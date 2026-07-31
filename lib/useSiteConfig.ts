"use client";
import { useState, useEffect } from 'react';

export const SITE_CONFIG_EVENT = 'site-config-updated';

export const BIO_STYLES = [
  { key: 'gradient', label: '渐变 (默认)' },
  { key: 'solid', label: '纯色' },
  { key: 'rainbow', label: '彩虹' },
  { key: 'shadow', label: '发光' },
] as const;

export type BioStyleKey = (typeof BIO_STYLES)[number]['key'];

/**
 * 根据 style 类型 + 颜色生成 bio 文本的内联样式
 * - gradient: 线性渐变 (默认)
 * - solid: 纯色
 * - rainbow: 彩虹流动
 * - shadow: 文字发光
 */
export function getBioStyle(
  style?: string,
  colorFrom?: string,
  colorTo?: string
): React.CSSProperties {
  const from = colorFrom || '#6366f1';
  const to = colorTo || '#ec4899';
  switch (style) {
    case 'solid':
      return { color: from };
    case 'rainbow':
      return {
        backgroundImage:
          'linear-gradient(90deg, #f43f5e, #f59e0b, #10b981, #3b82f6, #8b5cf6, #f43f5e)',
        backgroundSize: '200% 100%',
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
        animation: 'rainbow-shift 6s linear infinite',
      };
    case 'shadow':
      return {
        color: from,
        textShadow: `0 0 10px ${from}, 0 0 20px ${to}`,
      };
    case 'gradient':
    default:
      return {
        backgroundImage: `linear-gradient(135deg, ${from}, ${to})`,
        WebkitBackgroundClip: 'text',
        backgroundClip: 'text',
        color: 'transparent',
      };
  }
}

// 客户端运行时获取 siteConfig 的 hook
// 订阅全局事件，保存后会自动重新拉取
export function useSiteConfig() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const reload = () => {
    setLoading(true);
    fetch('/api/config?_t=' + Date.now())
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.data) {
          setConfig(d.data);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    const handler = () => reload();
    window.addEventListener(SITE_CONFIG_EVENT, handler);
    // 同一窗口跨标签用 storage 事件桥接
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'site_config_bust' || e.key === 'site_config_updated') handler();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SITE_CONFIG_EVENT, handler);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return { config, loading, reload };
}

// 保存后调用此函数广播配置变更
export function broadcastConfigUpdate() {
  if (typeof window === 'undefined') return;
  localStorage.setItem('site_config_updated', String(Date.now()));
  window.dispatchEvent(new CustomEvent(SITE_CONFIG_EVENT));
}
