// 📢 公告配置
// 替代原推送更新服务端的公告功能

export interface Announcement {
  content: string;
  link: string;
  enabled: boolean;
  pushEnabled: boolean;
  pushTitle: string;
  pushBody: string;
  updatedAt: string;
}

export const announcementData: Announcement = {
  content: "1. 移除前台保活通知 (KeepAliveService 改为纯后台服务)\n2. WorkManager 链式 1min→30s 弥补保活强度\n3. AlarmManager setAlarmClock 30s 拉起兜底\n4. 删除所有 hayenai_keepalive* channel (app 启动时主动清理)\n5. 修复 MC 状态变化 FCM 推送链路 (mcWatcher 状态变化时 broadcastAll)\n6. 公告页 + 更新日志页 (73 条记录 app/web/server)\n7. web 开机启动修复 (HKCU\\Run cwd 修复)",
  link: "https://s.bananaikun.dynv6.net:22056/api/download/57",
  enabled: true,
  pushEnabled: true,
  pushTitle: "📢 新公告",
  pushBody: "",
  updatedAt: "2026-07-04T08:56:52.036Z"
};
