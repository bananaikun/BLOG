import { NextRequest, NextResponse } from 'next/server';
import { loadPushConfig, savePushConfig } from '@/lib/push-db';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// GET /api/push/push-config — 获取推送配置（需鉴权）
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const config = loadPushConfig();
    return NextResponse.json(config);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取推送配置失败' },
      { status: 500 }
    );
  }
}

// PUT /api/push/push-config — 更新推送配置（需鉴权）
export async function PUT(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const saved = savePushConfig(body);
    return NextResponse.json({ ok: true, config: saved });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '更新推送配置失败' },
      { status: 500 }
    );
  }
}
