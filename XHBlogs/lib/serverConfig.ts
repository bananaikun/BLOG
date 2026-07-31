// lib/serverConfig.ts - 仅服务端使用（API Routes / Server Components）
// 客户端请使用 useSiteConfig() hook 或 fetch('/api/config')
import * as fs from 'fs';
import * as path from 'path';

const CONFIG_PATH = path.join(process.cwd(), 'data', 'siteConfig.json');

export function getSiteConfig(): any {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveSiteConfig(config: any): void {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
