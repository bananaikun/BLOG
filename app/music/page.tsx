import { Suspense } from "react";
import MusicClient from "./MusicClient";

// 这里是服务端渲染，完美支持 metadata
export const metadata = {
  title: "云端乐律 | " + 'HaYenai の 宝藏之地',
};

export default function MusicPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-400 font-bold animate-pulse">加载中...</div>
      </div>
    }>
      <MusicClient />
    </Suspense>
  );
}