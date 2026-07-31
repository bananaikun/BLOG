import { NextResponse } from 'next/server';

// GET /api/push/system/status — 系统状态（公开）
export async function GET() {
  return NextResponse.json({
    ok: true,
    running: true,
    time: Date.now(),
  });
}
