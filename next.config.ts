import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // 关闭 source map 生成 (dev 模式也跳过, 节省内存/CPU; 生产时 devtool 已 default false)
  productionBrowserSourceMaps: false,
  // Turbopack 锁定到 ASCII 路径避免中文路径 bug
  turbopack: {
    root: path.resolve(__dirname),
  },
  // NCMAPI 作为外部 require 加载 (内部用 fs.readdir 动态 require ./module/*)
  serverExternalPackages: ['NeteaseCloudMusicApi'],

  // API 响应强制 utf-8
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Content-Type', value: 'application/json; charset=utf-8' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
        ],
      },
    ];
  },
};

export default nextConfig;