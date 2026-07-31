import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');

// GET: 列出所有已上传的图片
export async function GET() {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    const files = fs.readdirSync(UPLOAD_DIR);
    const images = files
      .filter(f => {
        const lower = f.toLowerCase();
        return lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.png') ||
               lower.endsWith('.gif') || lower.endsWith('.webp') || lower.endsWith('.bmp') ||
               lower.endsWith('.svg') || lower.endsWith('.mp4') || lower.endsWith('.webm');
      })
      .map(f => {
        const stat = fs.statSync(path.join(UPLOAD_DIR, f));
        const lower = f.toLowerCase();
        const isVideo = lower.endsWith('.mp4') || lower.endsWith('.webm');
        return {
          name: f,
          url: `/uploads/${f}`,
          size: stat.size,
          mtime: stat.mtime.toISOString(),
          type: isVideo ? 'video' : 'image',
        };
      })
      .sort((a, b) => new Date(b.mtime).getTime() - new Date(a.mtime).getTime());

    return NextResponse.json({ success: true, images });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: 上传图片（支持多文件）
export async function POST(req: NextRequest) {
  try {
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    const formData = await req.formData();
    const files = formData.getAll('files');
    const uploaded: string[] = [];

    for (const file of files) {
      if (!(file instanceof File)) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = path.extname(file.name) || '.png';
      const name = crypto.randomBytes(8).toString('hex') + ext;
      const filePath = path.join(UPLOAD_DIR, name);
      fs.writeFileSync(filePath, buffer);
      uploaded.push(`/uploads/${name}`);
    }

    if (uploaded.length === 0) {
      // 尝试单文件（兼容旧格式）
      const singleFile = formData.get('file') as File | null;
      if (singleFile) {
        const buffer = Buffer.from(await singleFile.arrayBuffer());
        const ext = path.extname(singleFile.name) || '.png';
        const name = crypto.randomBytes(8).toString('hex') + ext;
        fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
        uploaded.push(`/uploads/${name}`);
      }
    }

    return NextResponse.json({ success: true, urls: uploaded, count: uploaded.length });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// DELETE: 删除图片
export async function DELETE(req: NextRequest) {
  try {
    const { url } = await req.json();
    if (!url) return NextResponse.json({ success: false, message: 'Missing url' }, { status: 400 });

    const fileName = path.basename(url);
    const filePath = path.join(UPLOAD_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ success: false, message: 'File not found' }, { status: 404 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
