import { NextRequest, NextResponse } from 'next/server'
import { loadNcm } from '@/lib/ncm-loader'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// code: 800=过期 801=等待扫码 802=等待确认 803=授权成功（带 cookie）
export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ code: 400, msg: 'Missing key' }, { status: 400 })

  try {
    const NCM = await loadNcm()
    const result: any = await NCM.login_qr_check({ key })
    const body = result?.body || {}
    return NextResponse.json({
      code: body.code ?? 881,
      message: body.message,
      cookie: body.cookie,
      status: result?.status ?? 200,
    })
  } catch (e: any) {
    console.error('[login/qr/check]', e)
    return NextResponse.json({ code: 881, status: 881, msg: e.message || String(e) }, { status: 500 })
  }
}