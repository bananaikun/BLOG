import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  const qrimg = request.nextUrl.searchParams.get('qrimg') || 'true'
  if (!key) return NextResponse.json({ code: 400, msg: 'Missing key' }, { status: 400 })

  try {
    const NCM = await import('NeteaseCloudMusicApi')
    const result: any = await NCM.login_qr_create({ key, qrimg })
    const body = result?.body || {}
    // 提取 data 子对象供前端使用
    return NextResponse.json({
      code: body.code ?? 200,
      data: body.data || null,
      status: result?.status ?? 200,
    })
  } catch (e: any) {
    console.error('[login/qr/create]', e)
    return NextResponse.json({ code: 500, msg: e.message || String(e) }, { status: 500 })
  }
}