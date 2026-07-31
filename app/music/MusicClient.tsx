"use client";

import { useEffect, useRef, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, RefreshCcw, RefreshCw, ListMusic, Mic2, Disc3, Volume2, VolumeX, Search, X, MessageSquare, Download, Shield, LogOut, ChevronRight, ChevronLeft, ListPlus, Music2, Library, Plus, Trash2 } from 'lucide-react';
import Navbar from '../../components/Navbar';
import PageTransition from '../../components/PageTransition';
import { useMusic } from '../../components/MusicProvider';
import Comments from '../../components/Comments';
import NeteaseQRLogin from './NeteaseQRLogin';

type Tab = 'lyrics' | 'myPlaylists' | 'playQueue';

interface UserPlaylist {
  id: string;
  name: string;
  cover: string;
  trackCount: number;
  playCount: number;
  creator: string;
}

export default function MusicClient() {
  const {
    playlist, currentSong, isPlaying, progress, currentTime, duration, currentLyric,
    isLoading, togglePlay, nextSong, prevSong, handleSeek,
    playSong, selectSong,
    playMode, togglePlayMode,
    volume, setVolume, isMuted, toggleMute,
    loadPlaylist, addToPlaylist, isInPlaylist, removeFromPlaylist,
    me, meLoading, refreshMe
  } = useMusic();

  const lyricContainerRef = useRef<HTMLDivElement>(null);
  const activeLyricRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<Tab>('lyrics');
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const [parsedLyrics, setParsedLyrics] = useState<any[]>([]);

  // 我的歌单列表
  const [userPlaylists, setUserPlaylists] = useState<UserPlaylist[]>([]);
  const [userPlaylistsLoading, setUserPlaylistsLoading] = useState(false);
  const [userPlaylistsError, setUserPlaylistsError] = useState('');

  // 当前选中的歌单(子视图)
  const [selectedPlaylist, setSelectedPlaylist] = useState<UserPlaylist | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);
  const [playlistSongsLoading, setPlaylistSongsLoading] = useState(false);
  const [playlistSongsError, setPlaylistSongsError] = useState('');

  // 播放列表 tab 中的提示
  const [toast, setToast] = useState('');

  // 拉取我的歌单列表
  useEffect(() => {
    if (activeTab !== 'myPlaylists') return;
    const cookie = typeof window !== 'undefined' ? localStorage.getItem('netease_cookie') : '';
    if (!cookie) {
      setUserPlaylists([]);
      setUserPlaylistsError('请先登录网易云账号');
      return;
    }
    setUserPlaylistsLoading(true);
    setUserPlaylistsError('');
    fetch(`/api/music/user-playlists?cookie=${encodeURIComponent(cookie)}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.playlists)) {
          setUserPlaylists(data.playlists);
          if (data.playlists.length === 0) {
            setUserPlaylistsError('该账号下暂无歌单');
          }
        } else {
          setUserPlaylistsError(data?.error || '获取歌单列表失败');
        }
      })
      .catch(() => setUserPlaylistsError('网络错误, 请稍后重试'))
      .finally(() => setUserPlaylistsLoading(false));
  }, [activeTab]);

  // 选中歌单后, 拉取该歌单下的歌曲
  useEffect(() => {
    if (!selectedPlaylist) {
      setPlaylistSongs([]);
      return;
    }
    setPlaylistSongsLoading(true);
    setPlaylistSongsError('');
    // 修复: 必须传 cookie, 否则 VIP 歌曲拿不到 URL, 被 filter(s=>s.url) 过滤后变空
    const cookie = typeof window !== 'undefined' ? (localStorage.getItem('netease_cookie') || '') : '';
    const cookieParam = cookie ? `&cookie=${encodeURIComponent(cookie)}` : '';
    fetch(`/api/music/playlist?id=${selectedPlaylist.id}${cookieParam}`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.songs) && data.songs.length > 0) {
          setPlaylistSongs(data.songs);
        } else {
          setPlaylistSongs([]);
          setPlaylistSongsError(data?.error || '该歌单下暂无歌曲');
        }
      })
      .catch(() => setPlaylistSongsError('网络错误, 请稍后重试'))
      .finally(() => setPlaylistSongsLoading(false));
  }, [selectedPlaylist]);

  useEffect(() => {
    if (!currentSong) {
      setParsedLyrics([]);
      return;
    }

    const rawLrc = currentSong.lrc || currentSong.lyric || (typeof currentSong.lyrics === 'string' ? currentSong.lyrics : '');

    if (Array.isArray(currentSong.lyrics) && currentSong.lyrics.length > 0) {
      setParsedLyrics(currentSong.lyrics);
      return;
    }

    if (!rawLrc || typeof rawLrc !== 'string') {
      setParsedLyrics([]);
      return;
    }

    const lines = rawLrc.split('\n');
    const parsed = [];
    const timeExp = /\[(\d{2,}):(\d{2})(?:[.:](\d{2,3}))?\]/g;
    let hasValidTime = false;

    for (const line of lines) {
      const text = line.replace(/\[\d{2,}:\d{2}(?:[.:]\d{2,3})?\]/g, '').trim();
      if (!text) continue;

      let match;
      while ((match = timeExp.exec(line)) !== null) {
        hasValidTime = true;
        const min = parseInt(match[1], 10);
        const sec = parseInt(match[2], 10);
        const ms = match[3] ? parseFloat(`0.${match[3]}`) : 0;
        parsed.push({ time: min * 60 + sec + ms, text });
      }
    }

    if (hasValidTime) {
      setParsedLyrics(parsed.sort((a, b) => a.time - b.time));
    } else {
      setParsedLyrics(lines.map(l => ({ time: -1, text: l.trim() })).filter(l => l.text));
    }
  }, [currentSong?.id, currentSong?.lyric, currentSong?.lrc, currentSong?.lyrics]);

  const activeLyricIndex = useMemo(() => {
    if (!parsedLyrics.length) return -1;
    let idx = parsedLyrics.findIndex((l: any) => l.time > currentTime) - 1;
    if (idx === -2) idx = parsedLyrics.length - 1;
    return Math.max(0, idx);
  }, [currentTime, parsedLyrics]);

  useEffect(() => {
    if (activeLyricRef.current && lyricContainerRef.current && activeTab === 'lyrics') {
      const container = lyricContainerRef.current;
      const activeItem = activeLyricRef.current;
      const scrollTarget = activeItem.offsetTop - container.offsetHeight / 2 + activeItem.offsetHeight / 2;
      container.scrollTo({ top: scrollTarget, behavior: 'auto' });
    }
  }, [activeLyricIndex, activeTab]);

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getPlayModeIcon = () => {
    switch (playMode) {
      case 'loop': return <Repeat size={18} className="text-slate-500 hover:text-indigo-500 md:w-5 md:h-5" />;
      case 'single': return <RefreshCcw size={18} className="text-indigo-500 md:w-5 md:h-5" />;
      case 'random': return <Shuffle size={18} className="text-slate-500 hover:text-indigo-500 md:w-5 md:h-5" />;
      default: return <Repeat size={18} className="text-slate-500 md:w-5 md:h-5" />;
    }
  };

  const handlePlaySong = (index: number) => {
    if (typeof playSong === 'function') playSong(index);
    else if (typeof selectSong === 'function') selectSong(index);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  // 播放列表 tab 中的歌曲渲染(扁平化, 可点击播放)
  const renderSongRow = (song: any, opts: { showRemove?: boolean } = {}) => {
    const inQueue = isInPlaylist(song.id);
    const isCurrent = currentSong && String(song.id) === String(currentSong.id);
    return (
      <div
        key={String(song.id)}
        onClick={() => {
          // 在我的歌单子视图里点击 → 直接播放这首歌
          if (opts.showRemove) {
            // 播放列表视图: 不直接播放(避免误触发)
            return;
          }
          if (!inQueue) {
            addToPlaylist(song);
          }
          const idx = playlist.findIndex((s: any) => String(s.id) === String(song.id));
          if (idx >= 0) handlePlaySong(idx);
        }}
        className={`group flex items-center justify-between p-3 md:p-4 rounded-xl md:rounded-2xl cursor-pointer transition-all border ${isCurrent ? 'bg-white/60 dark:bg-slate-700/80 shadow-md border-indigo-500/30' : 'border-transparent hover:bg-white/30 dark:hover:bg-slate-700/40'}`}
      >
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
          <div className="relative w-10 h-10 md:w-12 md:h-12 shrink-0 rounded-lg md:rounded-xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-700">
            {song.cover || song.pic ? (
              <img src={song.cover || song.pic} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">
                <Music2 size={18} />
              </div>
            )}
            {isCurrent && isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[1px]">
                <div className="flex gap-[3px] items-end h-2 md:h-3">
                  <span className="w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_0ms]" />
                  <span className="w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_200ms]" />
                  <span className="w-0.5 bg-white rounded-full animate-[bounce_1s_infinite_400ms]" />
                </div>
              </div>
            )}
          </div>
          <div className="flex flex-col truncate">
            <span className={`text-sm md:text-[15px] font-black truncate ${isCurrent ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
              {song.title || song.name}
            </span>
            <span className="text-[10px] md:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
              {song.artist || song.author}
            </span>
          </div>
        </div>
        {opts.showRemove ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (removeFromPlaylist) {
                removeFromPlaylist(song.id);
                showToast(`已移出播放列表: ${song.title || song.name}`);
              }
            }}
            className="ml-2 w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-full flex items-center justify-center bg-rose-500/15 text-rose-500 hover:bg-rose-500 hover:text-white hover:scale-110 active:scale-95 transition-all"
            title="移出播放列表"
          >
            <Trash2 size={14} className="md:w-4 md:h-4" />
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const ok = addToPlaylist(song);
              if (ok) showToast(`已加入播放列表: ${song.title || song.name}`);
              else showToast('已在播放列表中');
            }}
            disabled={inQueue}
            className={`ml-2 w-8 h-8 md:w-9 md:h-9 shrink-0 rounded-full flex items-center justify-center transition-all ${inQueue ? 'bg-slate-300/40 dark:bg-slate-700/40 text-slate-400 dark:text-slate-600 cursor-not-allowed' : 'bg-indigo-500/15 text-indigo-500 hover:bg-indigo-500 hover:text-white hover:scale-110 active:scale-95'}`}
            title={inQueue ? '已在播放列表中' : '加入播放列表'}
          >
            {inQueue ? <span className="text-lg md:text-xl font-black leading-none">✓</span> : <Plus size={16} className="md:w-5 md:h-5" strokeWidth={2.5} />}
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen relative pb-32 flex flex-col">
        <Navbar />
        <div className="flex-1 flex flex-col items-center justify-center animate-pulse gap-4">
          <Disc3 size={48} className="text-indigo-500 animate-spin" />
          <span className="font-black text-slate-500 tracking-widest text-sm">唤醒音频引擎中...</span>
        </div>
      </div>
    );
  }

  // 播放列表为空时也展示完整音乐界面 (歌词 / 控件 / 三个 tab 都可以切换)
  // 没有 currentSong 时, 用占位封面 + 提示文案, 不再走"空空如也"全屏空状态
  const hasSongs = playlist.length > 0;
  const songCover = (hasSongs && currentSong)
    ? (currentSong.cover || currentSong.pic || "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop")
    : "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?q=80&w=1000&auto=format&fit=crop";

  return (
    <div className="min-h-screen relative pb-10 flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-[-10%] bg-cover bg-center transition-opacity duration-1000 blur-[20px] opacity-40 dark:opacity-20 saturate-150" style={{ backgroundImage: `url(${songCover})` }} />
        <div className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-sm" />
      </div>

      <Navbar />

      <PageTransition>
        <div className="w-full max-w-7xl mx-auto mt-24 md:mt-28 px-4 sm:px-6 md:px-10 relative z-10">
          <div className="animate-fade-in-up mb-6 md:mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="text-center md:text-left">
              <h1 className="text-3xl md:text-5xl font-black text-slate-900 dark:text-white tracking-widest mb-1 md:mb-2 transition-colors duration-700">云端乐律</h1>
              <p className="text-xs md:text-base text-slate-600 dark:text-slate-400 font-medium tracking-wider transition-colors duration-700">在代码的缝隙中寻找灵魂的共鸣</p>
            </div>
            <div className="flex justify-center md:justify-end">
              {me?.nickname ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-gradient-to-br from-yellow-50/80 to-rose-50/80 dark:from-yellow-900/30 dark:to-rose-900/30 backdrop-blur-md border border-yellow-300/40 dark:border-yellow-500/30 shadow-lg" title={
                  me.expireTime > 0
                    ? `到期: ${new Date(me.expireTime).toLocaleDateString()}`
                    : '会员信息'
                }>
                  <img src={me.avatarUrl || ''} alt="" className="w-7 h-7 rounded-full border-2 border-yellow-400/60" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-black text-slate-800 dark:text-slate-100 max-w-[100px] truncate">{me.nickname}</span>
                      {me.vipType > 0 ? (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-yellow-400 to-orange-500 text-white shadow-sm">
                          {me.vipType === 11 ? '黑胶VIP' : `VIP${me.vipLevel || ''}`}
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                          非会员
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <Shield size={9} className="inline" />
                      验证有效
                      {me.expireTime > 0 && new Date(me.expireTime) > new Date() && (
                        <span className="text-slate-500 ml-1">· {Math.ceil((me.expireTime - Date.now()) / 86400000)}天到期</span>
                      )}
                    </span>
                  </div>
                  <button
                    onClick={() => refreshMe()}
                    disabled={meLoading}
                    className="ml-1 p-1 rounded-full hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-500 hover:text-indigo-500 transition-colors disabled:opacity-50"
                    title="刷新会员状态"
                  >
                    <RefreshCw size={12} className={meLoading ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('退出网易云登录？清除本地 cookie？')) {
                        localStorage.removeItem('netease_cookie');
                        window.dispatchEvent(new CustomEvent('netease-cookie-changed', { detail: { cookie: '' } }));
                      }
                    }}
                    className="p-1 rounded-full hover:bg-white/40 dark:hover:bg-slate-800/40 text-slate-500 hover:text-rose-500 transition-colors"
                    title="退出登录"
                  >
                    <LogOut size={12} />
                  </button>
                </div>
              ) : (
                <NeteaseQRLogin />
              )}
            </div>
          </div>

          <div className="flex flex-col md:grid md:grid-cols-12 gap-6 md:gap-8 w-full md:items-stretch md:h-[calc(100vh-320px)] md:min-h-[600px] md:max-h-[720px]">

            {/* ====== 左侧/顶部：播放控制台 ====== */}
            <div className="md:col-span-5 flex flex-col bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-[32px] shadow-2xl p-6 md:p-10 relative overflow-hidden transition-all duration-500 shrink-0 min-h-[460px] sm:min-h-[500px] md:min-h-0">

              <div className="flex-1 flex flex-col items-center justify-center relative z-10 w-full overflow-hidden py-4 md:py-0">
                <div className="relative w-40 h-40 sm:w-48 sm:h-48 lg:w-64 lg:h-64 flex-shrink-0 aspect-square mb-6 md:mb-10 flex items-center justify-center">
                   <div className={`absolute inset-0 m-auto w-[85%] h-[85%] bg-indigo-500/25 blur-[35px] rounded-full transition-all duration-1000 z-0 ${isPlaying ? 'opacity-90 scale-105' : 'opacity-20 scale-100'}`}></div>
                   <div className="absolute inset-0 m-auto w-[90%] h-[90%] rounded-full shadow-[0_0_40px_-5px_rgba(99,102,241,0.4)] z-0"></div>
                   <motion.div className={`absolute inset-0 w-full h-full rounded-full border-[4px] md:border-[6px] border-white/80 dark:border-slate-600/80 shadow-2xl overflow-hidden transition-transform duration-700 z-10 rotating-disc ${isPlaying ? 'scale-100' : 'scale-95'}`}
                     style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
                     <img src={songCover} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                     <div className="absolute inset-0 m-auto w-10 h-10 md:w-12 md:h-12 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md rounded-full z-30 shadow-inner border border-slate-300 dark:border-slate-700"></div>
                     <div className="absolute inset-0 z-20 rounded-full pointer-events-none opacity-20" style={{ background: 'conic-gradient(from 0deg, transparent, rgba(255,255,255,0.4), transparent, rgba(255,255,255,0.4), transparent)' }}></div>
                   </motion.div>
                </div>
                <div className="w-full text-center px-2 md:px-4 mb-2 md:mb-6">
                  <h1 className="text-lg md:text-xl lg:text-2xl font-black text-slate-900 dark:text-white truncate drop-shadow-sm tracking-tight">
                    {hasSongs ? (currentSong.title || currentSong.name) : '暂无播放'}
                  </h1>
                  <h2 className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400 truncate mt-1 md:mt-2 tracking-widest">
                    {hasSongs ? (currentSong.artist || currentSong.author) : '去「我的歌单」选首歌开始播放吧'}
                  </h2>
                </div>
              </div>

              <div className="w-full mt-auto relative z-20">
                <div className="w-full flex flex-col gap-1.5 mb-6 md:mb-8 px-1 md:px-3">
                  <input type="range" min="0" max="100" value={progress || 0} onChange={handleSeek} className="w-full h-1 md:h-1.5 rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #4f46e5 ${progress}%, rgba(0, 0, 0, 0.15) 0)` }} />
                  <div className="flex justify-between text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums"><span>{formatTime(currentTime)}</span><span>{formatTime(duration)}</span></div>
                </div>
                <div className="w-full flex items-center justify-between px-1 md:px-2 lg:px-4">
                  <button onClick={togglePlayMode} className="p-2 transition-transform hover:scale-110" title={
                    playMode === 'loop' ? '列表循环' : playMode === 'single' ? '单曲循环' : '随机播放'
                  }>{getPlayModeIcon()}</button>
                  <div className="flex items-center gap-3 md:gap-4 lg:gap-6">
                    <button onClick={prevSong} className="p-2 text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-transform hover:scale-110"><SkipBack size={24} className="md:w-7 md:h-7" fill="currentColor" /></button>
                    <button onClick={togglePlay} className="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 flex items-center justify-center bg-indigo-500 text-white rounded-full hover:scale-105 shadow-xl shadow-indigo-500/40">
                      {isPlaying ? <Pause size={28} className="md:w-8 md:h-8" fill="currentColor" /> : <Play size={28} className="md:w-8 md:h-8 ml-1" fill="currentColor" />}
                    </button>
                    <button onClick={nextSong} className="p-2 text-slate-700 dark:text-slate-300 hover:text-indigo-500 transition-transform hover:scale-110"><SkipForward size={24} className="md:w-7 md:h-7" fill="currentColor" /></button>
                  </div>
                  <div className="flex items-center" onMouseLeave={() => setShowVolumeSlider(false)}>
                    <AnimatePresence>
                      {showVolumeSlider && (
                        <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 80, opacity: 1 }} exit={{ width: 0, opacity: 0 }} className="hidden md:flex overflow-hidden items-center mr-2 bg-white/30 dark:bg-black/20 backdrop-blur-md rounded-full px-3 py-1.5 border border-white/20">
                          <input type="range" min="0" max="1" step="0.01" value={isMuted ? 0 : (volume || 0)} onChange={(e) => setVolume && setVolume(Number(e.target.value))} className="w-16 h-1 appearance-none rounded-full cursor-pointer" style={{ background: `linear-gradient(to right, #4f46e5 ${(volume || 0) * 100}%, rgba(0, 0, 0, 0.15) 0)` }} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button onClick={() => setShowVolumeSlider(!showVolumeSlider)} onDoubleClick={toggleMute} className={`p-2 rounded-full transition-all ${showVolumeSlider ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 hover:text-indigo-500'}`}>{isMuted || volume === 0 ? <VolumeX size={18} className="md:w-5 md:h-5"/> : <Volume2 size={18} className="md:w-5 md:h-5" />}</button>
                  </div>
                </div>
              </div>
            </div>

            {/* ====== 右侧/底部：歌词与歌单面板 ====== */}
            <div className="md:col-span-7 flex flex-col bg-white/40 dark:bg-slate-800/50 backdrop-blur-md border border-white/40 dark:border-white/10 rounded-[32px] shadow-2xl relative transition-colors duration-700 overflow-hidden h-[450px] md:h-auto shrink-0">
              <div className="flex items-center justify-center gap-1 p-1 mt-4 md:mt-6 mx-auto bg-white/50 dark:bg-slate-900/50 rounded-full shadow-inner border border-white/40 z-20 shrink-0 max-w-[90%]">
                <button
                  onClick={() => { setActiveTab('lyrics'); setSelectedPlaylist(null); }}
                  className={`flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-full font-black text-[11px] md:text-[13px] transition-all ${activeTab === 'lyrics' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  歌词
                </button>
                <button
                  onClick={() => setActiveTab('myPlaylists')}
                  className={`flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-full font-black text-[11px] md:text-[13px] transition-all flex items-center justify-center gap-1 ${activeTab === 'myPlaylists' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <Library size={12} className="md:w-3.5 md:h-3.5" />
                  我的歌单
                </button>
                <button
                  onClick={() => { setActiveTab('playQueue'); setSelectedPlaylist(null); }}
                  className={`flex-1 py-1.5 md:py-2 px-2 md:px-3 rounded-full font-black text-[11px] md:text-[13px] transition-all flex items-center justify-center gap-1 ${activeTab === 'playQueue' ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                >
                  <ListPlus size={12} className="md:w-3.5 md:h-3.5" />
                  播放列表
                  {playlist.length > 0 && (
                    <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black ${activeTab === 'playQueue' ? 'bg-white/30 text-white' : 'bg-indigo-500/15 text-indigo-500'}`}>
                      {playlist.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex-1 relative mt-2 flex flex-col overflow-hidden">
                <AnimatePresence>
                  {toast && (
                    <motion.div
                      key="toast"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="absolute top-2 left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 rounded-full bg-slate-900/80 dark:bg-white/90 text-white dark:text-slate-900 text-[11px] font-black shadow-lg backdrop-blur-md pointer-events-none"
                    >
                      {toast}
                    </motion.div>
                  )}
                </AnimatePresence>

                {activeTab === 'lyrics' && (
                  <div className="absolute inset-0 flex flex-col h-full animate-in fade-in duration-300">
                    <div className="absolute top-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-b from-white/40 dark:from-slate-800/60 to-transparent z-10 pointer-events-none" />
                    <div className="absolute bottom-0 left-0 right-0 h-32 md:h-40 bg-gradient-to-t from-white/40 dark:from-slate-800/60 to-transparent z-10 pointer-events-none" />
                    <div ref={lyricContainerRef} className="h-full overflow-y-auto no-scrollbar scroll-smooth relative px-4 md:px-6 lyric-mask-container">
                        <div className="py-[30vh] md:py-[35vh] flex flex-col gap-4 md:gap-6 text-center lg:px-10">
                            {parsedLyrics.length > 0 ? (
                              parsedLyrics.map((line: any, index: number) => {
                                const isActive = index === activeLyricIndex;
                                return (
                                  <div key={index} ref={isActive ? activeLyricRef : null}
                                    className={`transition-all duration-700 cursor-pointer px-2 md:px-4 rounded-2xl ${isActive ? 'opacity-100 scale-105 py-2 md:py-3 bg-white/10' : 'opacity-20 hover:opacity-40'}`}
                                    onClick={() => duration > 0 && handleSeek({ target: { value: String((line.time / duration) * 100) } } as any)}
                                  >
                                    <p className={`font-black tracking-tight leading-relaxed transition-all duration-700 ${isActive ? 'text-lg md:text-2xl text-indigo-600 dark:text-indigo-400' : 'text-sm md:text-lg text-slate-700 dark:text-slate-300'}`} style={isActive ? { textShadow: '0 0 20px rgba(99,102,241,0.15)' } : {}}>{line.text}</p>
                                  </div>
                                );
                              })
                            ) : (
                              <div className="h-full flex items-center justify-center">
                                 <div className="flex flex-col items-center gap-3 md:gap-4">
                                    <Disc3 className="animate-spin text-indigo-500/40" size={32} />
                                    <p className="text-base md:text-xl font-black text-indigo-500 animate-pulse">{currentLyric || "正在捕获灵魂旋律..."}</p>
                                 </div>
                              </div>
                            )}
                        </div>
                    </div>
                  </div>
                )}

                {activeTab === 'myPlaylists' && (
                  <div className="absolute inset-0 px-4 md:px-6 pb-4 md:pb-6 pt-2 md:pt-4 animate-in fade-in duration-300 flex flex-col">
                    {selectedPlaylist ? (
                      // ===== 子视图: 选中歌单的歌曲列表 =====
                      <div className="flex flex-col h-full min-h-0">
                        <div className="flex items-center gap-2 mb-3 shrink-0">
                          <button
                            onClick={() => setSelectedPlaylist(null)}
                            className="p-1.5 rounded-full hover:bg-white/40 dark:hover:bg-slate-700/40 text-slate-500 hover:text-indigo-500 transition-colors"
                            title="返回歌单列表"
                          >
                            <ChevronLeft size={18} className="md:w-5 md:h-5" />
                          </button>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100 truncate">
                              {selectedPlaylist.name}
                            </h3>
                            <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">
                              {playlistSongs.length > 0 ? `${playlistSongs.length} 首` : '加载中…'}
                            </p>
                          </div>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 md:gap-2.5 min-h-0">
                          {playlistSongsLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Disc3 className="animate-spin text-indigo-500/60" size={28} />
                                <span className="text-xs text-slate-500 font-bold">正在拉取歌曲…</span>
                              </div>
                            </div>
                          ) : playlistSongsError ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                              {playlistSongsError}
                            </div>
                          ) : playlistSongs.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                              该歌单下暂无歌曲
                            </div>
                          ) : (
                            playlistSongs.map((song) => renderSongRow(song))
                          )}
                        </div>
                      </div>
                    ) : (
                      // ===== 歌单列表 =====
                      <div className="flex flex-col h-full min-h-0">
                        <div className="flex items-center justify-between mb-3 shrink-0 px-1">
                          <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100">
                            我的歌单
                          </h3>
                          <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold">
                            {me?.nickname ? `${me.nickname} · ${userPlaylists.length} 个` : '请先登录'}
                          </span>
                        </div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 md:gap-2.5 min-h-0">
                          {userPlaylistsLoading ? (
                            <div className="flex-1 flex items-center justify-center">
                              <div className="flex flex-col items-center gap-2">
                                <Disc3 className="animate-spin text-indigo-500/60" size={28} />
                                <span className="text-xs text-slate-500 font-bold">正在拉取我的歌单…</span>
                              </div>
                            </div>
                          ) : userPlaylistsError ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
                              <Library size={32} className="text-slate-300 dark:text-slate-600" />
                              <p className="text-xs text-slate-500 font-bold">{userPlaylistsError}</p>
                            </div>
                          ) : userPlaylists.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center text-xs text-slate-500">
                              暂无歌单
                            </div>
                          ) : (
                            userPlaylists.map((pl) => (
                              <button
                                key={pl.id}
                                onClick={() => setSelectedPlaylist(pl)}
                                className="group flex items-center gap-3 p-3 md:p-4 rounded-xl md:rounded-2xl cursor-pointer transition-all border border-transparent hover:bg-white/40 dark:hover:bg-slate-700/40 hover:border-indigo-500/30 text-left w-full"
                              >
                                <div className="relative w-12 h-12 md:w-14 md:h-14 shrink-0 rounded-lg md:rounded-xl overflow-hidden shadow-sm bg-slate-200 dark:bg-slate-700">
                                  {pl.cover ? (
                                    <img src={pl.cover} alt="cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                                      <Library size={20} />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm md:text-[15px] font-black text-slate-800 dark:text-slate-100 truncate">
                                    {pl.name}
                                  </p>
                                  <p className="text-[10px] md:text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                    {pl.trackCount} 首{pl.creator ? ` · ${pl.creator}` : ''}
                                  </p>
                                </div>
                                <ChevronRight size={16} className="text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'playQueue' && (
                  <div className="absolute inset-0 px-4 md:px-6 pb-4 md:pb-6 pt-2 md:pt-4 animate-in fade-in duration-300 flex flex-col">
                    <div className="flex items-center justify-between mb-3 shrink-0 px-1">
                      <h3 className="text-sm md:text-base font-black text-slate-800 dark:text-slate-100">
                        播放列表
                      </h3>
                      <span className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 font-bold">
                        共 {playlist.length} 首
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-2 md:gap-2.5 min-h-0">
                      {playlist.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-4">
                          <ListPlus size={32} className="text-slate-300 dark:text-slate-600" />
                          <p className="text-xs text-slate-500 font-bold">播放列表为空</p>
                          <p className="text-[10px] text-slate-400">到「我的歌单」中点击 <span className="text-indigo-500 font-black">+</span> 添加歌曲吧</p>
                        </div>
                      ) : (
                        playlist.map((song: any) => renderSongRow(song, { showRemove: true }))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </PageTransition>

      <style jsx global>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .rotating-disc { animation: spin 20s linear infinite; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .lyric-mask-container {
          -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
          mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }
      `}</style>
    </div>
  );
}
