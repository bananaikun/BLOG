import { NextResponse } from 'next/server';

// GET /api/push/mc-status — MC服务器状态（公开）
// 博客模式下无法直接运行 McWatcher，返回静态/配置信息
export async function GET() {
  return NextResponse.json({
    online: false,
    host: 'mc.bananaikun.dynv6.net',
    port: 25565,
    latencyMs: 0,
    lastCheckAt: 0,
    lastChangeAt: null,
    lastError: 'MC探测功能在博客模式下不可用',
    running: false,
  });
}
