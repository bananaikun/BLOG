import { NextResponse } from 'next/server';
import { announcementData } from '@/data/announcements';

export const runtime = 'nodejs';

export async function GET() {
  if (!announcementData.enabled) {
    return NextResponse.json({ enabled: false });
  }

  return NextResponse.json({
    enabled: true,
    content: announcementData.content,
    link: announcementData.link,
    pushTitle: announcementData.pushTitle,
    pushBody: announcementData.pushBody,
    updatedAt: announcementData.updatedAt,
  });
}
