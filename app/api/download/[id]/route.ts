import { NextRequest, NextResponse } from 'next/server';
import { versionsData } from '@/data/versions';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id);
  const version = versionsData.find(v => v.id === id);

  if (!version) {
    return NextResponse.json({ error: 'Version not found' }, { status: 404 });
  }

  const filePath = path.join(process.cwd(), 'public', 'uploads', version.fileName);

  try {
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.android.package-archive',
        'Content-Disposition': `attachment; filename="${version.fileName}"`,
        'Content-Length': version.sizeBytes.toString(),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'File read error' }, { status: 500 });
  }
}
