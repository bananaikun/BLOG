// lib/ncm-loader.ts
// NeteaseCloudMusicApi 单例加载器
//
// 背景:
//   NCM 包内部用 fs.readdir + 动态 require('./module/' + file) 加载所有模块,
//   Next.js 16 Turbopack 的静态分析器无法追踪这种动态导入,
//   构建时会报错: "找不到模块: 无法解析 './ROOT/node_modules/NeteaseCloudMusicApi/module' <dynamic>"
//
// 解决方案:
//   用 eval('require')(...) 包一层, 让 Turbopack 静态分析时看不到 require 关键字,
//   从而不会尝试追踪 NCM 包内部的动态 require.
//
// 单例模式: 同一进程多次调用复用同一个 NCM 实例, 避免重复加载.

/* eslint-disable @typescript-eslint/no-require-imports */

let _ncm: any = null;

export async function loadNcm(): Promise<any> {
  if (_ncm) return _ncm;

  // 用 eval 包裹 require, 绕过 Turbopack/webpack 的静态分析
  // 运行时才会真正执行 require('NeteaseCloudMusicApi')
  const dynamicRequire: (name: string) => any = eval('require');
  const mod = dynamicRequire('NeteaseCloudMusicApi');
  _ncm = mod.default || mod;
  return _ncm;
}
