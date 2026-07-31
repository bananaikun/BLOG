import { NextRequest, NextResponse } from 'next/server';
import { fixNcmCookie } from '@/lib/ncm-cookie';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * 获取登录用户的歌单列表
 *
 * 关键修复: cookie 里的 MUSIC_U 是登录 token, 不是用户 ID
 * 必须先用 user_account 接口换取真实 userId, 再查歌单
 */
export async function GET(request: NextRequest) {
  const rawCookie = request.nextUrl.searchParams.get('cookie') || '';
  // 修复 NCM 包 cookieToJson BUG: base64 末尾的 = 会导致 MUSIC_U 被丢弃
  const cookie = fixNcmCookie(rawCookie);
  const uidParam = request.nextUrl.searchParams.get('uid');

  if (!cookie) {
    return NextResponse.json({ error: '未登录,无法获取我的歌单', playlists: [] }, { status: 401 });
  }

  try {
    const NCM = await import('NeteaseCloudMusicApi');

    // 1. 先用 cookie 获取真实 userId (MUSIC_U 不是 userId!)
    let userId = uidParam || '';
    if (!userId) {
      try {
        const acctRes: any = await NCM.user_account({ cookie } as any);
        const acctBody = acctRes?.body || acctRes;
        userId = String(acctBody?.account?.id || acctBody?.profile?.userId || '');
      } catch (e) {
        console.error('[user-playlists] user_account 失败:', e);
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: '无法识别用户ID, 请重新登录', playlists: [] },
        { status: 400 },
      );
    }

    // 2. 用真实 userId 查询歌单
    const result: any = await NCM.user_playlist({
      uid: userId,
      limit: 100,
      offset: 0,
      cookie,
    } as any);
    const body = result?.body || result;
    const playlistData = body?.playlist || body?.playlists || [];

    if (!Array.isArray(playlistData)) {
      return NextResponse.json(
        { error: body?.msg || '获取歌单列表失败', playlists: [] },
        { status: 500 },
      );
    }

    const playlists = playlistData.map((p: any) => ({
      id: String(p.id),
      name: p.name,
      cover: p.coverImgUrl || p.picUrl || '',
      trackCount: p.trackCount ?? 0,
      playCount: p.playCount ?? 0,
      creator: p.creator?.nickname || '',
    }));

    return NextResponse.json({
      code: 200,
      total: playlists.length,
      playlists,
    });
  } catch (e: any) {
    console.error('[api/music/user-playlists] 获取失败:', e);
    return NextResponse.json(
      { error: e?.message || '请求失败', playlists: [] },
      { status: 500 },
    );
  }
}
