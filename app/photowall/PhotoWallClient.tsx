"use client";

import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react';
import { Search, X, Camera, Upload, Trash2, Calendar, HardDrive, Image as ImageIcon, ZoomIn } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';

interface UploadedImage {
  name: string;
  url: string;
  size: number;
  mtime: string;
  type: string;
  // 来自自然宽高, 用于按尺寸排版 (瀑布流按"原始宽高比"分配列)
  width?: number;
  height?: number;
}

/* -----------------------------------------------------------
   单张图片卡片: 用 React.memo 隔离重渲染, 避免父级 setState 时
   整个瀑布流全部重排, 点击慢一拍的根因
   ----------------------------------------------------------- */
const PhotoCard = memo(function PhotoCard({
  img,
  onPreview,
  onDelete,
  formatSize,
  formatTime,
}: {
  img: UploadedImage;
  onPreview: (img: UploadedImage) => void;
  onDelete: (url: string) => void;
  formatSize: (n: number) => string;
  formatTime: (s: string) => string;
}) {
  const isVideo = img.type === 'video';
  return (
    <div
      className="group relative mb-3 md:mb-4 break-inside-avoid rounded-2xl overflow-hidden bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/10 shadow-md hover:shadow-2xl transition-shadow duration-300 animate-fade-in-up will-change-transform"
      style={{ contentVisibility: 'auto', containIntrinsicSize: '320px 240px' }}
    >
      {/* 图片主体: 原图比例, 不裁剪, 透明区域直接透出卡片背景 */}
      <div
        className="relative w-full cursor-zoom-in"
        onClick={() => onPreview(img)}
      >
        {isVideo ? (
          <video
            src={img.url}
            muted
            loop
            playsInline
            preload="metadata"
            className="w-full h-auto object-contain block"
          />
        ) : (
          <img
            src={img.url}
            alt={img.name}
            loading="lazy"
            decoding="async"
            className="w-full h-auto object-contain block transition-transform duration-700 group-hover:scale-[1.03]"
          />
        )}
        {/* 悬浮操作层 */}
        <div className="absolute top-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <button
            onClick={(e) => { e.stopPropagation(); onPreview(img); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-indigo-500 hover:text-white backdrop-blur-md shadow-md transition-colors"
            title="查看大图"
          >
            <ZoomIn size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(img.url); }}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 dark:bg-slate-800/80 text-red-500 hover:bg-red-500 hover:text-white backdrop-blur-md shadow-md transition-colors"
            title="删除"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* 元信息: 时间 + 大小, 风格与博客卡片统一 */}
      <div className="px-3 py-2 flex items-center justify-between text-[11px] font-bold border-t border-white/20 dark:border-white/5 bg-white/30 dark:bg-slate-800/30 backdrop-blur-sm">
        <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Calendar size={11} className="text-indigo-500" />
          {formatTime(img.mtime)}
        </span>
        <span className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-mono">
          <HardDrive size={11} />
          {formatSize(img.size)}
        </span>
      </div>
    </div>
  );
});

export default function PhotoWallClient() {
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedImage, setSelectedImage] = useState<UploadedImage | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  /* ---------- 加载列表 ---------- */
  const loadImages = useCallback(async () => {
    try {
      const r = await fetch('/api/photowall', { cache: 'no-store' });
      const d = await r.json();
      if (d.success && Array.isArray(d.images)) {
        // 预取真实尺寸, 用作后续按"图片尺寸"排版的依据
        // 这里只对前 N 张做并发测量, 失败也不影响列表
        const imgs = d.images as UploadedImage[];
        setUploadedImages(imgs);
        setLoading(false);
        // 异步后台测量宽高比
        preloadDimensions(imgs.slice(0, 80));
      } else {
        setUploadedImages([]);
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadImages(); }, [loadImages]);

  /* ---------- 后台并发测量图片尺寸, 完成后批量更新一次, 避免频繁 setState ---------- */
  const dimensionCache = useRef<Map<string, { w: number; h: number }>>(new Map());
  const preloadDimensions = useCallback((imgs: UploadedImage[]) => {
    let pending = 0;
    imgs.forEach((img) => {
      if (img.type === 'video' || dimensionCache.current.has(img.url)) return;
      pending++;
      const tmp = new window.Image();
      tmp.onload = () => {
        dimensionCache.current.set(img.url, { w: tmp.naturalWidth, h: tmp.naturalHeight });
        pending--;
        if (pending === 0) {
          // 全部测量完, 一次性合并入 state (而不是每张都 setState 一次)
          setUploadedImages((prev) => prev.map((p) => {
            const d = dimensionCache.current.get(p.url);
            return d ? { ...p, width: d.w, height: d.h } : p;
          }));
        }
      };
      tmp.onerror = () => {
        dimensionCache.current.set(img.url, { w: 0, h: 0 });
        pending--;
        if (pending === 0) {
          setUploadedImages((prev) => prev.map((p) => {
            const d = dimensionCache.current.get(p.url);
            return d ? { ...p, width: d.w, height: d.h } : p;
          }));
        }
      };
      tmp.src = img.url;
    });
    if (pending === 0) return; // 没有需要测量的图片
  }, []);

  /* ---------- 上传 ---------- */
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const fd = new FormData();
    for (let i = 0; i < files.length; i++) fd.append('files', files[i]);
    try {
      const res = await fetch('/api/photowall', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        await loadImages();
      }
    } catch {
    } finally {
      setUploading(false);
    }
  }, [loadImages]);

  /* ---------- 删除 ---------- */
  const handleDelete = useCallback(async (url: string) => {
    if (!confirm('确定删除这张照片？')) return;
    try {
      await fetch('/api/photowall', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setUploadedImages((prev) => prev.filter((p) => p.url !== url));
    } catch {}
  }, []);

  /* ---------- 搜索过滤 (轻量, 仅按文件名匹配) ---------- */
  const filteredImages = useMemo(() => {
    if (!searchQuery.trim()) return uploadedImages;
    const q = searchQuery.toLowerCase();
    return uploadedImages.filter((img) => img.name.toLowerCase().includes(q));
  }, [uploadedImages, searchQuery]);

  /* ---------- 工具函数 ---------- */
  const formatSize = useCallback((bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }, []);

  const formatTime = useCallback((iso: string) => {
    try {
      const d = new Date(iso);
      const Y = d.getFullYear();
      const M = String(d.getMonth() + 1).padStart(2, '0');
      const D = String(d.getDate()).padStart(2, '0');
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${Y}.${M}.${D} ${h}:${m}`;
    } catch {
      return iso;
    }
  }, []);

  return (
    <div className="min-h-screen relative pb-32">
      <Navbar />

      <PageTransition>
        <div className="w-full max-w-7xl mx-auto mt-24 md:mt-28 px-3 sm:px-6 md:px-10 relative z-10">

          {/* 顶部标题区 - 保持博客大字风格 */}
          <div className="mb-6 md:mb-10 text-center">
            <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white mb-2 tracking-tighter transition-colors duration-700">
              光影画廊
            </h1>
            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 font-medium italic opacity-80">
              定格时间，封存泰拉与现实的每一次心跳
            </p>
          </div>

          {/* 控制条: 搜索 + 上传 */}
          <div className="mb-6 md:mb-8 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 md:gap-4">
            {/* 搜索框 */}
            <div className="relative w-full md:w-80 group">
              <Search className="w-4 h-4 md:w-5 md:h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors z-10 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索文件名…"
                className="w-full pl-11 pr-4 py-2.5 md:py-3 bg-white/40 dark:bg-slate-800/40 backdrop-blur-xl border border-white/40 dark:border-white/5 rounded-xl md:rounded-2xl text-sm font-medium text-slate-800 dark:text-white shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* 上传按钮组 */}
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-3 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black transition-all shadow-md hover:shadow-lg"
              >
                <Camera size={14} className="md:w-4 md:h-4" />
                {uploading ? '上传中…' : '选择图片'}
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                disabled={uploading}
                className="flex-1 md:flex-none inline-flex items-center justify-center gap-1.5 px-4 py-2.5 md:py-3 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl md:rounded-2xl text-xs md:text-sm font-black transition-all shadow-md hover:shadow-lg"
              >
                <Upload size={14} className="md:w-4 md:h-4" />
                导入文件夹
              </button>
            </div>
          </div>

          {/* 隐藏的文件输入 */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
          />
          <input
            ref={folderInputRef}
            type="file"
            // @ts-ignore
            webkitdirectory=""
            directory=""
            multiple
            className="hidden"
            onChange={(e) => { handleUpload(e.target.files); e.target.value = ''; }}
          />

          {/* 状态: 加载中 */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 md:py-32 text-slate-400">
              <div className="w-10 h-10 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
              <p className="text-sm font-bold">正在唤醒光影…</p>
            </div>
          )}

          {/* 状态: 空 */}
          {!loading && uploadedImages.length === 0 && (
            <div className="text-center py-20 md:py-32">
              <div className="inline-flex w-20 h-20 md:w-24 md:h-24 bg-indigo-500/10 rounded-2xl md:rounded-3xl items-center justify-center mb-6 relative">
                <div className="absolute inset-0 bg-indigo-500/20 blur-2xl rounded-full animate-pulse" />
                <ImageIcon size={36} className="text-indigo-500 relative z-10" strokeWidth={1.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-slate-700 dark:text-slate-200 mb-2">画廊空空如也</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium mb-6 text-sm">上传你的第一张照片，开始记录光影</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-2xl text-sm font-black transition-all shadow-lg"
              >
                <Camera size={16} /> 选择图片上传
              </button>
            </div>
          )}

          {/* 状态: 搜索无果 */}
          {!loading && uploadedImages.length > 0 && filteredImages.length === 0 && (
            <div className="text-center py-20 text-slate-400">
              <Search size={36} className="mx-auto mb-3 opacity-50" />
              <p className="font-bold">没找到匹配「{searchQuery}」的照片</p>
            </div>
          )}

          {/* 瀑布流主体: CSS columns 实现, 原图比例 + 按尺寸自适应列高 */}
          {!loading && filteredImages.length > 0 && (
            <>
              <div className="flex items-center justify-between mb-4 px-1">
                <p className="text-[11px] md:text-xs text-slate-500 dark:text-slate-400 font-bold tracking-wider">
                  共 <span className="text-indigo-500 font-black">{filteredImages.length}</span> 张 · 按上传时间从新到旧
                </p>
              </div>

              <div className="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 md:gap-4">
                {filteredImages.map((img) => (
                  <PhotoCard
                    key={img.url}
                    img={img}
                    onPreview={setSelectedImage}
                    onDelete={handleDelete}
                    formatSize={formatSize}
                    formatTime={formatTime}
                  />
                ))}
              </div>
            </>
          )}

          {/* 大图预览 */}
          {selectedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 cursor-zoom-out animate-fade-in"
              onClick={() => setSelectedImage(null)}
            >
              <div
                className="relative max-w-[95vw] max-h-[90vh] animate-zoom-in"
                onClick={(e) => e.stopPropagation()}
              >
                {selectedImage.type === 'video' ? (
                  <video
                    src={selectedImage.url}
                    controls
                    autoPlay
                    className="max-w-[95vw] max-h-[90vh] rounded-2xl shadow-2xl border border-white/10"
                  />
                ) : (
                  <img
                    src={selectedImage.url}
                    alt={selectedImage.name}
                    className="max-w-[95vw] max-h-[90vh] object-contain block"
                  />
                )}
                <div className="absolute -top-3 -right-3 flex gap-2">
                  <button
                    onClick={() => handleDelete(selectedImage.url)}
                    className="w-10 h-10 bg-red-500/90 hover:bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg backdrop-blur-md transition-colors"
                    title="删除"
                  >
                    <Trash2 size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 text-white rounded-full flex items-center justify-center text-xl font-bold backdrop-blur-md transition-colors"
                    title="关闭"
                  >
                    ✕
                  </button>
                </div>
                {/* 大图底部元信息 */}
                <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md text-white/90 text-[10px] md:text-xs font-black tracking-wider border border-white/10">
                  {formatTime(selectedImage.mtime)} · {formatSize(selectedImage.size)}
                </div>
              </div>
            </div>
          )}

        </div>
      </PageTransition>
    </div>
  );
}
