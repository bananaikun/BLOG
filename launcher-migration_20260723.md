# XHBlogs 系统托盘启动器 + 设置面板

## 目标
将 XHBlogs 启动器从 GUI 窗口改为系统托盘静默运行，新建在线设置面板。

## 完成内容

### 1. 系统托盘启动器 — XHBlogsTray.exe（13 KB）
- 启动后自动运行博客（`next start -p 3000`），隐藏在系统托盘
- 右键菜单：
  - **🌐 打开博客** — 浏览器打开 localhost:3000
  - **⚙️ 设置面板** — 打开 /settings 页面
  - **开机自启** — 切换开机自动启动（在 Startup 文件夹建快捷方式）
  - **运行时长** — 实时显示博客运行时间
  - **退出** — 停止博客并退出
- 左键点击托盘图标 = 打开博客
- 图标来源：`D:\mod\HaYenai\博客\系统托盘图标.png`（已转换为 tray.ico）
- 路径自适应：优先使用 EXE 所在目录，其次回退到 `D:\mod\HaYenai\博客\XHBlogs`
- C# 5 编译，无需额外运行时

### 2. 在线设置面板 — /settings
- 7 个标签页：个人名片、视觉背景、音乐播放、首页底部、全站弹幕、评论系统、AI 煤球
- 所有表单字段与 siteConfig.ts 字段一一对应
- **💾 保存配置** → 调用 `/api/config` POST → siteConfig.ts 自动重写 + 备份到 `data/config_backups/`
- 修改后需重新构建才能生效

### 3. 配置 API — /api/config
- GET：读取 siteConfig.ts 当前值
- POST：接收 JSON → 备份旧文件 → 重写 siteConfig.ts

### 4. 构建修复
- 移除了 rebuild 路由（Turbopack 在中文路径 `博客` 下生成 source map 崩溃）
- 结果：25 个页面全部构建成功，含 /settings

## 文件清单
| 文件 | 说明 |
|------|------|
| `launcher/XHBlogsTray.exe` | 系统托盘启动器 |
| `launcher/XHBlogsLauncher.cs` | C# 源码 |
| `launcher/tray.ico` | 托盘图标 |
| `app/settings/page.tsx` | 设置面板 |
| `app/api/config/route.ts` | 配置读写 API |
| `next.config.ts` | 添加了 productionBrowserSourceMaps: false |

## 使用方式
1. 双击 `launcher/XHBlogsTray.exe` 启动
2. 系统托盘右键 → 「设置面板」进行配置修改
3. 保存配置后，需手动执行 `npm run build` 使变更生效
