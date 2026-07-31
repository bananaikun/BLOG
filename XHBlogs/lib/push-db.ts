import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'push');
const VERSIONS_FILE = path.join(DATA_DIR, 'versions.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const STATS_FILE = path.join(DATA_DIR, 'stats.json');
const ANNOUNCEMENT_FILE = path.join(DATA_DIR, 'announcement.json');
const PUSH_CONFIG_FILE = path.join(DATA_DIR, 'push-config.json');
const CHANGELOG_FILE = path.join(DATA_DIR, 'changelog.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export interface Version {
  id: number;
  appId: string;
  platform: string;
  version: string;
  versionCode: number;
  filePath: string;
  sizeBytes: number;
  sha256: string;
  changelog: string;
  mandatory: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
  downloads: number;
  // APK 元数据（自动解析，可选）
  appLabel?: string;
  minSdkVersion?: number;
  targetSdkVersion?: number;
  launchableActivity?: string;
  permissions?: string[];
  nativeCode?: string[];
}

interface VersionsFile {
  versions: Version[];
  nextId: number;
}

function readJSON<T>(file: string, fallback: T): T {
  try {
    if (!fs.existsSync(file)) return fallback;
    const raw = fs.readFileSync(file, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON(file: string, data: any) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

// Versions
export function getVersions(): Version[] {
  const f = readJSON<VersionsFile>(VERSIONS_FILE, { versions: [], nextId: 1 });
  return f.versions;
}

export function findVersion(id: number): Version | undefined {
  return getVersions().find(v => v.id === id);
}

export function findLatest(appId: string, platform: string): Version | undefined {
  return getVersions()
    .filter(v => v.appId === appId && v.platform === platform && v.isActive)
    .sort((a, b) => b.versionCode - a.versionCode)[0];
}

export function addVersion(data: Omit<Version, 'id' | 'createdAt' | 'updatedAt' | 'downloads'>): Version {
  const f = readJSON<VersionsFile>(VERSIONS_FILE, { versions: [], nextId: 1 });
  const version: Version = {
    ...data,
    id: f.nextId++,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    downloads: 0,
  };
  f.versions.push(version);
  writeJSON(VERSIONS_FILE, f);
  return version;
}

export function updateVersion(id: number, updates: Partial<Version>): Version | null {
  const f = readJSON<VersionsFile>(VERSIONS_FILE, { versions: [], nextId: 1 });
  const v = f.versions.find(v => v.id === id);
  if (!v) return null;
  Object.assign(v, updates, { updatedAt: Date.now() });
  writeJSON(VERSIONS_FILE, f);
  return v;
}

export function deleteVersion(id: number): boolean {
  const f = readJSON<VersionsFile>(VERSIONS_FILE, { versions: [], nextId: 1 });
  const idx = f.versions.findIndex(v => v.id === id);
  if (idx < 0) return false;
  const v = f.versions[idx];
  // Delete file
  const filePath = path.join(UPLOAD_DIR, path.basename(v.filePath));
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  f.versions.splice(idx, 1);
  writeJSON(VERSIONS_FILE, f);
  return true;
}

export function incrementDownloads(id: number) {
  const f = readJSON<VersionsFile>(VERSIONS_FILE, { versions: [], nextId: 1 });
  const v = f.versions.find(v => v.id === id);
  if (v) {
    v.downloads = (v.downloads || 0) + 1;
    writeJSON(VERSIONS_FILE, f);

    // Also update stats
    const stats = readJSON<any>(STATS_FILE, { totalDownloads: 0, totalUploads: 0, perVersion: {}, perClient: {}, recent: [] });
    stats.totalDownloads = (stats.totalDownloads || 0) + 1;
    if (!stats.perVersion) stats.perVersion = {};
    if (!stats.perVersion[String(id)]) stats.perVersion[String(id)] = { downloads: 0, bytesDownloaded: 0 };
    stats.perVersion[String(id)].downloads++;
    writeJSON(STATS_FILE, stats);
  }
}

// Stats - 合并原推送服务 stats.json
export function getStats() {
  const versions = getVersions();
  // 原推送服务的 stats.json 已经有 totalDownloads/perVersion 等
  const externalStats = readJSON<any>(STATS_FILE, {});
  const totalDownloads = externalStats.totalDownloads || versions.reduce((s, v) => s + (v.downloads || 0), 0);
  const totalUploads = externalStats.totalUploads || versions.length;

  return {
    versions: versions.length,
    active: versions.filter(v => v.isActive).length,
    mandatory: versions.filter(v => v.mandatory).length,
    totalDownloads,
    totalUploads,
    totalSizeBytes: versions.reduce((s, v) => s + (v.sizeBytes || 0), 0),
    recent: externalStats.recent || [],
    perVersion: externalStats.perVersion || {},
    perClient: externalStats.perClient || {},
  };
}

// Settings - 直接读取 settings.json
export function loadSettings() {
  const external = readJSON<any>(SETTINGS_FILE, {});
  return {
    autoStart: external.autoStart ?? false,
    openBrowserOnStart: external.openBrowserOnStart ?? true,
    startMinimized: external.startMinimized ?? false,
    closeAction: external.closeAction ?? 'tray',
    enableTray: external.enableTray ?? true,
    accent: external.accent ?? '#7C3AED',
    theme: external.theme ?? 'dark',
    autoActivateOnUpload: external.autoActivateOnUpload ?? true,
    allowCors: external.allowCors ?? true,
    logLevel: external.logLevel ?? 'info',
    keepActiveVersions: external.keepActiveVersions ?? 3,
    mcWatcher: external.mcWatcher ?? { enabled: true, host: '127.0.0.1', port: 25565, intervalMs: 10000, timeoutMs: 1500 },
    tunnelWatcher: external.tunnelWatcher ?? {},
    tunnelWatchers: external.tunnelWatchers ?? {},
    externalProbe: external.externalProbe ?? {},
    _raw: external,
  };
}

export function saveSettings(data: any) {
  writeJSON(SETTINGS_FILE, data);
  return data;
}

// Announcements
export function loadAnnouncement() {
  const a = readJSON<any>(ANNOUNCEMENT_FILE, {});
  return {
    content: String(a.content || ''),
    link: String(a.link || ''),
    enabled: !!a.enabled,
    pushEnabled: a.pushEnabled !== false,
    pushTitle: String(a.pushTitle || '📢 新公告'),
    pushBody: String(a.pushBody || ''),
    updatedAt: a.updatedAt || null,
  };
}

export function saveAnnouncement(data: any) {
  const obj = {
    content: String(data.content || ''),
    link: String(data.link || ''),
    enabled: !!data.enabled,
    pushEnabled: data.pushEnabled !== false,
    pushTitle: String(data.pushTitle || '📢 新公告').slice(0, 80),
    pushBody: String(data.pushBody || '').slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  writeJSON(ANNOUNCEMENT_FILE, obj);
  return obj;
}

// Push Config
export function loadPushConfig() {
  return readJSON<any>(PUSH_CONFIG_FILE, {
    appVersionPushEnabled: true,
    appVersionPushTitle: '🎉 新版本发布',
    appVersionPushBody: '{version} 已发布，点击查看详情',
  });
}

export function savePushConfig(data: any) {
  const obj = {
    appVersionPushEnabled: data.appVersionPushEnabled !== false,
    appVersionPushTitle: String(data.appVersionPushTitle || '🎉 新版本发布').slice(0, 80),
    appVersionPushBody: String(data.appVersionPushBody || '{version} 已发布').slice(0, 500),
    updatedAt: new Date().toISOString(),
  };
  writeJSON(PUSH_CONFIG_FILE, obj);
  return obj;
}

// Changelog
export function getChangelog() {
  return readJSON<any[]>(CHANGELOG_FILE, []);
}

export function addChangelogEntry(entry: any) {
  const list = getChangelog();
  const obj = {
    id: Date.now(),
    ts: Date.now(),
    version: entry.version || '',
    title: entry.title || '',
    content: entry.content || '',
    tags: entry.tags || [],
    ...entry,
  };
  list.unshift(obj);
  writeJSON(CHANGELOG_FILE, list);
  return obj;
}

// Uploads
export function getUploadDir() {
  return UPLOAD_DIR;
}

// Row to DTO
export function rowToDto(v: Version) {
  return {
    id: v.id,
    appId: v.appId,
    platform: v.platform,
    version: v.version,
    versionCode: v.versionCode,
    sizeBytes: v.sizeBytes,
    sha256: v.sha256,
    changelog: v.changelog,
    mandatory: v.mandatory,
    isActive: v.isActive,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    downloads: v.downloads,
    downloadUrl: `/api/push/download/${v.id}`,
    appLabel: v.appLabel,
    minSdkVersion: v.minSdkVersion,
    targetSdkVersion: v.targetSdkVersion,
    launchableActivity: v.launchableActivity,
    permissions: v.permissions,
    nativeCode: v.nativeCode,
  };
}
