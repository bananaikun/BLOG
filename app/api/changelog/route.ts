import { NextResponse } from 'next/server';
import { versionsData } from '@/data/versions';

export const runtime = 'nodejs';

export async function GET() {
  const sorted = [...versionsData]
    .filter(v => v.isActive)
    .sort((a, b) => b.versionCode - a.versionCode);

  return NextResponse.json({
    versions: sorted.map(v => ({
      id: v.id,
      version: v.version,
      versionCode: v.versionCode,
      changelog: v.changelog,
      mandatory: v.mandatory,
      sizeBytes: v.sizeBytes,
      createdAt: v.createdAt,
    })),
    total: sorted.length,
  });
}
