import { NextRequest } from 'next/server';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// GET /api/push/logs/stream — SSE日志流（需鉴权）
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // 发送初始连接确认
      const data = `data: ${JSON.stringify({ time: Date.now(), level: 'info', message: 'SSE日志流已连接（博客模式）' })}\n\n`;
      controller.enqueue(encoder.encode(data));

      // 博客模式下没有实时日志源，保持连接但不发送数据
      // 定期发送心跳保持连接
      const heartbeat = setInterval(() => {
        try {
          const ping = `: heartbeat\n\n`;
          controller.enqueue(encoder.encode(ping));
        } catch {
          clearInterval(heartbeat);
        }
      }, 30000);

      // 清理（当客户端断开时）
      request.signal.addEventListener('abort', () => {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // 已关闭
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
