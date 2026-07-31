'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Globe } from 'lucide-react';

interface MCPingResult {
  online: boolean;
  host: string;
  port: number;
  localHost?: string;
  localPort?: number;
  latencyMs: number;
  lastPing?: string;
  version?: string;
  players?: { online: number; max: number; sample: any[] };
  error?: string;
}

interface MCStatusHistory {
  ts: string;
  online: boolean;
  latencyMs: number;
  playersOnline: number;
}

interface MCQueryPanelProps {}

export default function PushMCMonitor(_props: MCQueryPanelProps) {
  const [status, setStatus] = useState<MCPingResult | null>(null);
  const [history, setHistory] = useState<MCStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastCheck, setLastCheck] = useState<string>('—');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/push/mc-status');
      const j = await res.json();
      const data = j?.data;
      if (data) setStatus(data);
      setHistory((prev) => {
        const next = [...prev, {
          ts: new Date().toISOString(),
          online: !!data?.online,
          latencyMs: data?.latencyMs || 0,
          playersOnline: data?.players?.online || 0,
        }];
        return next.length > 30 ? next.slice(-30) : next;
      });
      setLastCheck(new Date().toLocaleTimeString());
    } catch (e: any) {
      setStatus({ online: false, host: '?', port: 0, latencyMs: 0, error: String(e) });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-400" />
          MC 服务器状态
        </h2>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <RefreshCw className="w-3 h-3" />
          3 秒刷新 · 上次 {lastCheck}
        </div>
      </div>

      {/* 主面板 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur border border-white/20 dark:border-slate-700/40 shadow-xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="text-xs text-slate-500 mb-1">外网地址</div>
              <div className="font-mono text-sm text-slate-800 dark:text-white">
                {status?.host || 'mc.bananaikun.dynv6.net'}
              </div>
              <div className="text-xs text-slate-500 mt-2 mb-1">端口</div>
              <div className="font-mono text-sm text-slate-800 dark:text-white">
                {status?.port || 25565}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${status?.online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className={`text-sm font-bold ${status?.online ? 'text-emerald-400' : 'text-rose-400'}`}>
                {loading ? '查询中…' : status?.online ? '在线' : '离线'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-4">
            <div className="p-3 rounded-xl bg-white/30 dark:bg-slate-900/30">
              <div className="text-xs text-slate-500 mb-1">延迟</div>
              <div className="font-mono text-lg font-bold text-slate-800 dark:text-white">
                {status?.latencyMs ? `${status.latencyMs}ms` : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/30 dark:bg-slate-900/30">
              <div className="text-xs text-slate-500 mb-1">在线玩家</div>
              <div className="font-mono text-lg font-bold text-slate-800 dark:text-white">
                {status?.players ? `${status.players.online} / ${status.players.max}` : '—'}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white/30 dark:bg-slate-900/30">
              <div className="text-xs text-slate-500 mb-1">版本</div>
              <div className="font-mono text-sm text-slate-800 dark:text-white truncate">
                {status?.version || '—'}
              </div>
            </div>
          </div>
        </div>

        {/* 历史延迟图表 */}
        <div className="p-5 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur border border-white/20 dark:border-slate-700/40 shadow-xl">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
            <Globe className="w-4 h-4 text-pink-400" />
            最近 30 次延迟
          </h3>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {history.slice().reverse().slice(0, 30).map((h, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className={`w-2 h-2 rounded-full ${h.online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                <span className="text-slate-500 font-mono w-20 truncate">
                  {h.ts.split('T')[1]?.slice(0, 8)}
                </span>
                <span className="font-mono text-slate-700 dark:text-slate-300">
                  {h.latencyMs}ms
                </span>
                {h.playersOnline > 0 && (
                  <span className="text-indigo-500">· {h.playersOnline}p</span>
                )}
              </div>
            ))}
            {history.length === 0 && (
              <div className="text-xs text-slate-500">暂无数据</div>
            )}
          </div>
        </div>
      </div>

      {/* 错误信息 */}
      {status?.error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm">
          ⚠ {status.error}
        </div>
      )}
    </div>
  );
}