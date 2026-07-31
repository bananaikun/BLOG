import { NextRequest, NextResponse } from 'next/server';
import { getVersions, addVersion, rowToDto } from '@/lib/push-db';
import { parseApkMetadata } from '@/lib/apk-parser';
import { writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';
const UPLOAD_DIR = path.join(process.cwd(), 'data', 'push', 'uploads');

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// GET /api/push/versions
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const appId = searchParams.get('appId');
  const platform = searchParams.get('platform');

  let list = getVersions();
  if (appId) list = list.filter(v => v.appId === appId);
  if (platform) list = list.filter(v => v.platform === platform);
  list.sort((a, b) => b.versionCode - a.versionCode);

  return NextResponse.json({ versions: list.map(rowToDto) });
}

// POST /api/push/versions
//
// 上传流程（参考原推送更新程序 server.js:2539 区域）：
//  1. 接收 formData: file / version / versionCode / appId / changelog / mandatory / isActive / platform
//  2. 保存文件到 uploads/
//  3. 调用 parseApkMetadata(临时路径) 提取 appId/versionCode/versionName/sdks/permissions...
//  4. 如果用户没填或填的是默认值，用 APK 解析结果覆盖
//  5. 写入 versions.json
export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    let version = String(formData.get('version') || '');
    let versionCode = String(formData.get('versionCode') || '');
    const changelog = String(formData.get('changelog') || '');
    const mandatory = formData.get('mandatory') === 'true';
    const isActive = formData.get('isActive') !== 'false'; // 默认 true
    let appId = String(formData.get('appId') || '');
    const platform = String(formData.get('platform') || 'android');

    if (!file) {
      return NextResponse.json({ ok: false, error: '缺少 APK 文件' }, { status: 400 });
    }

    // Save file first
    const ext = path.extname(file.name) || '.apk';
    const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`;
    const filePath = path.join(UPLOAD_DIR, fileName);
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // Calculate SHA256
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');

    // 自动解析 APK 元数据（参考原 server.js:parseApkMetadata 调用）
    // 解析成功且用户没填时，用解析结果填充
    let apkMeta = null;
    try {
      apkMeta = parseApkMetadata(filePath);
    } catch {
      // 解析失败不阻断流程，让用户手动填
    }

    if (apkMeta) {
      if (!appId) appId = apkMeta.appId;
      if (!version) version = apkMeta.versionName;
      if (!versionCode) versionCode = String(apkMeta.versionCode);
    }

    // 校验必填
    if (!version || !versionCode) {
      // 清理刚保存的文件
      try {
        const fs = await import('fs/promises');
        await fs.unlink(filePath);
      } catch {}
      return NextResponse.json(
        {
          ok: false,
          error: '缺少 version / versionCode（自动解析失败时需手动填）',
          hint: apkMeta ? null : '请确认 aapt.exe 是否可用（设置 AAPT_PATH 环境变量）',
        },
        { status: 400 }
      );
    }

    const code = parseInt(versionCode, 10);
    if (isNaN(code)) {
      try {
        const fs = await import('fs/promises');
        await fs.unlink(filePath);
      } catch {}
      return NextResponse.json({ ok: false, error: 'versionCode 必须为整数' }, { status: 400 });
    }

    // 默认值：appId 仍空就给默认
    if (!appId) appId = 'com.hayenai.app';

    const newVersion = addVersion({
      appId,
      platform,
      version,
      versionCode: code,
      filePath: fileName,
      sizeBytes: file.size,
      sha256,
      changelog,
      mandatory,
      isActive,
      appLabel: apkMeta?.appLabel,
      minSdkVersion: apkMeta?.minSdkVersion,
      targetSdkVersion: apkMeta?.targetSdkVersion,
      launchableActivity: apkMeta?.launchableActivity,
      permissions: apkMeta?.permissions,
      nativeCode: apkMeta?.nativeCode,
    });

    return NextResponse.json({
      ok: true,
      version: rowToDto(newVersion),
      autoFilled: apkMeta
        ? {
            appLabel: apkMeta.appLabel,
            minSdkVersion: apkMeta.minSdkVersion,
            targetSdkVersion: apkMeta.targetSdkVersion,
            launchableActivity: apkMeta.launchableActivity,
            permissions: apkMeta.permissions?.length || 0,
            nativeCode: apkMeta.nativeCode,
          }
        : null,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || '上传失败' }, { status: 500 });
  }
}
