import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import {
  parseApkMetadata,
  type ApkMetadata,
} from '@/lib/apk-parser';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface InspectResponse {
  ok: boolean;
  meta?: ApkMetadata;
  error?: string;
  hint?: string;
}

/**
 * POST /api/push/apk-inspect
 *
 * 预览 APK 元数据（不写入数据库、不移动文件）
 * - 上传 APK 文件，解析 appId / versionCode / versionName / 应用名 / SDK 版本 / 权限 / 启动 Activity / 架构
 * - 用于上传前的实时预览
 */
export async function POST(request: NextRequest): Promise<NextResponse<InspectResponse>> {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json(
        { ok: false, error: '缺少 APK 文件', hint: '请上传 .apk 文件' },
        { status: 400 }
      );
    }

    // 校验扩展名（宽松）
    const fname = file.name || 'upload.apk';
    if (!/\.apk$/i.test(fname)) {
      return NextResponse.json(
        { ok: false, error: '文件必须是 .apk 格式' },
        { status: 400 }
      );
    }

    // 临时保存到 uploads（避免 aapt 中文路径问题：apk-parser 已处理复制到 ASCII 临时目录）
    const tmpDir = path.join(process.cwd(), 'data', 'push', 'uploads');
    await fs.mkdir(tmpDir, { recursive: true });
    const tmpName = `inspect_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.apk`;
    const tmpPath = path.join(tmpDir, tmpName);
    const bytes = await file.arrayBuffer();
    await fs.writeFile(tmpPath, Buffer.from(bytes));

    try {
      const meta = parseApkMetadata(tmpPath);
      if (!meta) {
        return NextResponse.json(
          {
            ok: false,
            error: 'aapt 解析失败',
            hint: '请检查 AAPT_PATH 环境变量，或上传的 APK 是否损坏',
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: true, meta });
    } finally {
      // 无论成功失败，都清理临时文件
      try {
        await fs.unlink(tmpPath);
      } catch {
        // ignore
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message || e) },
      { status: 500 }
    );
  }
}
