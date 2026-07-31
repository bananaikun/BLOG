import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

const TCP_TIMEOUT_MS = 5000;

interface TunnelTarget {
  host: string;
  port: number;
  label: string;
}

const TUNNEL_TARGETS: Record<string, TunnelTarget> = {
  mc: { host: 'mc.bananaikun.dynv6.net', port: 25565, label: 'MC隧道' },
  push: { host: 'v.bananaikun.dynv6.net', port: 23443, label: 'Push隧道' },
};

// POST /api/push/tunnel-status/[tunnelId]/ping — 隧道探测
export async function POST(
  request: NextRequest,
  { params }: { params: { tunnelId: string } }
) {
  const { tunnelId } = params;
  const target = TUNNEL_TARGETS[tunnelId];

  if (!target) {
    return NextResponse.json(
      { ok: false, error: `未知隧道: ${tunnelId}` },
      { status: 404 }
    );
  }

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
        tunnelId,
        label: target.label,
        online: true,
        host: target.host,
        port: target.port,
        latencyMs: latency,
        lastCheckAt: Date.now(),
        lastError: null,
      });
    });
    socket.once('timeout', () => {
      finish({
        tunnelId,
        label: target.label,
        online: false,
        host: target.host,
        port: target.port,
        latencyMs: 0,
        lastCheckAt: Date.now(),
        lastError: '连接超时',
      });
    });
    socket.once('error', (err: Error) => {
      finish({
        tunnelId,
        label: target.label,
        online: false,
        host: target.host,
        port: target.port,
        latencyMs: 0,
        lastCheckAt: Date.now(),
        lastError: err.message,
      });
    });

    socket.connect(target.port, target.host);
  });
}
