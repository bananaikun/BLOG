"use client";

import { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

// 【增强版 LRC 歌词解析】
function parseLrc(lrcText: string) {
  if (!lrcText || lrcText.length > 30000) return [];

  const lines = lrcText.split(/\r?\n/);
  const result = [];

  for (let line of lines) {
    const matches = [...line.matchAll(/\[(\d{2,}):(\d{2})(?:\.(\d{2,3}))?\]/g)];
    if (matches.length > 0) {
      let text = line.replace(/\[\d{2,}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      const cleanText = text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, "");
      if (cleanText) {
        for (const match of matches) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = match[3] ? parseInt(match[3]) : 0;
          const divisor = match[3] && match[3].length === 3 ? 1000 : 100;
          const time = min * 60 + sec + ms / divisor;
          result.push({ time, text: cleanText });
        }
      }
    }
  }
  return result.sort((a, b) => a.time - b.time);
}

type PlayMode = 'loop' | 'single' | 'random';

interface NeteaseMe {
  userId: number | null;
  nickname: string | null;
  avatarUrl: string | null;
  vipType: number;
  vipLevel: number;
  expireTime: number;
}

interface MusicContextType {
  playlist: any[];
  currentIndex: number;
  currentSong: any;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  currentLyric: string;
  isLoading: boolean;
  volume: number;
  isMuted: boolean;
  playMode: PlayMode;
  autoPlay: boolean;
  me: NeteaseMe;
  meLoading: boolean;
  togglePlay: () => void;
  nextSong: () => void;
  prevSong: () => void;
  handleSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
  playSong: (index: number) => void;
  selectSong: (index: number) => void;
  setVolume: (value: number) => void;
  toggleMute: () => void;
  togglePlayMode: () => void;
  loadPlaylist: (playlistId: string) => Promise<boolean>;
  setAutoPlay: (v: boolean) => void;
  addToPlaylist: (song: any) => boolean;
  isInPlaylist: (id: string | number) => boolean;
  removeFromPlaylist: (id: string | number) => boolean;
  refreshMe: () => Promise<void>;
}

const MusicContext = createContext<MusicContextType | null>(null);

export function MusicProvider({ children }: { children: ReactNode }) {
  const [playlist, setPlaylistState] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState<{ time: number; text: string }[]>([]);
  const [currentLyric, setCurrentLyric] = useState("正在连接高可用神经云端...");
  const [isLoading, setIsLoading] = useState(true);
  const [volume, setVolumeState] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playMode, setPlayMode] = useState<PlayMode>('loop');
  const [autoPlay, setAutoPlay] = useState(true); // 默认自动播放
  const audioRef = useRef<HTMLAudioElement>(null);
  const hasHydrated = useRef(false);

  // 同步设置 playlist (同时持久化到 localStorage)
  const setPlaylist = (next: any[] | ((prev: any[]) => any[])) => {
    setPlaylistState((prev) => {
      const value = typeof next === 'function' ? (next as any)(prev) : next;
      if (typeof window !== 'undefined' && hasHydrated.current) {
        try {
          localStorage.setItem('music_playlist', JSON.stringify(value));
        } catch {}
      }
      return value;
    });
  };

  // 持久化当前播放索引 (以便刷新后从同一首开始)
  useEffect(() => { if (hasHydrated.current && typeof window !== 'undefined') localStorage.setItem('music_current_index', String(currentIndex)); }, [currentIndex]);
  // 持久化播放模式
  useEffect(() => { if (hasHydrated.current && typeof window !== 'undefined') localStorage.setItem('music_play_mode', playMode); }, [playMode]);
  // 持久化音量
  useEffect(() => { if (hasHydrated.current && typeof window !== 'undefined') localStorage.setItem('music_volume', String(volume)); }, [volume]);
  // 持久化静音
  useEffect(() => { if (hasHydrated.current && typeof window !== 'undefined') localStorage.setItem('music_muted', isMuted ? '1' : '0'); }, [isMuted]);
  // 持久化自动播放
  useEffect(() => { if (hasHydrated.current && typeof window !== 'undefined') localStorage.setItem('music_autoplay', autoPlay ? '1' : '0'); }, [autoPlay]);
  // 节流持久化 currentTime (每 5 秒一次)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const id = setInterval(() => {
      try { localStorage.setItem('music_current_time', String(currentTime)); } catch {}
    }, 5000);
    return () => clearInterval(id);
  }, [currentTime]);
// 网易云登录用户信息（启动时自动从 cookie 验证 + 后续持续刷新）
  const [me, setMe] = useState<{
    userId: number | null;
    nickname: string | null;
    avatarUrl: string | null;
    vipType: number;     // 0=非会员, 1=普通VIP, 11=黑胶VIP (官方编码)
    vipLevel: number;
    expireTime: number;   // 毫秒时间戳, 0=未知
  }>({
    userId: null,
    nickname: null,
    avatarUrl: null,
    vipType: 0,
    vipLevel: 0,
    expireTime: 0,
  });
  const [meLoading, setMeLoading] = useState(false);


  // hydrate 后从 localStorage 恢复 currentTime 到 audio
  // ⚠️ 关键修复: 只在首次 hydrate 时恢复一次, 切歌时绝不恢复!
  //   之前依赖 [currentIndex, playlist.length], 每切一首歌都会把上一首的 currentTime
  //   (比如 30 秒) 恢复到新歌上, 导致新歌一开播就跳到 30 秒
  //   改为: 用 hasRestoredRef 标记, 只恢复一次
  const hasRestoredRef = useRef(false);
  useEffect(() => {
    if (!hasHydrated.current) return;
    if (hasRestoredRef.current) return; // 已恢复过, 不再恢复
    if (!audioRef.current) return;
    const cached = typeof window !== 'undefined' ? parseFloat(localStorage.getItem('music_current_time') || '0') : 0;
    if (cached <= 5) {
      hasRestoredRef.current = true;
      return;
    }
    // metadata 已加载
    if (audioRef.current.duration > 0) {
      if (cached < audioRef.current.duration) {
        audioRef.current.currentTime = cached;
      }
      hasRestoredRef.current = true;
    } else {
      // metadata 尚未加载，等到 loadedmetadata 再设
      const onLoaded = () => {
        if (audioRef.current && cached < (audioRef.current.duration || Infinity)) {
          audioRef.current.currentTime = cached;
        }
        hasRestoredRef.current = true;
        audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
      };
      audioRef.current.addEventListener('loadedmetadata', onLoaded);
      return () => {
        audioRef.current?.removeEventListener('loadedmetadata', onLoaded);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasHydrated.current, playlist.length]);
  // 验证并刷新当前网易云会员状态 (从 localStorage 读 cookie, 调用 /api/login/status)
  const refreshMe = async () => {
    if (typeof window === 'undefined') return;
    const cookie = localStorage.getItem('netease_cookie');
    if (!cookie) {
      setMe({ userId: null, nickname: null, avatarUrl: null, vipType: 0, vipLevel: 0, expireTime: 0 });
      return;
    }
    setMeLoading(true);
    try {
      const res = await fetch(`/api/login/status?cookie=${encodeURIComponent(cookie)}`);
      const data = await res.json();
      if (data?.code === 200 && data.data?.profile) {
        setMe({
          userId: data.data.profile.userId ?? null,
          nickname: data.data.profile.nickname ?? null,
          avatarUrl: data.data.profile.avatarUrl ?? null,
          vipType: data.data.vipInfo?.vipType ?? data.data.account?.vipType ?? 0,
          vipLevel: data.data.vipInfo?.vipLevel ?? data.data.account?.vipLevel ?? 0,
          expireTime: data.data.vipInfo?.expireTime ?? 0,
        });
        // 后端可能返回刷新后的新 cookie (login_refresh 续命成功), 更新本地存储
        if (data.data?.newCookie && typeof data.data.newCookie === 'string' && data.data.newCookie !== cookie) {
          try {
            localStorage.setItem('netease_cookie', data.data.newCookie);
            window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie: data.data.newCookie } }));
          } catch {}
        }
      } else {
        // ⚠️ 关键修复: 不要清除 cookie!
        // 之前这里直接 localStorage.removeItem('netease_cookie') 是登录持久化失效的元凶
        // 原因: /api/login/status 可能因网络波动/字段变化临时返回非 200, 但 cookie 本身 (MUSIC_U) 仍有效
        //       一旦这里删除 cookie, NeteaseQRLogin 的重试机制也救不回来 (cookie 已被删)
        // 改为: 只更新 me 状态为 null, 保留 cookie; 真正失效由 NeteaseQRLogin 重试确认, 或用户主动 logout
        setMe({ userId: null, nickname: null, avatarUrl: null, vipType: 0, vipLevel: 0, expireTime: 0 });
      }
    } catch (e) {
      // 网络错误时保留现有 me 状态, 下次再试
    } finally {
      setMeLoading(false);
    }
  };

    // 启动时优先恢复 localStorage 中的歌单, 再拉取默认
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem('music_playlist');
      const cachedIdx = localStorage.getItem('music_current_index');
      const cachedMode = localStorage.getItem('music_play_mode');
      const cachedVol = localStorage.getItem('music_volume');
      const cachedMute = localStorage.getItem('music_muted');
      const cachedTime = localStorage.getItem('music_current_time');
      const cachedAuto = localStorage.getItem('music_autoplay');
      let restoredCount = 0;
      if (cached) {
        const list = JSON.parse(cached);
        if (Array.isArray(list) && list.length > 0) {
          setPlaylist(list);
          restoredCount = list.length;
          // hydrate 后立即清除 "云端音乐加载失败" 的残留状态
          const first = list[0];
          if (first && first.title) {
            setCurrentLyric(`${first.title || ''} · 已就绪`);
          } else {
            setCurrentLyric('歌单已恢复');
          }
          setIsLoading(false);
        }
      }
      if (cachedIdx) setCurrentIndex(parseInt(cachedIdx, 10) || 0);
      if (cachedMode === 'loop' || cachedMode === 'single' || cachedMode === 'random') setPlayMode(cachedMode);
      if (cachedVol) setVolumeState(parseFloat(cachedVol));
      if (cachedMute) setIsMuted(cachedMute === '1');
      if (cachedTime) {
        const t = parseFloat(cachedTime);
        if (!isNaN(t) && t >= 0) setCurrentTime(t);
      }
      if (cachedAuto === '0' || cachedAuto === '1') setAutoPlay(cachedAuto === '1');
      // 保留: 仍给 fetchMusicData 一次机会补充默认歌单 (如果本地空)
      if (restoredCount === 0) {
        setCurrentLyric('正在连接高可用神经云端…');
      }
    } catch {}
    hasHydrated.current = true;
    // 启动时立刻验证本地 cookie 是否有效 + 拉会员状态
    refreshMe();
    // 监听 cookie 变化（其他 tab 登录/退出）
    const onCookie = (e: StorageEvent) => {
      if (e.key === 'netease_cookie') refreshMe();
    };
    window.addEventListener('storage', onCookie);
    // 监听自定义事件 (NeteaseQRLogin 扫码后)
    const onCustom = (e: any) => {
      if (e?.detail?.cookie !== undefined) refreshMe();
    };
    window.addEventListener('netease-cookie-changed', onCustom as EventListener);
    return () => {
      window.removeEventListener('storage', onCookie);
      window.removeEventListener('netease-cookie-changed', onCustom as EventListener);
    };
  }, []);

  // 初始加载默认歌曲（仅当 localStorage 中无缓存歌单时才去远端拉）
  useEffect(() => {
    let isMounted = true;
    const fetchMusicData = async () => {
      try {
        // localStorage 已经有缓存歌单 → 先恢复 + 验证 URL
        const cached = localStorage.getItem('music_playlist');
        const cachedIdsStr = localStorage.getItem('music_playlist_ids');
        const cachedIds: string[] = cachedIdsStr ? JSON.parse(cachedIdsStr) : [];
        if (cached) {
          const list = JSON.parse(cached);
          if (Array.isArray(list) && list.length > 0) {
            if (isMounted) setIsLoading(false);
            return;
          }
        }
      } catch {}

      try {
        // 从 API 获取配置中的默认歌曲
        const configRes = await fetch('/api/config');
        const configData = await configRes.json();
        const config = configData.data || {};
        const songIds = config.cloudMusicIds || [];

        if (songIds.length === 0) {
          if (isMounted) setIsLoading(false);
          return;
        }

        const res = await fetch(`/api/music?ids=${songIds.join(',')}`);
        const rawResults = await res.json();

        const mergedPlaylist = rawResults
          .filter((song: any) => song && song.url && !song.error)
          .map((song: any) => ({
            id: song.id || Math.random().toString(),
            title: song.name || '未知歌曲',
            artist: song.artist || song.author || '未知歌手',
            cover: song.cover || song.pic || '',
            src: song.url,
            fallbackSrc: song.url,
            lrcUrl: null,
            lyrics: song.lrc ? parseLrc(song.lrc) : []
          }));

        if (isMounted) {
          if (mergedPlaylist.length > 0) {
            setPlaylist(mergedPlaylist);
            // 保存 id 列表，用于后续 URL 刷新
            try { localStorage.setItem('music_playlist_ids', JSON.stringify(mergedPlaylist.map((s: any) => String(s.id)))); } catch {}
            if (config.musicAutoPlay !== false) {
              setAutoPlay(true);
            }
            // 成功后立刻设歌词 + 清掉失败状态, 让 CloudPlayer 不会一直显示 "云端音乐加载失败"
            const first = mergedPlaylist[0];
            setCurrentLyric(first?.title ? `🎵 ${first.title} · ${first.artist || '未知歌手'}` : '云端音乐已就绪');
          } else {
            // 只有完全没有歌单才显示失败
            if (!localStorage.getItem('music_playlist')) {
              setCurrentLyric('云端链路受阻, 等待重试');
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        if (isMounted) {
          if (!localStorage.getItem('music_playlist')) {
            setCurrentLyric('网络初始化失败, 重试中…');
          }
          setIsLoading(false);
        }
      }
    };

    fetchMusicData();
    return () => { isMounted = false; };
  }, []);

  // 当 playlist 首次加载或切歌时尝试播放 (统一入口, 避免多个 effect 冲突)
  useEffect(() => {
    if (playlist.length === 0) return;
    if (!audioRef.current) return;
    const song = playlist[currentIndex];
    if (!song) return;

    // 更新歌词
    setLyrics([]);
    if (song.lyrics && song.lyrics.length > 0) {
      setLyrics(song.lyrics);
      setCurrentLyric(song.lyrics[0]?.text || '♪ 纯享音乐 ♪');
    } else {
      setCurrentLyric('♪ 正在缓冲 ♪');
    }

    // 只有用户期望播放时才尝试 play (不主动启动, 避免多个 effect 反复 play/pause)
    if (isPlaying) {
      const timer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
            // 浏览器 autoplay 策略阻止, 等用户交互
          });
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, playlist.length]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // 首次用户交互后重试自动播放（绕过浏览器 autoplay policy）
  // 优化: 只绑定一次, 不每次 playlist 变化都重新绑定
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const tryAutoplay = () => {
      if (playlist.length > 0 && audioRef.current && audioRef.current.paused && autoPlay) {
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    };
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'];
    events.forEach((ev) => document.addEventListener(ev, tryAutoplay, { once: true, capture: true }));
    return () => {
      events.forEach((ev) => document.removeEventListener(ev, tryAutoplay, { capture: true }));
    };
  }, []); // 只绑定一次, 不依赖 playlist


  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(!isPlaying);
    }
  };

  const nextSong = () => {
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((prev) => (prev + 1) % playlist.length);
    }
  };

  const prevSong = () => {
    if (playMode === 'random') {
      setCurrentIndex(Math.floor(Math.random() * playlist.length));
    } else {
      setCurrentIndex((prev) => (prev - 1 + playlist.length) % playlist.length);
    }
  };

  const playSong = (index: number) => {
    setCurrentIndex(index);
    setIsPlaying(true);
    // 直接调用 play (不等 effect), 确保点击同一首歌也能重新播放
    if (audioRef.current) {
      // 如果点击的是当前歌曲, 直接 play; 如果切歌, 等 src 更新后 effect 会触发 play
      if (index === currentIndex) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
      }
    }
  };

  const selectSong = playSong;

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const { currentTime, duration } = audioRef.current;
      setCurrentTime(currentTime);
      setDuration(duration || 0);
      setProgress((currentTime / (duration || 1)) * 100);

      if (lyrics.length > 0) {
        const activeLyric = lyrics.slice().reverse().find(l => currentTime >= l.time);
        if (activeLyric && activeLyric.text !== currentLyric) {
          setCurrentLyric(activeLyric.text);
        }
      }
    }
  };

  const handleEnded = () => {
    if (playMode === 'single' && audioRef.current) {
       audioRef.current.currentTime = 0;
       audioRef.current.play();
    } else {
       nextSong();
    }
  };


  // 音频加载失败时 (e.g. VIP 歌曲无 cookie, URL 失效) - 尝试重新获取 URL 后再跳下一首
  const handleAudioError = async (e: any) => {
    console.warn('[MusicProvider] audio error:', currentSong?.title, 'src:', currentSong?.src?.slice(0, 60));
    if (!currentSong) return;

    // 尝试重新拉取该歌曲的 URL（避免因 cookie 状态变化导致的过期 URL）
    try {
      const cookie = localStorage.getItem('netease_cookie') || '';
      const sep = cookie ? '&cookie=' + encodeURIComponent(cookie) : '';
      const r = await fetch('/api/music?ids=' + currentSong.id + sep);
      if (r.ok) {
        const arr = await r.json();
        const fresh = Array.isArray(arr) ? arr[0] : null;
        if (fresh && fresh.url) {
          setPlaylist((prev) => prev.map((p) =>
            String(p.id) === String(currentSong.id)
              ? Object.assign({}, p, { src: fresh.url, fallbackSrc: fresh.url })
              : p
          ));
          // URL 已刷新 → 重新播放当前（手动 reload 一次 audio 元素以加载新 src）
          setCurrentLyric('! 链接已恢复, 重新尝试播放');
          if (audioRef.current) {
            audioRef.current.load();
            audioRef.current.play().catch(() => {});
          }
          setIsPlaying(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[MusicProvider] refresh url failed:', err);
    }

    // 标记不可用 + 跳到下一首
    setCurrentLyric('! ' + (currentSong.title || '歌曲') + ' 不可用, 跳到下一首...');
    setTimeout(() => {
      if (playlist.length > 1) {
        const nextIdx = (currentIndex + 1) % playlist.length;
        setCurrentIndex(nextIdx);
        setIsPlaying(true);
        setCurrentLyric('已切换下一首');
      } else {
        setIsPlaying(false);
        setCurrentLyric('! 播放失败, 请尝试登录后重试');
      }
    }, 1500);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = Number(e.target.value);
    setProgress(newProgress);
    if (audioRef.current && audioRef.current.duration) {
      audioRef.current.currentTime = (newProgress / 100) * audioRef.current.duration;
    }
  };

  const setVolume = (val: number) => {
    setVolumeState(val);
    if (isMuted && val > 0) setIsMuted(false);
  };

  const toggleMute = () => setIsMuted(!isMuted);

  const togglePlayMode = () => {
    setPlayMode(prev => {
      const next = prev === 'loop' ? 'single' : prev === 'single' ? 'random' : 'loop';
      if (typeof window !== 'undefined') {
        try { localStorage.setItem('music_play_mode', next); } catch {}
      }
      return next;
    });
  };

  // 获取歌曲真实播放 URL（如果已登录，带上 cookie 解锁会员音质）
  const fetchSongUrl = async (songId: string, fallback: string): Promise<string> => {
    try {
      const cookie = typeof window !== 'undefined' ? localStorage.getItem('netease_cookie') : null;
      const url = cookie
        ? `/api/login/song/url?id=${encodeURIComponent(songId)}&cookie=${encodeURIComponent(cookie)}`
        : `/api/login/song/url?id=${encodeURIComponent(songId)}`;
      const res = await fetch(url);
      const data = await res.json();
      const realUrl = data?.data?.[0]?.url;
      if (realUrl && realUrl !== null) return realUrl;
    } catch {}
    return fallback;
  };

  // 加载歌单
  const loadPlaylist = async (playlistId: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      // 传递 cookie, 让后端获取完整歌单 + 可用的播放 URL
      const cookie = typeof window !== 'undefined' ? (localStorage.getItem('netease_cookie') || '') : '';
      const cookieParam = cookie ? `&cookie=${encodeURIComponent(cookie)}` : '';
      const res = await fetch(`/api/music/playlist?id=${playlistId}${cookieParam}`);
      const data = await res.json();

      if (data.error || !data.songs || data.songs.length === 0) {
        setIsLoading(false);
        return false;
      }

      const newPlaylist = data.songs
        .filter((song: any) => song && !song.error) // 保留所有歌曲, 包括 url 为空的 VIP 歌曲
        .map((song: any) => ({
          id: song.id || Math.random().toString(),
          title: song.name || '未知歌曲',
          artist: song.artist || song.author || '未知歌手',
          cover: song.cover || song.pic || '',
          fallbackSrc: song.url || '',
          src: song.url || '', // VIP 未登录时为空, 播放时会提示
          lrcUrl: null,
          lyrics: song.lrc ? parseLrc(song.lrc) : []
        }));

      if (newPlaylist.length > 0) {
        setPlaylist(newPlaylist);
        // 保存 id 列表
        try { localStorage.setItem('music_playlist_ids', JSON.stringify(newPlaylist.map((s: any) => String(s.id)))); } catch {}
        setCurrentIndex(0);
        setAutoPlay(true);
        setIsPlaying(true);
        setIsLoading(false);
        // 异步升级为会员音质（如果已登录）
        // 注意: 不修改 index 0 (当前播放) 的 src, 避免打断刚启动的播放
        if (typeof window !== 'undefined' && localStorage.getItem('netease_cookie')) {
          (async () => {
            const upgraded = await Promise.all(
              newPlaylist.map((s: any) => fetchSongUrl(s.id, s.fallbackSrc))
            );
            setPlaylist((prev) => prev.map((p, idx) => {
              if (idx === 0) return p; // 不动当前歌曲
              return { ...p, src: upgraded[idx] };
            }));
          })();
        }
        return true;
      }
      setIsLoading(false);
      return false;
    } catch {
      setIsLoading(false);
      return false;
    }
  };

  // 切歌时不再主动升级音质!
  // 根因: 升级会改变 currentSong.src → React 重渲染 <audio> → 浏览器重新加载 → 播放中断
  // 改为: 仅在音频出错 (handleAudioError) 时才刷新 URL, 避免打断正常播放
  useEffect(() => {
    if (playlist.length === 0) return;
    const song = playlist[currentIndex];
    if (!song?.id) return;
    // 不做任何操作, 保持当前 src 不变, 避免播放中断
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  // 监听登录事件，触发列表升级 (但不修改当前播放歌曲的 src, 避免打断播放)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onChange = (e: any) => {
      const cookie = e.detail?.cookie;
      if (cookie && playlist.length > 0) {
        (async () => {
          const upgraded = await Promise.all(
            playlist.map((s: any) => fetchSongUrl(s.id, s.fallbackSrc || s.src))
          );
          // 只更新非当前播放歌曲的 src, 当前歌曲保持不变 (切歌时才会用新 URL)
          setPlaylist((prev) => prev.map((p, idx) => {
            if (idx === currentIndex) return p; // 不动当前歌曲
            return { ...p, src: upgraded[idx] };
          }));
        })();
      }
    };
    window.addEventListener('netease-cookie-changed', onChange);
    return () => window.removeEventListener('netease-cookie-changed', onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playlist.length]);

  const currentSong = playlist[currentIndex];

  const addToPlaylist = (song: any): boolean => {
    if (!song || !song.id) return false
    let added = false
    setPlaylist((prev) => {
      const exists = prev.some((p: any) => String(p.id) === String(song.id))
      if (exists) return prev
      added = true
      // 补齐必要字段, 使用已有 url/src, 不用不稳定的外链
      const songId = String(song.id)
      const existingUrl = song.src || song.url || ''
      const normalized = {
        id: songId,
        title: song.title || song.name || '未知歌曲',
        name: song.name || song.title || '未知歌曲',
        artist: song.artist || song.author || '未知歌手',
        author: song.author || song.artist || '未知歌手',
        cover: song.cover || song.pic || '',
        pic: song.pic || song.cover || '',
        url: existingUrl,
        src: existingUrl,
        fallbackSrc: existingUrl,
        lrc: song.lrc || song.lyric || '',
        lyric: song.lyric || song.lrc || '',
        lyrics: song.lyrics || (song.lrc ? parseLrc(song.lrc) : []),
        duration: song.duration || 0
      }
      const newList = [...prev, normalized]
      // 同步保存 id 列表（供 URL 刷新使用）
      try { localStorage.setItem('music_playlist_ids', JSON.stringify(newList.map((p: any) => String(p.id)))) } catch {}
      return newList
    })

    // 异步预获取真实播放 URL (不阻塞 UI, 不影响当前播放)
    // 如果歌曲没有可用 src, 通过 API 获取; 如果已登录, 尝试升级为会员音质
    if (!song.src && !song.url) {
      const songId = String(song.id)
      fetchSongUrl(songId, '').then((realUrl) => {
        if (realUrl) {
          setPlaylist((prev) => prev.map((p) =>
            String(p.id) === songId
              ? { ...p, src: realUrl, url: realUrl, fallbackSrc: realUrl }
              : p
          ))
        }
      })
    }

    return added
  }

  const isInPlaylist = (id: string | number): boolean => {
    return playlist.some((p: any) => String(p.id) === String(id))
  }

  const removeFromPlaylist = (id: string | number): boolean => {
    let removed = false
    setPlaylistState((prev) => {
      const idx = prev.findIndex((p: any) => String(p.id) === String(id))
      if (idx === -1) return prev
      removed = true
      const next = prev.filter((_: any, i: number) => i !== idx)
      try {
        if (typeof window !== 'undefined') {
          localStorage.setItem('music_playlist', JSON.stringify(next))
          localStorage.setItem('music_playlist_ids', JSON.stringify(next.map((p: any) => String(p.id))))
        }
      } catch {}
      // 若当前播放的歌曲被移除, 索引不变 (切到下一首 / 暂停)
      if (idx === currentIndex) {
        if (next.length === 0) {
          // 列表删空 → 停掉 audio, 重置播放状态, 避免卡在"唤醒音频引擎中..."
          setCurrentIndex(0)
          if (typeof window !== 'undefined' && audioRef.current) {
            try {
              audioRef.current.pause()
              audioRef.current.currentTime = 0
            } catch {}
          }
          setIsPlaying(false)
          setCurrentLyric('播放列表已清空')
        } else if (idx >= next.length) {
          setCurrentIndex(0)
        }
      } else if (idx < currentIndex) {
        setCurrentIndex(currentIndex - 1)
      }
      return next
    })
    return removed
  }

  return (
    <MusicContext.Provider value={{
        playlist, currentIndex, currentSong, isPlaying, progress, currentTime, duration, currentLyric, isLoading,
        volume, isMuted, playMode, autoPlay,
        me, meLoading, refreshMe,
        togglePlay, nextSong, prevSong, handleSeek,
        playSong, selectSong, setVolume, toggleMute, togglePlayMode,
        loadPlaylist, setAutoPlay,
        addToPlaylist, isInPlaylist, removeFromPlaylist
    }}>
      {children}
      {currentSong && (
        <audio
          ref={audioRef}
          src={currentSong.src || undefined}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onLoadedMetadata={handleTimeUpdate}
          onError={handleAudioError}
          onPlay={() => setIsPlaying(true)}
          onPause={() => {
            // 只在用户主动暂停时更新状态, 不在缓冲时更新
            if (audioRef.current && !audioRef.current.ended) {
              // 检查是否是 seek 导致的暂停, 如果不是则设为暂停
            }
          }}
          onWaiting={() => setCurrentLyric('♪ 缓冲中 ♪')}
          onPlaying={() => {
            if (currentLyric === '♪ 缓冲中 ♪' || currentLyric === '♪ 正在缓冲 ♪') {
              setCurrentLyric(lyrics[0]?.text || '♪ 播放中 ♪');
            }
          }}
          autoPlay={autoPlay}
          preload="auto"
        />
      )}
    </MusicContext.Provider>
  );
}

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (!context) throw new Error("useMusic must be used within MusicProvider");
  return context;
};
