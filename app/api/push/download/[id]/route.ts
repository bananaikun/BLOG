import { NextRequest, NextResponse } from 'next/server';
import { findVersion, incrementDownloads } from '@/lib/push-db';
import fs from 'fs';
import path from 'path';

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'push', 'uploads');

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const versionId = parseInt(id, 10);
    if (isNaN(versionId)) {
      return NextResponse.json({ error: 'invalid id' }, { status: 400 });
    }

    const row = findVersion(versionId);
    if (!row) {
      return NextResponse.json({ error: 'version not found' }, { status: 404 });
    }

    const filePath = path.join(UPLOAD_DIR, path.basename(row.filePath));
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'file missing on server' }, { status: 410 });
    }

    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const fileSize = stat.size;

    const rangeHeader = request.headers.get('range');
    let start = 0;
    let end = fileSize - 1;
    let isPartial = false;

    if (rangeHeader) {
      const m = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
      if (m) {
        const s = m[1];
        const e = m[2];
        if (s !== '' && e === '') {
          start = parseInt(s, 10);
          if (!isNaN(start) && start < fileSize) {
            end = fileSize - 1;
            isPartial = true;
          }
        } else if (s !== '' && e !== '') {
          start = parseInt(s, 10);
          end = parseInt(e, 10);
          if (!isNaN(start) && !isNaN(end) && start < fileSize) {
            if (end >= fileSize) end = fileSize - 1;
            isPartial = true;
          }
        }
      }
    }

    const chunkSize = end - start + 1;
    incrementDownloads(versionId);

    const buffer = fs.readFileSync(filePath);
    const chunk = buffer.subarray(start, end + 1);

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Accept-Ranges': 'bytes',
      'X-Version': row.version,
      'X-Version-Code': String(row.versionCode),
      'X-SHA256': row.sha256,
      'Cache-Control': 'no-store',
    };

    if (isPartial) {
      headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`;
      headers['Content-Length'] = String(chunkSize);
      return new NextResponse(chunk, { status: 206, headers });
    } else {
      headers['Content-Length'] = String(fileSize);
      return new NextResponse(buffer, { status: 200, headers });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'download error' }, { status: 500 });
  }
}
