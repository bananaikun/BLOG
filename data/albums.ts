// 本文件由 XingHuiSama 控制台自动生成，请勿手动修改
export interface Photo { url: string; caption?: string; }
export interface Album { id: string; title: string; description: string; cover: string; date: string; photos: Photo[]; }

export const albums: Album[] = [
  // 测试用相册（泰拉大陆纪行 / 唐宋历史巡游）已被移除 - 保留空数组
];