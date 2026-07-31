import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POSTS_DIR = path.join(process.cwd(), 'posts');

// 确保 posts 目录存在
function ensurePostsDir() {
  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
  }
}

// 从 frontmatter + 文件名提取文章元数据
function parsePostMeta(slug: string, raw: string) {
  const { data, content } = matter(raw);
  return {
    slug,
    title: data.title || slug,
    description: data.description || '',
    date: data.date || '',
    tags: Array.isArray(data.tags) ? data.tags : [],
    cover: data.cover || '',
    content,
  };
}

// GET: 列出所有文章元数据 (不含正文, 减少传输)
export async function GET() {
  try {
    ensurePostsDir();
    const files = fs.readdirSync(POSTS_DIR).filter((f) => f.endsWith('.md'));
    const posts = files.map((file) => {
      const slug = file.replace(/\.md$/, '');
      const raw = fs.readFileSync(path.join(POSTS_DIR, file), 'utf8');
      const { data } = matter(raw);
      return {
        slug,
        title: data.title || slug,
        description: data.description || '',
        date: data.date || '',
        tags: Array.isArray(data.tags) ? data.tags : [],
        cover: data.cover || '',
      };
    });
    // 按日期降序 (新文章在前)
    posts.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return NextResponse.json({ posts });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || '读取文章列表失败' }, { status: 500 });
  }
}

// POST: 创建新文章
// body: { title, content, description?, tags?, cover?, date?, slug? }
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const title = String(body.title || '').trim();
    const content = String(body.content || '');
    if (!title) {
      return NextResponse.json({ ok: false, error: '标题不能为空' }, { status: 400 });
    }

    // 生成 slug: 优先用用户提供的, 其次用标题, 最后用时间戳
    let slug = String(body.slug || '').trim();
    if (!slug) {
      // 用日期 + 标题拼音/英文 (简化: 用时间戳, 避免引入拼音库)
      const date = body.date ? new Date(body.date) : new Date();
      const dateStr = date.toISOString().slice(0, 10);
      // 标题转 slug: 英文小写 + 连字符, 中文用时间戳兜底
      const titleSlug = title
        .toLowerCase()
        .replace(/[^\w\u4e00-\u9fa5]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 50);
      slug = /^[a-z0-9-]+$/.test(titleSlug) ? `${dateStr}-${titleSlug}` : `${dateStr}-${Date.now()}`;
    }
    // slug 安全: 只允许字母数字下划线连字符
    slug = slug.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) slug = `post-${Date.now()}`;

    ensurePostsDir();
    const filePath = path.join(POSTS_DIR, `${slug}.md`);
    if (fs.existsSync(filePath)) {
      return NextResponse.json({ ok: false, error: `文章 ${slug} 已存在` }, { status: 409 });
    }

    // 组装 frontmatter + content
    const frontmatter: any = {
      title,
      date: body.date || new Date().toISOString(),
    };
    if (body.description) frontmatter.description = String(body.description);
    if (Array.isArray(body.tags) && body.tags.length) frontmatter.tags = body.tags;
    if (body.cover) frontmatter.cover = String(body.cover);

    const fileContent = matter.stringify(content || '', frontmatter);
    fs.writeFileSync(filePath, fileContent, 'utf8');

    return NextResponse.json({ ok: true, slug, post: parsePostMeta(slug, fileContent) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '创建文章失败' }, { status: 500 });
  }
}
