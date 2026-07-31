'use client';

import { useEffect, useState } from 'react';
import { Network, RefreshCw, Zap, Activity, ArrowDownUp, Globe, MapPin, Clock } from 'lucide-react';

interface TunnelStatus {
  tunnelId: string;
  label: string;
  enabled: boolean;
  running: boolean;
  local: { host: string; port: number };
  public: { host: string; port: number } | null;
  online: boolean;
  latencyMs: number;
  lastCheckAt: number;
  lastError: string | null;
}

const TOKEN = 'hayenai-admin-2024';
const authHeaders = { Authorization: `Bearer ${TOKEN}` };

function fmtTime(ts: number) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

export default function PushTunnel() {
  const [tunnels, setTunnels] = useState<TunnelStatus[]>([]);
  const [rawConfig, setRawConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/push/tunnel-status', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setTunnels(data.tunnels || []);
      }
      const settingsRes = await fetch('/api/push/settings', { headers: authHeaders });
      if (settingsRes.ok) {
        const d = await settingsRes.json();
        if (d.settings?.tunnelWatchers) setRawConfig(d.settings.tunnelWatchers);
      }
    } catch {
      // 忽略错误
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, []);

  const handlePing = async (tunnelId: string) => {
    try {
      await fetch(`/api/push/tunnel-status/${tunnelId}/ping`, {
        method: 'POST',
        headers: authHeaders,
      });
      fetchAll();
    } catch {
      alert('探测失败');
    }
  };

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Network className="w-5 h-5" />
          内网穿透隧道
        </h2>
        <button
          onClick={fetchAll}
          className="p-2 rounded-lg bg-white/40 dark:bg-slate-800/50 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      {tunnels.length === 0 && loading && (
        <div className="flex items-center justify-center py-20">
          <div className="flex items-center gap-3 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin" />
            加载隧道状态...
          </div>
        </div>
      )}

      {tunnels.length === 0 && !loading && (
        <div className="p-6 rounded-2xl bg-amber-500/10 backdrop-blur-md border border-amber-500/30 text-amber-300 text-sm">
          当前无隧道状态数据。
        </div>
      )}

      {/* 隧道卡片 */}
      <div className="space-y-4">
        {tunnels.map((t) => (
          <div
            key={t.tunnelId}
            className="p-6 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/30 dark:border-white/10"
          >
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-lg font-bold text-slate-800 dark:text-white">
                    {t.label || t.tunnelId}
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-slate-200/50 dark:bg-slate-700/50 rounded text-slate-500 font-mono">
                    {t.tunnelId}
                  </span>
                  {t.online ? (
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full font-bold">
                      在线
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full font-bold">
                      离线
                    </span>
                  )}
                  {t.enabled && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded-full font-bold">
                      已启用
                    </span>
                  )}
                  {!t.enabled && (
                    <span className="text-xs px-2 py-0.5 bg-slate-500/20 text-slate-500 rounded-full">
                      已禁用
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handlePing(t.tunnelId)}
                className="px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors shrink-0"
              >
                <Zap className="w-3 h-3" />
                探测
              </button>
            </div>

            {/* 流向图：本地 → 公网 */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center mb-4">
              <div className="p-4 rounded-2xl bg-white/30 dark:bg-slate-900/30">
                <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                  <MapPin className="w-3 h-3" />
                  本地服务
                </div>
                <div className="font-mono text-sm text-slate-800 dark:text-white break-all">
                  {t.local.host}:{t.local.port}
                </div>
              </div>
              <div className="flex justify-center">
                <ArrowDownUp className="w-5 h-5 text-indigo-400" />
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-500/15 to-pink-500/15 border border-purple-500/20">
                <div className="flex items-center gap-2 text-xs text-purple-400 mb-1">
                  <Globe className="w-3 h-3" />
                  公网地址
                </div>
                <div className="font-mono text-sm text-slate-800 dark:text-white break-all">
                  {t.public ? `${t.public.host}:${t.public.port}` : '未映射'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="p-2 rounded-lg bg-white/20 dark:bg-slate-900/20">
                <div className="text-xs text-slate-500 mb-1">延迟</div>
                <div className="font-mono text-slate-800 dark:text-white">
                  {t.latencyMs}ms
                </div>
              </div>
              <div className="p-2 rounded-lg bg-white/20 dark:bg-slate-900/20">
                <div className="text-xs text-slate-500 mb-1">状态</div>
                <div className="text-slate-800 dark:text-white">
                  {t.running ? '运行中' : '已停止'}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-white/20 dark:bg-slate-900/20">
                <div className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  最后检查
                </div>
                <div className="text-xs text-slate-700 dark:text-slate-300">
                  {fmtTime(t.lastCheckAt)}
                </div>
              </div>
            </div>

            {t.lastError && (
              <div className="mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {t.lastError}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 原始配置（来自原推送服务端） */}
      {rawConfig && (
        <details className="p-4 rounded-2xl bg-white/30 dark:bg-slate-800/30 backdrop-blur-md border border-white/20 dark:border-white/5">
          <summary className="cursor-pointer text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            原始 tunnelWatchers 配置（来自原推送服务端 data/settings.json）
          </summary>
          <pre className="text-xs bg-slate-100 dark:bg-slate-900 p-4 rounded-xl overflow-auto max-h-96 mt-3">
            {JSON.stringify(rawConfig, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}