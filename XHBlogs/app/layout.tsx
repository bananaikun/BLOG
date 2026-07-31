import 'katex/dist/katex.min.css';
import type { Metadata } from "next";
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/700.css';
import '@fontsource/noto-serif-sc/900.css';
import "./globals.css";
import { ThemeProvider } from "../components/ThemeProvider";
import BackgroundEffects from "../components/BackgroundEffects";
import { MusicProvider } from "../components/MusicProvider";
import FloatingPlayer from "../components/FloatingPlayer";
import { siteConfig } from "../siteConfig";
import { getSiteConfig } from "../lib/serverConfig";
import ClickEffect from "../components/ClickEffect";
import BackgroundSlider from "../components/BackgroundSlider";
import GlobalToolbox from "../components/GlobalToolbox";
import SplashScreen from "../components/SplashScreen";
import DanmakuBackground from '../components/DanmakuBackground';
import MobileBackButton from '../components/MobileBackButton';

// 运行时读取配置（仅服务端）
const runtimeConfig = getSiteConfig();
const mergedConfig = { ...siteConfig, ...runtimeConfig };

export const metadata: Metadata = {
  title: mergedConfig.title,
  description: mergedConfig.bio,
  icons: {
    icon: mergedConfig.faviconUrl,
    apple: mergedConfig.faviconUrl,
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
              #app-mount-root { opacity: 0; visibility: hidden; pointer-events: none; }
              html.splash-seen #app-mount-root { opacity: 1 !important; visibility: visible !important; pointer-events: auto !important; }
            `}} />
        {/* 早于 React 注入的 splash-seen class — 用 noscript 包裹的 style 注入避免 React 19 script 警告 */}
        <noscript suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
          <style>html.splash-seen #app-mount-root { opacity: 1 !important; visibility: visible !important; }</style>
        `}} />
      </head>

      <body className="w-screen overflow-x-hidden min-h-full flex flex-col relative transition-colors duration-1000 bg-slate-50 dark:bg-slate-950 font-serif">
        <ThemeProvider>
          <SplashScreen />
          <MusicProvider>
            <div id="app-mount-root" className="flex-1 flex flex-col transition-opacity duration-1000">
              {/* BackgroundSlider 独立容器 - 可以接收点击事件用于切换背景 */}
              {!mergedConfig.useGradient && <BackgroundSlider />}
              {/* 其他装饰背景 - 不可点击 */}
              <div className="fixed inset-0 z-[-2] pointer-events-none overflow-hidden">
                <div className="absolute inset-0 z-0 bg-white/30 dark:bg-slate-900/40 backdrop-blur-md transition-colors duration-1000"></div>
                <div className="absolute inset-0 z-0 opacity-60 dark:opacity-20 mix-blend-color transition-opacity duration-1000 transform-gpu"
                  style={{ background: `linear-gradient(-45deg, ${mergedConfig.themeColors.join(', ')})`, backgroundSize: '400% 400%', animation: 'gradientMove 15s ease infinite' }}>
                </div>
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-white/40 dark:bg-indigo-900/20 blur-[100px] rounded-full md:mix-blend-overlay"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/30 dark:bg-purple-900/30 blur-[100px] rounded-full md:mix-blend-overlay"></div>
                <div className="hidden md:block absolute inset-0 w-full h-full">
                  <BackgroundEffects />
                </div>
              </div>
              <div className="hidden md:block">
                <DanmakuBackground />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                {children}
              </div>
              <div className="hidden md:block"><FloatingPlayer /></div>
              <div className="hidden md:block"><GlobalToolbox /></div>
              <div className="md:hidden block"><MobileBackButton /></div>
              <div className="hidden md:block"><ClickEffect /></div>
            </div>
            <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
              @keyframes gradientMove { 
                0% { background-position: 0% 50%; } 
                50% { background-position: 100% 50%; } 
                100% { background-position: 0% 50%; } 
              }
            `}} />
          </MusicProvider>
          {/* 🐱 CyberCat removed — no cat on page */}
        </ThemeProvider>
      </body>
    </html>
  );
}
