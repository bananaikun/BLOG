import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // 关闭 source map 生成 (dev 模式也跳过, 节省内存/CPU; 生产时 devtool 已 default false)
  productionBrowserSourceMaps: false,
  // NCMAPI 作为外部 require 加载 (内部用 fs.readdir 动态 require ./module/*)
  // 配合 lib/ncm-loader.ts 的 eval('require') 绕过 Turbopack 静态分析
  serverExternalPackages: ['NeteaseCloudMusicApi'],
  // 强制将 NeteaseCloudMusicApi 及其所有依赖（含嵌套传递依赖）打包进服务端产物，
  // 解决 Vercel 运行时 Cannot find module 'form-data' / 'follow-redirects' 等错误
  // NCM 内部 axios 的依赖被 npm hoist 到根 node_modules，tracing 无法自动追踪，
  // 因此直接包含整个 node_modules 确保所有依赖可用
  outputFileTracingIncludes: {
    '/api/**/*': ['./node_modules/**/*'],
  },

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