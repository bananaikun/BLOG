import { NextRequest, NextResponse } from 'next/server';
import { versionsData, getLatestVersion } from '@/data/versions';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const appId = searchParams.get('appId') || 'com.hayenai.app';
  const platform = searchParams.get('platform') || 'android';
  const versionCode = parseInt(searchParams.get('versionCode') || '0');

  const latest = getLatestVersion(appId, platform);

  if (!latest) {
    return NextResponse.json({ error: 'No version found' }, { status: 404 });
  }

  const hasUpdate = latest.versionCode > versionCode;

  return NextResponse.json({
    hasUpdate,
    version: latest.version,
    versionCode: latest.versionCode,
    appId: latest.appId,
    platform: latest.platform,
    changelog: latest.changelog,
    mandatory: latest.mandatory,
    sizeBytes: latest.sizeBytes,
    sha256: latest.sha256,
    downloadUrl: `/api/download/${latest.id}`,
    fileName: latest.fileName,
    createdAt: latest.createdAt,
  });
}
