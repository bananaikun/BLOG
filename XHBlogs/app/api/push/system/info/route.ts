import { NextResponse } from 'next/server';

// GET /api/push/system/info — 系统信息（公开）
export async function GET() {
  try {
    const info = {
      name: 'HaYenai Push Server (XHBlogs)',
      publicBaseUrl: process.env.PUBLIC_HOST || 'http://localhost:23525',
      port: 23525,
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: process.platform,
    };

    return NextResponse.json(info);
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取系统信息失败' },
      { status: 500 }
    );
  }
}
