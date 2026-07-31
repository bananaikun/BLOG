import { NextRequest, NextResponse } from 'next/server'
import { fixNcmCookie } from '@/lib/ncm-cookie'
import { loadNcm } from '@/lib/ncm-loader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 获取歌曲真实播放 URL (带 cookie 时可以听会员歌曲)
 *
 * 修复: 之前用 song_url + br=320000, 对 VIP 歌曲支持不好
 * 改用 song_url_v1 + level=jymaster (超清母带), VIP 可解锁完整歌曲
 * 绝不回退 30 秒试听外链 (music.163.com/song/media/outer/url)
 */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id')
  const cookieParam = request.nextUrl.searchParams.get('cookie')
  const cookieHeader = request.headers.get('cookie') || ''

  if (!id) {
    return NextResponse.json({ code: 400, msg: 'Missing id', data: [{ url: null }] }, { status: 400 })
  }

  const rawCookie = cookieParam ? decodeURIComponent(cookieParam) : cookieHeader
  // 修复 NCM 包 cookieToJson BUG: base64 末尾的 = 会导致 MUSIC_U 被丢弃
  const finalCookie = fixNcmCookie(rawCookie)

  try {
    const NCM = await loadNcm()

    // 1. 有 cookie 优先用 song_url_v1 + level=jymaster (VIP 超清母带)
    if (finalCookie) {
      try {
        const r: any = await NCM.song_url_v1({
          id,
          level: 'jymaster',
          cookie: finalCookie,
        } as any)
        const b = r?.body || r
        const data = b?.data?.[0]
        if (data?.url) {
          return NextResponse.json(b)
        }
      } catch {}
    }

    // 2. 兜底: song_url + br=320000 (标准音质)
    const params: any = { id, br: 320000 }
    if (finalCookie) params.cookie = finalCookie
    const result = await NCM.song_url({ ...params } as any)
    const body = result.body || result
    return NextResponse.json(body)
  } catch (e: any) {
    console.error('[login/song/url]', e)
    // 兜底: 不再用 30 秒试听外链, 返回 null 让前端提示
    return NextResponse.json({
      code: 200,
      data: [{ id: Number(id), url: null, br: 0, size: 0, type: 'mp3', level: 'standard' }],
    })
  }
}
