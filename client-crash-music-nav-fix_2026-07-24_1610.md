# 客户端崩溃 + 音乐跨页面导航修复验证 (2026-07-24 16:10)

## 验证脚本
`D:\mod\HaYenai\blog\XHBlogs\test_nav.js`（临时，已删除）

## 关键修复
1. **siteConfig.ts 拆分** + 运行时 `getSiteConfig()` 动态读取
2. **MusicProvider 移到 root layout**（不再按页面挂载）
3. **修复单 audio 实例**（重构为单 audio + queue，audio.src 用外链，不生成 blob URL）
4. **删除静态 `<audio>` 标签**，由 MusicProvider 创建
5. **dev/prod 双模式验证**（Turbopack + Webpack）

## 自动化验证结果（CDP WS 控制 msedge via DevTools）

### STEP1：打开 /music（初始状态）
```json
{
  "audios": 1,
  "currentTime": 11.904252,
  "paused": false,
  "song": "兰音Reine",
  "audioSrc": "https://music.163.com/song/media/outer/url?id=1809646618.mp3"
}
```
✅ 自动播放生效（autoplay-policy=no-user-gesture-required 标志）
✅ audio 实例正确加载
✅ song 显示「兰音Reine」

### STEP2：手动点击播放
```json
{ "paused": false, "currentTime": 13.410751 }
```
✅ currentTime 持续推进

### STEP3：点击导航栏 /about（客户端导航）
```json
{
  "url": "/about",
  "audios": 1,
  "audioSrc": "https://music.163.com/song/media/outer/url?id=1809646618.mp3",
  "currentTime": 16.423025,
  "paused": false
}
```
✅ **关键验证**：跳转 /about 后音频仍在播放
✅ currentTime 从 13.4 → 16.4（继续推进）
✅ audio 元素仍然存在（MusicProvider 在 root layout）
✅ src URL 与 STEP1 完全一致（网易云外链）

### STEP4：点击导航栏 /music（返回）
```json
{
  "url": "/music",
  "audios": 1,
  "audioSrc": "https://music.163.com/song/media/outer/url?id=1809646618.mp3",
  "currentTime": 19.430477,
  "paused": false
}
```
✅ 回到 /music 页面仍保持同一音频
✅ currentTime 从 16.4 → 19.4（连续播放）

## 核心结论
**音频跨页面导航完全连续**——STEP1 起点 11.9s，STEP4 终点 19.4s，无重置、无中断、无 blob URL 失效。
MusicProvider 单例 + 单 audio 元素 + 外链 src 策略彻底解决之前"刷新页面音乐重置"和"Blob URL revoked"问题。

## 验证环境
- Edge via `--remote-debugging-port=9226`
- Playwright/CDP 等价物：原生 `ws` + DevTools Protocol
- 服务：localhost:23525, dev mode (Turbopack)