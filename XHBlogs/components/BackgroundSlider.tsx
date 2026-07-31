"use client";
import { useState, useEffect, useRef } from 'react';

interface BgItem {
  url: string;
  type: 'image' | 'video';
}

export default function BackgroundSlider() {
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState<BgItem[]>([]);
  const [bgToggle, setBgToggle] = useState(true);
  const [bgInterval, setBgInterval] = useState(10000);
  const [bgBlur, setBgBlur] = useState(0);
  const [bgDim, setBgDim] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 运行时从 API 获取配置
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data) {
          const config = d.data;
          const rawBgs = config.bgImages || [];
          const parsed: BgItem[] = rawBgs.map((url: string) => {
            const lower = url.toLowerCase();
            if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.ogg')) {
              return { url, type: 'video' as const };
            }
            return { url, type: 'image' as const };
          });
          setItems(parsed);
          setBgToggle(config.bgToggle !== false);
          setBgInterval(config.bgInterval || 10000);
          setBgBlur(config.bgBlur || 0);
          setBgDim(config.bgDim || 0);
        }
      })
      .catch(() => {});
  }, []);

  // 自动轮播
  useEffect(() => {
    if (!bgToggle || items.length <= 1) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setIndex((prev) => (prev + 1) % items.length);
    }, bgInterval);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [bgToggle, bgInterval, items.length]);

  // 视频播放控制
  useEffect(() => {
    if (videoRef.current) {
      if (index >= 0 && items[index]?.type === 'video') {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [index, items]);

  // 点击切换背景：
  // 只在「设置」页面 (/settings) 才允许点击背景切换, 其他页面背景只是装饰, 不响应点击
  // 避免误触, 避免在其他页面阅读时背景突然切走
  useEffect(() => {
    if (typeof window === 'undefined') return;
    // 仅在 settings 页面启用点击切换
    const onSettings = window.location.pathname.startsWith('/settings');
    if (!onSettings) return;
    if (items.length <= 1) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // 排除明显交互元素
      if (target.closest('a, button, input, textarea, select, video, audio, [role="button"], [data-no-bg-switch]')) return;
      setIndex((prev) => (prev + 1) % items.length);
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [items.length]);

  if (items.length === 0) return null;

  const blurStyle = bgBlur > 0 ? `blur(${bgBlur}px)` : 'none';
  const dimStyle = bgDim > 0 ? `rgba(0,0,0,${bgDim})` : 'transparent';

  return (
    <div
      className="fixed inset-0 z-[-10] overflow-hidden pointer-events-none"
    >
      {items.map((item, i) => (
        <div
          key={i}
          className="absolute inset-0 transition-opacity duration-[2000ms] ease-in-out transform-gpu"
          style={{
            opacity: i === index ? 1 : 0,
            visibility: Math.abs(i - index) <= 1 || (i === items.length - 1 && index === 0) ? 'visible' : 'hidden',
            filter: blurStyle,
          }}
        >
          {item.type === 'video' ? (
            <video
              ref={i === index ? videoRef : undefined}
              src={item.url}
              className="w-full h-full object-cover"
              autoPlay
              loop
              muted
              playsInline
              preload="auto"
            />
          ) : (
            <div
              className="w-full h-full"
              style={{
                backgroundImage: `url(${item.url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            />
          )}
        </div>
      ))}
      {/* 暗度遮罩 */}
      {bgDim > 0 && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundColor: dimStyle }} />
      )}
    </div>
  );
}