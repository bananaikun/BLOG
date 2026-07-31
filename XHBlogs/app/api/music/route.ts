import { NextRequest, NextResponse } from 'next/server'
import { fixNcmCookie } from '@/lib/ncm-cookie'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const NET_EASE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Referer: 'https://music.163.com/',
}

type SongResult = {
  id: string
  name?: string
  artist?: string
  author?: string
  cover?: string
  pic?: string
  url?: string
  lrc?: string
  error?: string
}

/**
 * 云端音乐聚合接口
 *
 * 修复: 会员歌曲只能听 30 秒 (试听) 的根因:
 *  之前 song_url 失败时回退到 https://music.163.com/song/media/outer/url (30秒试听外链!)
 *  现在:
 *   1. 有 cookie: 用 song_url_v1 + level=jymaster (超清母带) 拿 VIP 完整 URL
 *   2. 无 cookie 或失败: 用 song_url br=320000 拿标准音质
 *   3. 都失败: 不回退外链, 返回 url='' 让前端提示"VIP 歌曲请登录"
 */
export async function GET(request: NextRequest) {
  const ids = request.nextUrl.searchParams.get('ids')
  const cookieParam = request.nextUrl.searchParams.get('cookie')
  const cookieHeader = request.headers.get('cookie') || ''
  const rawCookie = (cookieParam ? decodeURIComponent(cookieParam) : '') || cookieHeader
  // 修复 NCM 包 cookieToJson BUG: base64 末尾的 = 会导致 MUSIC_U 被丢弃
  const finalCookie = fixNcmCookie(rawCookie)

  if (!ids) {
    return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 })
  }

  const songIds = ids.split(',').map((id) => id.trim()).filter(Boolean)

  const results: SongResult[] = await Promise.all(
    songIds.map(async (songId): Promise<SongResult> => {
      try {
        const NCM = await import('NeteaseCloudMusicApi')

        // 1. 详情 (song_detail 返回数组, 取第一个)
        const detailRes = await NCM.song_detail({
          ids: songId,
          cookie: finalCookie || undefined,
        } as any)
        const detailBody = detailRes.body || detailRes
        const song = detailBody?.songs?.[0]

        if (!song) {
          // 退路: 网易云官方接口
          try {
            const r = await fetch(
              `https://music.163.com/api/song/detail/?id=${songId}&ids=[${songId}]`,
              { headers: NET_EASE_HEADERS, signal: AbortSignal.timeout(5000) },
            )
            const fb = await r.json()
            const fbSong = fb.songs?.[0]
            if (fbSong) {
              const artistName = fbSong.artists?.[0]?.name || '未知歌手'
              // 注意: 这里 url 用 song_url_v1 获取, 不再用 30 秒试听外链
              const playUrl = await fetchPlayUrl(NCM, songId, finalCookie)
              return {
                id: songId,
                name: fbSong.name,
                artist: artistName,
                author: artistName,
                cover: fbSong.album?.picUrl || '',
                pic: fbSong.album?.picUrl || '',
                url: playUrl,
                lrc: '',
              }
            }
          } catch {}
          return { id: songId, error: 'not_found' }
        }

        const artistName = (song as any).ar?.[0]?.name || (song as any).artists?.[0]?.name || '未知歌手'
        const cover = (song as any).al?.picUrl || (song as any).album?.picUrl || ''

        // 2. 歌词 (可选, 不影响主流程)
        let lrcText = ''
        try {
          const lrcRes = await NCM.lyric({
            id: songId,
            cookie: finalCookie || undefined,
          } as any)
          const lrcBody = (lrcRes as any).body || lrcRes
          lrcText = (lrcBody as any)?.lrc?.lyric || ''
        } catch {}

        // 3. 真实播放 URL (关键: 不回退 30 秒试听外链)
        const playUrl = await fetchPlayUrl(NCM, songId, finalCookie)

        return {
          id: songId,
          name: song.name,
          artist: artistName,
          author: artistName,
          cover,
          pic: cover,
          url: playUrl, // 可能为空 (VIP 未登录), 前端会提示
          lrc: lrcText,
        }
      } catch (error) {
        console.error(`[api/music] 获取歌曲 ${songId} 失败:`, error)
        return { id: songId, error: String(error) }
      }
    }),
  )

  return new NextResponse(JSON.stringify(results), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  })
}

/**
 * 获取真实播放 URL (绝不用 30 秒试听外链)
 *
 * 策略:
 * 1. 有 cookie: song_url_v1 + level=jymaster (超清母带, VIP 解锁完整歌曲)
 * 2. song_url + br=320000 (标准音质, 兜底)
 * 3. 都失败: 返回空字符串 (前端提示 VIP 歌曲请登录)
 */
async function fetchPlayUrl(NCM: any, songId: string, cookie: string): Promise<string> {
  // 1. 有 cookie 优先用 song_url_v1 拿 VIP 高音质
  if (cookie) {
    try {
      const r: any = await NCM.song_url_v1({
        id: songId,
        level: 'jymaster', // 超清母带, VIP 可用
        cookie,
      } as any)
      const b = r?.body || r
      const data = b?.data?.[0]
      if (data?.url) return data.url
    } catch {}
  }

  // 2. 兜底: song_url + br=320000 (无 cookie 也能拿标准音质, 非VIP歌曲)
  try {
    const r: any = await NCM.song_url({
      id: songId,
      br: 320000,
      cookie: cookie || undefined,
    } as any)
    const b = r?.body || r
    const data = b?.data?.[0]
    if (data?.url) return data.url
  } catch {}

  // 3. 都失败 → 返回空 (前端会显示 "VIP 歌曲请登录", 不会播 30 秒试听)
  return ''
}
