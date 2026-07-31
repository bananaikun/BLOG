import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 公告数据文件 (统一数据源, 替代原 data/announcements.ts + data/push/announcement.json)
const ANNOUNCEMENT_FILE = path.join(process.cwd(), 'data', 'announcement.json');

// 默认公告 (首次访问时初始化)
const DEFAULT_ANNOUNCEMENT = {
  enabled: false,
  content: '',
  link: '',
  style: 'plain',
  colorFrom: '#a78bfa',
  colorTo: '#ec4899',
  scheduledEnabled: false,
  scheduledAt: null as string | null,
  updatedAt: new Date().toISOString(),
};

function loadAnnouncement() {
  try {
    if (!fs.existsSync(ANNOUNCEMENT_FILE)) {
      // 首次访问, 写入默认值
      fs.mkdirSync(path.dirname(ANNOUNCEMENT_FILE), { recursive: true });
      fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(DEFAULT_ANNOUNCEMENT, null, 2), 'utf8');
      return { ...DEFAULT_ANNOUNCEMENT };
    }
    const raw = fs.readFileSync(ANNOUNCEMENT_FILE, 'utf8');
    const data = JSON.parse(raw);
    // 合并默认值, 防止字段缺失
    return { ...DEFAULT_ANNOUNCEMENT, ...data };
  } catch (e) {
    console.error('[api/announcements] load failed:', e);
    return { ...DEFAULT_ANNOUNCEMENT };
  }
}

function saveAnnouncement(data: any) {
  try {
    fs.mkdirSync(path.dirname(ANNOUNCEMENT_FILE), { recursive: true });
    const toSave = { ...data, updatedAt: new Date().toISOString() };
    fs.writeFileSync(ANNOUNCEMENT_FILE, JSON.stringify(toSave, null, 2), 'utf8');
    return toSave;
  } catch (e) {
    console.error('[api/announcements] save failed:', e);
    return null;
  }
}

// GET: 获取公告 (展示页 + 管理页都用这个)
export async function GET() {
  const data = loadAnnouncement();

  // 定时发布检查: 未到时间不展示
  if (data.enabled && data.scheduledEnabled && data.scheduledAt) {
    const scheduledTime = new Date(data.scheduledAt).getTime();
    if (Date.now() < scheduledTime) {
      // 未到时间, 展示页看到的是 "未启用"
      return NextResponse.json({ enabled: false, scheduled: true });
    }
  }

  return NextResponse.json(data);
}

// PUT: 保存公告 (管理页用)
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const saved = saveAnnouncement(body);
    if (!saved) {
      return NextResponse.json({ ok: false, error: '保存失败' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, announcement: saved });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '请求失败' }, { status: 500 });
  }
}

// DELETE: 清空公告 (管理页用)
export async function DELETE() {
  try {
    const cleared = saveAnnouncement({
      enabled: false,
      content: '',
      link: '',
      style: 'plain',
      colorFrom: '#a78bfa',
      colorTo: '#ec4899',
      scheduledEnabled: false,
      scheduledAt: null,
    });
    if (!cleared) {
      return NextResponse.json({ ok: false, error: '清空失败' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, announcement: cleared });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || '请求失败' }, { status: 500 });
  }
}
