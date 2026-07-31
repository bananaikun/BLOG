import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 项目数据文件 (JSON 持久化, 替代原 data/projects.ts 静态文件)
const PROJECTS_FILE = path.join(process.cwd(), 'data', 'projects.json');

// 默认项目 (首次访问时从 data/projects.ts 迁移, 或写入空数组)
const DEFAULT_PROJECTS: any[] = [];

function loadProjects() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) {
      // 首次访问, 尝试从 data/projects.ts 迁移
      let migrated: any[] = [];
      try {
        // 删除 require cache, 动态加载 TS (仅 dev/SSR 可用)
        delete require.cache[require.resolve('@/data/projects')];
        const mod = require('@/data/projects');
        if (mod?.projectsData && Array.isArray(mod.projectsData)) {
          migrated = mod.projectsData;
        }
      } catch {
        // 迁移失败, 用空数组
      }
      fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
      fs.writeFileSync(PROJECTS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
      return migrated;
    }
    const raw = fs.readFileSync(PROJECTS_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error('[api/projects] load failed:', e);
    return [...DEFAULT_PROJECTS];
  }
}

function saveProjects(data: any[]) {
  try {
    fs.mkdirSync(path.dirname(PROJECTS_FILE), { recursive: true });
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[api/projects] save failed:', e);
    return false;
  }
}

// GET: 获取所有项目 (展示页 + 管理页)
export async function GET() {
  const projects = loadProjects();
  return NextResponse.json({ projects });
}

// POST: 保存所有项目 (管理页整体覆盖)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projects = Array.isArray(body?.projects) ? body.projects : [];
    // 清理字段 + 生成缺失 id
    const cleaned = projects.map((p: any, idx: number) => ({
      id: p.id || `proj_${Date.now()}_${idx}`,
      name: String(p.name || '').slice(0, 100),
      description: String(p.description || '').slice(0, 1000),
      icon: String(p.icon || '🚀').slice(0, 10),
      githubUrl: String(p.githubUrl || '').slice(0, 500),
      tags: Array.isArray(p.tags) ? p.tags.slice(0, 20) : [],
    }));
    const ok = saveProjects(cleaned);
    if (!ok) {
      return NextResponse.json({ ok: false, error: '保存失败' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, projects: cleaned });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '请求失败' }, { status: 500 });
  }
}

// DELETE: 删除指定项目 (按 id 或 index)
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const projects = loadProjects();
    let filtered: any[];
    if (id) {
      filtered = projects.filter((p) => p.id !== id);
    } else {
      // 没有 id, 删除最后一个 (兼容旧 UI)
      filtered = projects.slice(0, -1);
    }
    const ok = saveProjects(filtered);
    if (!ok) {
      return NextResponse.json({ ok: false, error: '删除失败' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, projects: filtered });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '请求失败' }, { status: 500 });
  }
}
