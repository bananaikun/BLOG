import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTS_DIR = path.join(process.cwd(), 'posts');

// 安全: 防止路径穿越
function safeSlug(slug: string) {
  return slug.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
}

function getPostPath(slug: string) {
  return path.join(POSTS_DIR, `${safeSlug(slug)}.md`);
}

// GET: 获取单篇文章 (含 markdown 原文, 供编辑器加载)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // 优先从路径参数读取, 兼容 query parameter
  const routeSlug = (await params)?.slug || '';
  const slug = routeSlug || request.nextUrl.searchParams.get('slug') || '';
  if (!slug) {
    return NextResponse.json({ ok: false, error: '缺少 slug 参数' }, { status: 400 });
  }
  const filePath = getPostPath(slug);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: '文章不存在' }, { status: 404 });
  }
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const { data, content } = matter(raw);
    return NextResponse.json({
      ok: true,
      post: {
        slug: safeSlug(slug),
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        cover: data.cover || '',
        content, // markdown 原文 (供编辑器加载)
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '读取文章失败' }, { status: 500 });
  }
}

// PUT: 更新文章 (可改 frontmatter + 正文, 也可重命名 slug)
// body: { title?, content?, description?, tags?, cover?, date?, newSlug? }
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const routeSlug = (await params)?.slug || '';
  const slug = routeSlug || request.nextUrl.searchParams.get('slug') || '';
  if (!slug) {
    return NextResponse.json({ ok: false, error: '缺少 slug 参数' }, { status: 400 });
  }
  const oldPath = getPostPath(slug);
  if (!fs.existsSync(oldPath)) {
    return NextResponse.json({ ok: false, error: '文章不存在' }, { status: 404 });
  }
  try {
    const body = await request.json();
    const raw = fs.readFileSync(oldPath, 'utf8');
    const { data: oldMeta, content: oldContent } = matter(raw);

    // 合并新旧字段 (未提供的保留原值)
    const newMeta: any = {
      title: body.title ?? oldMeta.title,
      date: body.date ?? oldMeta.date,
    };
    if (body.description !== undefined) newMeta.description = String(body.description);
    else if (oldMeta.description) newMeta.description = oldMeta.description;
    if (Array.isArray(body.tags)) newMeta.tags = body.tags;
    else if (Array.isArray(oldMeta.tags)) newMeta.tags = oldMeta.tags;
    if (body.cover !== undefined) newMeta.cover = String(body.cover);
    else if (oldMeta.cover) newMeta.cover = oldMeta.cover;

    const newContent = body.content !== undefined ? String(body.content) : oldContent;
    const fileContent = matter.stringify(newContent, newMeta);

    // 处理 slug 重命名
    const newSlug = body.newSlug ? safeSlug(String(body.newSlug)) : safeSlug(slug);
    if (newSlug !== safeSlug(slug)) {
      const newPath = getPostPath(newSlug);
      if (fs.existsSync(newPath)) {
        return NextResponse.json({ ok: false, error: `目标 slug ${newSlug} 已存在` }, { status: 409 });
      }
      fs.writeFileSync(newPath, fileContent, 'utf8');
      fs.unlinkSync(oldPath);
    } else {
      fs.writeFileSync(oldPath, fileContent, 'utf8');
    }

    return NextResponse.json({
      ok: true,
      slug: newSlug,
      post: {
        slug: newSlug,
        title: newMeta.title,
        description: newMeta.description || '',
        date: newMeta.date,
        tags: newMeta.tags || [],
        cover: newMeta.cover || '',
        content: newContent,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '更新文章失败' }, { status: 500 });
  }
}

// DELETE: 删除文章
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const routeSlug = (await params)?.slug || '';
  const slug = routeSlug || request.nextUrl.searchParams.get('slug') || '';
  if (!slug) {
    return NextResponse.json({ ok: false, error: '缺少 slug 参数' }, { status: 400 });
  }
  const filePath = getPostPath(slug);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: '文章不存在' }, { status: 404 });
  }
  try {
    fs.unlinkSync(filePath);
    return NextResponse.json({ ok: true, slug: safeSlug(slug) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '删除文章失败' }, { status: 500 });
  }
}
