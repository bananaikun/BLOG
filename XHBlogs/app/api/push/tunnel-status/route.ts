import { NextResponse } from 'next/server';

// GET /api/push/tunnel-status — 隧道状态（公开）
// 博客模式下无法直接监控隧道，返回配置信息 + offline 状态
export async function GET() {
  const tunnels = [
    {
      tunnelId: 'mc',
      label: 'MC隧道',
      enabled: true,
      running: false,
      local: { host: '127.0.0.1', port: 25565 },
      public: { host: 'mc.bananaikun.dynv6.net', port: 25565 },
      online: false,
      latencyMs: 0,
      lastCheckAt: 0,
      lastError: '博客模式下隧道监控不可用',
    },
    {
      tunnelId: 'push',
      label: 'Push隧道',
      enabled: true,
      running: false,
      local: { host: '127.0.0.1', port: 23525 },
      public: { host: 'v.bananaikun.dynv6.net', port: 23443 },
      online: false,
      latencyMs: 0,
      lastCheckAt: 0,
      lastError: '博客模式下隧道监控不可用',
    },
  ];

  return NextResponse.json({ tunnels });
}
