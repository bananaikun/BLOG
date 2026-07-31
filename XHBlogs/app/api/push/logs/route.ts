import { NextRequest, NextResponse } from 'next/server';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// 博客模式下使用内存中的简单日志
const inMemoryLogs: Array<{ time: number; level: string; message: string }> = [
  { time: Date.now(), level: 'info', message: 'XHBlogs Push Server 已启动（博客模式）' },
];

// 导出供其他模块使用
export function pushLog(level: string, message: string) {
  inMemoryLogs.push({ time: Date.now(), level, message });
  // 最多保留 200 条
  if (inMemoryLogs.length > 200) {
    inMemoryLogs.splice(0, inMemoryLogs.length - 200);
  }
}

// GET /api/push/logs — 获取最近日志（需鉴权）
export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const level = searchParams.get('level');

    let logs = [...inMemoryLogs].reverse(); // 最新在前

    if (level) {
      logs = logs.filter(l => l.level === level);
    }

    logs = logs.slice(0, limit);

    return NextResponse.json({ logs, total: inMemoryLogs.length });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取日志失败' },
      { status: 500 }
    );
  }
}
