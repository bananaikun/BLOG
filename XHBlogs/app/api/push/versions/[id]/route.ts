import { NextRequest, NextResponse } from 'next/server';
import { findVersion, updateVersion, deleteVersion, rowToDto } from '@/lib/push-db';

const ADMIN_TOKEN = process.env.PUSH_ADMIN_TOKEN || 'hayenai-admin-2024';

function verifyAuth(request: NextRequest): boolean {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  return token === ADMIN_TOKEN;
}

// PATCH /api/push/versions/:id
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const versionId = parseInt(id, 10);
    if (isNaN(versionId)) {
      return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
    }

    const body = await request.json();
    const updates: any = {};
    if (body.changelog !== undefined) updates.changelog = String(body.changelog);
    if (body.mandatory !== undefined) updates.mandatory = !!body.mandatory;
    if (body.isActive !== undefined) updates.isActive = !!body.isActive;
    if (body.version !== undefined) updates.version = String(body.version).trim();
    if (body.versionCode !== undefined) {
      const code = parseInt(body.versionCode, 10);
      if (!isNaN(code)) updates.versionCode = code;
    }

    const updated = updateVersion(versionId, updates);
    if (!updated) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, version: rowToDto(updated) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || '更新失败' }, { status: 500 });
  }
}

// DELETE /api/push/versions/:id
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ ok: false, error: '未授权' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const versionId = parseInt(id, 10);
    if (isNaN(versionId)) {
      return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
    }

    const ok = deleteVersion(versionId);
    if (!ok) {
      return NextResponse.json({ ok: false, error: 'not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message || '删除失败' }, { status: 500 });
  }
}
