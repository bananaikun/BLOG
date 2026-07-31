'use client';

import { useState } from 'react';
import { versionsData, getLatestVersion, formatSize, type AppVersion } from '@/data/versions';
import { announcementData } from '@/data/announcements';

export default function DownloadBoard() {
  const latest = getLatestVersion();
  const sortedVersions = [...versionsData].sort((a, b) => b.versionCode - a.versionCode);
  const [selectedVersion, setSelectedVersion] = useState<AppVersion | null>(latest);

  return (
    <div className="max-w-4xl mx-auto px-4">
      {/* 标题区 */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          HaYenai 应用下载
        </h1>
        <p className="text-gray-400 text-lg">
          最新版本：{latest?.version || '暂无'}
        </p>
      </div>

      {/* 公告区 */}
      {announcementData.enabled && (
        <div className="mb-8 p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-2xl">📢</span>
            <h2 className="text-xl font-semibold">最新公告</h2>
          </div>
          <div className="text-gray-300 whitespace-pre-line text-sm leading-relaxed">
            {announcementData.content}
          </div>
          {announcementData.link && (
            <a
              href={announcementData.link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-4 text-purple-400 hover:text-purple-300 text-sm"
            >
              查看详情 →
            </a>
          )}
        </div>
      )}

      {/* 最新版本下载卡 */}
      {latest && (
        <div className="mb-10 p-8 rounded-3xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 backdrop-blur-md border border-purple-500/30">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-3 py-1 text-xs font-medium rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                  最新版本
                </span>
                {latest.mandatory && (
                  <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
                    强制更新
                  </span>
                )}
              </div>
              <h3 className="text-3xl font-bold mb-2">v{latest.version}</h3>
              <p className="text-gray-400 text-sm">
                {formatSize(latest.sizeBytes)} · {new Date(latest.createdAt).toLocaleDateString('zh-CN')}
              </p>
            </div>
            <a
              href={`/uploads/${latest.fileName}`}
              download
              className="px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold text-lg hover:shadow-lg hover:shadow-purple-500/30 transition-all duration-300 text-center"
            >
              ⬇ 立即下载
            </a>
          </div>
          <div className="mt-6 pt-6 border-t border-white/10">
            <h4 className="text-sm font-medium text-gray-300 mb-3">更新日志</h4>
            <p className="text-gray-400 text-sm leading-relaxed">{latest.changelog}</p>
          </div>
        </div>
      )}

      {/* 历史版本列表 */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold mb-6">历史版本</h2>
        {sortedVersions.map((version) => (
          <div
            key={version.id}
            className="p-5 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 hover:border-purple-500/30 transition-all cursor-pointer"
            onClick={() => setSelectedVersion(selectedVersion?.id === version.id ? null : version)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <span className="text-xl font-semibold">v{version.version}</span>
                <span className="text-gray-500 text-sm">{formatSize(version.sizeBytes)}</span>
              </div>
              <div className="flex items-center gap-3">
                {version.isActive ? (
                  <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">活跃</span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">归档</span>
                )}
                <a
                  href={`/uploads/${version.fileName}`}
                  download
                  onClick={(e) => e.stopPropagation()}
                  className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 text-sm hover:bg-purple-500/30 transition-colors"
                >
                  下载
                </a>
              </div>
            </div>
            {selectedVersion?.id === version.id && (
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-gray-400 text-sm leading-relaxed">{version.changelog}</p>
                <div className="mt-3 text-xs text-gray-500 font-mono">
                  SHA256: {version.sha256.substring(0, 32)}...
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* API 说明 */}
      <div className="mt-16 p-6 rounded-2xl bg-white/5 backdrop-blur-md border border-white/10">
        <h3 className="text-lg font-semibold mb-4">🔌 客户端 API 接口</h3>
        <div className="space-y-3 text-sm font-mono">
          <div className="p-3 rounded-lg bg-black/30">
            <span className="text-green-400">GET</span>
            <span className="text-gray-300 ml-2">/api/latest?appId=com.hayenai.app&platform=android</span>
            <p className="text-gray-500 mt-1 text-xs">获取最新版本信息</p>
          </div>
          <div className="p-3 rounded-lg bg-black/30">
            <span className="text-green-400">GET</span>
            <span className="text-gray-300 ml-2">/api/download/:id</span>
            <p className="text-gray-500 mt-1 text-xs">下载指定版本 APK</p>
          </div>
          <div className="p-3 rounded-lg bg-black/30">
            <span className="text-green-400">GET</span>
            <span className="text-gray-300 ml-2">/api/changelog</span>
            <p className="text-gray-500 mt-1 text-xs">获取完整更新日志</p>
          </div>
          <div className="p-3 rounded-lg bg-black/30">
            <span className="text-green-400">GET</span>
            <span className="text-gray-300 ml-2">/api/announcements</span>
            <p className="text-gray-500 mt-1 text-xs">获取最新公告</p>
          </div>
        </div>
      </div>
    </div>
  );
}
