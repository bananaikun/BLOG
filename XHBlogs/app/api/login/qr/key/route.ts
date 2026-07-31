import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const type = body.type || 1
    const NCM = await import('NeteaseCloudMusicApi')
    const result: any = await NCM.login_qr_key({ type })
    const data = result?.body?.data || {}
    // 返回标准化格式给前端
    return NextResponse.json({
      code: data.code ?? 200,
      unikey: data.unikey,
      status: result?.status ?? 200,
    })
  } catch (e: any) {
    console.error('[login/qr/key]', e)
    return NextResponse.json({ code: 500, msg: e.message || String(e) }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return POST(request)
}