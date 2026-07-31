'use client';

import { useState, useRef } from 'react';
import { Upload, File, Package, Check, X, ChevronRight, Hash, FileText, AlertCircle, Sparkles, Shield, Cpu, Info } from 'lucide-react';

const TOKEN = 'hayenai-admin-2024';

interface ApkMeta {
  appId: string;
  versionCode: number;
  versionName: string;
  appLabel?: string;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  launchableActivity?: string;
  permissions?: string[];
  nativeCode?: string[];
}

export default function PushNewVersion() {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [version, setVersion] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [appId, setAppId] = useState('com.hayenai.app');
  const [changelog, setChangelog] = useState('');
  const [mandatory, setMandatory] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ ok: boolean; message: string; version?: any; autoFilled?: any } | null>(null);
  const [apkMeta, setApkMeta] = useState<ApkMeta | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const [inspectHint, setInspectHint] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onFileSelected(f);
  };

  const onFileSelected = async (f: File) => {
    setFile(f);
    setApkMeta(null);
    setInspectHint(null);

    // 1. 先从文件名猜版本号
    const match = f.name.match(/v?(\d+\.\d+\.\d+)/);
    if (match && !version) setVersion(match[1]);
    const codeMatch = f.name.match(/code(\d+)/i) || f.name.match(/-(\d{3})\./);
    if (codeMatch && !versionCode) setVersionCode(codeMatch[1]);

    // 2. 立即调用 apk-inspect 解析（仅 APK 文件）
    if (!/\.apk$/i.test(f.name)) return;

    setInspecting(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const resp = await fetch('/api/push/apk-inspect', {
        method: 'POST',
        body: fd,
      });
      const data = await resp.json();
      if (data.ok && data.meta) {
        const meta: ApkMeta = data.meta;
        setApkMeta(meta);
        // 用解析结果覆盖（仅当用户还没填）
        if (!version) setVersion(meta.versionName);
        if (!versionCode) setVersionCode(String(meta.versionCode));
        if (meta.appId) setAppId(meta.appId);
      } else {
        setInspectHint(data.hint || data.error || 'aapt 解析失败，可手动填写版本信息');
      }
    } catch (e: any) {
      setInspectHint('解析失败：' + (e?.message || e));
    } finally {
      setInspecting(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = () => setDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) onFileSelected(f);
  };

  const handleSubmit = async () => {
    if (!file) {
      setResult({ ok: false, message: '请选择 APK 文件' });
      return;
    }
    if (!version || !versionCode) {
      setResult({ ok: false, message: '请填写版本号和版本代码' });
      return;
    }

    setUploading(true);
    setProgress(0);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('version', version);
    formData.append('versionCode', versionCode);
    formData.append('appId', appId);
    formData.append('changelog', changelog);
    formData.append('mandatory', String(mandatory));
    formData.append('isActive', String(isActive));

    try {
      // 使用 XMLHttpRequest 以支持上传进度
      const xhr = new XMLHttpRequest();
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200 && data.ok) {
            setResult({
              ok: true,
              message: `版本 v${version} (code ${versionCode}) 上传成功！`,
              version: data.version,
              autoFilled: data.autoFilled,
            });
            setFile(null);
            setApkMeta(null);
            setInspectHint(null);
            setVersion('');
            setVersionCode('');
            setAppId('com.hayenai.app');
            setChangelog('');
            setMandatory(false);
            setIsActive(true);
            if (fileInputRef.current) fileInputRef.current.value = '';
          } else {
            setResult({ ok: false, message: data.error || `上传失败 (HTTP ${xhr.status})` });
          }
        } catch {
          setResult({ ok: false, message: '响应解析失败' });
        }
        setUploading(false);
      };
      xhr.onerror = () => {
        setResult({ ok: false, message: '网络错误，请检查推送服务' });
        setUploading(false);
      };
      xhr.open('POST', '/api/push/versions');
      xhr.setRequestHeader('Authorization', `Bearer ${TOKEN}`);
      xhr.send(formData);
    } catch (e: any) {
      setResult({ ok: false, message: e.message || '上传失败' });
      setUploading(false);
    }
  };

  const fmtBytes = (n: number) => {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* 标题 */}
      <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
        <Upload className="w-5 h-5" />
        推送新版本
      </h2>

      <div className="p-6 rounded-3xl bg-white/40 dark:bg-slate-800/40 backdrop-blur-md border border-white/30 dark:border-white/10 space-y-5">
        {/* 文件上传区 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
            <File className="w-4 h-4" />
            APK 文件
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
              dragging
                ? 'border-indigo-500 bg-indigo-500/10'
                : file
                ? 'border-indigo-500/50 bg-indigo-500/5'
                : 'border-slate-300 dark:border-slate-600 hover:border-indigo-400 dark:hover:border-indigo-400 hover:bg-white/20 dark:hover:bg-slate-700/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk,.aab"
              onChange={handleFileChange}
              className="hidden"
            />
            {file ? (
              <div className="flex items-center gap-3 justify-center">
                <Package className="w-8 h-8 text-indigo-500" />
                <div className="text-left">
                  <div className="text-indigo-500 font-bold">{file.name}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {fmtBytes(file.size)}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="ml-2 p-1 rounded-full hover:bg-red-500/20"
                >
                  <X className="w-4 h-4 text-red-400" />
                </button>
              </div>
            ) : (
              <div className="text-slate-500 dark:text-slate-400">
                <Upload className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="font-medium">点击选择 或 拖拽 APK 到此处</p>
                <p className="text-xs mt-1">支持 .apk / .aab · 自动从文件名提取版本号</p>
              </div>
            )}
          </div>
        </div>

        {/* APK 元数据预览 */}
        {(inspecting || apkMeta || inspectHint) && (
          <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/30 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-500">APK 元数据预览</span>
              {inspecting && (
                <div className="flex items-center gap-2 text-xs text-slate-500 ml-auto">
                  <div className="w-3 h-3 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  解析中...
                </div>
              )}
              {apkMeta && !inspecting && (
                <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-medium">
                  已自动填充
                </span>
              )}
            </div>

            {apkMeta && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                {apkMeta.appLabel && (
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">应用名</div>
                    <div className="font-medium text-slate-800 dark:text-white truncate">{apkMeta.appLabel}</div>
                  </div>
                )}
                <div>
                  <div className="text-slate-500 dark:text-slate-400">包名 (appId)</div>
                  <div className="font-mono font-medium text-slate-800 dark:text-white truncate">{apkMeta.appId}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">版本名</div>
                  <div className="font-mono font-medium text-slate-800 dark:text-white">{apkMeta.versionName}</div>
                </div>
                <div>
                  <div className="text-slate-500 dark:text-slate-400">版本代码</div>
                  <div className="font-mono font-medium text-slate-800 dark:text-white">{apkMeta.versionCode}</div>
                </div>
                {(apkMeta.minSdkVersion !== undefined || apkMeta.targetSdkVersion !== undefined) && (
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">SDK 范围</div>
                    <div className="font-mono font-medium text-slate-800 dark:text-white">
                      min {apkMeta.minSdkVersion ?? '?'} · target {apkMeta.targetSdkVersion ?? '?'}
                    </div>
                  </div>
                )}
                {apkMeta.launchableActivity && (
                  <div className="col-span-2">
                    <div className="text-slate-500 dark:text-slate-400">启动 Activity</div>
                    <div className="font-mono font-medium text-slate-800 dark:text-white truncate">{apkMeta.launchableActivity}</div>
                  </div>
                )}
                {apkMeta.nativeCode && apkMeta.nativeCode.length > 0 && (
                  <div className="col-span-2">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      原生架构 ({apkMeta.nativeCode.length})
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {apkMeta.nativeCode.map((arch) => (
                        <span
                          key={arch}
                          className="px-2 py-0.5 text-[10px] font-mono rounded bg-indigo-500/20 text-indigo-300"
                        >
                          {arch}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {apkMeta.permissions && apkMeta.permissions.length > 0 && (
                  <div className="col-span-2 md:col-span-4">
                    <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                      <Shield className="w-3 h-3" />
                      权限 ({apkMeta.permissions.length})
                    </div>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                      {apkMeta.permissions.slice(0, 30).map((p) => (
                        <span
                          key={p}
                          className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-500/10 text-slate-400 dark:bg-slate-700/30 dark:text-slate-300"
                        >
                          {p}
                        </span>
                      ))}
                      {apkMeta.permissions.length > 30 && (
                        <span className="px-1.5 py-0.5 text-[10px] rounded bg-slate-500/10 text-slate-400">
                          +{apkMeta.permissions.length - 30}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!inspecting && inspectHint && (
              <div className="flex items-start gap-2 text-xs text-amber-400">
                <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{inspectHint}</span>
              </div>
            )}
          </div>
        )}

        {/* 版本信息 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <ChevronRight className="w-4 h-4" />
              版本号
            </label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="1.0.0"
              className="w-full px-4 py-2.5 bg-white/40 dark:bg-slate-700/40 border border-white/30 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <Hash className="w-4 h-4" />
              版本代码
            </label>
            <input
              type="number"
              value={versionCode}
              onChange={(e) => setVersionCode(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-2.5 bg-white/40 dark:bg-slate-700/40 border border-white/30 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
              <Package className="w-4 h-4" />
              包名 (appId)
            </label>
            <input
              type="text"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="com.hayenai.app"
              className="w-full px-4 py-2.5 bg-white/40 dark:bg-slate-700/40 border border-white/30 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 font-mono"
            />
          </div>
        </div>

        {/* 更新日志 */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1">
            <FileText className="w-4 h-4" />
            更新日志
          </label>
          <textarea
            value={changelog}
            onChange={(e) => setChangelog(e.target.value)}
            placeholder="描述这个版本的更新内容..."
            rows={5}
            className="w-full px-4 py-2.5 bg-white/40 dark:bg-slate-700/40 border border-white/30 dark:border-white/10 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none text-sm leading-relaxed"
          />
        </div>

        {/* 选项 */}
        <div className="flex items-center gap-6 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">强制更新</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-500 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">立即启用</span>
          </label>
        </div>

        {/* 进度条 */}
        {uploading && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>上传中...</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* 结果 */}
        {result && (
          <div
            className={`px-4 py-3 rounded-xl text-sm flex items-start gap-2 ${
              result.ok
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'bg-red-500/10 text-red-400 border border-red-500/30'
            }`}
          >
            {result.ok ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <div className="flex-1">
              <div className="font-bold">{result.message}</div>
              {result.version && (
                <div className="text-xs mt-1 opacity-80">
                  ID: {result.version.id} · SHA256: {result.version.sha256?.slice(0, 16)}...
                </div>
              )}
            </div>
          </div>
        )}

        {/* 提交按钮 */}
        <button
          onClick={handleSubmit}
          disabled={uploading}
          className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-500 hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              上传中...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              推送新版本
            </>
          )}
        </button>
      </div>
    </div>
  );
}