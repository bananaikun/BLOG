import { NextResponse } from 'next/server';

// GET /api/push/mc-status/history — MC探测历史（公开）
// 博客模式下不持久化历史
export async function GET() {
  return NextResponse.json({ history: [] });
}
