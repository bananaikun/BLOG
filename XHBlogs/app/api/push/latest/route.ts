import { NextRequest, NextResponse } from 'next/server';
import { findLatest, rowToDto } from '@/lib/push-db';

// GET /api/push/latest?appId=com.hayenai.app&versionCode=1&platform=android
// 公开接口，App 调用检查更新
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const appId = searchParams.get('appId') || 'com.hayenai.app';
    const platform = searchParams.get('platform') || 'android';
    const versionCode = parseInt(searchParams.get('versionCode') || '0', 10);

    const latest = findLatest(appId, platform);

    if (!latest) {
      return new NextResponse(null, { status: 204 });
    }

    // 如果客户端版本 >= 最新版本，也返回 204
    if (versionCode > 0 && versionCode >= latest.versionCode) {
      return new NextResponse(null, { status: 204 });
    }

    return NextResponse.json({
      ...rowToDto(latest),
      hasUpdate: true,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e.message || '获取最新版本失败' },
      { status: 500 }
    );
  }
}
