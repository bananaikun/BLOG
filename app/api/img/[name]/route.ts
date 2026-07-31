import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET: 本地图片代理 (从 public/uploads/<name> 读取)
// 支持路径参数 /api/img/<name> 和 query 参数 /api/img?name=<name>
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  // 优先从路径参数读取, 兼容 query parameter
  const routeName = (await params)?.name || '';
  const name = routeName || request.nextUrl.searchParams.get('name') || '';
  if (!name) {
    return NextResponse.json({ error: 'Missing name' }, { status: 400 });
  }

  // 安全: 只允许文件名, 不允许路径
  const safeName = name.split('/').pop() || name;
  if (!safeName || safeName.includes('..')) {
    return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
  }

  // 本地: 直接读 public/uploads/<name>
  const filePath = path.join(process.cwd(), 'public', 'uploads', safeName);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const buffer = fs.readFileSync(filePath);
  // 推断 content-type
  const lower = safeName.toLowerCase();
  let contentType = 'application/octet-stream';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) contentType = 'image/jpeg';
  else if (lower.endsWith('.png')) contentType = 'image/png';
  else if (lower.endsWith('.gif')) contentType = 'image/gif';
  else if (lower.endsWith('.webp')) contentType = 'image/webp';
  else if (lower.endsWith('.svg')) contentType = 'image/svg+xml';
  else if (lower.endsWith('.mp4')) contentType = 'video/mp4';
  else if (lower.endsWith('.webm')) contentType = 'video/webm';
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
