'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import PushVersions from './components/PushVersions';
import PushNewVersion from './components/PushNewVersion';
import PushMCMonitor from './components/PushMCMonitor';
import PushTunnel from './components/PushTunnel';
import PushChangelog from './components/PushChangelog';

const tabs = [
  { id: 'versions', label: '版本管理' },
  { id: 'push', label: '推送新版本' },
  { id: 'mcmonitor', label: 'MC 监控' },
  { id: 'tunnelmonitor', label: '内网穿透' },
  { id: 'changelog', label: '更新日志' },
];

function PushPanelContent() {
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState('versions');

  useEffect(() => {
    const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : '';
    if (hash && tabs.find((t) => t.id === hash)) {
      setActiveTab(hash);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (hash && tabs.find((t) => t.id === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const onTabClick = (id: string) => {
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      history.replaceState(null, '', `#${id}`);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'versions':
        return <PushVersions />;
      case 'push':
        return <PushNewVersion />;
      case 'mcmonitor':
        return <PushMCMonitor />;
      case 'tunnelmonitor':
        return <PushTunnel />;
      case 'changelog':
        return <PushChangelog />;
      default:
        return <PushVersions />;
    }
  };

  return (
    <div className="min-h-screen relative pb-20">
      <Navbar />
      <PageTransition>
        <div className="mt-28 max-w-7xl mx-auto px-4">
          {/* 标题区 - 复用 /download 风格的渐变标题 */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-black mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              推送管理控制台
            </h1>
            <p className="text-gray-400 text-base">
              5 个模块 · 继承自原 UpdateHub WebUI · 数据已迁移
            </p>
          </div>

          {/* 返回博客按钮 */}
          <div className="mb-6 flex items-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/30 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-700/80 transition-all text-sm font-bold shadow-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              返回博客
            </Link>
          </div>

          {/* 隐藏的标签选择 - 不显示在 UI 上，通过 URL hash 切换 */}
          <div className="hidden">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabClick(tab.id)}
                data-tab={tab.id}
              />
            ))}
          </div>

          {/* 内容 */}
          <div className="mt-6">{renderContent()}</div>
        </div>
      </PageTransition>
    </div>
  );
}

export default function PushPanelPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen pt-28 max-w-7xl mx-auto px-4">
          <div className="text-slate-400 font-bold animate-pulse">加载中...</div>
        </div>
      }
    >
      <PushPanelContent />
    </Suspense>
  );
}