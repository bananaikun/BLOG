import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

const MC_HOST = 'mc.bananaikun.dynv6.net';
const MC_PORT = 25565;
const TCP_TIMEOUT_MS = 5000;

// POST /api/push/mc-status/ping — 手动探测MC服务器
export async function POST(_request: NextRequest) {
  const startTime = Date.now();

  return new Promise<NextResponse>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result: Record<string, any>) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(NextResponse.json(result));
    };

    socket.setTimeout(TCP_TIMEOUT_MS);
    socket.once('connect', () => {
      const latency = Date.now() - startTime;
      finish({
        online: true,
        host: MC_HOST,
        port: MC_PORT,
        latencyMs: latency,
        lastCheckAt: Date.now(),
        lastError: null,
      });
    });
    socket.once('timeout', () => {
      finish({
        online: false,
        host: MC_HOST,
        port: MC_PORT,
        latencyMs: 0,
        lastCheckAt: Date.now(),
        lastError: '连接超时',
      });
    });
    socket.once('error', (err: Error) => {
      finish({
        online: false,
        host: MC_HOST,
        port: MC_PORT,
        latencyMs: 0,
        lastCheckAt: Date.now(),
        lastError: err.message,
      });
    });

    socket.connect(MC_PORT, MC_HOST);
  });
}
