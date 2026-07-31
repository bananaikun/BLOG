import { NextRequest, NextResponse } from 'next/server'
import { fixNcmCookie } from '@/lib/ncm-cookie'
import { loadNcm } from '@/lib/ncm-loader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 验证用户登录态（cookie）
 *
 * 多重验证 + 自动续期策略:
 * 1. 用 login_status (本质 user_account, 路径 /api/w/nuser/account/get) 验证
 * 2. 失败 → 尝试 login_refresh (/api/login/token/refresh) 刷新 token
 * 3. 刷新成功 → 用新 cookie 再验证一次, 返回 newCookie 让前端更新 localStorage
 * 4. 都失败 → 返回 301 (前端 NeteaseQRLogin 会重试, 不会立即清 cookie)
 *
 * 关键: 不要因为单次失败就判定 cookie 失效
 *       网易云 cookie 中的 __csrf/oscache 等字段会变化, 但 MUSIC_U 仍有效
 */
export async function GET(request: NextRequest) {
  const cookie = request.nextUrl.searchParams.get('cookie')
  const cookieHeader = request.headers.get('cookie') || ''
  const rawCookie = (cookie ? decodeURIComponent(cookie) : '') || cookieHeader
  // 修复 NCM 包 cookieToJson BUG: base64 末尾的 = 会导致 MUSIC_U 被丢弃
  const finalCookie = fixNcmCookie(rawCookie)

  if (!finalCookie) {
    return NextResponse.json({ code: 301, msg: 'no cookie', data: { profile: null } }, { status: 200 })
  }

  try {
    const NCM = await loadNcm()

    // 提取 profile/account 的辅助函数 (兼容 login_status 与 user_account 两种返回结构)
    const extract = (result: any) => {
      const body = result?.body || result
      // login_status 包装: { data: { profile, account, ... } }
      // user_account 直返: { profile, account, ... }
      const profile = body?.data?.profile || body?.profile || null
      const account = body?.data?.account || body?.account || null
      return { profile, account, body }
    }

    // 第 1 次验证: login_status
    let profile: any = null
    let account: any = null
    try {
      const result: any = await NCM.login_status({ cookie: finalCookie } as any)
      const ext = extract(result)
      profile = ext.profile
      account = ext.account
    } catch (e) {
      console.warn('[login/status] login_status failed, try user_account:', e)
    }

    // 第 2 次验证: user_account (路径不同, 偶尔一个能用)
    if (!profile) {
      try {
        const result: any = await NCM.user_account({ cookie: finalCookie } as any)
        const ext = extract(result)
        profile = ext.profile
        account = ext.account
      } catch (e2) {
        console.warn('[login/status] user_account failed:', e2)
      }
    }

    // 第 3 次验证: login_refresh 刷新 token, 拿到新 cookie 再验证一次
    if (!profile) {
      try {
        const refreshRes: any = await NCM.login_refresh({ cookie: finalCookie } as any)
        const refreshBody = refreshRes?.body || refreshRes
        // login_refresh 成功返回 code:200 + cookie 字符串
        const newCookieRaw = refreshBody?.cookie || refreshRes?.cookie
        if (refreshBody?.code === 200 && typeof newCookieRaw === 'string' && newCookieRaw) {
          // 用新 cookie 再验证
          try {
            const result: any = await NCM.login_status({ cookie: newCookieRaw } as any)
            const ext = extract(result)
            if (ext.profile) {
              // 刷新成功 + 新 cookie 验证通过 → 返回新 cookie 让前端续命
              profile = ext.profile
              account = ext.account
              return NextResponse.json({
                code: 200,
                data: {
                  profile: {
                    userId: profile.userId,
                    nickname: profile.nickname,
                    avatarUrl: profile.avatarUrl,
                  },
                  account: {
                    id: account?.id,
                    vipType: account?.vipType || 0,
                    vipLevel: account?.vipLevel || 0,
                  },
                  vipInfo: {
                    vipType: account?.vipType || 0,
                    vipLevel: account?.vipLevel || 0,
                    expireTime: 0,
                  },
                  newCookie: newCookieRaw, // 关键: 让前端更新 localStorage
                },
              })
            }
          } catch (e3) {
            console.warn('[login/status] verify with refreshed cookie failed:', e3)
          }
        }
      } catch (e4) {
        console.warn('[login/status] login_refresh failed:', e4)
      }
    }

    if (!profile) {
      // 三重验证都失败 → cookie 真的失效了
      // 注意: 前端 NeteaseQRLogin.checkStatus 有 2 秒重试, MusicProvider.refreshMe 现在不会直接清 cookie
      // 所以此处返回 301 是安全的, 真正清 cookie 由 NeteaseQRLogin 重试失败后触发
      return NextResponse.json({ code: 301, msg: 'cookie invalid', data: { profile: null } }, { status: 200 })
    }

    return NextResponse.json({
      code: 200,
      data: {
        profile: {
          userId: profile.userId,
          nickname: profile.nickname,
          avatarUrl: profile.avatarUrl,
        },
        account: {
          id: account?.id,
          vipType: account?.vipType || 0,
          vipLevel: account?.vipLevel || 0,
        },
        vipInfo: {
          vipType: account?.vipType || 0,
          vipLevel: account?.vipLevel || 0,
          // 网易云 VIP 过期时间在 account.redVipLevelTime 或 profile 里面
          expireTime: 0,
        },
      },
    })
  } catch (e: any) {
    console.error('[login/status]', e)
    return NextResponse.json({ code: 500, msg: e.message, data: { profile: null } }, { status: 500 })
  }
}
