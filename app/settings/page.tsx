"use client";

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { broadcastConfigUpdate } from '../../lib/useSiteConfig';

const menuItems = [
  { id: 'profile', name: '个人名片设置', icon: '👤' },
  { id: 'background', name: '视觉背景配置', icon: '🌌' },
  { id: 'music', name: '音乐播放设置', icon: '🎵' },
  { id: 'posts', name: '文章管理', icon: '📝' },
  { id: 'announcement', name: '公告编辑', icon: '📢' },
  { id: 'projects', name: '项目管理', icon: '🚀' },
  { id: 'footer', name: '首页底部设置', icon: '🧩' },
  { id: 'danmaku', name: '全站弹幕设置', icon: '⚡' },
  { id: 'comment', name: '评论系统配置', icon: '💬' },
  { id: 'aicat', name: 'AI 煤球配置', icon: '🐾' },
];

const DEFAULT_CONFIG = {
  authorName: '', bio: '', title: '', navTitle: '', navSuffix: '', navAfter: '',
  avatarUrl: '', faviconUrl: '', bgImages: [], cloudMusicIds: [], danmakuList: [],
  buildDate: '', enableLevelSystem: false, friendLinkApplyFormat: '',
  icpConfig: { name: '', link: '' },
  footerBadges: [],
  social: { github: '', gitee: '', google: '', email: '', qq: '', wechat: '' },
  gitalkConfig: { clientID: '', clientSecret: '', repo: '', owner: '', admin: [''] },
  geminiConfig: { modelId: '', systemPrompt: '', maxOutputTokens: 150, temperature: 0.85 },
  pushServerUrl: 'http://localhost:23525',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('profile');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [formData, setFormData] = useState<any>(DEFAULT_CONFIG);

  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const merged = { ...DEFAULT_CONFIG, ...d.data };
          merged.social = { ...DEFAULT_CONFIG.social, ...(d.data.social || {}) };
          merged.icpConfig = { ...DEFAULT_CONFIG.icpConfig, ...(d.data.icpConfig || {}) };
          merged.gitalkConfig = { ...DEFAULT_CONFIG.gitalkConfig, ...(d.data.gitalkConfig || {}) };
          merged.geminiConfig = { ...DEFAULT_CONFIG.geminiConfig, ...(d.data.geminiConfig || {}) };
          merged.bgImages = Array.isArray(d.data.bgImages) ? d.data.bgImages : [];
          merged.cloudMusicIds = Array.isArray(d.data.cloudMusicIds) ? d.data.cloudMusicIds : [];
          merged.danmakuList = Array.isArray(d.data.danmakuList) ? d.data.danmakuList : [];
          merged.footerBadges = Array.isArray(d.data.footerBadges) ? d.data.footerBadges : [];
          setFormData(merged);
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const showToast = (msg: string, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleUpdate = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };
  const handleSocialUpdate = (p: string, v: string) => {
    setFormData((prev: any) => ({ ...prev, social: { ...prev.social, [p]: v } }));
  };
  const handleIcpUpdate = (k: string, v: string) => {
    setFormData((prev: any) => ({ ...prev, icpConfig: { ...prev.icpConfig, [k]: v } }));
  };
  const handleGitalkUpdate = (k: string, v: any) => {
    setFormData((prev: any) => ({ ...prev, gitalkConfig: { ...prev.gitalkConfig, [k]: v } }));
  };
  const handleGeminiUpdate = (k: string, v: any) => {
    setFormData((prev: any) => ({ ...prev, geminiConfig: { ...prev.geminiConfig, [k]: v } }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        // 广播事件 -> 所有 useSiteConfig 订阅者重新拉取，无需刷新页面
        broadcastConfigUpdate();
        showToast('OK', 'success');
      } else {
        showToast('❌ 保存失败: ' + (data.message || ''), 'error');
      }
    } catch {
      showToast('❌ 无法连接服务器', 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadFile = (accept: string, maxMB: number, onUrl: (url: string) => void, autoSave = true) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > maxMB * 1024 * 1024) {
        showToast(`文件不能超过 ${maxMB}MB`, 'error');
        return;
      }
      showToast('上传中...', 'success');
      const fd = new FormData();
      fd.append('file', file);
      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        const data = await res.json();
        if (data.success) {
          onUrl(data.url);
          showToast('✅ 上传成功', 'success');
          // 上传成功后立即保存 + 广播，让博客其他页面立即可见新文件
          if (autoSave) {
            setTimeout(() => { handleSave(); }, 100);
          }
        } else {
          showToast('❌ 上传失败: ' + (data.message || ''), 'error');
        }
      } catch {
        showToast('❌ 上传失败', 'error');
      }
    };
    input.click();
  };

  if (!loaded) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="min-h-screen relative pb-10">
      {/* Back button */}
      <div className="fixed top-20 left-4 z-40 md:left-8">
        <Link href="/" className="flex items-center gap-2 px-4 py-2 bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/30 dark:border-slate-700/30 rounded-2xl text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60 transition-all shadow-lg">
          <ArrowLeft size={16} />
          <span>返回首页</span>
        </Link>
      </div>

      <main className="w-[95%] max-w-7xl mx-auto mt-24 flex flex-col md:flex-row gap-8 items-start relative z-10">
        <div className="w-full md:w-72 shrink-0 flex flex-col gap-4">
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl border border-white/50 dark:border-slate-800/50 rounded-3xl p-4 shadow-xl">
            <p className="text-[10px] font-black text-slate-400 uppercase mb-4 ml-2 tracking-widest">系统管理维度</p>
            <nav className="flex flex-col gap-2">
              {menuItems.map(item => (
                <button key={item.id} onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 font-bold text-sm text-left ${
                    activeTab === item.id ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 translate-x-1' : 'text-slate-600 dark:text-slate-300 hover:bg-white/50 dark:hover:bg-slate-800/50'
                  }`}>
                  <span>{item.icon}</span>{item.name}
                </button>
              ))}
            </nav>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-indigo-500 text-white rounded-2xl text-sm font-black shadow-xl hover:bg-indigo-600 transition-all active:scale-95 disabled:opacity-50">
            {saving ? '保存中...' : '💾 保存配置（自动刷新）'}
          </button>
          <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-4">
            <p className="text-[10px] font-black text-green-600 dark:text-green-400">✨ 热更新</p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80 mt-1">保存后页面自动刷新，无需重新构建。</p>
          </div>
        </div>

        <div className="flex-1 w-full min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-2xl border border-white/50 dark:border-slate-800/50 rounded-[40px] p-8 shadow-2xl">
              {activeTab === 'profile' && <ProfileSection d={formData} h={handleUpdate} hs={handleSocialUpdate} upload={uploadFile} />}
              {activeTab === 'background' && <BackgroundSection d={formData} h={handleUpdate} upload={uploadFile} />}
              {activeTab === 'music' && <MusicSection d={formData} h={handleUpdate} />}
              {activeTab === 'footer' && <FooterSection d={formData} h={handleUpdate} hi={handleIcpUpdate} />}
              {activeTab === 'danmaku' && <DanmakuSection d={formData} h={handleUpdate} />}
              {activeTab === 'comment' && <CommentSection d={formData} hg={handleGitalkUpdate} />}
              {activeTab === 'aicat' && <AICatSection d={formData} hg={handleGeminiUpdate} />}
              {activeTab === 'announcement' && <AnnouncementSection />}
              {activeTab === 'projects' && <ProjectsSection />}
              {activeTab === 'posts' && <PostsSection />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {toast && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl ${
              toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ======================== Section Components ======================== */

function ProfileSection({ d, h, hs, upload }: any) {
  const s = d.social || {};
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">👤 个人名片设置</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Input label="网站总标题" value={d.title} onChange={v => h('title', v)} />
        <Input label="作者名称" value={d.authorName} onChange={v => h('authorName', v)} />
        <Input label="导航栏前缀" value={d.navTitle} onChange={v => h('navTitle', v)} />
        <Input label="连接符" value={d.navSuffix} onChange={v => h('navSuffix', v)} />
        <Input label="尾部文字" value={d.navAfter} onChange={v => h('navAfter', v)} />
        <div className="col-span-1 md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">头像</label>
          <div className="flex items-center gap-3 mt-1">
            <input value={d.avatarUrl || ''} onChange={e => h('avatarUrl', e.target.value)}
              className="flex-1 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <button onClick={() => upload('image/*', 50, (url: string) => h('avatarUrl', url))}
      // 头像限制 5MB→50MB, 用户反馈太严
              className="px-4 py-2.5 bg-indigo-500 text-white rounded-xl text-xs font-black whitespace-nowrap">📁 本地上传</button>
          </div>
          {d.avatarUrl && <img src={d.avatarUrl} className="mt-2 w-16 h-16 rounded-xl object-cover border-2 border-white/50" />}
        </div>
        <Input label="Favicon URL" value={d.faviconUrl} onChange={v => h('faviconUrl', v)} full />
        <div className="col-span-1 md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">个人简介</label>
          <textarea rows={3} value={d.bio || ''} onChange={e => h('bio', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
          <div className="mt-2">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">简介文本样式</label>
            <select value={d.bioStyle || 'plain'} onChange={e => h('bioStyle', e.target.value)}
              className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500">
              <option value="plain">默认（继承色）</option>
              <option value="gradient-purple">渐变紫粉</option>
              <option value="gradient-cyan">渐变青蓝</option>
              <option value="glow-pink">腮红粉辉光</option>
              <option value="neon-amber">霓虹蜜橙</option>
              <option value="rainbow">彩虹色</option>
              <option value="custom">自定义渐变</option>
            </select>
            {d.bioStyle === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input type="color" value={d.bioColorFrom || '#a78bfa'} onChange={e => h('bioColorFrom', e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer" />
                <input type="color" value={d.bioColorTo || '#ec4899'} onChange={e => h('bioColorTo', e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer" />
                <div className="flex-1 p-2 rounded-lg text-sm font-bold" style={{ backgroundImage: `linear-gradient(135deg, ${d.bioColorFrom || '#a78bfa'}, ${d.bioColorTo || '#ec4899'})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{d.bio || '预览文本'}</div>
              </div>
            )}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block">🔗 社交媒体</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {['github','gitee','google','email','qq','wechat'].map(p => (
              <div key={p}>
                <label className="text-[10px] font-bold text-slate-500 uppercase">{p}</label>
                <input value={s[p] || ''} onChange={e => hs(p, e.target.value)}
                  className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm mt-0.5 outline-none focus:ring-2 focus:ring-indigo-500" />
              </div>
            ))}
          </div>
        </div>

        <div className="col-span-1 md:col-span-2 pt-3 border-t border-slate-200/50 dark:border-slate-700/50">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block">⚙️ 功能开关</label>
          <div className="flex items-center justify-between p-3 bg-white/50 dark:bg-slate-800/50 rounded-xl">
            <div><span className="text-sm font-bold">RPG 等级系统</span><br/><span className="text-[10px] text-slate-500">开启全图鉴成就徽章与经验值展示</span></div>
            <div onClick={() => h('enableLevelSystem', !d.enableLevelSystem)}
              className={`w-11 h-6 rounded-full transition-colors cursor-pointer ${d.enableLevelSystem ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${d.enableLevelSystem ? 'translate-x-5' : 'translate-x-0'}`} />
            </div>
          </div>
        </div>

        <div className="col-span-1 md:col-span-2">
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">友链申请模板</label>
          <textarea rows={3} value={d.friendLinkApplyFormat || ''} onChange={e => h('friendLinkApplyFormat', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
      </div>
    </div>
  );
}

function BackgroundSection({ d, h, upload }: any) {
  const bg = d.bgImages || [];
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">🌌 视觉背景配置</h2>
      <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">当前 {bg.length} 张背景图</p>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 auto-rows-fr">
        {bg.map((url: string, i: number) => (
          <div key={i} className="relative rounded-xl overflow-hidden aspect-video group bg-slate-200/40 dark:bg-slate-800/40 min-h-[110px]">
            {url.match(/\.(mp4|webm|ogg)$/i) ? (
              <video src={url + '#t=0.5'} className="w-full h-full object-cover" muted loop autoPlay playsInline preload="metadata" />
            ) : (
              <img src={url} alt={`bg-${i}`} loading="lazy" className="w-full h-full object-cover" />
            )}
            <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-[10px] text-white/80 font-mono truncate max-w-[90%]">{url.split('/').pop()}</span>
            </div>
            <button onClick={() => h('bgImages', bg.filter((_: any, j: number) => j !== i))}
              className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        <input id="bg-url-input" type="text" placeholder="输入图片/视频 URL 或使用本地上传..."
          className="flex-1 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { h('bgImages', [...bg, v]); (e.target as HTMLInputElement).value = ''; handleSave(); }}}} />
        <button onClick={() => { const el = document.getElementById('bg-url-input') as HTMLInputElement; const v = el?.value?.trim(); if (v) { h('bgImages', [...bg, v]); el.value = ''; handleSave(); }}}
          className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black">+ 添加</button>
        <button onClick={() => upload('image/*,video/*', 200, (url: string) => h('bgImages', [...bg, url]), true)}
          className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black">📁 上传本地</button>
      </div>

      {/* 轮播控制 */}
      <div className="space-y-4 bg-white/30 dark:bg-slate-800/30 rounded-2xl p-4 border border-white/20">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">背景轮播</label>
          <button onClick={() => h('bgToggle', d.bgToggle === false ? true : false)}
            className={`relative w-12 h-6 rounded-full transition-all ${d.bgToggle !== false ? 'bg-indigo-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${d.bgToggle !== false ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">轮播间隔: {(d.bgInterval || 10000) / 1000}秒</label>
          <input type="range" min="3000" max="60000" step="1000" value={d.bgInterval || 10000}
            onChange={e => h('bgInterval', Number(e.target.value))}
            className="w-full mt-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">背景模糊度: {d.bgBlur || 0}px</label>
          <input type="range" min="0" max="30" step="1" value={d.bgBlur || 0}
            onChange={e => h('bgBlur', Number(e.target.value))}
            className="w-full mt-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">背景暗度: {Math.round((d.bgDim || 0) * 100)}%</label>
          <input type="range" min="0" max="0.8" step="0.05" value={d.bgDim || 0}
            onChange={e => h('bgDim', Number(e.target.value))}
            className="w-full mt-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700" />
        </div>
        <p className="text-[10px] text-slate-400">提示：支持 mp4/webm 视频背景，点击背景图可手动切换</p>
      </div>
    </div>
  );
}

function MusicSection({ d, h }: any) {
  const ids = d.cloudMusicIds || [];
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">🎵 音乐播放设置</h2>
      <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">网易云歌单 ID ({ids.length} 首)</p>
      <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
        {ids.map((id: string, i: number) => (
          <div key={i} className="flex justify-between items-center p-3 bg-white/40 dark:bg-slate-800/40 rounded-2xl border border-white/20">
            <span className="text-sm font-mono text-pink-500">#{id}</span>
            <button onClick={() => h('cloudMusicIds', ids.filter((_: any, j: number) => j !== i))} className="text-red-400 hover:text-red-600 font-bold text-xs">✕</button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-6">
        <input id="music-id-input" type="text" placeholder="输入网易云 ID..."
          className="flex-1 bg-white/50 dark:bg-slate-800/50 border rounded-xl px-4 py-2.5 text-sm outline-none"
          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v) { h('cloudMusicIds', [...ids, v]); (e.target as HTMLInputElement).value = ''; }}}} />
        <button onClick={() => { const el = document.getElementById('music-id-input') as HTMLInputElement; if (el?.value) { h('cloudMusicIds', [...ids, el.value]); el.value = ''; }}}
          className="px-4 py-2 bg-pink-500 text-white rounded-xl text-xs font-black">+ 添加</button>
      </div>

      {/* 音乐播放控制 */}
      <div className="space-y-4 bg-white/30 dark:bg-slate-800/30 rounded-2xl p-4 border border-white/20">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">进入博客自动播放</label>
          <button onClick={() => h('musicAutoPlay', d.musicAutoPlay === false ? true : false)}
            className={`relative w-12 h-6 rounded-full transition-all ${d.musicAutoPlay !== false ? 'bg-pink-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${d.musicAutoPlay !== false ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">默认音量: {Math.round((d.musicVolume ?? 1) * 100)}%</label>
          <input type="range" min="0" max="1" step="0.01" value={d.musicVolume ?? 1}
            onChange={e => h('musicVolume', Number(e.target.value))}
            className="w-full mt-1 h-2 rounded-full appearance-none cursor-pointer bg-slate-200 dark:bg-slate-700" />
        </div>
        <div>
          <label className="text-sm font-bold text-slate-700 dark:text-slate-200">播放模式</label>
          <div className="flex gap-2 mt-2">
            {[['loop', '🔁 列表循环'], ['single', '🔂 单曲循环'], ['random', '🔀 随机播放']].map(([val, label]) => (
              <button key={val} onClick={() => h('musicPlayMode', val)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${d.musicPlayMode === val ? 'bg-pink-500 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>{label}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FooterSection({ d, h, hi }: any) {
  const badges = d.footerBadges || [];
  const icp = d.icpConfig || { name: '', link: '' };
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">🧩 首页底部设置</h2>
      <div className="space-y-6">
        <Input label="建站日期" value={d.buildDate} onChange={v => h('buildDate', v)} type="datetime-local" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="ICP 备案名" value={icp.name} onChange={v => hi('name', v)} />
          <Input label="ICP 跳转链接" value={icp.link} onChange={v => hi('link', v)} />
        </div>
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">技术栈徽章 ({badges.length})</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {badges.map((b: any, i: number) => (
              <span key={i} className="px-3 py-1 bg-white/50 dark:bg-slate-700/50 rounded-lg text-xs font-bold flex items-center gap-1.5 group">
                <span className={b.color || 'text-indigo-500'}>⬟</span>{b.name}
                <button onClick={() => h('footerBadges', badges.filter((_: any, j: number) => j !== i))} className="ml-1 text-red-400 opacity-0 group-hover:opacity-100">✕</button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input id="badge-input" type="text" placeholder="徽章名称"
              className="flex-1 bg-white/50 dark:bg-slate-800/50 border rounded-xl px-3 py-2 text-sm outline-none"
              onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v) { h('footerBadges', [...badges, { name: v, color: 'text-indigo-500', svg: '' }]); (e.target as HTMLInputElement).value = ''; }}}} />
            <button onClick={() => { const el = document.getElementById('badge-input') as HTMLInputElement; if (el?.value) { h('footerBadges', [...badges, { name: el.value, color: 'text-indigo-500', svg: '' }]); el.value = ''; }}}
              className="px-4 py-2 bg-cyan-500 text-white rounded-xl text-xs font-black">+ 添加</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DanmakuSection({ d, h }: any) {
  const list = d.danmakuList || [];
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">⚡ 全站弹幕设置</h2>
      <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">弹幕池 ({list.length} 条)</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {list.map((text: string, i: number) => (
          <span key={i} className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-bold flex items-center gap-1 group">
            {text}
            <button onClick={() => h('danmakuList', list.filter((_: any, j: number) => j !== i))} className="ml-1 opacity-0 group-hover:opacity-100 text-red-500">✕</button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input id="danmaku-input" type="text" placeholder="输入弹幕内容..."
          className="flex-1 bg-white/50 dark:bg-slate-800/50 border rounded-xl px-4 py-2.5 text-sm outline-none"
          onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v) { h('danmakuList', [...list, v]); (e.target as HTMLInputElement).value = ''; }}}} />
        <button onClick={() => { const el = document.getElementById('danmaku-input') as HTMLInputElement; if (el?.value) { h('danmakuList', [...list, el.value]); el.value = ''; }}}
          className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-xs font-black">+ 添加</button>
      </div>
    </div>
  );
}

function CommentSection({ d, hg }: any) {
  const g = d.gitalkConfig || { clientID: '', clientSecret: '', repo: '', owner: '', admin: [] };
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">💬 评论系统 (Gitalk) 配置</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Client ID" value={g.clientID} onChange={v => hg('clientID', v)} />
        <Input label="Client Secret" value={g.clientSecret} onChange={v => hg('clientSecret', v)} type="password" />
        <Input label="GitHub Repo" value={g.repo} onChange={v => hg('repo', v)} />
        <Input label="GitHub Owner" value={g.owner} onChange={v => hg('owner', v)} />
      </div>
    </div>
  );
}

function AICatSection({ d, hg }: any) {
  const g = d.geminiConfig || { modelId: '', systemPrompt: '', maxOutputTokens: 150, temperature: 0.85 };
  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">🐾 AI 煤球配置</h2>
      <div className="space-y-4">
        <Input label="模型 ID" value={g.modelId} onChange={v => hg('modelId', v)} />
        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">System Prompt</label>
          <textarea rows={5} value={g.systemPrompt || ''} onChange={e => hg('systemPrompt', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="最大输出 Token" value={String(g.maxOutputTokens)} onChange={v => hg('maxOutputTokens', Number(v) || 150)} type="number" />
          <Input label="Temperature" value={String(g.temperature)} onChange={v => hg('temperature', parseFloat(v) || 0.85)} type="number" />
        </div>
      </div>
    </div>
  );
}

function Input({ label, value, onChange, type, full }: any) {
  const span = full ? 'col-span-1 md:col-span-2' : '';
  return (
    <div className={span}>
      <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{label}</label>
      <input type={type || 'text'} value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500" />
    </div>
  );
}

function AnnouncementSection() {
  const [data, setData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const res = await fetch('/api/announcements', { cache: 'no-store' });
      const j = await res.json();
      setData(j);
    } catch {}
  };

  useEffect(() => { load(); }, []);

  const update = (k: string, v: any) => setData((prev: any) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('✅ 已保存，刷新 /announcements 查看效果');
        setData(j.announcement);
      } else {
        setMsg('❌ 保存失败：' + (j.error || '未知错误'));
      }
    } catch (e: any) {
      setMsg('❌ 网络错误：' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  if (!data) return <div className="text-slate-400 animate-pulse">加载中...</div>;

  const styles = [
    { id: 'plain', label: '默认色' },
    { id: 'gradient-purple', label: '紫粉渐变' },
    { id: 'gradient-cyan', label: '青蓝渐变' },
    { id: 'glow-pink', label: '粉色辉光' },
    { id: 'neon-amber', label: '霓虹蜜橙' },
    { id: 'rainbow', label: '彩虹色' },
    { id: 'custom', label: '自定义渐变' },
  ];

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">📢 公告编辑</h2>
      <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">访问 <a href="/announcements" className="text-indigo-500 underline">/announcements</a> 查看效果</p>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-white/30 dark:bg-slate-800/30 rounded-2xl border border-white/20">
          <span className="text-sm font-bold">启用公告</span>
          <button onClick={() => update('enabled', !data.enabled)}
            className={`relative w-12 h-6 rounded-full transition-all ${data.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${data.enabled ? 'left-6' : 'left-0.5'}`} />
          </button>
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">公告内容</label>
          <textarea rows={8} value={data.content || ''} onChange={e => update('content', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono" />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">链接（可选）</label>
          <input value={data.link || ''} onChange={e => update('link', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>

        <div>
          <label className="text-[10px] font-black text-slate-400 uppercase ml-1">文本样式</label>
          <select value={data.style || 'plain'} onChange={e => update('style', e.target.value)}
            className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm mt-1 outline-none focus:ring-2 focus:ring-indigo-500">
            {styles.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          {data.style === 'custom' && (
            <div className="flex gap-2 mt-2 items-center">
              <label className="text-xs font-bold">起始色</label>
              <input type="color" value={data.colorFrom || '#a78bfa'} onChange={e => update('colorFrom', e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer" />
              <label className="text-xs font-bold">结束色</label>
              <input type="color" value={data.colorTo || '#ec4899'} onChange={e => update('colorTo', e.target.value)} className="w-12 h-10 rounded-lg cursor-pointer" />
            </div>
          )}
        </div>

        {/* 定时发布 */}
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold flex items-center gap-2">⏰ 定时发布</span>
            <button onClick={() => update('scheduledEnabled', !data.scheduledEnabled)}
              className={`relative w-12 h-6 rounded-full transition-all ${data.scheduledEnabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
              <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all ${data.scheduledEnabled ? 'left-6' : 'left-0.5'}`} />
            </button>
          </div>
          {data.scheduledEnabled && (
            <div>
              <label className="text-[10px] font-bold text-slate-500">公告将在以下时间之前不展示</label>
              <input type="datetime-local" value={data.scheduledAt ? data.scheduledAt.slice(0, 16) : ''}
                onChange={e => update('scheduledAt', e.target.value ? new Date(e.target.value).toISOString() : null)}
                className="w-full mt-1 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500" />
            </div>
          )}
          <p className="text-[10px] text-slate-500">提示：开启后，未到指定时间不显示公告（但已保存）。</p>
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3 bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">
          {saving ? '保存中...' : '💾 保存公告'}
        </button>
        <button
            onClick={async () => {
              if (!confirm('确定清空当前公告？\n点击 OK 后内容将被清空，公告状态将被禁用。')) return;
              setSaving(true);
              try {
                const res = await fetch('/api/announcements', { method: 'DELETE' });
                const j = await res.json();
                if (j.ok) {
                  setData(j.announcement);
                  setMsg('🗑️ 公告已清空');
                } else {
                  setMsg('❌ 清空失败：' + (j.error || '未知错误'));
                }
              } catch (e: any) {
                setMsg('❌ 网络错误：' + e.message);
              } finally {
                setSaving(false);
                setTimeout(() => setMsg(''), 4000);
              }
            }}
            className="px-6 py-3 bg-red-500/20 text-red-600 dark:text-red-300 border border-red-500/30 rounded-2xl font-black hover:bg-red-500/30"
            title="清空公告（禁用并清空内容）"
          >
            🗑️ 清空
          </button>
        {msg && <div className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">{msg}</div>}
      </div>
    </div>
  );
}

function ProjectsSection() {
  const [list, setList] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    fetch('/api/projects')
      .then(r => r.json())
      .then(d => { if (d?.projects) setList(d.projects); })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const addProj = () => {
    setList(prev => [...prev, { id: 'proj_' + Date.now(), name: '', description: '', icon: '🚀', githubUrl: '', tags: [] }]);
  };

  const update = (idx: number, key: string, val: any) => {
    setList(prev => prev.map((p, i) => i === idx ? { ...p, [key]: val } : p));
  };

  const updateTags = (idx: number, raw: string) => {
    const tags = raw.split(/[,，]/).map(t => t.trim()).filter(Boolean);
    setList(prev => prev.map((p, i) => i === idx ? { ...p, tags } : p));
  };

  const remove = (idx: number) => {
    setList(prev => prev.filter((_, i) => i !== idx));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projects: list }),
      });
      const j = await res.json();
      if (j.ok) {
        setMsg('✅ 已保存，刷新 /projects 查看效果');
      } else {
        setMsg('❌ 保存失败：' + (j.error || '未知错误'));
      }
    } catch (e: any) {
      setMsg('❌ 网络错误：' + e.message);
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-black text-slate-800 dark:text-white mb-6">🚀 项目管理</h2>
      <p className="text-[10px] font-bold text-slate-400 mb-4 uppercase">访问 <a href="/projects" className="text-indigo-500 underline">/projects</a> 查看效果</p>

      <div className="space-y-4">
        {list.map((p, i) => (
          <div key={p.id} className="p-4 bg-white/30 dark:bg-slate-800/30 rounded-2xl border border-white/20 space-y-3">
            <div className="flex gap-2 items-center">
              <input value={p.icon || ''} onChange={e => update(i, 'icon', e.target.value)} placeholder="图标 emoji" className="w-20 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-center text-2xl" />
              <input value={p.name || ''} onChange={e => update(i, 'name', e.target.value)} placeholder="项目名称" className="flex-1 bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500" />
              <button onClick={() => remove(i)} className="px-3 py-2 bg-red-500 text-white rounded-xl text-xs font-black">✕</button>
            </div>
            <textarea rows={2} value={p.description || ''} onChange={e => update(i, 'description', e.target.value)} placeholder="项目描述" className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
            <input value={p.githubUrl || ''} onChange={e => update(i, 'githubUrl', e.target.value)} placeholder="GitHub URL" className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
            <input value={(p.tags || []).join(',')} onChange={e => updateTags(i, e.target.value)} placeholder="标签（逗号分隔）" className="w-full bg-white/50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
        ))}
        <button onClick={addProj} className="w-full py-3 bg-slate-200/50 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 rounded-2xl font-black border border-dashed border-slate-300 dark:border-slate-600">+ 添加项目</button>
        <button onClick={save} disabled={saving} className="w-full py-3 bg-gradient-to-r from-pink-500 to-indigo-500 text-white rounded-2xl font-black shadow-lg disabled:opacity-50">{saving ? '保存中...' : '💾 保存所有项目'}</button>
        {msg && <div className="text-center text-sm font-bold text-slate-600 dark:text-slate-300">{msg}</div>}
      </div>
    </div>
  );
}