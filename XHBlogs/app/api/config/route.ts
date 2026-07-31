import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';
import { getSiteConfig, saveSiteConfig } from '../../../lib/serverConfig';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'siteConfig.json');
const BACKUP_DIR = path.join(process.cwd(), 'data', 'config_backups');

// GET: read current config
export async function GET() {
  try {
    const config = getSiteConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

// POST: save config → 刷新页面即可生效（无需重新构建）
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Create backup
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
    if (fs.existsSync(CONFIG_PATH)) {
      const backup = fs.readFileSync(CONFIG_PATH, 'utf-8');
      fs.writeFileSync(path.join(BACKUP_DIR, `config_${Date.now()}.json`), backup, 'utf-8');
    }

    saveSiteConfig(body);

    return NextResponse.json({ success: true, message: '配置已保存，刷新页面即可生效' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
