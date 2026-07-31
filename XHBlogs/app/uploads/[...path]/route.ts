import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 把 public/uploads 转为 API 动态路由
// 原因: next start 在 production 模式下不会扫描运行时新增的 public/uploads 文件
// (只读 build 时生成的 manifest). 把请求转到这个 API 路由可读取磁盘真实文件.
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ico': 'image/x-icon',
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segs } = await params;
  const filename = segs.join('/');

  // 安全检查: 不允许 .. 跳出 uploads 目录
  if (filename.includes('..') || filename.startsWith('/')) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const filePath = path.join(UPLOAD_DIR, filename);

  // 防止访问 uploads 之外的文件
  if (!filePath.startsWith(UPLOAD_DIR)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  if (!fs.existsSync(filePath)) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';

  // 读文件 - 用 buffer 避免 stream 在 Next.js 路由中的复杂关闭问题
  const buffer = fs.readFileSync(filePath);

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      'Content-Type': mime,
      'Content-Length': String(stat.size),
      // 浏览器缓存 1 小时, 但用查询参数或 ETag 触发更新
      'Cache-Control': 'public, max-age=3600, must-revalidate',
      'Last-Modified': stat.mtime.toUTCString(),
    },
  });
}