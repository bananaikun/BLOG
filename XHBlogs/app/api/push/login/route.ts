import { NextRequest, NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body || {};

    if (!token || token !== ADMIN_TOKEN) {
      return NextResponse.json({ ok: false, error: 'Token 不正确' }, { status: 401 });
    }

    return NextResponse.json({ ok: true, token: ADMIN_TOKEN });
  } catch {
    return NextResponse.json({ ok: false, error: '请求格式错误' }, { status: 400 });
  }
}
