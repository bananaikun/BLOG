import { NextResponse } from 'next/server';
import { getVersions } from '@/lib/push-db';

// GET /api/push/changelog — 公开更新日志（无需鉴权）
// 优先读取 data/push/changelog.json（含 EARLY_CHANGELOG + versions 合并）
// 若不存在则 fallback 到仅 versions
export async function GET() {
  try {
    const fs = require('fs');
    const path = require('path');
    const changelogFile = path.join(process.cwd(), 'data', 'push', 'changelog.json');

    if (fs.existsSync(changelogFile)) {
      const raw = fs.readFileSync(changelogFile, 'utf8');
      const data = JSON.parse(raw);
      return NextResponse.json({ ok: true, total: data.total || (data.changelog?.length || 0), changelog: data.changelog || [] });
    }

    // fallback
    const versions = getVersions()
      .sort((a, b) => b.versionCode - a.versionCode)
      .map(v => ({
        version: v.version,
        versionCode: v.versionCode,
        title: '',
        changelog: v.changelog,
        category: 'app',
        date: v.createdAt || null,
        isActive: v.isActive,
        isEarly: false,
        source: 'versions',
        sizeBytes: v.sizeBytes,
        downloadUrl: `/api/push/download/${v.id}`,
      }));

    return NextResponse.json({ ok: true, total: versions.length, changelog: versions });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取更新日志失败' },
      { status: 500 }
    );
  }
}