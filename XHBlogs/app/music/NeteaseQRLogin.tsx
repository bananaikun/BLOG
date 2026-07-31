"use client";

import { useEffect, useRef, useState } from 'react';
import { QrCode, LogIn, LogOut, Shield, Check, AlertCircle, RefreshCcw } from 'lucide-react';

type LoginStatus = 'idle' | 'loading' | 'ready' | 'waiting' | 'confirm' | 'expired' | 'success' | 'logged-in';

interface UserInfo {
  userId: number;
  nickname: string;
  avatarUrl?: string;
  vipType: number;
  vipLevel?: number;
}

const STATUS_TEXT: Record<LoginStatus, string> = {
  idle: '点击扫码登录网易云',
  loading: '正在生成二维码...',
  ready: '请使用网易云音乐 APP 扫码',
  waiting: '等待扫码...',
  confirm: '已扫码，请在 APP 中点确认',
  expired: '二维码已过期，正在刷新...',
  success: '登录成功！',
  'logged-in': '已登录',
};

export default function NeteaseQRLogin() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<LoginStatus>('idle');
  const [qrImg, setQrImg] = useState<string>('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const unikeyRef = useRef<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const attemptsRef = useRef(0);

  // 启动时检查现有 cookie
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem('netease_cookie');
    if (saved) {
      checkStatus(saved);
    }
    // 监听 storage 同步（多 tab 登录）
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'netease_cookie' && e.newValue) checkStatus(e.newValue);
      else if (e.key === 'netease_cookie' && !e.newValue) {
        setUserInfo(null);
        setStatus('idle');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, []);

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  const checkStatus = async (cookie: string) => {
    try {
      const res = await fetch(`/api/login/status?cookie=${encodeURIComponent(cookie)}`);
      const data = await res.json();
      if (data?.data?.profile) {
        setUserInfo({
          userId: data.data.profile.userId,
          nickname: data.data.profile.nickname,
          avatarUrl: data.data.profile.avatarUrl,
          vipType: data.data.vipInfo?.vipType || data.data.account?.vipType || 0,
          vipLevel: data.data.vipInfo?.vipLevel || data.data.account?.vipLevel || 0,
        });
        setStatus('logged-in');
        // 后端 login_refresh 续命成功会返回 newCookie, 主动更新 localStorage
        if (data.data?.newCookie && typeof data.data.newCookie === 'string' && data.data.newCookie !== cookie) {
          try {
            localStorage.setItem('netease_cookie', data.data.newCookie);
            window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie: data.data.newCookie } }));
          } catch {}
        }
      } else {
        // 验证失败: 可能是网络波动或 API 临时异常, 不立即清除 cookie
        // 重试 2 次 (间隔 2s), 成功就保留; 全部失败也保留 cookie (避免误删导致重新登录)
        // 真正失效由后端 login_refresh 兜底, 或用户主动点退出登录
        setTimeout(async () => {
          for (let i = 0; i < 2; i++) {
            try {
              const retry = await fetch(`/api/login/status?cookie=${encodeURIComponent(cookie)}`);
              const retryData = await retry.json();
              if (retryData?.data?.profile) {
                setUserInfo({
                  userId: retryData.data.profile.userId,
                  nickname: retryData.data.profile.nickname,
                  avatarUrl: retryData.data.profile.avatarUrl,
                  vipType: retryData.data.vipInfo?.vipType || retryData.data.account?.vipType || 0,
                  vipLevel: retryData.data.vipInfo?.vipLevel || retryData.data.account?.vipLevel || 0,
                });
                setStatus('logged-in');
                // 重试拿到新 cookie 也更新
                if (retryData.data?.newCookie && typeof retryData.data.newCookie === 'string' && retryData.data.newCookie !== cookie) {
                  try {
                    localStorage.setItem('netease_cookie', retryData.data.newCookie);
                    window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie: retryData.data.newCookie } }));
                  } catch {}
                }
                return; // 重试成功, 保留 cookie
              }
            } catch {}
            if (i < 1) await new Promise((r) => setTimeout(r, 2000));
          }
          // 重试都失败 → 不清除 cookie, 仅显示未登录 (用户可重新扫码覆盖)
          // 这样即使 /api/login/status 误判, cookie 仍在, 下次启动还能再试
          setUserInfo(null);
          setStatus('idle');
        }, 2000);
      }
    } catch {
      // 网络错误: 不清除 cookie, 保留登录态 (下次再验证)
      // 不修改 status, 避免闪烁
    }
  };

  const startLogin = async () => {
    stopPolling();
    setStatus('loading');
    setErrorMsg('');
    setOpen(true);

    try {
      // 1. 获取 unikey
      const keyRes = await fetch('/api/login/qr/key', { method: 'POST' });
      const keyData = await keyRes.json();
      if (!keyData.unikey) {
        setErrorMsg('获取二维码失败，请稍后重试');
        setStatus('expired');
        return;
      }
      unikeyRef.current = keyData.unikey;

      // 2. 生成二维码
      const qrRes = await fetch(`/api/login/qr/create?key=${keyData.unikey}&qrimg=true`);
      const qrData = await qrRes.json();
      // qrImg: data.data.qrimg 或 data.qrimg
      const qrImgData = qrData?.data?.qrimg || qrData?.qrimg;
      if (qrImgData) {
        setQrImg(qrImgData);
        setStatus('ready');
        startPolling();
      } else {
        setErrorMsg('二维码生成失败');
        setStatus('expired');
      }
    } catch (e: any) {
      setErrorMsg(e.message || '网络错误');
      setStatus('expired');
    }
  };

  const startPolling = () => {
    attemptsRef.current = 0;
    stopPolling();
    pollingRef.current = setInterval(async () => {
      attemptsRef.current++;
      const key = unikeyRef.current;
      if (!key) return;

      // 60 次（约 3 分钟）超时后自动刷新
      if (attemptsRef.current > 60) {
        stopPolling();
        setStatus('expired');
        setTimeout(() => startLogin(), 1000);
        return;
      }

      try {
        const res = await fetch(`/api/login/qr/check?key=${encodeURIComponent(key)}`);
        const data = await res.json();
        const code = data.code ?? data.status;
        switch (code) {
          case 801:
            setStatus('waiting');
            break;
          case 802:
            setStatus('confirm');
            break;
          case 800:
            stopPolling();
            setStatus('expired');
            setTimeout(() => startLogin(), 1200);
            break;
          case 803: {
            stopPolling();
            // 803 网易云 v3 接口实际返回的 cookie 字段
            const cookie = data.cookie || data.data?.cookie || data.body?.cookie;
            if (cookie) {
              localStorage.setItem('netease_cookie', cookie);
              // 派发事件给 MusicProvider
              window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie } }));
              setStatus('success');
              await checkStatus(cookie);
              setTimeout(() => setOpen(false), 1200);
            } else {
              setStatus('success');
              setTimeout(() => checkStatus(localStorage.getItem('netease_cookie') || ''), 800);
            }
            break;
          }
        }
      } catch {
        // 单次失败容错
      }
    }, 3000);
  };

  const logout = () => {
    localStorage.removeItem('netease_cookie');
    setUserInfo(null);
    setStatus('idle');
    setOpen(false);
    stopPolling();
    window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie: '' } }));
  };

  const isLoggedIn = status === 'logged-in' || status === 'success';

  return (
    <div className="relative">
      {/* 触发按钮 */}
      {userInfo ? (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/30 dark:bg-slate-900/50 backdrop-blur-md border border-white/40 dark:border-white/10">
          <img
            src={userInfo.avatarUrl}
            alt=""
            className="w-6 h-6 rounded-full"
          />
          <span className="text-xs font-black text-slate-700 dark:text-slate-200 max-w-[120px] truncate">
            {userInfo.nickname}
          </span>
          {userInfo.vipType > 0 ? (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm flex items-center gap-0.5">
              <Shield size={9} />VIP{userInfo.vipLevel || ''}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
              非会员
            </span>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="text-slate-500 hover:text-indigo-500 transition-colors text-[11px] font-bold"
          >
            详情
          </button>
          <button
            onClick={logout}
            className="text-slate-500 hover:text-red-500 transition-colors"
            title="退出登录"
          >
            <LogOut size={13} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            setOpen(true);
            if (status === 'idle' || status === 'expired') startLogin();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-black transition-colors shadow-md shadow-pink-500/30"
        >
          <LogIn size={13} />
          登录网易云
        </button>
      )}

      {/* 弹窗 */}
      {open && (
        <div
          className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl bg-white/95 dark:bg-slate-800/95 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                <QrCode className="text-pink-500" size={20} />
                网易云扫码登录
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            {userInfo ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <img src={userInfo.avatarUrl} alt="" className="w-16 h-16 rounded-full border-2 border-white shadow-md" />
                <div className="font-black text-lg text-slate-800 dark:text-white">
                  {userInfo.nickname}
                </div>
                {userInfo.vipType > 0 ? (
                  <div className="px-2 py-1 rounded-full text-[10px] font-black bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm flex items-center gap-1">
                    <Shield size={11} /> VIP{userInfo.vipLevel || ''} 已激活
                  </div>
                ) : (
                  <div className="px-2 py-1 rounded-full text-[10px] font-black bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                    普通账号 — 会员歌曲受限
                  </div>
                )}
                <button
                  onClick={logout}
                  className="mt-3 px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white font-bold text-sm shadow-md flex items-center gap-2 transition-colors"
                >
                  <LogOut size={14} /> 退出登录
                </button>
              </div>
            ) : (
              <>
                <div className="relative mx-auto w-48 h-48 rounded-2xl bg-white border-2 border-white/30 shadow-inner flex items-center justify-center overflow-hidden">
                  {qrImg ? (
                    <img src={qrImg} alt="QR" className="w-full h-full object-contain" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      {status === 'loading' || status === 'expired' ? (
                        <RefreshCcw className="animate-spin text-pink-400" size={32} />
                      ) : (
                        <QrCode className="text-slate-300" size={64} />
                      )}
                    </div>
                  )}
                </div>

                <p className="mt-4 text-center text-sm text-slate-700 dark:text-slate-200 font-bold">
                  {STATUS_TEXT[status]}
                </p>

                {errorMsg && (
                  <p className="mt-2 text-center text-xs text-red-500 font-medium">
                    {errorMsg}
                  </p>
                )}

                <p className="mt-3 text-center text-[10px] text-slate-400 font-medium leading-relaxed">
                  打开网易云音乐 APP → 右上角扫一扫
                  <br />
                  登录后可播放会员歌曲 · Cookie 保存在本地
                </p>

                <button
                  onClick={startLogin}
                  className="mt-4 w-full py-2 rounded-full bg-white/40 dark:bg-slate-700/40 border border-white/50 dark:border-white/10 text-slate-700 dark:text-slate-200 text-xs font-black hover:bg-white/60 dark:hover:bg-slate-700/60 flex items-center justify-center gap-2"
                >
                  <RefreshCcw size={12} /> 刷新二维码
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
