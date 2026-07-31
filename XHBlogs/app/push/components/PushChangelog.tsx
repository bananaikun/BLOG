'use client';

import { useEffect, useState } from 'react';
import { History, Calendar, Tag, RefreshCw, Filter } from 'lucide-react';

interface ChangelogEntry {
  version: string;
  versionCode: number;
  date: string | null;
  title: string;
  changelog: string;
  category: string;
  isActive: boolean;
  isEarly: boolean;
  source: string;
}

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  app: { label: 'APP', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  server: { label: 'SERVER', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  web: { label: 'WEB', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
  tool: { label: 'TOOL', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
};

const TOKEN = 'hayenai-admin-2024';

export default function PushChangelog() {
  const [items, setItems] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'app' | 'server' | 'web'>('all');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/push/changelog');
      if (res.ok) {
        const data = await res.json();
        setItems(data.changelog || []);
        setError('');
      } else {
        setError(`HTTP ${res.status}`);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          加载更新日志...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-400">
        加载失败：{error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <History className="w-5 h-5" />
          更新日志
        </h2>
        <button
          onClick={fetchData}
          className="p-2 rounded-lg bg-white/40 dark:bg-slate-800/50 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </button>
      </div>

      {/* 过滤器 */}
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="w-4 h-4 text-slate-400" />
        {[
          { id: 'all', label: '全部' },
          { id: 'app', label: 'APP' },
          { id: 'server', label: 'SERVER' },
          { id: 'web', label: 'WEB' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.id
                ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40'
                : 'bg-white/30 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border border-white/20 dark:border-white/5 hover:bg-white/50'
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-500 dark:text-slate-400">
          共 {filtered.length} 条
        </span>
      </div>

      {/* 列表 */}
      <div className="space-y-2">
        {filtered.map((item, idx) => {
          const cat = CATEGORY_LABEL[item.category] || { label: item.category || '?', color: 'bg-slate-500/20 text-slate-400 border-slate-500/30' };
          const isExpanded = expanded === idx;
          const text = item.changelog || item.title || '(无内容)';
          return (
            <div
              key={`${item.versionCode}-${idx}`}
              className="p-4 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/30 dark:border-white/10 hover:border-purple-500/30 transition-all"
            >
              <div className="flex items-start gap-3">
                <div className="shrink-0">
                  <span className={`inline-block px-2 py-0.5 text-xs font-bold rounded-md border ${cat.color}`}>
                    {cat.label}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-base font-bold text-slate-800 dark:text-white">
                      v{item.version || '?'}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-slate-200/50 dark:bg-slate-700/50 rounded text-slate-500 dark:text-slate-400 font-mono">
                      code {item.versionCode}
                    </span>
                    {item.date && (
                      <span className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {item.date}
                      </span>
                    )}
                  </div>
                  {item.title && (
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-1">
                      {item.title}
                    </div>
                  )}
                  <div
                    className={`text-sm text-slate-600 dark:text-slate-300 leading-relaxed ${
                      isExpanded ? '' : 'line-clamp-2'
                    }`}
                  >
                    {text}
                  </div>
                  {text.length > 120 && (
                    <button
                      onClick={() => setExpanded(isExpanded ? null : idx)}
                      className="mt-1 text-xs text-indigo-500 dark:text-indigo-400 hover:underline"
                    >
                      {isExpanded ? '收起' : '展开全部'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            <Tag className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>该筛选下暂无记录</p>
          </div>
        )}
      </div>
    </div>
  );
}