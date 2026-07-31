---
title: "推送系统集成 - 统一管理面板"
date: "2026-07-24 13:00"
cover: ""
tags: ["推送", "集成", "博客"]
---

## ✅ 推送管理统一升级

原推送更新程序是独立的 Node.js 服务，需要单独启动。现在已**完整集成到博客主站**，所有功能在一个进程里。

### 主要变更

- **统一入口**：推送管理现在在 `http://localhost:23525/push` 一键可访问
- **博客风格**：复用 Navbar + PageTransition + Card 布局，与 `/download` 等页风格一致
- **数据继承**：完整迁移原推送程序的 3 个版本、12 项配置、26 条更新日志、5 个 APK 文件
- **鉴权简化**：固定 Bearer Token（`hayenai-admin-2024`），无需每次输入密码
- **GBK → UTF-8**：原推送程序的 JSON 文件已转换编码

### 新增 API

```
GET    /api/push/versions       列出所有版本
POST   /api/push/versions       上传新版本
PATCH  /api/push/versions/[id]  修改版本
DELETE /api/push/versions/[id]  删除版本
GET    /api/push/download/[id]  下载（断点续传）
GET    /api/push/stats          统计
GET    /api/push/settings       推送设置
GET    /api/push/changelog      更新日志
GET    /api/push/announcement   公告
POST   /api/push/announcement   设置公告
```

### 推送面板 5 大模块

1. **版本管理** - 列出所有版本、切换激活状态、强制更新、删除
2. **推送新版本** - 上传 APK + 拖拽支持 + 实时进度条
3. **MC 监控** - Minecraft 服务器状态 + 前端直连探测（mcsrvstat.us）
4. **内网穿透** - 隧道状态、本地→公网映射、延迟监控
5. **更新日志** - 完整 26 条记录展示，支持按类别筛选

### 注意事项

- 服务必须从 ASCII 路径 `D:\mod\HaYenai\blog\XHBlogs` 启动（避免 Turbopack 中文路径 BUG）
- 中文路径 `D:\mod\HaYenai\博客\XHBlogs` 通过 junction 链接 `node_modules` 和 `.next`
- 推送鉴权使用固定 Bearer Token（开发环境友好）