import { NextRequest, NextResponse } from 'next/server';
import { fixNcmCookie } from '@/lib/ncm-cookie';
import { loadNcm } from '@/lib/ncm-loader';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取歌单详情 -> 返回歌单内所有歌曲
 *
 * 性能优化策略:
 * 1. playlist_detail 一次拿全部 trackIds + 前 100 首 tracks 完整详情
 * 2. song_url 批量拿播放 URL (每批 100 首, 带 cookie 解锁 VIP)
 * 3. 不在此时获取歌词! 歌词由前端播放时调 /api/music?ids=xxx 单独获取
 *    之前每批 20 首并发调 lyric, 100 首歌要 5 批次, 是慢的元凶
 * 4. 超过 100 首的歌单, 后续歌曲用 song_detail 批量补充详情
 *
 * 修复: 之前用 song_url_v1 的 ids 参数格式不对 (它内部会包成 [id]),
 *       批量应改用 song_url (支持逗号分隔 + JSON.stringify)
 */
export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get('id');
  const rawCookie = request.nextUrl.searchParams.get('cookie') || '';
  // 修复 NCM 包 cookieToJson BUG: base64 末尾的 = 会导致 MUSIC_U 被丢弃
  const cookie = fixNcmCookie(rawCookie);

  if (!playlistId) {
    return NextResponse.json({ error: 'Missing playlist id' }, { status: 400 });
  }

  try {
    const NCM = await loadNcm();

    // 1. 获取歌单详情 (NCM 包能拿到全部 trackIds + 前 100 首 tracks)
    const detailRes: any = await NCM.playlist_detail({
      id: playlistId,
      cookie,
    } as any);
    const detailBody = detailRes?.body || detailRes;
    const playlistData = detailBody?.playlist || {};

    // trackIds: 全部歌曲 ID (不受 limit 限制)
    const allTrackIds: number[] = (playlistData.trackIds || []).map((t: any) => t.id);
    // tracks: 前 100 首完整详情 (NCM 包默认返回)
    const firstTracks: any[] = playlistData.tracks || [];

    const trackCount = allTrackIds.length;
    if (trackCount === 0) {
      return NextResponse.json({ error: '歌单为空或不存在', songs: [] }, { status: 404 });
    }

    // 2. 构建歌曲详情 map (前 100 首已有, 超过部分用 song_detail 补充)
    const detailMap = new Map<string, any>();
    for (const t of firstTracks) {
      detailMap.set(String(t.id), t);
    }

    // 超过 100 首的部分, 分批 song_detail 补充 (每批 100 首)
    const extraIds = allTrackIds.slice(100).map((id) => String(id));
    if (extraIds.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < extraIds.length; i += BATCH) {
        const batch = extraIds.slice(i, i + BATCH);
        try {
          const r: any = await NCM.song_detail({ ids: batch.join(','), cookie } as any);
          const b = r?.body || r;
          for (const s of b?.songs || []) {
            detailMap.set(String(s.id), s);
          }
        } catch (e) {
          console.error('[playlist] song_detail batch failed at', i, e);
        }
      }
    }

    // 3. 批量获取播放 URL
    //    关键修复: VIP 歌曲必须用 song_url_v1 + level=jymaster 才能拿完整 URL
    //    之前用 song_url + br=320000, 对 VIP 歌曲只会返回 30 秒试听片段!
    //    song_url_v1 单首调用 (它内部会把 id 包成 [id]), 批量用并发 + Promise.all
    const urlMap: Record<string, string> = {};
    const allIds = allTrackIds.map(String);

    // 并发获取 URL (每批 20 首并发, 避免限流)
    const CONCURRENCY = 20;
    for (let i = 0; i < allIds.length; i += CONCURRENCY) {
      const batch = allIds.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (sid) => {
          try {
            // 有 cookie 用 song_url_v1 + level=jymaster (VIP 解锁完整歌曲)
            if (cookie) {
              try {
                const r: any = await NCM.song_url_v1({
                  id: sid,
                  level: 'jymaster',
                  cookie,
                } as any);
                const b = r?.body || r;
                const data = b?.data?.[0];
                if (data?.url) return { id: sid, url: data.url };
              } catch {}
            }
            // 兜底: song_url + br=320000 (非 VIP 歌曲 / 未登录)
            const r: any = await NCM.song_url({
              id: sid,
              br: 320000,
              cookie: cookie || undefined,
            } as any);
            const b = r?.body || r;
            const data = b?.data?.[0];
            return { id: sid, url: data?.url || '' };
          } catch {
            return { id: sid, url: '' };
          }
        })
      );
      for (const r of results) {
        if (r.url) urlMap[r.id] = r.url;
      }
    }

    // 4. 组装结果 (不获取歌词, 由前端播放时懒加载)
    const songs: any[] = [];
    for (const id of allIds) {
      const detail = detailMap.get(id);
      const url = urlMap[id];
      // 没有 URL 的歌曲 (VIP / 下架) 仍保留, 但标记 url 为空, 前端可提示
      const artistName = detail?.ar?.[0]?.name || detail?.artists?.[0]?.name || '未知歌手';
      const cover = detail?.al?.picUrl || detail?.album?.picUrl || '';
      songs.push({
        id,
        name: detail?.name || `歌曲 ${id}`,
        artist: artistName,
        author: artistName,
        cover,
        pic: cover,
        url: url || '', // 可能为空 (VIP 未登录 / 下架)
        lrc: '', // 歌词懒加载, 不在这里获取
      });
    }

    return NextResponse.json({
      playlistId,
      playlistName: playlistData.name || '未知歌单',
      total: trackCount,
      songs,
    });
  } catch (error: any) {
    console.error('[api/music/playlist] 获取歌单失败:', error);
    return NextResponse.json({ error: error.message, songs: [] }, { status: 500 });
  }
}
