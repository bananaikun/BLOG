# XHBlogs 精简版 ✨

> 一个基于 Next.js 16 + React 19 的个人博客系统，聚焦核心写作与展示能力。
> 移除了推送服务、系统监控、APK 下载等附加模块，保留文章管理、音乐、图片上传、项目展示、公告等核心功能。

## 🌟 功能特性

### 核心功能
- 📝 **文章管理**：Markdown 写作，支持封面图、标签、描述、定时发布，完整的 CRUD（创建/读取/更新/删除）
- 🎵 **音乐播放**：网易云歌单集成，支持 QR 登录、播放列表、歌词显示
- 🖼️ **图片上传**：本地上传图片到 `public/uploads/`，自动生成访问 URL
- 📢 **公告系统**：站点公告，支持启用开关、定时发布、自定义样式（渐变/辉光/彩虹）
- 🚀 **项目展示**：GitHub 项目卡片矩阵，支持搜索、标签筛选
- 💬 **评论系统**：基于 Gitalk 的 GitHub Issue 评论
- 🐾 **AI 煤球**： Gemini 驱动的暹罗猫聊天助手

### 界面特性
- 🌌 玻璃拟态（Glassmorphism）+ 暗色模式
- 🌸 樱花、萤火虫、雪、风草等多种背景特效
- ⚡ 全站弹幕系统
- 🎬 Framer Motion 流畅动画过渡
- 📱 响应式设计，手机端转盘导航

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| 框架 | Next.js 16.2.1（App Router + Turbopack）|
| UI | React 19.2.4 + Tailwind CSS 4 |
| 动画 | Framer Motion 12 |
| Markdown | unified + remark + rehype + highlight.js + KaTeX |
| 音乐 | NeteaseCloudMusicApi |
| 评论 | Gitalk |
| AI | Openai SDK（Gemini）|
| 字体 | Geist + Noto Serif SC |

## 📦 项目结构

```
XHBlogs/
├── app/                      # Next.js App Router
│   ├── api/                  # 后端 API 路由
│   │   ├── posts/            # 文章 CRUD API
│   │   ├── projects/         # 项目 API
│   │   ├── announcements/    # 公告 API
│   │   ├── music/            # 音乐 API
│   │   ├── upload/           # 图片上传 API
│   │   ├── config/           # 站点配置 API
│   │   ├── chat/             # AI 聊天 API
│   │   ├── github/           # GitHub API
│   │   ├── weather/          # 天气 API
│   │   └── photowall/        # 照片墙 API
│   ├── posts/[slug]/         # 文章详情页
│   ├── projects/             # 项目展示页
│   ├── announcements/        # 公告展示页
│   ├── music/                # 音乐播放页
│   ├── photowall/            # 照片墙页
│   ├── settings/             # 后台管理页
│   └── page.tsx              # 首页
├── components/               # React 组件
├── data/                     # JSON 数据持久化
│   ├── siteConfig.json       # 站点配置
│   ├── projects.json         # 项目数据
│   ├── announcement.json     # 公告数据
│   └── config_backups/       # 配置自动备份
├── posts/                    # Markdown 文章目录
├── public/uploads/           # 上传图片存储
├── lib/                      # 工具库
└── siteConfig.ts             # 站点配置默认值
```

## 🚀 本地开发

### 环境要求
- Node.js ≥ 18.18
- npm ≥ 9

### 安装与运行

```bash
# 1. 克隆仓库
git clone https://github.com/<your-username>/XHBlogs.git
cd XHBlogs

# 2. 安装依赖
npm install

# 3. 启动开发服务器
npm run dev
```

访问 [http://localhost:23525](http://localhost:23525) 查看博客。

### 后台管理

访问 [http://localhost:23525/settings](http://localhost:23525/settings) 进入管理面板：

- **个人名片设置**：头像、简介、社交媒体链接
- **视觉背景配置**：背景图、模糊、亮度、主题色
- **音乐播放设置**：网易云歌单 ID、播放模式、音量
- **文章管理**：新建/编辑/删除文章，上传封面
- **公告编辑**：编辑公告内容、样式、定时发布
- **项目管理**：增删改查 GitHub 项目
- **首页底部设置**：ICP 备案、底部徽章
- **全站弹幕设置**：自定义弹幕内容
- **评论系统配置**：Gitalk 配置
- **AI 煤球配置**：Gemini API Key 与系统提示词

## 🌐 部署指南

### 方案一：Vercel 部署（推荐，最简单）

1. Fork 本仓库到自己的 GitHub
2. 访问 [vercel.com](https://vercel.com) 并登录
3. 点击 "New Project" → Import 你的 Fork 仓库
4. Vercel 自动识别 Next.js，直接点击 "Deploy"
5. 部署完成后获得 `https://<your-blog>.vercel.app` 域名

> ⚠️ Vercel 部署注意事项：
> - Vercel 的 Serverless 函数文件系统是只读的，文章和图片无法持久化到本地磁盘
> - 推荐使用 Vercel Blob Storage 或外部存储（如 Cloudflare R2、阿里云 OSS）替代本地文件存储
> - 修改 `app/api/posts/route.ts` 和 `app/api/upload/route.ts` 使用外部存储

### 方案二：自托管 VPS 部署（完整功能）

#### 1. 准备服务器
- 一台 Linux VPS（推荐 Ubuntu 22.04+）
- Node.js ≥ 18.18
- Nginx（反向代理）
- PM2（进程守护）

#### 2. 上传代码并安装

```bash
# 在服务器上
git clone https://github.com/<your-username>/XHBlogs.git
cd XHBlogs
npm ci --production=false

# 构建生产版本
npm run build
```

#### 3. 用 PM2 启动

```bash
# 安装 PM2（一次性）
npm install -g pm2

# 启动博客
pm2 start npm --name "xhblogs" -- start

# 设置开机自启
pm2 startup
pm2 save
```

#### 4. 配置 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 可选：HTTP 跳转 HTTPS
    # return 301 https://$host$request_uri;

    location / {
        proxy_pass http://127.0.0.1:23525;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # 上传文件大小限制
    client_max_body_size 60M;
}
```

重载 Nginx：
```bash
sudo nginx -t && sudo systemctl reload nginx
```

#### 5. 配置 HTTPS（推荐 Certbot）

```bash
sudo apt install certbot python3-certbot-nginx -y
sudo certbot --nginx -d your-domain.com
```

### 方案三：Docker 部署

#### 1. 创建 Dockerfile（项目根目录）

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/posts ./posts
COPY --from=builder /app/data ./data
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/next.config.ts ./
COPY --from=builder /app/siteConfig.ts ./
COPY --from=builder /app/tsconfig.json ./
EXPOSE 23525
CMD ["npm", "start"]
```

#### 2. 构建并运行

```bash
docker build -t xhblogs .
docker run -d --name xhblogs -p 23525:23525 -v $(pwd)/posts:/app/posts -v $(pwd)/data:/app/data -v $(pwd)/public/uploads:/app/public/uploads xhblogs
```

## 📝 使用说明

### 写第一篇文章

1. 访问 `/settings` → 切换到"文章管理"
2. 点击"+ 新建"
3. 填写标题、描述、标签、封面图（可上传）
4. 在正文区使用 Markdown 语法写作
5. 点击"✨ 创建文章"
6. 访问 `/posts` 或首页文章轮播查看

### 文章 Markdown 格式

文章存储在 `posts/<slug>.md`，使用 frontmatter 元数据：

```markdown
---
title: 我的第一篇文章
description: 一句话描述
date: 2026-07-31T10:00:00
tags: [随笔, 折腾]
cover: /uploads/xxx.jpg
---

# 正文标题

在这里用 Markdown 写正文...
```

### 配置音乐播放器

1. 登录 [music.163.com](https://music.163.com)
2. 创建或收藏一个歌单，复制歌单 ID（URL 中的数字）
3. 访问 `/settings` → "音乐播放设置"
4. 粘贴歌单 ID（多个用逗号分隔）
5. 保存配置

### 上传图片

- **管理后台上传**：在"个人名片设置"中上传头像，在"文章管理"中上传封面
- **API 上传**：`POST /api/upload`，FormData 字段名 `file`
- 上传后图片存储在 `public/uploads/`，返回 URL 如 `/uploads/abc123.jpg`

## 🔧 常见问题

### Q: 端口 23525 被占用怎么办？
A: 修改 `package.json` 中的 `dev` 和 `start` 脚本的端口号。

### Q: 文章/图片丢失了？
A: 检查 `posts/` 和 `public/uploads/` 目录的写权限。Vercel 等 Serverless 平台不持久化文件系统，请用外部存储。

### Q: 音乐无法播放？
A: 网易云 API 需要登录 Cookie。访问 `/music` 页面扫码登录后，Cookie 会自动保存到 `lib/ncm-cookie.ts`。

### Q: 评论系统不工作？
A: 在 `/settings` → "评论系统配置"中填入 Gitalk 的 `clientID`、`clientSecret`、`repo`、`owner`。需要在 [GitHub OAuth Apps](https://github.com/settings/developers) 创建应用。

### Q: AI 煤球不回复？
A: 在 `/settings` → "AI 煤球配置"中配置 Gemini API Key。可在 [Google AI Studio](https://aistudio.google.com/) 申请。

## 📜 License

MIT License - 详见 [LICENSE](LICENSE)

## 🙏 致谢

- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Framer Motion](https://www.framer.com/motion/)
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
- [Gitalk](https://github.com/gitalk/gitalk)
- 原作者 [XingHuiSama](https://github.com/XingHuiSama) 的博客项目作为本精简版的基础
