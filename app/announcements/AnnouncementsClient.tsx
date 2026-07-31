"use client";

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, ExternalLink, Clock } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';

interface AnnouncementData {
  enabled: boolean;
  content?: string;
  link?: string;
  pushTitle?: string;
  pushBody?: string;
  updatedAt?: string;
}

export default function AnnouncementsClient() {
  const [data, setData] = useState<AnnouncementData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/announcements', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData({ enabled: false }))
      .finally(() => setLoading(false));
  }, []);

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
              <Megaphone className="inline-block w-8 h-8 md:w-10 md:h-10 text-indigo-500 mr-2 -mt-1" />
              公告
            </motion.h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium italic opacity-80">
              最新的站点通知与重要更新
            </p>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold">正在拉取公告…</p>
            </div>
          )}

          {!loading && data && !data.enabled && (
            <div className="text-center py-20 text-slate-400">
              <Megaphone size={36} className="mx-auto mb-3 opacity-50" />
              <p className="font-bold">当前没有公告</p>
            </div>
          )}

          {!loading && data && data.enabled && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="bg-white/60 dark:bg-slate-800/50 backdrop-blur-xl rounded-2xl md:rounded-3xl shadow-lg md:shadow-xl border border-white/40 dark:border-white/10 p-6 md:p-10 transition-colors"
            >
              {data.updatedAt && (
                <div className="flex items-center gap-1.5 text-[10px] md:text-xs text-slate-400 font-bold mb-4 md:mb-6">
                  <Clock size={12} />
                  {new Date(data.updatedAt).toLocaleString('zh-CN')}
                </div>
              )}
              <div className="text-slate-800 dark:text-slate-200 text-sm md:text-base leading-relaxed whitespace-pre-wrap font-medium">
                {data.content}
              </div>
              {data.link && (
                <a
                  href={data.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs md:text-sm font-black transition-all shadow-md"
                >
                  <ExternalLink size={14} /> 查看详情
                </a>
              )}
            </motion.div>
          )}
        </div>
      </PageTransition>
    </div>
  );
}
