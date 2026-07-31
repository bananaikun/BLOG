import { NextRequest, NextResponse } from 'next/server';
import { loadAnnouncement } from '@/lib/push-db';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// POST /api/push/announcements/push — 手动推送公告（需鉴权）
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const announcement = loadAnnouncement();

    // 博客模式下 FCM 不可用，返回模拟结果
    return NextResponse.json({
      ok: true,
      message: '公告推送已触发（博客模式下FCM不可用）',
      announcement,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '推送公告失败' },
      { status: 500 }
    );
  }
}
