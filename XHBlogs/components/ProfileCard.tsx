"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { siteConfig } from '../siteConfig';
import { useToast } from './ToastProvider';
import { getBioStyle } from '../lib/useSiteConfig';

interface SakuraPetal {
  id: number;
  x: number;
  delay: number;
  duration: number;
  drift: number;     // X 位移 (px)
  driftY?: number;   // Y 位移 (px)
  size: number;
  rotStart: number;
  rotEnd: number;
  originX: number;
  originY: number;
}

interface UrgeBubble {
  id: number;
  x: number;
  y: number;
  text: string;
}

export default function ProfileCard({ photoCount }: { photoCount: number }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [bioExpanded, setBioExpanded] = useState(false);

  // 运行时获取配置（头像URL可能在 siteConfig.json 中被修改）
  const [config, setConfig] = useState(siteConfig);
  useEffect(() => {
    fetch('/api/config')
      .then(r => r.json())
      .then(d => { if (d.success && d.data) setConfig({ ...siteConfig, ...d.data }); })
      .catch(() => {});
  }, []);

  // 催开服计数 (无节流 - 用户要求点击多快就多快刷新)
  // 同时持久化到 localStorage, 避免刷新后重置丢失
  // 重要: SSR 期间不能读 localStorage (会 hydration mismatch) → 初始永远 0, hydrate 后再读
  const [urgeCount, setUrgeCount] = useState<number>(0);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('urge_count');
      const n = parseInt(saved || '0', 10);
      if (!isNaN(n) && n > 0) setUrgeCount(n);
    } catch {}
    setHydrated(true);
  }, []);
  const [petals, setPetals] = useState<SakuraPetal[]>([]);
  const [bubble, setBubble] = useState<UrgeBubble | null>(null);
  const petalIdRef = useRef(0);
  const burstLayerRef = useRef<HTMLDivElement>(null);

  // 催开服计数: 纯前端, 不上报服务端 (用户要求移除上报)

const BUBBLES = [
    '催开服正在摸鱼中…',
    '服务器还在睡觉哦~',
    '我还以为服务器会闻鸡起舞！',
    '博主已被崔得连夜布线！',
    '全员笑哭，这一波崔得好！',
  ];

  const handleUrge = (e: React.MouseEvent<HTMLButtonElement>) => {
    // 无节流 - 用户要求点击多快就多快增加, 不 disabled 按钮

    // 点击位置（相对于卡片层）
    const layer = burstLayerRef.current;
    let clickX = 50, clickY = 50;
    if (layer) {
      const rect = layer.getBoundingClientRect();
      clickX = e.clientX - rect.left;
      clickY = e.clientY - rect.top;
    }

    // 立刻乐观更新 (纯前端计数, 不上报, 不节流, 同时持久化)
    setUrgeCount(c => {
      const next = c + 1;
      try { localStorage.setItem('urge_count', String(next)); } catch {}
      return next;
    });

    // 随机气泡（附近随机位置：偏离点击位置 0~120px）
    const bubbleText = BUBBLES[Math.floor(Math.random() * BUBBLES.length)];
    const bubbleOffsetX = (Math.random() - 0.5) * 220;
    const bubbleOffsetY = -30 - Math.random() * 100;
    setBubble({ id: Date.now() + Math.random(), x: clickX + bubbleOffsetX, y: clickY + bubbleOffsetY, text: bubbleText });
    // 保留 4.5 秒再消失, 让用户看清楚 (之前 2500ms 太短)
    setTimeout(() => setBubble(null), 4500);

    // 散发樱花粒子从点击位置向四周散开
    const burstCount = 32; // 增加数量让周围更密集
    const newPetals: SakuraPetal[] = [];
    for (let i = 0; i < burstCount; i++) {
      petalIdRef.current += 1;
      const id = petalIdRef.current;
      // 完全均匀的角度 + 小幅随机抖动
      const angle = (i / burstCount) * Math.PI * 2 + Math.random() * 0.3;
      // 距离更远（最大到 260px）保证四周充分散开
      const dist = 80 + Math.random() * 180;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      newPetals.push({
        id,
        x: 0,
        delay: Math.random() * 0.25,
        duration: 1.6 + Math.random() * 1.4,
        drift: dx, // X 方向位移
        size: 8 + Math.random() * 10,
        rotStart: Math.random() * 360,
        rotEnd: 360 + Math.random() * 720,
        originX: clickX,
        originY: clickY,
      });
      // 同时记下 Y 位移到 --sakura-drift-y
      newPetals[newPetals.length - 1] = { ...newPetals[newPetals.length - 1] } as any;
      (newPetals[newPetals.length - 1] as any).driftY = dy;
    }
    setPetals(prev => [...prev, ...newPetals]);
    // 清理过期花瓣
    setTimeout(() => {
      const ids = new Set(newPetals.map(p => p.id));
      setPetals(prev => prev.filter(p => !ids.has(p.id)));
    }, 4000);
    // 不再 setTimeout 重置 urging, 按钮也不再 disabled
  };

  return (
    <div
      className="md:col-span-7 rounded-3xl bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-xl p-5 sm:p-6 md:p-8 flex flex-col justify-between transition-all duration-700 hover:scale-[1.01] group relative overflow-visible h-full min-h-[220px] md:min-h-[280px]"
    >
      <div className="flex items-start justify-between relative z-10">
        <div className="flex items-center gap-4 md:gap-6 w-full">
          <div className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl md:rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-500 p-1 shadow-lg flex-shrink-0 transition-transform duration-500 group-hover:rotate-3 overflow-hidden">
            {config.avatarUrl ? (
              <img src={config.avatarUrl} alt="avatar" className="w-full h-full rounded-lg md:rounded-xl object-cover bg-white" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            ) : (
              <div className="w-full h-full rounded-lg md:rounded-xl bg-gradient-to-tr from-indigo-400 to-purple-400 flex items-center justify-center text-white text-2xl font-bold">
                {(config.authorName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-1 md:mb-2 pb-1 leading-snug tracking-wider transition-colors duration-700 truncate">
              {config.authorName}
            </h1>
            <p
              className={`text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-md transition-all duration-700 whitespace-pre-line ${bioExpanded ? "" : "line-clamp-2 md:line-clamp-3"}`}
              style={getBioStyle(config.bioStyle, config.bioColorFrom, config.bioColorTo)}
            >
              {config.bio || '这个人很懒，什么都没写'}
            </p>

            {(config.bio && config.bio.length > 80) && (
              <button
                onClick={() => setBioExpanded(!bioExpanded)}
                className='mt-1 inline-flex items-center gap-1 text-[10px] md:text-xs font-bold text-indigo-500 dark:text-indigo-300 hover:text-indigo-600 transition-all'
              >
                <span>{bioExpanded ? '收起' : '展开'}</span>
                <span className='inline-block transition-transform duration-300' style={{ transform: bioExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>v</span>
              </button>
            )}
          </div>
        </div>
      </div>

            <div className="flex justify-center items-stretch gap-3 mt-4 md:mt-6 relative z-10">
        <button
          onClick={(e) => { e.stopPropagation(); router.push('/photowall'); }}
          className="bg-white/30 dark:bg-slate-700/30 backdrop-blur-sm border border-white/30 dark:border-white/10 rounded-2xl py-2 px-6 min-w-[120px] hover:bg-white/50 dark:hover:bg-slate-700/50 transition-all"
        >
          <div className="text-base md:text-xl font-black text-amber-600 dark:text-amber-300">{photoCount}</div>
          <div className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">照片</div>
        </button>
        {/* 催开服按钮 - 移至照片按钮旁边 */}
        <button
          onClick={handleUrge}
          className="relative flex flex-col items-center justify-center gap-0.5 px-4 py-2 rounded-2xl bg-gradient-to-br from-pink-500/90 to-rose-500/90 hover:from-pink-400 hover:to-rose-400 active:scale-95 text-white text-xs md:text-sm font-black shadow-lg shadow-pink-500/40 transition-all overflow-visible"
        >
          <span className="text-base md:text-lg leading-none">⚡</span>
          <span className="text-[10px] md:text-xs">催开服</span>
          <span className="inline-flex items-center justify-center min-w-[20px] h-4 px-1 rounded-full bg-white/30 text-[9px] font-black tabular-nums">{urgeCount}</span>
        </button>
      </div>

      {/* 樱花粒子层 - 覆盖整卡片，粒子从点击位置绽开 */}
      <div ref={burstLayerRef} className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden>
        {petals.map((p) => (
          <span
            key={p.id}
            className="absolute will-change-transform"
            style={{
              left: `${p.originX}px`,
              top: `${p.originY}px`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              background: 'radial-gradient(circle at 30% 30%, #ffe4ec 0%, #ffb6c1 40%, #ff69b4 100%)',
              borderRadius: '65% 35% 70% 30% / 60% 60% 40% 40%',
              transform: `translate(-50%, -50%) rotate(${p.rotStart}deg)`,
              animation: `sakura-burst ${p.duration}s ${p.delay}s cubic-bezier(0.2, 0.6, 0.4, 1) forwards`,
              ['--sakura-drift' as any]: `${p.drift}px`,
              ['--sakura-drift-y' as any]: `${p.driftY ?? 0}px`,
              ['--sakura-rot' as any]: `${p.rotEnd}deg`,
              boxShadow: '0 0 6px rgba(255,182,193,0.6)'
            }}
          />
        ))}
        {bubble && (
          <div
            key={bubble.id}
            className="absolute pointer-events-none"
            style={{
              left: `${bubble.x}px`,
              top: `${bubble.y}px`,
              transform: 'translate(-50%, -100%)',
              animation: 'bubble-rise 2.2s ease-out forwards',
            }}
          >
            <div className="px-3 py-1.5 rounded-2xl bg-pink-500/95 text-white text-xs font-bold whitespace-nowrap shadow-lg shadow-pink-500/40 backdrop-blur-sm">
              💬 {bubble.text}
            </div>
          </div>
        )}
      </div>
      <style jsx>{`
        @keyframes sakura-burst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(0) scale(0.4);
          }
          15% {
            opacity: 1;
            transform: translate(calc(-50% + var(--sakura-drift) * 0.3), calc(-50% + var(--sakura-drift-y) * 0.3)) rotate(45deg) scale(1.1);
          }
          100% {
            opacity: 0;
            transform: translate(calc(-50% + var(--sakura-drift)), calc(-50% + var(--sakura-drift-y))) rotate(var(--sakura-rot)) scale(0.9);
          }
        }
        @keyframes bubble-rise {
          0% { opacity: 0; transform: translate(-50%, -90%) scale(0.8); }
          15% { opacity: 1; transform: translate(-50%, -110%) scale(1); }
          85% { opacity: 1; transform: translate(-50%, -180%) scale(1); }
          100% { opacity: 0; transform: translate(-50%, -220%) scale(0.9); }
        }
      `}</style>
    </div>
  );
}
