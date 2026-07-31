// siteConfig.ts - 全站配置中心
// 配置保存在 data/siteConfig.json，修改后刷新页面即可生效
// 
// 客户端组件：使用 useSiteConfig() hook 或 fetch('/api/config')
// 服务端组件/API Route：使用 getSiteConfig() / saveSiteConfig()

// 注意：此文件不包含 fs 调用，可安全用于客户端和服务端

// 客户端使用的静态默认值（仅用于初始渲染，实际值从 API 获取）
export const siteConfig: any = {
  authorName: 'HaYenai',
  bio: '',
  title: 'HaYenai の 宝藏之地',
  navTitle: 'HaYenai',
  navSuffix: 'の',
  navAfter: '宝藏之地',
  avatarUrl: '',
  faviconUrl: '',
  bgImages: [],
  cloudMusicIds: [],
  danmakuList: [],
  buildDate: '2026-03-23T00:00:00',
  enableLevelSystem: true,
  icpConfig: { name: '', link: '' },
  footerBadges: [],
  social: { github: '', gitee: '', google: '', email: '', qq: '', wechat: '' },
  geminiConfig: { modelId: 'gemini-2.5-flash-lite', systemPrompt: '', maxOutputTokens: 150, temperature: 0.85 },
  pushServerUrl: 'http://localhost:23525',
  gitalkConfig: {
    clientID: '',
    clientSecret: '',
    repo: 'ha-yenai-blog-comments',
    owner: 'bananaikun',
    admin: ['bananaikun'],
  },
};
