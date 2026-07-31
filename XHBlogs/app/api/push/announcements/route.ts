import { NextRequest, NextResponse } from 'next/server';
import { loadAnnouncement, saveAnnouncement } from '@/lib/push-db';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// GET /api/push/announcements — 获取当前公告（公开）
export async function GET() {
  try {
    const announcement = loadAnnouncement();
    return NextResponse.json(announcement);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取公告失败' },
      { status: 500 }
    );
  }
}

// PUT /api/push/announcements — 设置公告（需鉴权）
export async function PUT(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const saved = saveAnnouncement(body);
    return NextResponse.json({ ok: true, announcement: saved });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '设置公告失败' },
      { status: 500 }
    );
  }
}
