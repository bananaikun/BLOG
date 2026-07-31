"use client";
import { useState, useEffect, useRef } from 'react';

interface SystemStats {
  cpu: number;
  memory: { total: number; used: number; percent: number };
  uptime: number;
  loadAvg: number[];
  platform: string;
  hostname: string;
  nodeVersion: string;
  networkInterfaces: any;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}天 ${h}时 ${m}分`;
  if (h > 0) return `${h}时 ${m}分 ${s}秒`;
  return `${m}分 ${s}秒`;
}

export default function ResourceDashboard() {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [error, setError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      try {
        const res = await fetch('/api/system');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        if (mounted) {
          setStats(data);
          setError(false);
          setHistory(prev => {
            const next = [...prev, data.cpu];
            return next.length > 60 ? next.slice(-60) : next;
          });
        }
      } catch {
        if (mounted) setError(true);
      }
    };

    fetchData();
    // 1秒刷新一次
    const interval = setInterval(fetchData, 1000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  // 绘制 CPU 历史折线图
  useEffect(() => {
    if (!canvasRef.current || history.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // 背景网格
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (h / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // 折线
    const max = 100;
    const stepX = w / Math.max(history.length - 1, 1);

    // 填充区域
    ctx.beginPath();
    ctx.moveTo(0, h);
    history.forEach((val, i) => {
      const x = i * stepX;
      const y = h - (val / max) * h;
      ctx.lineTo(x, y);
    });
    ctx.lineTo(w, h);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, h);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.3)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // 线条
    ctx.beginPath();
    history.forEach((val, i) => {
      const x = i * stepX;
      const y = h - (val / max) * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [history]);

  if (error && !stats) {
    return (
      <div className="md:col-span-12 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6 text-center text-sm text-slate-500">
        系统监控不可用（/api/system 未响应）
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="md:col-span-12 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-6">
        <div className="animate-pulse flex items-center gap-3 text-sm text-slate-400">
          <div className="w-3 h-3 rounded-full bg-indigo-500 animate-ping"></div>
          正在获取系统信息...
        </div>
      </div>
    );
  }

  return (
    <div className="md:col-span-12 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/20 dark:border-white/5">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span className="text-sm font-bold text-slate-700 dark:text-slate-200">资源仪表盘</span>
          <span className="text-[10px] text-slate-400 ml-1">· 每秒刷新</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">{stats.hostname || 'localhost'} · {stats.platform}</span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        {/* CPU */}
        <div className="bg-slate-900/5 dark:bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">CPU</div>
          <div className="text-2xl md:text-3xl font-black text-indigo-500 tabular-nums">{stats.cpu.toFixed(1)}<span className="text-sm">%</span></div>
          <div className="w-full mt-2 h-1.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(stats.cpu, 100)}%` }} />
          </div>
        </div>

        {/* Memory */}
        <div className="bg-slate-900/5 dark:bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">内存</div>
          <div className="text-2xl md:text-3xl font-black text-emerald-500 tabular-nums">{stats.memory.percent.toFixed(1)}<span className="text-sm">%</span></div>
          <div className="text-[10px] text-slate-400 mt-1">{formatBytes(stats.memory.used)} / {formatBytes(stats.memory.total)}</div>
          <div className="w-full mt-1 h-1.5 bg-slate-200/50 dark:bg-slate-700/50 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full transition-all duration-300" style={{ width: `${Math.min(stats.memory.percent, 100)}%` }} />
          </div>
        </div>

        {/* Uptime */}
        <div className="bg-slate-900/5 dark:bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">运行时长</div>
          <div className="text-base md:text-lg font-black text-amber-500 tabular-nums text-center">{formatUptime(stats.uptime)}</div>
        </div>

        {/* Load Average */}
        <div className="bg-slate-900/5 dark:bg-black/20 rounded-2xl p-4 flex flex-col items-center justify-center">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-1">系统负载</div>
          <div className="text-base md:text-lg font-black text-pink-500 tabular-nums">
            {(stats.loadAvg || []).map(v => v.toFixed(2)).join('  ') || 'N/A'}
          </div>
        </div>
      </div>

      {/* CPU 历史折线图 */}
      <div className="px-4 pb-4">
        <div className="text-[10px] font-bold text-slate-400 mb-1">CPU 历史 (60秒)</div>
        <canvas ref={canvasRef} width={800} height={80} className="w-full h-20 rounded-xl bg-slate-900/5 dark:bg-black/10" />
      </div>
    </div>
  );
}
