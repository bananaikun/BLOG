// 📦 应用版本更新配置
// 替代原推送更新服务端的版本管理功能

export interface AppVersion {
  id: number;
  appId: string;
  platform: string;
  version: string;
  versionCode: number;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  changelog: string;
  mandatory: boolean;
  isActive: boolean;
  createdAt: number;
  updatedAt: number;
}

export const versionsData: AppVersion[] = [
  {
    id: 3,
    appId: "com.hayenai.app",
    platform: "android",
    version: "1.0.60",
    versionCode: 60,
    fileName: "app-1783226173335-2b9c3597.apk",
    sizeBytes: 70734648,
    sha256: "7c3bb487a78766206ff5a2fa03306b32619a2e875ad4105f9db3f96738cd0d4a",
    changelog: "v1.0.60 整合包安装 v3 - 真正的 Scoped Storage 修复：之前 v1.0.58/v1.0.59 只修了 mkdirs 没修写文件，expo-file-system.writeAsStringAsync 写 /Android/data/.../files/tmp/.../manifest.json 依然报 isn't writable。BackgroundCopy 新增 writeString 方法（用纯 Java IO 写文件，绕开 expo writable 检查），installer 6 处 writeAsStringAsync 全部改用 writeStringSafe（优先 native，失败退 expo）。writeStringSafe 支持 utf-8/base64/latin1 encoding。直接修复 mrpack + curseforge 整合包安装失败问题。Plugin 模板同步更新。",
    mandatory: true,
    isActive: true,
    createdAt: 1783226173763,
    updatedAt: 1783226173763
  },
  {
    id: 4,
    appId: "com.hayenai.app",
    platform: "android",
    version: "1.0.61",
    versionCode: 61,
    fileName: "app-1783226859109-4ad3a0ef.apk",
    sizeBytes: 70735104,
    sha256: "1238ce5a4508bf5ff3ee31b21e183aa1c40d9ad1529fa5619ab89dcef8781b81",
    changelog: "v1.0.61 整合包安装 v4 - copyDirContentsLegacy 修复：v1.0.60 修 writeString + 部分 mkdirs，但 copyDirContentsLegacy 复制 overrides/ 时仍用 FileSystem.makeDirectoryAsync 创建子目录（如 overrides/PCL→outDir/PCL, overrides/mods→outDir/mods），在 Android 11+ 报 isn't writable。v1.0.61 把 copyDirContentsLegacy 内部子目录创建改用 backgroundCopy.mkdirs，文件复制改用 backgroundCopy.copy（绕开 Scoped Storage 误判）。请重装新版后重试 26.1.2FabricGreenMan.zip 和 modpack.mrpack。",
    mandatory: true,
    isActive: true,
    createdAt: 1783226859578,
    updatedAt: 1783226859578
  },
  {
    id: 5,
    appId: "com.hayenai.app",
    platform: "android",
    version: "1.0.62",
    versionCode: 62,
    fileName: "app-1783238694146-5e711727.apk",
    sizeBytes: 70735504,
    sha256: "337db536cf4b26824666f48f78b0b67490e013b9c330111bb96006b6f79aebb6",
    changelog: "v1.0.62 整合包安装 v5 - 修复 FCL/PCL 启动器不下载 minecraft.jar：之前 v1.0.24 模式写非标准 version.json + 22 字节占位 jar，启动器误判 jar 已存在但不下载。v1.0.62 改写为 FCL/HMCL/PCL 启动器兼容的 Mojang 标准 version.json（type=release + inheritsFrom=mcVersion + mainClass + libraries），不创建占位 jar，让启动器根据 inheritsFrom 从 Mojang 拉 MC 原版 + 拉真 client.jar。Loader mainClass 覆盖 fabric / quilt / forge / neoforge。装新版后重试两个整合包，启动 MC 时 FCL 启动器应自动下载 ~30MB 的真 minecraft.jar。",
    mandatory: true,
    isActive: true,
    createdAt: 1783238694726,
    updatedAt: 1783238694726
  }
];

// 获取最新版本
export function getLatestVersion(appId: string = "com.hayenai.app", platform: string = "android"): AppVersion | null {
  const active = versionsData.filter(v => v.appId === appId && v.platform === platform && v.isActive);
  if (active.length === 0) return null;
  return active.reduce((latest, v) => v.versionCode > latest.versionCode ? v : latest);
}

// 格式化文件大小
export function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
