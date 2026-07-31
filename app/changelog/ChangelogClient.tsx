"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { History, GitCommit } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';

interface Version {
  id: string;
  version: string;
  versionCode: number;
  changelog: string;
  mandatory: boolean;
  sizeBytes: number;
  createdAt: string;
}

export default function ChangelogClient() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/changelog', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d?.versions)) setVersions(d.versions);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatSize = (bytes: number) => {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />
      <PageTransition>
        <div className="w-full max-w-3xl mx-auto mt-24 md:mt-28 px-4 sm:px-6 md:px-10 relative z-10">
          <div className="text-center mb-10">
            <motion.h1
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter"
            >
              <History className="inline-block w-8 h-8 md:w-10 md:h-10 text-indigo-500 mr-2 -mt-1" />
              更新日志
            </motion.h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium italic opacity-80">
              记录每一次功能迭代与问题修复
            </p>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold">正在拉取日志…</p>
            </div>
          )}

          {!loading && versions.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <GitCommit size={36} className="mx-auto mb-3 opacity-50" />
              <p className="font-bold">还没有任何版本记录</p>
            </div>
          )}

          {!loading && versions.length > 0 && (
            <div className="flex flex-col gap-5 md:gap-8">
              {versions.map((v, idx) => (
                <motion.div
                  key={v.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-lg border border-white/40 dark:border-white/10 p-5 md:p-8 transition-colors"
                >
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-indigo-500 text-white text-[10px] md:text-xs font-black tracking-wider">
                        v{v.version}
                      </span>
                      {v.mandatory && (
                        <span className="px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-500 text-[10px] font-black">
                          强制
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] md:text-xs text-slate-400 font-bold">
                      {v.createdAt ? new Date(v.createdAt).toLocaleDateString('zh-CN') : ''}
                    </span>
                  </div>
                  <div className="text-slate-800 dark:text-slate-200 text-[13px] md:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                    {v.changelog}
                  </div>
                  {v.sizeBytes > 0 && (
                    <div className="mt-3 text-[10px] md:text-xs text-slate-400 font-mono">
                      {formatSize(v.sizeBytes)}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
