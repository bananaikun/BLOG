'use client';

import { useEffect, useState } from 'react';
import { Download, Power, Trash2, RefreshCw, Package, ChevronDown, ChevronUp, Smartphone, Cpu, Shield } from 'lucide-react';

interface Version {
  id: number;
  appId: string;
  platform: string;
  version: string;
  versionCode: number;
  sizeBytes: number;
  sha256: string;
  changelog: string;
  mandatory: boolean;
  isActive: boolean;
  createdAt: string;
  downloads: number;
  downloadUrl: string;
  appLabel?: string;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  launchableActivity?: string;
  permissions?: string[];
  nativeCode?: string[];
}

const TOKEN = 'hayenai-admin-2024';
const authHeaders = { Authorization: `Bearer ${TOKEN}` };

function fmtBytes(n: number) {
  if (!n && n !== 0) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function fmtDate(ts: string) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleString('zh-CN', { hour12: false });
}

export default function PushVersions() {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchVersions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/push/versions', { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
        setError('');
      } else {
        setError(`获取版本列表失败 (HTTP ${res.status})`);
      }
    } catch (e: any) {
      setError(`连接失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, []);

  const toggleActive = async (id: number, current: boolean) => {
    try {
      const res = await fetch(`/api/push/versions/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !current }),
      });
      if (res.ok) {
        toast(current ? '已禁用' : '已启用', 'success');
        fetchVersions();
      } else {
        toast('操作失败', 'error');
      }
    } catch {
      toast('网络错误', 'error');
    }
  };

  const toggleMandatory = async (id: number, current: boolean) => {
    try {
      const res = await fetch(`/api/push/versions/${id}`, {
        method: 'PATCH',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ mandatory: !current }),
      });
      if (res.ok) {
        toast(current ? '已取消强制更新' : '已设为强制更新', 'success');
        fetchVersions();
      }
    } catch {
      toast('操作失败', 'error');
    }
  };

  const deleteVersion = async (id: number) => {
    if (!confirm(`确定要删除版本 ${id} 吗？此操作不可恢复。`)) return;
    try {
      const res = await fetch(`/api/push/versions/${id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        toast('已删除', 'success');
        fetchVersions();
      } else {
        toast('删除失败', 'error');
      }
    } catch {
      toast('网络错误', 'error');
    }
  };

  // 简易 toast
  const toast = (msg: string, type: 'success' | 'error' = 'success') => {
    const el = document.createElement('div');
    el.className = `fixed top-20 right-4 z-50 px-4 py-2 rounded-xl text-sm font-bold backdrop-blur-md border ${
      type === 'success'
        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
        : 'bg-red-500/20 text-red-300 border-red-500/30'
    }`;
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          加载版本列表...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/30 text-red-400">
        {error}
      </div>
    );
  }

  const latest = versions.find((v) => v.isActive);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
          <Package className="w-5 h-5" />
          版本管理
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500 dark:text-slate-400">
            共 {versions.length} 个版本 · {versions.filter((v) => v.isActive).length} 启用
          </span>
          <button
            onClick={fetchVersions}
            className="p-2 rounded-lg bg-white/40 dark:bg-slate-800/50 hover:bg-white/60 dark:hover:bg-slate-700/60 transition-colors"
            title="刷新"
          >
            <RefreshCw className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
      </div>

      {/* 最新版本大卡片 */}
      {latest && (
        <div className="p-8 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md border border-purple-500/30">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
              最新版本
            </span>
            {latest.mandatory && (
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                强制更新
              </span>
            )}
          </div>
          <h3 className="text-3xl font-bold mb-2 text-slate-800 dark:text-white">
            v{latest.version} <span className="text-slate-500 text-xl">code {latest.versionCode}</span>
          </h3>
          <div className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            {fmtBytes(latest.sizeBytes)} · {fmtDate(latest.createdAt)} · 下载 {latest.downloads} 次
          </div>
          {latest.changelog && (
            <div className="pt-4 border-t border-white/10 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {latest.changelog.slice(0, 200)}
              {latest.changelog.length > 200 && '...'}
            </div>
          )}
          <div className="mt-4 flex gap-2">
            <a
              href={latest.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-sm hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              <Download className="w-4 h-4" />
              立即下载
            </a>
          </div>
        </div>
      )}

      {/* 版本列表 */}
      <div className="space-y-3">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200">历史版本</h3>
        {versions.map((v) => (
          <div
            key={v.id}
            className="p-5 rounded-2xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/30 dark:border-white/10 hover:border-purple-500/30 transition-all"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className="text-lg font-bold text-slate-800 dark:text-white">v{v.version}</span>
                  <span className="text-xs px-2 py-0.5 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300 font-mono">
                    code {v.versionCode}
                  </span>
                  {v.mandatory && (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-400 rounded-full">强制</span>
                  )}
                  {v.isActive ? (
                    <span className="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">启用</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 bg-slate-500/20 text-slate-500 rounded-full">禁用</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-3 flex-wrap">
                  <span>{fmtBytes(v.sizeBytes)}</span>
                  <span>·</span>
                  <span>下载 {v.downloads} 次</span>
                  <span>·</span>
                  <span>{v.platform}</span>
                  <span>·</span>
                  <span>{fmtDate(v.createdAt)}</span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
                  SHA256: {v.sha256.slice(0, 32)}...
                </div>

                {/* APK 元数据 */}
                {(v.appLabel || v.minSdkVersion || v.targetSdkVersion || v.launchableActivity || (v.nativeCode && v.nativeCode.length > 0) || (v.permissions && v.permissions.length > 0)) && (
                  <div className="mt-2 pt-2 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
                    {v.appLabel && (
                      <div>
                        <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Smartphone className="w-3 h-3" />
                          应用名
                        </div>
                        <div className="font-medium text-slate-700 dark:text-slate-300 truncate">{v.appLabel}</div>
                      </div>
                    )}
                    {(v.minSdkVersion !== undefined || v.targetSdkVersion !== undefined) && (
                      <div>
                        <div className="text-slate-500 dark:text-slate-400">SDK</div>
                        <div className="font-mono font-medium text-slate-700 dark:text-slate-300">
                          min {v.minSdkVersion ?? '?'} / t {v.targetSdkVersion ?? '?'}
                        </div>
                      </div>
                    )}
                    {v.launchableActivity && (
                      <div className="col-span-2">
                        <div className="text-slate-500 dark:text-slate-400">启动 Activity</div>
                        <div className="font-mono font-medium text-slate-700 dark:text-slate-300 truncate">{v.launchableActivity}</div>
                      </div>
                    )}
                    {v.nativeCode && v.nativeCode.length > 0 && (
                      <div className="col-span-2">
                        <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Cpu className="w-3 h-3" />
                          架构 ({v.nativeCode.length})
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {v.nativeCode.map((arch) => (
                            <span key={arch} className="px-1.5 py-0.5 font-mono rounded bg-indigo-500/15 text-indigo-300">
                              {arch}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {v.permissions && v.permissions.length > 0 && (
                      <div className="col-span-2 md:col-span-4">
                        <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          权限 ({v.permissions.length})
                        </div>
                        <div className="flex flex-wrap gap-1 mt-0.5 max-h-12 overflow-y-auto">
                          {v.permissions.slice(0, 20).map((p) => (
                            <span key={p} className="px-1 py-0.5 font-mono rounded bg-slate-500/10 text-slate-400 dark:text-slate-400">
                              {p.split('.').pop()}
                            </span>
                          ))}
                          {v.permissions.length > 20 && (
                            <span className="px-1 py-0.5 rounded bg-slate-500/10 text-slate-400">+{v.permissions.length - 20}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(v.id, v.isActive)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${
                    v.isActive
                      ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  }`}
                >
                  <Power className="w-3 h-3" />
                  {v.isActive ? '禁用' : '启用'}
                </button>
                <button
                  onClick={() => toggleMandatory(v.id, v.mandatory)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    v.mandatory
                      ? 'bg-slate-500/20 text-slate-400 hover:bg-slate-500/30'
                      : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  }`}
                >
                  {v.mandatory ? '取消强制' : '设为强制'}
                </button>
                <a
                  href={v.downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30 rounded-lg text-xs font-medium text-center transition-colors flex items-center gap-1 justify-center"
                >
                  <Download className="w-3 h-3" />
                  下载
                </a>
                <button
                  onClick={() => deleteVersion(v.id)}
                  className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 justify-center"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            </div>
            {v.changelog && (
              <div className="mt-3">
                <button
                  onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                  className="text-xs text-indigo-500 dark:text-indigo-400 hover:underline flex items-center gap-1"
                >
                  {expanded === v.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {expanded === v.id ? '收起' : '查看'}更新日志
                </button>
                {expanded === v.id && (
                  <div className="mt-2 p-3 rounded-lg bg-black/20 dark:bg-white/5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {v.changelog}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}