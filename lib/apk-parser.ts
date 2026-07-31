/**
 * APK metadata parser
 *
 * Extract appId / versionCode / versionName / appLabel / SDK versions / permissions / launchable activity / native architectures from APK files.
 *
 * Ported from the original push update program server.js (parseApkMetadata + findAapt):
 *   - findAapt(): locate aapt.exe in Android SDK build-tools or AAPT_PATH env
 *   - parseApkMetadata(): invoke `aapt dump badging` and parse the output
 *   - Handles non-ASCII paths by copying the APK to an ASCII temp directory
 *     (aapt internally uses the ANSI API to read ZIPs and fails with "Illegal byte sequence" on Chinese paths)
 */

import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

export interface ApkMetadata {
  /** Package name (applicationId) */
  appId: string;
  /** Version code (integer) */
  versionCode: number;
  /** Version name (string, e.g. "1.0.1") */
  versionName: string;
  /** App label (launcher name) */
  appLabel?: string;
  /** Minimum SDK version */
  minSdkVersion?: number;
  /** Target SDK version */
  targetSdkVersion?: number;
  /** Launchable activity */
  launchableActivity?: string;
  /** Permission list */
  permissions?: string[];
  /** Native architecture list (arm64-v8a / armeabi-v7a / x86 / x86_64) */
  nativeCode?: string[];
}

interface ApkBadging extends ApkMetadata {
  permissions: string[];
  nativeCode: string[];
}

/**
 * Locate aapt.exe
 * Priority: AAPT_PATH env > Android SDK build-tools/<version>/aapt.exe > PATH
 */
export function findAapt(): string | null {
  // 1. AAPT_PATH environment variable has highest priority
  if (process.env.AAPT_PATH && fs.existsSync(process.env.AAPT_PATH)) {
    return process.env.AAPT_PATH;
  }

  // 2. Scan Android SDK build-tools directories
  const candidates: string[] = [];
  if (process.env.ANDROID_HOME) {
    candidates.push(path.join(process.env.ANDROID_HOME, 'build-tools'));
  }
  if (process.env.ANDROID_SDK_ROOT) {
    candidates.push(path.join(process.env.ANDROID_SDK_ROOT, 'build-tools'));
  }
  // Windows default paths
  if (process.platform === 'win32') {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      candidates.push(path.join(localAppData, 'Android', 'Sdk', 'build-tools'));
    }
    candidates.push('C:\\Android\\sdk\\build-tools');
  }

  for (const dir of candidates) {
    if (!fs.existsSync(dir)) continue;
    try {
      // Find the latest version of build-tools/<version>/aapt.exe
      const subs = fs
        .readdirSync(dir)
        .filter((n) => /^\d+\.\d+\.\d+$/.test(n))
        .sort()
        .reverse();
      for (const sub of subs) {
        const p = path.join(dir, sub, 'aapt.exe');
        if (fs.existsSync(p)) return p;
      }
      // Fallback: build-tools/aapt.exe
      const fallback = path.join(dir, 'aapt.exe');
      if (fs.existsSync(fallback)) return fallback;
    } catch {
      // Ignore scan errors
    }
  }

  // 3. Try PATH
  try {
    const which = process.platform === 'win32' ? 'where' : 'which';
    const out = execFileSync(which, [process.platform === 'win32' ? 'aapt.exe' : 'aapt'], {
      encoding: 'utf8',
      timeout: 3000,
    }).trim();
    if (out) return out.split(/\r?\n/)[0];
  } catch {
    // Not found
  }

  return null;
}

/**
 * Copy a file to an ASCII temporary directory
 * (aapt uses the ANSI API to read ZIPs and fails with non-ASCII characters in the path)
 */
function copyToAsciiTemp(srcPath: string): { tmpPath: string; cleanup: () => void } {
  const tmpDir = path.join(
    os.tmpdir(),
    `hayenai-aapt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  fs.mkdirSync(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, 'app.apk');
  fs.copyFileSync(srcPath, tmpPath);
  return {
    tmpPath,
    cleanup: () => {
      try {
        fs.unlinkSync(tmpPath);
        fs.rmdirSync(path.dirname(tmpPath));
      } catch {
        // Ignore cleanup errors
      }
    },
  };
}

/**
 * Check whether a path contains non-ASCII characters
 */
function hasNonAscii(s: string): boolean {
  return /[^\x00-\x7F]/.test(s);
}

/**
 * Call `aapt dump badging` and return parsed metadata
 * Does NOT throw: returns null when aapt is not available or the APK is corrupt
 */
export function parseApkMetadata(apkPath: string): ApkBadging | null {
  const aapt = findAapt();
  if (!aapt) {
    return null;
  }

  let workPath = apkPath;
  let tmp: { tmpPath: string; cleanup: () => void } | null = null;

  try {
    if (hasNonAscii(apkPath)) {
      tmp = copyToAsciiTemp(apkPath);
      workPath = tmp.tmpPath;
    }

    const out = execFileSync(aapt, ['dump', 'badging', workPath], {
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });

    return parseBadgingOutput(out);
  } catch {
    return null;
  } finally {
    if (tmp) tmp.cleanup();
  }
}

/**
 * Parse the output of `aapt dump badging`
 *
 * Example output:
 *   package: name='com.hayenai.app' versionCode='2' versionName='1.0.1'
 *   sdkVersion:'21'
 *   targetSdkVersion:'34'
 *   application-label:'App Name'
 *   launchable-activity: name='com.hayenai.app.MainActivity'
 *   uses-permission: name='android.permission.INTERNET'
 *   native-code: 'arm64-v8a' 'armeabi-v7a'
 */
function parseBadgingOutput(out: string): ApkBadging | null {
  // package: name='com.xx' versionCode='1' versionName='1.0.0'
  const pkg = out.match(
    /package:\s+name='([^']+)'\s+versionCode='(\d+)'\s+versionName='([^']+)'/
  );
  if (!pkg) return null;

  const appId = pkg[1];
  const versionCode = parseInt(pkg[2], 10);
  const versionName = pkg[3];

  // application-label:'App Name'
  const labelMatch = out.match(/application-label:\s*'([^']+)'/);
  const appLabel = labelMatch ? labelMatch[1] : '';

  // sdkVersion:'21'
  const minSdkMatch = out.match(/sdkVersion:\s*'([^']+)'/);
  const minSdkVersion = minSdkMatch ? parseInt(minSdkMatch[1], 10) : undefined;

  // targetSdkVersion:'34'
  const targetSdkMatch = out.match(/targetSdkVersion:\s*'([^']+)'/);
  const targetSdkVersion = targetSdkMatch ? parseInt(targetSdkMatch[1], 10) : undefined;

  // launchable-activity: name='com.xx.MainActivity'
  const launchMatch = out.match(/launchable-activity:\s*name='([^']+)'/);
  const launchableActivity = launchMatch ? launchMatch[1] : undefined;

  // uses-permission: name='android.permission.INTERNET'
  const permissions: string[] = [];
  const permRegex = /uses-permission:\s*name='([^']+)'/g;
  let m: RegExpExecArray | null;
  while ((m = permRegex.exec(out)) !== null) {
    permissions.push(m[1]);
  }

  // native-code: 'arm64-v8a' 'armeabi-v7a'
  const nativeCode: string[] = [];
  const nativeMatch = out.match(/native-code:\s*(.+)/);
  if (nativeMatch) {
    const archRegex = /'([^']+)'/g;
    let n: RegExpExecArray | null;
    while ((n = archRegex.exec(nativeMatch[1])) !== null) {
      nativeCode.push(n[1]);
    }
  }

  return {
    appId,
    versionCode,
    versionName,
    appLabel,
    minSdkVersion,
    targetSdkVersion,
    launchableActivity,
    permissions,
    nativeCode,
  };
}

/**
 * Simplified version: only returns appId / versionCode / versionName
 * Useful for the auto-fill scenario in upload endpoints
 */
export function parseApkBasic(apkPath: string): {
  appId: string;
  versionCode: number;
  versionName: string;
} | null {
  const full = parseApkMetadata(apkPath);
  if (!full) return null;
  return {
    appId: full.appId,
    versionCode: full.versionCode,
    versionName: full.versionName,
  };
}
