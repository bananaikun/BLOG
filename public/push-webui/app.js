// ============== 工具函数 ==============
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const on = (el, ev, fn) => el && el.addEventListener(ev, fn);
const STORAGE_KEY = 'hayenai.updatehub.token';
const THEME_KEY = 'hayenai.updatehub.theme';
const ACCENT_KEY = 'hayenai.updatehub.accent';

function fmtBytes(n) {
  if (n == null) return '—';
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(2) + ' MB';
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB';
}
function fmtTime(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 3600_000) return Math.floor(diff / 60_000) + ' 分钟前';
  if (diff < 86400_000) return Math.floor(diff / 3600_000) + ' 小时前';
  if (diff < 7 * 86400_000) return Math.floor(diff / 86400_000) + ' 天前';
  return d.toLocaleString('zh-CN');
}
function fmtUptime(secs) {
  secs = Math.max(0, Math.floor(secs || 0));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h) return `${h}h ${m}m ${s}s`;
  if (m) return `${m}m ${s}s`;
  return `${s}s`;
}
function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function shortSha(s) { return s ? s.slice(0, 12) : '—'; }
function copyText(t) {
  if (navigator.clipboard) return navigator.clipboard.writeText(t);
  const ta = document.createElement('textarea');
  ta.value = t;
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (_) {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

// ============== Toast ==============
let toastTimer = null;
function toast(msg, type = '') {
  const el = $('#toast');
  if (!el) return;
  el.className = 'toast' + (type ? ' toast-' + type : '');
  el.textContent = msg;
  el.hidden = false;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

// ============== API ==============
let _token = null;
function getToken() { return _token || localStorage.getItem(STORAGE_KEY) || ''; }
function setToken(t) { _token = t; if (t) localStorage.setItem(STORAGE_KEY, t); else localStorage.removeItem(STORAGE_KEY); }

async function api(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token && !opts.headers.Authorization) {
    opts.headers.Authorization = 'Bearer ' + token;
  }
  // **2026-07-02 修复**：自动 JSON 序列化 body + 设 Content-Type
  //   之前调用方必须自己 JSON.stringify + 设 header，否则 server 端 express.json() 不解析
  //   → req.body 是空对象 → req.body?.host 是 undefined → 报 "missing host"
  //   现在统一在 api() 里处理，调用方直接传对象即可
  if (opts.body !== undefined && typeof opts.body !== 'string' && !(opts.body instanceof FormData)) {
    opts.body = JSON.stringify(opts.body);
    if (!opts.headers['Content-Type'] && !opts.headers['content-type']) {
      opts.headers['Content-Type'] = 'application/json';
    }
  }
  const r = await fetch(path, opts);
  const ct = r.headers.get('content-type') || '';
  let data = null;
  if (ct.includes('application/json')) {
    data = await r.json();
  } else {
    data = await r.text();
  }
  if (!r.ok) {
    const err = new Error((data && data.error) || r.statusText || ('HTTP ' + r.status));
    err.status = r.status;
    err.hint = data && data.hint;
    err.data = data;
    throw err;
  }
  return data;
}

// ============== 主题 ==============
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const icon = $('#theme-icon');
  if (icon) {
    if (t === 'light') {
      icon.innerHTML = '<circle cx="10" cy="10" r="4"/><path d="M10 1v2M10 17v2M3.5 3.5l1.4 1.4M15.1 15.1l1.4 1.4M1 10h2M17 10h2M3.5 16.5l1.4-1.4M15.1 4.9l1.4-1.4"/>';
    } else {
      icon.innerHTML = '<path d="M16 12.5A7 7 0 118.5 4a6 6 0 007.5 8.5z"/>';
    }
  }
  localStorage.setItem(THEME_KEY, t);
}
function applyAccent(c) {
  document.documentElement.style.setProperty('--accent-color', c);
  localStorage.setItem(ACCENT_KEY, c);
}
function nextTheme() {
  const cur = localStorage.getItem(THEME_KEY) || 'dark';
  const order = ['dark', 'light'];
  const i = order.indexOf(cur);
  const next = order[(i + 1) % order.length];
  applyTheme(next);
  toast('已切换到 ' + (next === 'dark' ? '深色' : '浅色') + ' 主题', 'success');
}

// ============== 鉴权 ==============
async function tryAutoLogin() {
  const token = getToken();
  if (!token) return false;
  try {
    // 试调一个 admin 接口
    await api('/api/admin/settings');
    return true;
  } catch (e) {
    if (e.status === 401) setToken('');
    return false;
  }
}

async function doLogin() {
  const inp = $('#auth-token');
  const err = $('#auth-error');
  const btn = $('#auth-submit');
  const token = inp.value.trim();
  if (!token) {
    err.textContent = '请输入 ADMIN_TOKEN';
    err.hidden = false;
    return;
  }
  err.hidden = true;
  btn.disabled = true;
  const orig = btn.innerHTML;
  btn.innerHTML = '<span>验证中…</span>';
  try {
    setToken(token);
    await api('/api/admin/settings');
    showApp();
    toast('登录成功', 'success');
  } catch (e) {
    setToken('');
    err.textContent = e.message + (e.hint ? '（' + e.hint + '）' : '');
    err.hidden = false;
  } finally {
    btn.disabled = false;
    btn.innerHTML = orig;
  }
}

async function showAuth() {
  $('#auth-panel').hidden = false;
  $('#main-app').hidden = true;
  // 探测 .env 是否配置了 ADMIN_TOKEN
  try {
    const info = await api('/api/system/info');
    if (info && info.adminTokenConfigured === false) {
      $('#auth-hint-warn').hidden = false;
    }
  } catch (_) {}
  setTimeout(() => $('#auth-token').focus(), 80);
}

function showApp() {
  $('#auth-panel').hidden = true;
  $('#main-app').hidden = false;
  loadPage('dashboard');
  // 启动系统信息轮询
  startStatusPolling();
}

// ============== 导航 ==============
let currentPage = 'dashboard';
const pageLoaders = {
  dashboard: loadDashboard,
  versions: loadVersions,
  push: loadPush,
  mcmonitor: loadMcMonitorPage,
  tunnelmonitor: loadTunnelMonitorPage,
  fcmtest: loadFcmTestPage,
  announcement: loadAnnouncement,
  settings: loadSettings,
  logs: loadLogs,
  changelog: async () => { await loadChangelog(); bindChangelogUI(); },
};

function loadPage(name) {
  if (!pageLoaders[name]) return;
  // 切走内网穿透监控页时关 SSE
  if (currentPage === 'tunnelmonitor' && name !== 'tunnelmonitor') {
    stopTunnelStatusStream();
  }
  $$('.page').forEach((p) => p.hidden = p.dataset.page !== name);
  $$('.nav-item[data-page]').forEach((n) => n.classList.toggle('active', n.dataset.page === name));
  currentPage = name;
  // 2026-07-03 fix v2: 切页后重置 main 滚动到顶部
  // 用 requestAnimationFrame + setTimeout(0,0) 多次保险，确保在 page 渲染完后归零
  const mainEl = document.querySelector('.main');
  if (mainEl) {
    mainEl.scrollTop = 0;
    requestAnimationFrame(() => {
      mainEl.scrollTop = 0;
      setTimeout(() => { mainEl.scrollTop = 0; }, 0);
      setTimeout(() => { mainEl.scrollTop = 0; }, 50);
    });
  }
  pageLoaders[name]();
  // 进入内网穿透监控页时启动 SSE
  if (name === 'tunnelmonitor') {
    startTunnelStatusStream();
  }
}

on(document, 'click', (e) => {
  const nav = e.target.closest('.nav-item[data-page]');
  if (nav) { loadPage(nav.dataset.page); return; }
  const go = e.target.closest('[data-go]');
  if (go) { loadPage(go.dataset.go); return; }
  const modalClose = e.target.closest('[data-modal-close]');
  if (modalClose) { modalClose.closest('.modal').hidden = true; return; }
  const modal = e.target.closest('.modal');
  if (modal && e.target.classList.contains('modal-mask')) { modal.hidden = true; return; }
});

// ============== 状态轮询 ==============
let statusTimer = null;
let serverInfo = null;
function startStatusPolling() {
  if (statusTimer) return;
  const tick = async () => {
    try {
      const s = await api('/api/system/status');
      const i = await api('/api/system/info');
      serverInfo = { ...s, ...i };
      $('#sys-line1').textContent = i.adminTokenConfigured ? '● 运行中' : '● 未配置 Token';
      $('#sys-line2').textContent = `${s.versionCount} 版本 · ${s.activeCount} 启用 · ${fmtUptime(s.uptime)}`;
      const dot = $('.sidebar-system .dot');
      dot.className = 'dot ' + (i.adminTokenConfigured ? 'dot-success' : 'dot-error');
    } catch (_) {
      $('#sys-line1').textContent = '● 服务不可达';
      $('.sidebar-system .dot').className = 'dot dot-error';
    }
  };
  tick();
  statusTimer = setInterval(tick, 2000);  // 加快到 2s 一次（原 5s），实时性更高
}

// ============== Dashboard ==============
async function loadDashboard() {
  try {
    const [stats, info] = await Promise.all([api('/api/admin/stats'), api('/api/system/info')]);
    serverInfo = { ...info, ...stats };
    $('#stat-versions').textContent = stats.versions;
    $('#stat-active').textContent = stats.active;
    $('#stat-mandatory').textContent = stats.mandatory;
    $('#stat-downloads').textContent = stats.totalDownloads;
    $('#stat-uploads').textContent = stats.totalUploads;
    $('#stat-downloads-24h').textContent = stats.downloads24h || 0;
    $('#stat-downloads-7d').textContent = stats.downloads7d || 0;
    $('#stat-size').textContent = fmtBytes(stats.totalSizeBytes);
    $('#stat-files').textContent = `APK 文件 ${stats.storage.uploadFiles} 个`;

    // **2026-07-02 新增**：下载流量统计
    $('#stat-bytes-total').textContent = fmtBytes(stats.totalDownloadBytes);
    $('#stat-bytes-24h').textContent = fmtBytes(stats.bytes24h || 0);
    $('#stat-bytes-7d').textContent = fmtBytes(stats.bytes7d || 0);

    // **2026-07-02 新增**：MC 服务器状态卡片
    const mc = stats.mc || {};
    const mcDot = $('#mc-stat-dot');
    const mcOnline = $('#stat-mc-online');
    const mcMeta = $('#stat-mc-meta');
    if (mc.online === true) {
      mcDot.className = 'mc-stat-dot online';
      mcOnline.textContent = '在线';
    } else if (mc.online === false) {
      mcDot.className = 'mc-stat-dot offline';
      mcOnline.textContent = '离线';
    } else {
      mcDot.className = 'mc-stat-dot checking';
      mcOnline.textContent = '检测中…';
    }
    const cfg = mc.config || {};
    const lastCheck = mc.lastCheckAt ? fmtTimeAgo(mc.lastCheckAt) : '—';
    const latency = mc.latencyMs != null ? `${mc.latencyMs}ms` : '—';
    mcMeta.textContent = `${cfg.host || '?'}:${cfg.port || '?'} · 延迟 ${latency} · 上次 ${lastCheck}`;

    $('#kv-port').textContent = info.port;
    // **2026-07-04 改造**：lucky STUN 端口动态变化
    //   - publicBaseUrl 已经用 push tunnelWatcher 实时端口拼（server.js publicBaseUrl()）
    //   - info.publicPort = 实时端口, info.publicPortEnv = .env 旧端口
    //   - 不一致时显示"实时 ✨"提示（绿色 badge），让用户知道当前是动态的
    const livePort = info.publicPort;
    const envPort = info.publicPortEnv;
    const portBadge = (livePort && envPort && livePort !== envPort)
      ? ` <span class="badge badge-active" title=".env 旧端口 ${envPort} 已过期，当前用 tunnelWatcher 实时端口">✨ 实时 ${livePort} <span class="muted">(env ${envPort})</span></span>`
      : (livePort ? ` <span class="muted">端口 ${livePort}</span>` : '');
    const baseEl = $('#kv-base');
    baseEl.innerHTML = `${escapeHtml(info.publicBaseUrl)}${portBadge}`;
    $('#kv-srv').textContent = info.suggestedSrvName || `hayenai-update._tcp.${info.publicHost}`;
    // **2026-07-04 改造**：数据目录 label 实际显示的是"公网下载 baseUrl"（用户能复制给客户端用的）
    //   也用 publicBaseUrl（已含实时端口）
    const dataEl = $('#kv-data');
    const dataHint = (info.livePublicHost)
      ? ` <span class="muted" title="SRV 解析实际 host（与 SRV 名基础域 ${info.publicHost} 不同）">via ${escapeHtml(info.livePublicHost)}</span>`
      : '';
    dataEl.innerHTML = `${escapeHtml(info.publicBaseUrl)}${dataHint}`;
    $('#kv-uptime').textContent = fmtUptime(info.uptime);
    $('#kv-node').textContent = info.nodeVersion;
    $('#kv-platform').textContent = info.platform === 'win32' ? 'Windows' : (info.platform === 'darwin' ? 'macOS' : info.platform);
    $('#kv-token').innerHTML = info.adminTokenConfigured
      ? '<span class="badge badge-active">已配置</span>'
      : '<span class="badge badge-inactive">未配置</span>';

    // **2026-07-02 新增**：24h 趋势图
    renderHourlyChart(stats.hourly24 || []);

    // **2026-07-02 新增**：按版本下载量
    renderPerVersionList(stats.perVersion || []);

    // **2026-07-02 新增**：按客户端分布
    renderPerClientList(stats.perClient || []);

    // Activity list
    const actList = $('#activity-list');
    if (!stats.recent || stats.recent.length === 0) {
      actList.innerHTML = '<div class="activity-empty">暂无活动</div>';
    } else {
      actList.innerHTML = stats.recent.slice(0, 30).map((a) => {
        const icon = a.type === 'upload' ? '↑' : (a.type === 'download' ? '↓' : '×');
        const cls = a.type === 'upload' ? 'upload' : (a.type === 'download' ? 'download' : 'delete');
        let text = '';
        if (a.type === 'upload') text = `推送 <b>${escapeHtml(a.version)}</b> (code ${a.versionCode}) · ${fmtBytes(a.sizeBytes)}`;
        else if (a.type === 'download') text = `下载 <b>${escapeHtml(a.version)}</b>${a.bytesSent ? ' · ' + fmtBytes(a.bytesSent) : ''}${a.appVersion ? ' · v' + escapeHtml(a.appVersion) : ''}${a.deviceModel ? ' · ' + escapeHtml(a.deviceModel) : ''}`;
        else text = `${a.type} ${a.version || ''}`;
        return `<div class="activity-item">
          <div class="activity-icon ${cls}">${icon}</div>
          <div class="activity-text">${text}</div>
          <div class="activity-time">${fmtTime(a.ts)}</div>
        </div>`;
      }).join('');
    }
  } catch (e) {
    toast('仪表盘加载失败：' + e.message, 'error');
  }
}

// **2026-07-02 新增**：24h 趋势柱状图（按小时分桶的下载次数）
function renderHourlyChart(buckets) {
  const wrap = $('#hourly-chart');
  if (!buckets || buckets.length === 0) {
    wrap.innerHTML = '<div style="color:var(--text-tertiary); font-size:12px">暂无数据</div>';
    return;
  }
  const maxCount = Math.max(1, ...buckets.map((b) => b.count || 0));
  wrap.innerHTML = buckets.map((b) => {
    const pct = Math.round((b.count / maxCount) * 100);
    const isZero = b.count === 0;
    const tip = b.count > 0
      ? `${b.hour} · ${b.count} 次下载 · ${fmtBytes(b.bytes)}`
      : `${b.hour} · 无下载`;
    return `<div class="hourly-col">
      <div class="hourly-tooltip">${escapeHtml(tip)}</div>
      <div class="hourly-bar ${isZero ? 'zero' : ''}" style="height:${Math.max(isZero ? 2 : pct, 2)}%"></div>
      <div class="hourly-label">${b.hour.split(':')[0]}</div>
    </div>`;
  }).join('');
}

// **2026-07-02 新增**：按版本下载量（柱状条 + 状态 badge）
function renderPerVersionList(items) {
  const list = $('#perversion-list');
  const downloadOnly = items.filter((i) => i.downloads > 0);
  if (downloadOnly.length === 0) {
    list.innerHTML = '<div class="activity-empty">暂无下载数据</div>';
    return;
  }
  const max = Math.max(1, ...downloadOnly.map((i) => i.downloads));
  list.innerHTML = downloadOnly.map((i) => {
    const pct = Math.round((i.downloads / max) * 100);
    const statusCls = i.mandatory ? 'mandatory' : (i.isActive ? 'active' : 'inactive');
    const statusTxt = i.mandatory ? '强制' : (i.isActive ? '启用' : '停用');
    return `<div class="perversion-item">
      <div class="pv-version">${escapeHtml(i.version)}<span class="pv-code">c${i.versionCode}</span></div>
      <div class="pv-bar-wrap"><div class="pv-bar" style="width:${pct}%"></div></div>
      <div class="pv-count">${i.downloads} 次<span class="pv-bytes">· ${fmtBytes(i.bytesDownloaded || 0)}</span></div>
      <div class="pv-status ${statusCls}">${statusTxt}</div>
    </div>`;
  }).join('');
}

// **2026-07-02 新增**：按客户端分布（app version + device model）
function renderPerClientList(items) {
  const list = $('#perclient-list');
  if (!items || items.length === 0) {
    list.innerHTML = '<div class="activity-empty">暂无客户端数据</div>';
    return;
  }
  list.innerHTML = items.map((c) => {
    return `<div class="perclient-item">
      <div class="pc-appver">v${escapeHtml(c.appVersion || '?')}</div>
      <div class="pc-device">${escapeHtml(c.deviceModel || '?')}</div>
      <div class="pc-count">${c.total} 次 · ${fmtBytes(c.bytes || 0)}</div>
    </div>`;
  }).join('');
}

on($('#btn-clear-activity'), 'click', () => {
  $('#activity-list').innerHTML = '<div class="activity-empty">已清空</div>';
});

// ============== Versions ==============
let allVersions = [];
async function loadVersions() {
  const list = $('#version-list');
  list.innerHTML = '<div class="empty">加载中…</div>';
  try {
    const data = await api('/api/admin/versions');
    allVersions = data.versions || [];
    renderVersions();
    renderPending();
  } catch (e) {
    list.innerHTML = `<div class="empty">加载失败：${escapeHtml(e.message)}</div>`;
  }
}

// 待推送定义：未启用 + 创建时间在 7 天内
// 7 天外的 inactive 是用户主动停用的历史版本
const PENDING_WINDOW_MS = 7 * 86400_000;
function isPending(v, now = Date.now()) {
  if (v.isActive) return false;
  const created = v.createdAt ? new Date(v.createdAt).getTime() : 0;
  if (!created) return false;
  return (now - created) <= PENDING_WINDOW_MS;
}

function renderVersions() {
  const list = $('#version-list');
  const q = ($('#version-search')?.value || '').toLowerCase().trim();
  const f = $('#version-filter')?.value || '';
  let arr = allVersions.slice();
  if (f === 'pending') arr = arr.filter((v) => isPending(v));
  else if (f === 'active') arr = arr.filter((v) => v.isActive);
  else if (f === 'inactive') arr = arr.filter((v) => !v.isActive && !isPending(v));
  else if (f === 'mandatory') arr = arr.filter((v) => v.mandatory);
  if (q) {
    arr = arr.filter((v) =>
      String(v.version).toLowerCase().includes(q)
      || String(v.changelog || '').toLowerCase().includes(q)
      || String(v.appId).toLowerCase().includes(q)
    );
  }
  if (arr.length === 0) {
    list.innerHTML = '<div class="empty">没有匹配的版本</div>';
    return;
  }
  list.innerHTML = arr.map((v) => {
    const status = v.isActive
      ? '<span class="badge badge-active">已启用</span>'
      : (isPending(v) ? '<span class="badge badge-pending">⏳ 待推送</span>' : '<span class="badge badge-inactive">已停用</span>');
    const mandatory = v.mandatory ? '<span class="badge badge-mandatory">强制</span>' : '';
    const platform = `<span class="badge badge-platform">${escapeHtml(v.platform)}</span>`;
    return `<div class="version-item" data-id="${v.id}">
      <div class="version-icon">${escapeHtml(String(v.version).slice(0, 3))}</div>
      <div class="version-info">
        <div class="version-title">
          v${escapeHtml(v.version)} ${platform} ${status} ${mandatory}
        </div>
        <div class="version-meta">
          <span>code <span class="mono">${v.versionCode}</span></span>
          <span>${fmtBytes(v.sizeBytes)}</span>
          <span>${fmtTime(v.createdAt)}</span>
          <span class="badge badge-downloads">↓ ${v.downloads || 0}</span>
          <span class="mono">sha:${shortSha(v.sha256)}</span>
        </div>
        ${v.changelog ? `<div class="version-meta" style="margin-top:4px;color:var(--text-secondary)">${escapeHtml(v.changelog.slice(0, 200))}${v.changelog.length > 200 ? '…' : ''}</div>` : ''}
      </div>
      <div class="version-actions">
        <button class="icon-btn" data-action="copy" data-url="${escapeHtml(v.downloadUrl)}" title="复制下载链接">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="5" width="9" height="9" rx="1.5"/><path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2"/></svg>
        </button>
        <button class="icon-btn" data-action="edit" data-id="${v.id}" title="编辑">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M11 2l3 3-8 8H3v-3l8-8z"/></svg>
        </button>
        <button class="icon-btn" data-action="toggle" data-id="${v.id}" data-active="${v.isActive ? '1' : '0'}" title="${v.isActive ? '停用' : '启用'}">
          ${v.isActive
            ? '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M5 8l2 2 4-4"/></svg>'
            : '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6"/><path d="M5 5l6 6M11 5l-6 6"/></svg>'
          }
        </button>
        <button class="icon-btn icon-btn-danger" data-action="delete" data-id="${v.id}" title="删除">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l1 9a1 1 0 001 1h2a1 1 0 001-1l1-9"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

// 渲染「待推送」section
function renderPending() {
  const panel = $('#pending-panel');
  const list = $('#pending-list');
  const count = $('#pending-count');
  if (!panel || !list) return;
  const pending = allVersions.filter((v) => isPending(v));
  if (count) count.textContent = String(pending.length);
  if (pending.length === 0) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  list.innerHTML = pending.map((v) => {
    const platform = `<span class="badge badge-platform">${escapeHtml(v.platform)}</span>`;
    const mandatory = v.mandatory ? '<span class="badge badge-mandatory">强制</span>' : '';
    return `<div class="version-item" data-id="${v.id}">
      <div class="version-icon">${escapeHtml(String(v.version).slice(0, 3))}</div>
      <div class="version-info">
        <div class="version-title">
          v${escapeHtml(v.version)} ${platform} <span class="badge badge-pending">⏳ 待推送</span> ${mandatory}
        </div>
        <div class="version-meta">
          <span>code <span class="mono">${v.versionCode}</span></span>
          <span>${fmtBytes(v.sizeBytes)}</span>
          <span>${fmtTime(v.createdAt)}</span>
          <span class="mono">sha:${shortSha(v.sha256)}</span>
        </div>
        ${v.changelog ? `<div class="version-meta" style="margin-top:4px;color:var(--text-secondary)">${escapeHtml(v.changelog.slice(0, 200))}${v.changelog.length > 200 ? '…' : ''}</div>` : ''}
      </div>
      <div class="version-actions">
        <button class="btn-promote" data-action="promote" data-id="${v.id}" title="点击启用推送">
          ▶ 启用推送
        </button>
        <button class="icon-btn icon-btn-danger" data-action="delete" data-id="${v.id}" title="丢弃此版本">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 4h10M6 4V2.5a1 1 0 011-1h2a1 1 0 011 1V4M5 4l1 9a1 1 0 001 1h2a1 1 0 001-1l1-9"/></svg>
        </button>
      </div>
    </div>`;
  }).join('');
}

on($('#version-search'), 'input', renderVersions);
on($('#version-filter'), 'change', renderVersions);
on($('#btn-refresh'), 'click', loadVersions);

on($('#version-list'), 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'edit') {
    openEditModal(id);
  } else if (action === 'toggle') {
    const v = allVersions.find((x) => x.id === id);
    if (!v) return;
    try {
      await api('/api/admin/versions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !v.isActive }),
      });
      toast(v.isActive ? '已停用' : '已启用', 'success');
      loadVersions();
    } catch (e) { toast('失败：' + e.message, 'error'); }
  } else if (action === 'delete') {
    const v = allVersions.find((x) => x.id === id);
    if (!v) return;
    const ok = await confirmModal({
      title: '删除版本',
      msg: `确认删除 <b>v${escapeHtml(v.version)}</b> (code ${v.versionCode})？<br>APK 文件和下载链接都会失效。`,
      okText: '删除',
    });
    if (!ok) return;
    try {
      await api('/api/admin/versions/' + id, { method: 'DELETE' });
      toast('已删除', 'success');
      loadVersions();
    } catch (e) { toast('失败：' + e.message, 'error'); }
  } else if (action === 'copy') {
    const url = btn.dataset.url;
    if (url) {
      await copyText(url);
      toast('下载链接已复制', 'success');
    }
  }
});

// 待推送 section 的点击处理（promote / delete）
on($('#pending-list'), 'click', async (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const id = parseInt(btn.dataset.id, 10);
  const action = btn.dataset.action;
  if (action === 'promote') {
    const v = allVersions.find((x) => x.id === id);
    if (!v) return;
    try {
      await api('/api/admin/versions/' + id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: true }),
      });
      toast(`v${v.version} 已开始推送`, 'success');
      loadVersions();
    } catch (e) { toast('失败：' + e.message, 'error'); }
  } else if (action === 'delete') {
    const v = allVersions.find((x) => x.id === id);
    if (!v) return;
    const ok = await confirmModal({
      title: '丢弃此版本',
      msg: `确认丢弃 <b>v${escapeHtml(v.version)}</b> (code ${v.versionCode})？<br>APK 文件会被删除。`,
      okText: '丢弃',
    });
    if (!ok) return;
    try {
      await api('/api/admin/versions/' + id, { method: 'DELETE' });
      toast('已丢弃', 'success');
      loadVersions();
    } catch (e) { toast('失败：' + e.message, 'error'); }
  }
});

// ============== Edit Modal ==============
let editingId = null;
function openEditModal(id) {
  const v = allVersions.find((x) => x.id === id);
  if (!v) return;
  editingId = id;
  $('#edit-version').value = v.version;
  $('#edit-code').value = v.versionCode;
  $('#edit-changelog').value = v.changelog || '';
  $('#edit-active').checked = !!v.isActive;
  $('#edit-mandatory').checked = !!v.mandatory;
  $('#edit-sha').textContent = v.sha256;
  $('#edit-size').textContent = fmtBytes(v.sizeBytes);
  $('#modal-edit').hidden = false;
}

on($('#btn-edit-save'), 'click', async () => {
  if (!editingId) return;
  const body = {
    version: $('#edit-version').value.trim(),
    versionCode: parseInt($('#edit-code').value, 10),
    changelog: $('#edit-changelog').value,
    isActive: $('#edit-active').checked,
    mandatory: $('#edit-mandatory').checked,
  };
  try {
    await api('/api/admin/versions/' + editingId, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    $('#modal-edit').hidden = true;
    toast('保存成功', 'success');
    loadVersions();
  } catch (e) { toast('保存失败：' + e.message, 'error'); }
});

// ============== Push ==============
let pushFile = null;
let pushAutoFilled = { version: false, code: false }; // 跟踪哪些字段是"自动填的"（用于 appId 改变时智能刷新）
function loadPush() {
  // 进入推送页面：自动查"下一个版本号"填到 version/code 字段
  //   - 用户没填过 → 自动填 suggestedVersion + suggestedCode
  //   - 用户填过 → 保留（不覆盖，避免误清）
  //   - 自动填的状态用 pushAutoFilled 跟踪，appId/平台变化时只刷新"自动填"的字段
  pushAutoFilled = { version: false, code: false };
  fillPushFromNextVersion({ silent: true });
}

// 点击 #file-drop 触发文件选择窗口
// 注意：外层是 <div>（不是 <label>），所以只有 JS 这一个入口触发，不会双重弹窗
// tabindex=0 + role=button：键盘 Enter/Space 也能触发
on($('#file-drop'), 'click', (e) => {
  if (e.target.tagName === 'INPUT') return; // input 自身 click 冒泡到 div 时直接返回（防止双重触发）
  $('#push-file').click();
});
// 键盘可达：Enter / Space 触发 click
on($('#file-drop'), 'keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    $('#push-file').click();
  }
});
// 选完 APK 后自动调 /api/admin/apk-inspect 从 APK 解析 versionCode/Name/appId 填表
// 然后调 /api/admin/next-version 拿"下一个版本号"（基于服务端 db 累计 code + 1）
// aapt 不存在时静默 fallback（用户手动填）

/**
 * 从服务端拉"下一个版本号"自动填 push 表单
 * 行为：
 *  - 强制按当前 appId+platform 查询
 *  - 只在"字段还是空"或"字段是上次自动填的"时才覆盖
 *    → 用户手动改过的字段不会被刷新覆盖
 *  - silent: true 时不弹 toast（页面静默加载时用）
 */
async function fillPushFromNextVersion({ silent = false } = {}) {
  const appId = ($('#push-appid')?.value || '').trim() || 'com.hayenai.app';
  const platform = $('#push-platform')?.value || 'android';
  let nextMeta = null;
  try {
    const r = await fetch('/api/admin/next-version?' + new URLSearchParams({
      appId, platform,
    }), { headers: { 'Authorization': 'Bearer ' + getToken() } });
    const data = await r.json();
    if (r.ok) nextMeta = data;
  } catch (_) {}
  if (!nextMeta) {
    if (!silent) toast('查询下一版本失败，请手动填表', 'warn', 2500);
    return;
  }
  const $v = $('#push-version');
  const $c = $('#push-code');
  if ($v && (!$v.value.trim() || pushAutoFilled.version)) {
    $v.value = nextMeta.suggestedVersion || '';
    $v.placeholder = nextMeta.suggestedVersion || '1.0.0';
    pushAutoFilled.version = true;
  } else if ($v) {
    // 已经有用户填的值：更新 placeholder 让用户看到建议值
    $v.placeholder = nextMeta.suggestedVersion || '1.0.0';
  }
  if ($c && (!$c.value.toString().trim() || pushAutoFilled.code)) {
    $c.value = nextMeta.suggestedCode != null ? String(nextMeta.suggestedCode) : '';
    $c.placeholder = nextMeta.suggestedCode != null ? String(nextMeta.suggestedCode) : '1';
    pushAutoFilled.code = true;
  } else if ($c) {
    $c.placeholder = nextMeta.suggestedCode != null ? String(nextMeta.suggestedCode) : '1';
  }
  // 顶部加一条当前最新版本提示（小字）
  const $hint = $('#push-next-hint');
  if ($hint) {
    if (nextMeta.lastVersion) {
      $hint.innerHTML = `当前最新: <b>v${escapeHtml(nextMeta.lastVersion)}</b> (code ${nextMeta.lastCode}) · 建议下一版: <b>v${escapeHtml(nextMeta.suggestedVersion)}</b> (code <b>${nextMeta.suggestedCode}</b>)`;
      $hint.hidden = false;
    } else {
      $hint.innerHTML = `<b>${escapeHtml(appId)}</b> 暂无历史版本 · 建议从 <b>v${escapeHtml(nextMeta.suggestedVersion)}</b> (code <b>${nextMeta.suggestedCode}</b>) 开始`;
      $hint.hidden = false;
    }
  }
  if (!silent) {
    toast(`✓ 已自动填入 v${nextMeta.suggestedVersion} (code ${nextMeta.suggestedCode})`, 'success', 2200);
  }
}

// 监听 appId / platform 变化 → 重新查 next-version 填表
let _appIdDebounce = null;
on($('#push-appid'), 'input', () => {
  // 用户改 appId 立即触发会抖动（连续打字），简单 debounce 400ms
  if (_appIdDebounce) clearTimeout(_appIdDebounce);
  _appIdDebounce = setTimeout(() => fillPushFromNextVersion({ silent: true }), 400);
});
on($('#push-platform'), 'change', () => fillPushFromNextVersion({ silent: true }));

// 监听用户主动改了 version/code → 标记"非自动填"（后续 appId 改变时不再覆盖）
on($('#push-version'), 'input', () => { pushAutoFilled.version = false; });
on($('#push-code'), 'input', () => { pushAutoFilled.code = false; });
async function inspectApkAndFillForm(file) {
  if (!file || !/\.(apk|aab)$/i.test(file.name)) return;
  toast('正在解析 APK…', 'info', 1500);

  // Step 1: inspect（拿 APK 自带 metadata）
  let inspectMeta = null;
  try {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/admin/apk-inspect', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken() },
      body: fd,
    });
    const data = await r.json();
    if (r.ok) {
      inspectMeta = data;
    } else {
      toast('APK 自动解析失败：' + (data?.error || r.statusText) + '，请手动填表', 'warn', 3000);
    }
  } catch (e) {
    toast('APK 解析失败：' + e.message + '，请手动填表', 'warn', 3000);
  }

  // Step 2: 拿"下一个版本号"（累计 code，避免冲突）
  let nextMeta = null;
  try {
    const r = await fetch('/api/admin/next-version?' + new URLSearchParams({
      appId: inspectMeta?.appId || ($('#push-appid')?.value || '').trim() || 'com.hayenai.app',
      platform: 'android',
    }), { headers: { 'Authorization': 'Bearer ' + getToken() } });
    const data = await r.json();
    if (r.ok) nextMeta = data;
  } catch (_) {}

  // Step 3: 填表（智能合并：APK 自带 > next-version > 用户已有）
  const $vid = $('#push-appid');
  if ($vid && !($vid.value || '').trim() && inspectMeta?.appId) $vid.value = inspectMeta.appId;
  const $v = $('#push-version');
  if ($v && !($v.value || '').trim()) {
    // 优先 APK 自带 versionName，没有再 fallback 到 next-version
    $v.value = inspectMeta?.versionName || nextMeta?.suggestedVersion || '';
    pushAutoFilled.version = false;  // 是 APK 解析出来的，不是自动填的
  }
  const $c = $('#push-code');
  if ($c && !($c.value || '').toString().trim()) {
    // 累计 code：next-version 算的 max+1（避免跟历史重复）
    // 如果 next-version 失败，则用 APK 自带的 code
    $c.value = nextMeta?.suggestedCode != null ? String(nextMeta.suggestedCode) : (inspectMeta ? String(inspectMeta.versionCode) : '');
    pushAutoFilled.code = false;
  }

  // Step 4: 更新顶部提示
  const $hint = $('#push-next-hint');
  if ($hint && nextMeta) {
    if (nextMeta.lastVersion) {
      $hint.innerHTML = `当前最新: <b>v${escapeHtml(nextMeta.lastVersion)}</b> (code ${nextMeta.lastCode}) · 建议下一版: <b>v${escapeHtml(nextMeta.suggestedVersion)}</b> (code <b>${nextMeta.suggestedCode}</b>)`
        + (inspectMeta ? ` · APK 自带 v${escapeHtml(inspectMeta.versionName)} (code ${inspectMeta.versionCode})` : '');
      $hint.hidden = false;
    }
  }

  // 显示提示
  const msgs = [];
  if (inspectMeta) msgs.push(`APK 自带 v${inspectMeta.versionName} (code ${inspectMeta.versionCode})`);
  if (nextMeta) msgs.push(`服务端累计: v${nextMeta.lastVersion || '无'} (code ${nextMeta.lastCode || 0}) → code +1 = ${nextMeta.suggestedCode}`);
  if (msgs.length) toast('✓ ' + msgs.join(' | '), 'success', 4000);
}

on($('#push-file'), 'change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  pushFile = f;
  $('#file-info').textContent = `${f.name} · ${fmtBytes(f.size)}`;
  // 自动解析 APK
  inspectApkAndFillForm(f);
});
on($('#file-drop'), 'dragover', (e) => { e.preventDefault(); $('#file-drop').classList.add('dragover'); });
on($('#file-drop'), 'dragleave', () => $('#file-drop').classList.remove('dragover'));
on($('#file-drop'), 'drop', (e) => {
  e.preventDefault();
  $('#file-drop').classList.remove('dragover');
  const f = e.dataTransfer.files[0];
  if (!f) return;
  pushFile = f;
  $('#file-info').textContent = `${f.name} · ${fmtBytes(f.size)}`;
  // 设置 input
  const dt = new DataTransfer();
  dt.items.add(f);
  $('#push-file').files = dt.files;
  // 自动解析 APK
  inspectApkAndFillForm(f);
});

on($('#btn-reset'), 'click', () => {
  pushFile = null;
  $('#push-file').value = '';
  $('#file-info').textContent = '未选择文件';
  $('#push-version').value = '';
  $('#push-code').value = '';
  $('#push-changelog').value = '';
  $('#push-mandatory').checked = false;
  $('#push-active').checked = true;
  $('#push-progress').hidden = true;
  $('#push-progress-bar').style.width = '0%';
});

on($('#btn-upload'), 'click', () => {
  if (!pushFile) { toast('请先选择文件', 'warn'); return; }
  if (!$('#push-version').value.trim()) { toast('请输入版本号', 'warn'); return; }
  if (!$('#push-code').value) { toast('请输入 versionCode', 'warn'); return; }

  const fd = new FormData();
  fd.append('file', pushFile);
  fd.append('appId', $('#push-appid').value.trim());
  fd.append('version', $('#push-version').value.trim());
  fd.append('versionCode', $('#push-code').value);
  fd.append('platform', $('#push-platform').value);
  fd.append('changelog', $('#push-changelog').value);
  fd.append('mandatory', $('#push-mandatory').checked);
  fd.append('isActive', $('#push-active').checked);

  const xhr = new XMLHttpRequest();
  xhr.open('POST', '/api/admin/versions');
  xhr.setRequestHeader('Authorization', 'Bearer ' + getToken());
  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = (e.loaded / e.total * 100).toFixed(1);
      $('#push-progress').hidden = false;
      $('#push-progress-bar').style.width = pct + '%';
      $('#push-progress-text').textContent = pct + '%';
    }
  });
  xhr.addEventListener('load', () => {
    let data = null;
    try { data = JSON.parse(xhr.responseText); } catch (_) {}
    if (xhr.status >= 200 && xhr.status < 300) {
      toast(`推送成功：v${data.version.version}`, 'success');
      // 重置表单
      $('#btn-reset').click();
      // 跳到版本管理
      setTimeout(() => loadPage('versions'), 600);
    } else {
      toast('推送失败：' + (data?.error || xhr.statusText), 'error');
      $('#push-progress').hidden = true;
    }
  });
  xhr.addEventListener('error', () => { toast('网络错误', 'error'); $('#push-progress').hidden = true; });
  xhr.send(fd);
});

// ============== Settings ==============
let _settings = null;
let _runtime = null;
async function loadSettings() {
  try {
    const data = await api('/api/admin/settings');
    _settings = data.settings;
    _runtime = data.runtime;
    $('#set-autoActivate').checked = _settings.autoActivateOnUpload !== false;
    $('#set-openBrowser').checked = _settings.openBrowserOnStart !== false;
    $('#set-enableTray').checked = !!_settings.enableTray;
    $('#set-allowCors').checked = _settings.allowCors !== false;
    $('#set-logLevel').value = _settings.logLevel || 'info';
    $('#set-accent').value = _settings.accent || '#7C3AED';
    // **2026-07-02 新增**：保留版本数（默认 3，范围 2-20）
    const keepCount = (typeof _settings.keepActiveVersions === 'number' && _settings.keepActiveVersions >= 2)
      ? _settings.keepActiveVersions
      : 3;
    $('#set-keep-versions').value = String(keepCount);
    // **2026-07-02 新增**：App 端 MC 服务器地址（webui 测试通知使用）
    $('#set-app-mc-target').value = _settings.appMcTarget || '';
    applyAccent($('#set-accent').value);

    if (_runtime.isWindows) {
      $('#set-autoStart').checked = !!_runtime.autoStart;
      if (!_runtime.isAdmin) {
        $('#set-autoStart-warn').textContent = '⚠ 进程非管理员，自启动可能写入失败（HKCU 通常不需要管理员）';
        $('#set-autoStart-warn').hidden = false;
      } else {
        $('#set-autoStart-warn').hidden = true;
      }
    } else {
      $('#set-autoStart').closest('.setting-row').style.display = 'none';
    }

    $('#set-publicBase').textContent = _runtime.publicBaseUrl;
    $('#srv-block').textContent = buildSrvBlock(_runtime);
    $('#srv-webhook-block').textContent = buildSrvWebhookBlock(_runtime);

    // 主动查一次 SRV 解析，把"当前公网入口"显示出来
    try {
      const r = await api('/api/srv-info');
      renderSrvResolved(r);
      renderSrvSyncStatus(r.sync);
    } catch (e) {
      $('#srv-resolved-block').textContent = '查询失败：' + e.message;
    }

    // **2026-07-03 新增**：MC SRV 同步状态
    try {
      const ms = await api('/api/admin/sync-mc-srv/status');
      renderMcSrvSyncStatus(ms);
    } catch (e) {
      console.warn('sync-mc-srv/status failed', e);
    }

    $('#kv-server-version').textContent = '1.0.0';

    // **2026-07-02 新增**：加载 MC 状态监控面板
    try { await loadMcStatus(); } catch (e) { console.warn('loadMcStatus failed', e); }
    // **2026-07-04 新增：加载公告管理面板
    try { await loadAnnouncement(); } catch (e) { console.warn('loadAnnouncement failed', e); }
    try { await loadPushConfig(); } catch (e) { console.warn('loadPushConfig failed', e); }
  } catch (e) {
    toast('设置加载失败：' + e.message, 'error');
  }
}

function buildSrvBlock(rt) {
  if (!rt.publicHost) return '';
  return `;; SRV record (建议)
_hayenai-update._tcp.${rt.publicHost}.  60  IN  SRV  10  10  ${rt.publicPort}  ${rt.publicHost}.

;; A / AAAA 记录
${rt.publicHost}.  60  IN  A  <你的服务器IP>

;; 反代示例 (Caddy)
${rt.publicHost} {
    reverse_proxy 127.0.0.1:${rt.port}
}`;
}

// 生成 lucky Webhook 配置示例（端口变化时自动同步到 dynv6 SRV）
// 服务端端口 rt.port 是 HTTP 监听端口，lucky 跟服务端在同内网所以可以直接访问
function buildSrvWebhookBlock(rt) {
  if (!rt) return '';
  return `URL:     http://127.0.0.1:${rt.port}/api/admin/port-register
Method:  POST
Header:  Authorization: Bearer <${'ADMIN_TOKEN'}>
Body:    {"port":"\${port}"}

触发条件:  STUN 端口变化（lucky 规则编辑里勾选）

工作流程:
  1. lucky STUN 端口变化（如 57625 → 49382）
  2. lucky 调上述 URL，body 里的 \${port} 自动替换为新端口
  3. 服务端鉴权（Bearer Token）通过后 PATCH dynv6 SRV 记录
  4. 手机 app 下次 DoH 查询 SRV 时拿到新端口，连接成功`;
}

// 渲染 SRV 同步状态（按钮可用性 + 提示）
function renderSrvSyncStatus(sync) {
  const btn = $('#btn-sync-srv');
  const status = $('#srv-sync-status');
  const desc = $('#srv-sync-desc');
  if (!btn || !status || !desc) return;
  if (!sync) {
    btn.disabled = true;
    status.textContent = '';
    return;
  }
  if (!sync.configured) {
    btn.disabled = true;
    status.innerHTML = '<span class="badge badge-err">未配置</span>';
    const missing = [];
    if (!sync.hasToken) missing.push('DYNV6_HTTP_TOKEN');
    if (!sync.hasZone) missing.push('DYNV6_ZONE_ID');
    if (!sync.hasRecord) missing.push('DYNV6_SRV_RECORD_ID');
    if (missing.length) {
      desc.innerHTML = `⚠ 缺少 <code>${missing.join(' / ')}</code>，无法同步。请在 <code>.env</code> 填好后重启 .exe。`;
    }
    return;
  }
  btn.disabled = false;
  if (sync.lastUpdateAt) {
    const ago = Math.floor((Date.now() - sync.lastUpdateAt) / 1000);
    const agoStr = ago < 60 ? `${ago}秒前` : `${Math.floor(ago / 60)}分钟前`;
    status.innerHTML = `<span class="badge badge-ok">已就绪</span> 上次同步 ${agoStr} → :${sync.lastUpdatePort}`;
  } else {
    status.innerHTML = '<span class="badge badge-ok">已配置</span> 尚未同步过';
  }
}

/**
 * 渲染"当前公网入口"卡片
 * - 从 /api/srv-info 读 DoH 解析结果
 * - 显示当前真实 baseUrl（手机 app 应该连的地址）
 * - 显示每个 DoH 端点的状态
 */
function renderSrvResolved(r) {
  const block = $('#srv-resolved-block');
  if (!block) return;
  if (r.resolved && r.resolved.baseUrl) {
    block.innerHTML =
      `<div class="srv-resolved-ok">` +
        `<div class="srv-resolved-label">当前公网入口（手机 app 应该连的地址）</div>` +
        `<div class="srv-resolved-url mono">${r.resolved.baseUrl}</div>` +
        `<div class="srv-resolved-meta">来自 <code>${r.resolved.from}</code> · host=${r.resolved.host} · port=${r.resolved.port}</div>` +
      `</div>` +
      `<div class="srv-doh-list">` +
        r.resolved.doh.map((d) => {
          const status = d.ok
            ? `<span class="badge badge-ok">OK ${d.ms}ms</span>`
            : `<span class="badge badge-err">${d.error || '失败'}</span>`;
          return `<div class="srv-doh-row">${status} <code>${d.url}</code></div>`;
        }).join('') +
      `</div>`;
  } else {
    block.innerHTML =
      `<div class="srv-resolved-warn">` +
        `<div class="srv-resolved-label">未配置 SRV 记录</div>` +
        `<div class="srv-resolved-meta">` +
          `请在 dynv6 添加 <code>_hayenai-update._tcp.${r.host}</code> SRV 记录，` +
          `并在 lucky 的 STUN 规则 Webhook 中配置同步端口。` +
        `</div>` +
      `</div>` +
      `<div class="srv-doh-list">` +
        (r.resolved?.doh || []).map((d) => {
          const status = d.ok
            ? `<span class="badge badge-ok">OK ${d.ms}ms</span>`
            : `<span class="badge badge-err">${d.error || '失败'}</span>`;
          return `<div class="srv-doh-row">${status} <code>${d.url}</code></div>`;
        }).join('') +
      `</div>`;
  }
}

on($('#set-autoActivate'), 'change', (e) => updateSetting('autoActivateOnUpload', e.target.checked));
on($('#set-openBrowser'), 'change', (e) => updateSetting('openBrowserOnStart', e.target.checked));
on($('#set-enableTray'), 'change', async (e) => {
  const enabled = e.target.checked;
  try {
    if (enabled) {
      const r = await api('/api/admin/system/tray', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: true }),
      });
      if (!r.ok) { e.target.checked = false; toast('托盘启动失败：' + (r.reason || ''), 'error'); return; }
      updateSetting('enableTray', true);
      toast('托盘已启动', 'success');
    } else {
      await api('/api/admin/system/tray', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: false }),
      });
      updateSetting('enableTray', false);
      toast('托盘已关闭', 'success');
    }
  } catch (e) { toast('操作失败：' + e.message, 'error'); e.target.checked = !enabled; }
});
on($('#set-allowCors'), 'change', (e) => updateSetting('allowCors', e.target.checked));
on($('#set-logLevel'), 'change', (e) => updateSetting('logLevel', e.target.value));
on($('#set-accent'), 'change', (e) => { applyAccent(e.target.value); updateSetting('accent', e.target.value); });
on($('#set-keep-versions'), 'change', (e) => {
  // 范围校验：2-20（server set() 也会兜底校验，但前端提前给反馈更友好）
  let n = parseInt(e.target.value, 10);
  if (isNaN(n) || n < 2) n = 2;
  if (n > 20) n = 20;
  e.target.value = String(n);
  updateSetting('keepActiveVersions', n).then(() => {
    toast(`已设置保留 ${n} 个版本，下次上传时生效`, 'success');
  });
});

// **2026-07-02 新增**：App 端 MC 服务器地址（用于 webui "测试通知" 按钮找到正确的订阅者）
on($('#set-app-mc-target'), 'change', (e) => {
  const raw = String(e.target.value || '').trim();
  // 简单校验：host 部分非空，port 1-65535（可选）
  if (raw) {
    const m = raw.match(/^(.+?)(?::(\d{1,5}))?$/);
    if (!m || !m[1]) {
      toast('地址格式错误，应为 host 或 host:port', 'error');
      e.target.value = _settings.appMcTarget || '';
      return;
    }
    if (m[2]) {
      const p = parseInt(m[2], 10);
      if (!Number.isFinite(p) || p < 1 || p > 65535) {
        toast('端口必须在 1-65535', 'error');
        e.target.value = _settings.appMcTarget || '';
        return;
      }
    }
  }
  _settings.appMcTarget = raw;
  updateSetting('appMcTarget', raw).then(() => {
    toast(raw ? `已保存 App 端 MC 地址：${raw}` : '已清空，将用 mc.bananaikun.dynv6.net（无端口，靠 SRV 解析）', 'success');
  });
});

async function updateSetting(key, value) {
  try {
    await api('/api/admin/settings', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
  } catch (e) { toast('保存失败：' + e.message, 'error'); }
}

on($('#set-autoStart'), 'change', async (e) => {
  const enabled = e.target.checked;
  try {
    const r = await api('/api/admin/system/auto-start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    });
    if (!r.ok) {
      e.target.checked = !enabled;
      toast('失败：' + (r.reason || '未知错误'), 'error');
    } else {
      toast(enabled ? '已开启开机自启' : '已关闭开机自启', 'success');
    }
  } catch (err) {
    e.target.checked = !enabled;
    toast('失败：' + err.message, 'error');
  }
});

on($('#btn-open-admin'), 'click', async () => {
  try {
    await api('/api/admin/system/open-browser', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    toast('已在浏览器中打开', 'success');
  } catch (e) { toast('失败：' + e.message, 'error'); }
});

on($('#btn-copy-base'), 'click', async () => {
  if (_runtime) {
    await copyText(_runtime.publicBaseUrl);
    toast('已复制：' + _runtime.publicBaseUrl, 'success');
  }
});

on($('#btn-sync-srv'), 'click', async () => {
  const btn = $('#btn-sync-srv');
  const status = $('#srv-sync-status');
  if (btn.disabled) return;
  btn.disabled = true;
  status.innerHTML = '<span class="badge badge-info">同步中…</span>';
  try {
    const r = await api('/api/admin/srv-update', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    status.innerHTML = `<span class="badge badge-ok">同步成功</span> :${r.port} (HTTP ${r.statusCode})`;
    toast(`SRV 已更新 → :${r.port}`, 'success');
    // 3s 后再刷一次 srv-info 显示最新 sync.lastUpdateAt
    setTimeout(async () => {
      try {
        const r2 = await api('/api/srv-info');
        renderSrvSyncStatus(r2.sync);
      } catch (_) {}
    }, 500);
  } catch (e) {
    status.innerHTML = `<span class="badge badge-err">失败</span> ${e.message}`;
    toast('同步失败：' + e.message, 'error');
    btn.disabled = false;
  }
});

// 渲染 MC SRV 同步状态
function renderMcSrvSyncStatus(s) {
  const btn = $('#btn-sync-mc-srv');
  const status = $('#mc-srv-sync-status');
  const desc = $('#mc-srv-sync-desc');
  if (!btn || !status || !desc) return;
  if (!s) {
    btn.disabled = true;
    status.textContent = '';
    return;
  }
  if (!s.configured) {
    btn.disabled = true;
    status.innerHTML = '<span class="badge badge-err">未配置</span>';
    const missing = [];
    if (!s.hasToken) missing.push('DYNV6_HTTP_TOKEN');
    if (!s.hasZone) missing.push('DYNV6_ZONE_ID');
    if (!s.hasMcRecordId) missing.push('DYNV6_MC_SRV_RECORD_ID');
    if (!s.hasMcTarget) missing.push('DYNV6_MC_SRV_TARGET');
    if (missing.length) {
      desc.innerHTML = `⚠ 缺少 <code>${missing.join(' / ')}</code>，无法同步。请在 <code>.env</code> 填好后重启 .exe。`;
    }
    return;
  }
  btn.disabled = false;
  status.innerHTML = `<span class="badge badge-ok">已就绪</span> <code>${s.mcSrvName}</code> → <code>${s.mcSrvTarget || '?'}</code> (id=${s.mcSrvRecordId})`;
  desc.innerHTML = '配置完成。检测到 <code>port_mismatch</code> 时自动同步。';
}

on($('#btn-sync-mc-srv'), 'click', async () => {
  const btn = $('#btn-sync-mc-srv');
  const status = $('#mc-srv-sync-status');
  if (btn.disabled) return;
  btn.disabled = true;
  status.innerHTML = '<span class="badge badge-info">同步中…</span>';
  try {
    const r = await api('/api/admin/sync-mc-srv', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    status.innerHTML = `<span class="badge badge-ok">同步成功</span> :${r.port} (HTTP ${r.statusCode})`;
    toast(`MC SRV 已更新 → :${r.port}`, 'success');
  } catch (e) {
    status.innerHTML = `<span class="badge badge-err">失败</span> ${e.message}`;
    toast('MC SRV 同步失败：' + e.message, 'error');
  }
  btn.disabled = false;
});

on($('#btn-shutdown'), 'click', async () => {
  // 二次确认：先弹确认框，再要求输入 ADMIN_TOKEN（防误触）
  const ok = await confirmModal({
    title: '<span style="color:#F87171">⚠ 停止推送服务</span>',
    msg: `
      <div style="color:#F87171;line-height:1.6">
        停止 HaYenai Update Server 后：
        <ul style="margin:8px 0;padding-left:20px">
          <li><b>手机 App 将无法检测/下载更新</b></li>
          <li><b>lucky 会一直刷 "actively refused" 错误</b></li>
          <li><b>lucky STUN 端口不会被释放</b>（除非你手动关 lucky）</li>
        </ul>
        <div style="margin-top:10px">建议：停止前先在 lucky 关闭对应的 STUN 规则。</div>
      </div>`,
    okText: '我已了解，继续停止',
  });
  if (!ok) return;
  // 第二次确认：要求输入 ADMIN_TOKEN（防误触）
  const token = prompt('为防止误触，请输入 ADMIN_TOKEN 确认停止：');
  if (token !== getToken()) {
    toast('TOKEN 不匹配，已取消', 'warn', 2500);
    return;
  }
  try {
    await api('/api/system/shutdown', { method: 'POST' });
    toast('服务已停止，请重新启动 .exe', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (e) { toast('失败：' + e.message, 'error'); }
});

// ============== Logs ==============
let logSSE = null;
let logBuffer = [];
let logFilter = '';
function loadLogs() {
  // 加载历史
  refreshLogs();
  // 启动 SSE
  startLogSSE();
  // 标记 live
  $('#log-live-dot').classList.add('live');
}
function startLogSSE() {
  if (logSSE) { try { logSSE.close(); } catch (_) {} }
  const es = new EventSource('/api/admin/logs/stream');
  logSSE = es;
  es.onmessage = (e) => {
    try {
      const entry = JSON.parse(e.data);
      logBuffer.push(entry);
      if (logBuffer.length > 1500) logBuffer.shift();
      appendLogLine(entry);
    } catch (_) {}
  };
  es.onerror = () => {
    $('#log-live-dot').classList.remove('live');
  };
  es.onopen = () => {
    $('#log-live-dot').classList.add('live');
  };
}
function stopLogSSE() {
  if (logSSE) { try { logSSE.close(); } catch (_) {} logSSE = null; }
  $('#log-live-dot').classList.remove('live');
}
async function refreshLogs() {
  try {
    const data = await api('/api/admin/logs?limit=500');
    logBuffer = data.logs || [];
    renderLogBuffer();
  } catch (e) {
    toast('日志加载失败：' + e.message, 'error');
  }
}
function appendLogLine(entry) {
  if (!matchesFilter(entry)) return;
  const view = $('#log-view');
  if (view.querySelector('.log-empty')) view.innerHTML = '';
  const div = document.createElement('div');
  div.className = 'log-line';
  div.innerHTML = `<span class="log-time">${formatLogTime(entry.ts)}</span>
    <span class="log-level log-level-${entry.level}">${entry.level.toUpperCase().padEnd(5)}</span>
    <span class="log-msg">${escapeHtml(entry.msg)}${entry.meta ? ' ' + JSON.stringify(entry.meta) : ''}</span>`;
  view.appendChild(div);
  if ($('#log-autoscroll')?.checked) view.scrollTop = view.scrollHeight;
  // 限制 DOM 行数
  while (view.children.length > 1000) view.removeChild(view.firstChild);
}
function renderLogBuffer() {
  const view = $('#log-view');
  const filtered = logBuffer.filter(matchesFilter);
  if (filtered.length === 0) {
    view.innerHTML = '<div class="log-empty">无匹配的日志</div>';
    return;
  }
  view.innerHTML = filtered.map((e) =>
    `<div class="log-line">
      <span class="log-time">${formatLogTime(e.ts)}</span>
      <span class="log-level log-level-${e.level}">${e.level.toUpperCase().padEnd(5)}</span>
      <span class="log-msg">${escapeHtml(e.msg)}${e.meta ? ' ' + JSON.stringify(e.meta) : ''}</span>
    </div>`).join('');
  if ($('#log-autoscroll')?.checked) view.scrollTop = view.scrollHeight;
}
function matchesFilter(e) {
  if (!logFilter) return true;
  return e.level === logFilter;
}
function formatLogTime(ts) {
  const d = new Date(ts);
  return d.toTimeString().slice(0, 8);
}
on($('#log-level-filter'), 'change', (e) => {
  logFilter = e.target.value;
  renderLogBuffer();
});
on($('#btn-clear-logs'), 'click', async () => {
  try {
    await api('/api/admin/logs', { method: 'DELETE' });
    logBuffer = [];
    renderLogBuffer();
    toast('已清空日志', 'success');
  } catch (e) { toast('失败：' + e.message, 'error'); }
});

// ============== MC 服务器状态监控 ==============
let _mcStatus = null;
let _mcStatusEventSrc = null;

function fmtTimeShort(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return isToday ? `${hh}:${mm}:${ss}` : `${d.toLocaleDateString()} ${hh}:${mm}:${ss}`;
}

function fmtTimeAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - ts;
  if (ms < 0) return fmtTimeShort(ts);
  const s = Math.floor(ms / 1000);
  if (s < 60) return s + ' 秒前';
  const m = Math.floor(s / 60);
  if (m < 60) return m + ' 分钟前';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' 小时前';
  const d = Math.floor(h / 24);
  return d + ' 天前';
}

function renderMcStatus(s) {
  _mcStatus = s;
  if (!s) return;
  const online = s.online;
  const dot = $('#mc-status-dot');
  const label = $('#mc-status-label');
  const meta = $('#mc-status-meta');
  dot.className = 'mc-status-dot ' + (online === true ? 'online' : online === false ? 'offline' : 'checking');
  if (online === true) {
    label.textContent = '在线 (Online)';
  } else if (online === false) {
    label.textContent = '离线 (Offline)';
  } else {
    label.textContent = '检测中…';
  }
  const cfg = s.config || {};
  const lastCheck = s.lastCheckAt ? fmtTimeAgo(s.lastCheckAt) : '—';
  const lastChange = s.lastChangeAt ? fmtTimeAgo(s.lastChangeAt) : '从未变化';
  const latency = s.latencyMs != null ? `${s.latencyMs}ms` : '—';
  const lastErr = s.lastError ? ` · 错误: ${s.lastError}` : '';
  meta.textContent = `${cfg.host || '?'}:${cfg.port || '?'} · 延迟 ${latency} · 上次检测 ${lastCheck} · 上次变化 ${lastChange}${lastErr}`;
  // 填入配置表单
  if (!$('#set-mc-host').dataset.userEdited) $('#set-mc-host').value = cfg.host || '127.0.0.1';
  if (!$('#set-mc-port').dataset.userEdited) $('#set-mc-port').value = String(cfg.port || 25565);
  if (!$('#set-mc-interval').dataset.userEdited) $('#set-mc-interval').value = String(Math.round((cfg.intervalMs || 10000) / 1000));
  $('#set-mc-enabled').checked = cfg.enabled !== false;
}

function renderMcChanges(changes) {
  const list = $('#mc-changes-list');
  if (!changes || changes.length === 0) {
    list.innerHTML = '<div style="color:var(--text-tertiary); font-size:12px; padding:6px 0">暂无</div>';
    return;
  }
  list.innerHTML = changes.map((c) => {
    const fromTxt = c.from ? '在线' : '离线';
    const toTxt = c.to ? '在线' : '离线';
    const arrowCls = c.to ? 'online' : 'offline';
    return `<div class="mc-change-item">
      <div><span style="color:var(--text-tertiary)">${fmtTimeShort(c.ts)}</span>
      &nbsp;<span class="mc-change-arrow ${c.from ? 'online' : 'offline'}">${fromTxt}</span>
      → <span class="mc-change-arrow ${arrowCls}">${toTxt}</span>
      ${c.latencyMs != null ? `<span style="color:var(--text-tertiary); margin-left:6px">· ${c.latencyMs}ms</span>` : ''}
      </div></div>`;
  }).join('');
}

async function loadMcStatus() {
  const data = await api('/api/admin/mc-status');
  renderMcStatus(data.status);
  renderMcChanges(data.changes);
  // 占位：标记未用户编辑（让 renderMcStatus 不会冲掉用户已填的输入）
  ['#set-mc-host', '#set-mc-port', '#set-mc-interval'].forEach((s) => { $(s).dataset.userEdited = ''; });
}

function startMcStatusStream() {
  if (_mcStatusEventSrc) return;
  try {
    _mcStatusEventSrc = new EventSource('/api/mc-status/stream');
    _mcStatusEventSrc.addEventListener('status', (e) => {
      try {
        renderMcStatus(JSON.parse(e.data));
        // **2026-07-02 优化**：在 MC 监控页时也触发 debounced refresh
        //   - 替代 mcmonitor 页单独订阅的重复 SSE
        if (currentPage === 'mcmonitor') scheduleRefreshMcPage();
      } catch (_) {}
    });
    _mcStatusEventSrc.addEventListener('change', (e) => {
      try {
        const d = JSON.parse(e.data);
        renderMcStatus(d.status);
        // 重新拉一次 changes 列表
        api('/api/admin/mc-status').then((data) => renderMcChanges(data.changes)).catch(() => {});
        toast(`${d.prev ? '在线' : '离线'} → ${d.curr ? '在线' : '离线'}`, d.curr ? 'success' : 'error');
        // **2026-07-02 优化**：MC 监控页时也刷新
        if (currentPage === 'mcmonitor') scheduleRefreshMcPage();
      } catch (_) {}
    });
    _mcStatusEventSrc.onerror = () => {
      // 自动重连（EventSource 自带重连）
    };
  } catch (e) {
    console.warn('SSE 连接失败', e);
  }
}

on($('#btn-mc-refresh'), 'click', async () => {
  try { await loadMcStatus(); toast('已刷新', 'success'); } catch (e) { toast('刷新失败: ' + e.message, 'error'); }
});
on($('#btn-mc-ping'), 'click', async () => {
  try {
    $('#mc-status-dot').className = 'mc-status-dot checking';
    const r = await api('/api/admin/mc-status/ping', { method: 'POST' });
    renderMcStatus(r.status);
    const d = await api('/api/admin/mc-status');
    renderMcChanges(d.changes);
    toast(r.status.online ? '在线' : '离线', r.status.online ? 'success' : 'error');
  } catch (e) { toast('探测失败: ' + e.message, 'error'); }
});

// 配置修改事件
async function saveMcConfig() {
  const patch = {
    enabled: $('#set-mc-enabled').checked,
    host: ($('#set-mc-host').value || '127.0.0.1').trim(),
    port: parseInt($('#set-mc-port').value, 10) || 25565,
    intervalMs: (parseInt($('#set-mc-interval').value, 10) || 15) * 1000,
  };
  try {
    const r = await api('/api/admin/mc-status/config', { method: 'PUT', body: patch });
    toast('已保存 · 间隔 ' + Math.round(r.config.intervalMs / 1000) + 's', 'success');
    ['#set-mc-host', '#set-mc-port', '#set-mc-interval'].forEach((s) => { $(s).dataset.userEdited = '1'; });
    await loadMcStatus();
  } catch (e) { toast('保存失败: ' + e.message, 'error'); }
}
on($('#set-mc-enabled'), 'change', saveMcConfig);
on($('#set-mc-host'), 'input', (e) => { e.target.dataset.userEdited = '1'; });
on($('#set-mc-port'), 'input', (e) => { e.target.dataset.userEdited = '1'; });
on($('#set-mc-interval'), 'change', saveMcConfig);
on($('#set-mc-host'), 'change', saveMcConfig);
on($('#set-mc-port'), 'change', saveMcConfig);

// 启动 SSE 订阅
startMcStatusStream();

// ============== MC 服务器监控独立页面 ==============
// 2026-07-02 新增：完整 MC 监控 dashboard
//   - 3 个 stat-card：MC 服务器 / 外网连通性 / 推送服务自身
//   - 6 宫格实时状态：地址/延迟/上次检测/上次变化/在线时长/离线时长
//   - 最近 50 次探测时序图（绿=在线 红=离线）
//   - 外网 endpoint 详细列表
//   - MC 状态变化历史
//   - 配置面板（启用/地址/间隔/外网）
//   - App 端通知链路说明
let _mcPageMcEventSrc = null;
let _mcPageExtEventSrc = null;
let _mcPageHistory = []; // 最近 50 次探测（持续累积）

async function loadMcMonitorPage() {
  // 填推送服务端地址到说明里
  const info = serverInfo || (await api('/api/system/info').catch(() => null));
  if (info) {
    const base = info.publicBaseUrl || `http://127.0.0.1:${info.port}`;
    const pre = $$('.mcp-banner-panel pre.srv-block');
    if (pre.length) {
      pre[0].textContent = pre[0].textContent.replace(/\$\{PUSH_BASE\}/g, base);
    }
  }
  // 启动 SSE（持续订阅）
  startMcPageStreams();
  // 拉一次完整数据
  await refreshMcPage();
}

// **2026-07-02 优化**：debounce refreshMcPage
//   - 多个 SSE onmessage 事件同时触发时合并为 1 次 fetch
//   - 50ms 窗口内多次触发只跑 1 次
//   - 用 trailing edge：保证最后一次触发会执行
let _refreshMcPageTimer = null;
function scheduleRefreshMcPage() {
  if (_refreshMcPageTimer) return;
  _refreshMcPageTimer = setTimeout(() => {
    _refreshMcPageTimer = null;
    refreshMcPage();
  }, 50);
}
async function refreshMcPage() {
  try {
    const [mcData, extData, info, subsWatcher, subsProbe, keepAlive] = await Promise.all([
      api('/api/admin/mc-status'),
      api('/api/admin/external-status'),
      api('/api/system/info'),
      api('/api/admin/mc-status/subscribers'),
      api('/api/admin/mc-probe/subscribers'),
      // **2026-07-02 新增**：App KeepAlive 心跳跟踪（30min 窗口内的 lastSeen）
      api('/api/admin/keepalive/clients'),
    ]);
    // **2026-07-02 优化**：用 requestAnimationFrame 让 DOM 更新不卡
    requestAnimationFrame(() => {
      renderMcMonitorMc(mcData, info);
      renderMcMonitorExt(extData);
      renderMcSubPanel(subsWatcher, subsProbe, mcData, keepAlive);
    });
  } catch (e) {
    toast('加载失败: ' + e.message, 'error');
  }
}

// ============== App 端通知链路面板（实时诊断）==============
// 2026-07-02 新增
let _pushHistory = [];   // 最近 20 条推送（页面会话内累积）
let _chainAnimTimer = null;

function renderMcSubPanel(subsWatcher, subsProbe, mcData, keepAlive) {
  // **2026-07-02 改造**：同时显示 mcWatcher（默认 127.0.0.1）+ mcProbe（任意 host:port）订阅者
  //   之前只显示 mcWatcher，导致 app 端 v1.0.17 改走 /api/mc-probe/stream 时 webui 显示"无订阅者"
  //   数据合并后统一渲染：mcWatcher 标 W, mcProbe 标 P，方便区分

  // 1) 订阅者数 + dot
  const watcherList = subsWatcher?.list || [];
  const probeTargets = subsProbe?.targets || [];
  const probeSubscriberCount = probeTargets.reduce((acc, t) => acc + (t.subscriberCount || 0), 0);
  const totalCount = (subsWatcher?.count || 0) + probeSubscriberCount;
  $('#mcp-sub-count').textContent = String(totalCount);
  const dot = $('#mcp-sub-dot');
  if (totalCount > 0) {
    dot.className = 'mcp-sub-dot online';
  } else {
    dot.className = 'mcp-sub-dot offline';
  }

  // 2) 合并订阅者列表渲染
  // mcWatcher 一条数据代表一个订阅者（每条带 kind/label/durationMs）
  // mcProbe 多层：targets[].subscribers[]，每条带 connectedAt/durationMs + meta
  const merged = [];
  for (const w of watcherList) {
    merged.push({
      kind: w.kind === 'app-sse' ? 'watcher-app' : (w.kind === 'admin' ? 'watcher-admin' : 'watcher'),
      tag: w.kind === 'app-sse' ? 'W·APP' : (w.kind === 'admin' ? 'W·ADMIN' : 'W'),
      label: w.label || w.id,
      durationMs: w.durationMs || 0,
      raw: w,
    });
  }
  for (const t of probeTargets) {
    const addr = `${t.host}:${t.port}`;
    for (const s of (t.subscribers || [])) {
      const meta = s || {};
      const metaLabel = meta.label || addr;
      const kind = meta.kind || 'probe';
      merged.push({
        kind: kind === 'app-sse' ? 'probe-app' : (kind === 'admin' ? 'probe-admin' : 'probe'),
        tag: kind === 'app-sse' ? 'P·APP' : (kind === 'admin' ? 'P·ADMIN' : 'P'),
        label: `${addr} · ${metaLabel}`,
        subLabel: meta.userAgent || meta.ip || '',
        durationMs: meta.durationMs || 0,
        raw: { host: t.host, port: t.port, ...meta },
      });
    }
  }

  const listEl = $('#mcp-sub-list');
  if (merged.length === 0) {
    listEl.innerHTML = '<div class="activity-empty">暂无订阅者（App 端打开后会立即订阅 SSE /api/mc-status/stream 或 /api/mc-probe/stream）</div>';
  } else {
    listEl.innerHTML = merged.map((s) => {
      const dur = fmtDuration(s.durationMs);
      const sub = s.subLabel ? `<span class="mcp-sub-item-sub">${escapeHtml(s.subLabel)}</span>` : '';
      return `<div class="mcp-sub-item">
        <span class="mcp-sub-item-kind ${s.kind}">${escapeHtml(s.tag)}</span>
        <span class="mcp-sub-item-label" title="${escapeHtml(s.label)}">${escapeHtml(s.label)}</span>
        ${sub}
        <span class="mcp-sub-item-duration">已连 ${dur}</span>
      </div>`;
    }).join('');
  }

  // **2026-07-02 新增**：App KeepAlive 心跳跟踪面板
  renderKeepAlivePanel(keepAlive);

  // 3) 链路状态
  updateChainStatus(mcData, totalCount);
}

// **2026-07-02 新增**：渲染 App KeepAlive 心跳跟踪列表
//   - keepalive.clients: Array<{ clientId, source, host, port, mcHost, mcPort, appVersion, deviceModel,
//                                  androidVersion, userAgent, lastSeen, lastSeenAgoText, online, heartbeatCount, ... }>
//   - 排序：online 优先 + lastSeen 倒序
function renderKeepAlivePanel(keepAlive) {
  const clients = (keepAlive && Array.isArray(keepAlive.clients)) ? keepAlive.clients : [];
  const stats = (keepAlive && keepAlive.stats) || {};
  const countEl = $('#mcp-keepalive-count');
  if (countEl) countEl.textContent = String(stats.online || 0);

  const listEl = $('#mcp-keepalive-list');
  if (!listEl) return;

  if (clients.length === 0) {
    listEl.innerHTML = '<div class="activity-empty">暂无心跳记录（App 端 KeepAliveService / KeepAliveWorker 每次探测会 POST 心跳到 <code>/api/keepalive/heartbeat</code>）</div>';
    return;
  }

  // 排序：online 优先 + lastSeen 倒序
  const sorted = clients.slice().sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.lastSeen || 0) - (a.lastSeen || 0);
  });

  listEl.innerHTML = sorted.map((c) => {
    const onlineDot = c.online ? 'online' : 'offline';
    const source = c.lastSource || c.firstSource || '?';
    const sourceTag = (() => {
      switch (source) {
        case 'keepalive': return '🛡️ SVC';
        case 'workmanager': return '⏰ WM';
        case 'service': return '📡 SVC';
        case 'unknown': return '❓';
        default: return source.toUpperCase().slice(0, 4);
      }
    })();
    const version = c.appVersion ? `v${escapeHtml(c.appVersion)}` : '?';
    const device = c.deviceModel ? escapeHtml(c.deviceModel) : '';
    const android = c.androidVersion ? `Android ${c.androidVersion}` : '';
    const host = c.host || c.mcHost || '';
    const port = c.port || c.mcPort || '';
    const addr = host ? `${escapeHtml(host)}:${port}` : '(no addr)';
    const online = c.lastResult && typeof c.lastResult.online === 'boolean'
      ? (c.lastResult.online ? '🟢 online' : '🔴 offline')
      : '';
    const latency = c.lastResult && c.lastResult.latencyMs != null ? `${c.lastResult.latencyMs}ms` : '';
    const ago = c.lastSeenAgoText || '未知';
    const hbCount = c.heartbeatCount || 0;
    const tip = [
      `clientId: ${c.clientId}`,
      c.userAgent ? `UA: ${c.userAgent}` : '',
      `心跳次数: ${hbCount}`,
      `首次: ${c.firstSeen ? new Date(c.firstSeen).toLocaleString() : '?'}`,
    ].filter(Boolean).join('\n');

    return `<div class="mcp-sub-item" title="${escapeHtml(tip)}">
      <span class="mcp-sub-item-kind ${c.online ? 'probe-app' : 'watcher'}">${sourceTag}</span>
      <span class="mcp-sub-item-kind" style="min-width:auto; padding:1px 4px; font-size:10px">${version}</span>
      <span class="mcp-sub-item-label">
        <span class="mcp-sub-item-dot ${onlineDot}"></span>
        ${addr} ${online ? '· ' + online : ''} ${latency ? '· ' + latency : ''}
        ${device ? '<span class="mcp-sub-item-sub">' + device + (android ? ' · ' + android : '') + '</span>' : ''}
      </span>
      <span class="mcp-sub-item-duration">${ago} · #${hbCount}</span>
    </div>`;
  }).join('');
}

function updateChainStatus(mcData, totalCount) {
  const s = mcData?.status || {};
  const cfg = s.config || {};
  // 1: TCP 探测
  const step1 = $('#mcp-chain-1');
  const desc1 = $('#mcp-chain-1-desc');
  const stat1 = $('#mcp-chain-1-status');
  if (cfg.enabled !== false) {
    step1.classList.add('active');
    step1.classList.remove('error');
    stat1.textContent = '✓';
    desc1.textContent = `每 ${Math.round((cfg.intervalMs || 10000) / 1000)}s 探测一次`;
  } else {
    step1.classList.remove('active');
    step1.classList.add('error');
    stat1.textContent = '✗';
    desc1.textContent = '已停用';
  }

  // 2: 状态变化
  const step2 = $('#mcp-chain-2');
  const desc2 = $('#mcp-chain-2-desc');
  const stat2 = $('#mcp-chain-2-status');
  if (s.lastChangeAt) {
    step2.classList.add('active');
    stat2.textContent = '✓';
    desc2.textContent = `最近变化 ${fmtTimeAgo(s.lastChangeAt)}`;
  } else {
    step2.classList.remove('active');
    stat2.textContent = '—';
    desc2.textContent = '尚无变化记录';
  }

  // 3: SSE 推送
  const step3 = $('#mcp-chain-3');
  const stat3 = $('#mcp-chain-3-status');
  // **2026-07-02 修复**：totalCount 从参数取（不再依赖 DOM 文本），包含 mcWatcher + mcProbe 订阅者
  if (totalCount > 0) {
    step3.classList.add('active');
    stat3.textContent = '✓';
  } else {
    step3.classList.remove('active');
    stat3.textContent = '—';
  }
  $('#mcp-chain-3-desc').textContent = `${totalCount} 个客户端订阅中`;

  // 4: 系统通知（取决于 app 端）
  const step4 = $('#mcp-chain-4');
  const stat4 = $('#mcp-chain-4-status');
  if (totalCount > 0 && s.lastChangeAt) {
    step4.classList.add('active');
    stat4.textContent = '✓';
  } else {
    step4.classList.remove('active');
    stat4.textContent = '—';
  }
  $('#mcp-chain-4-desc').textContent = totalCount > 0 ? '已向订阅者推送' : '需要 App 端订阅';
}

function pushToHistory(evt, forced = false) {
  const t = new Date();
  const time = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}`;
  const isOn = !!evt.curr;
  const detail = `${evt.status?.host || '?'}:${evt.status?.port || '?'} · ${isOn ? '开启' : '关闭'}`;
  _pushHistory.unshift({ time, isOn, detail, forced });
  if (_pushHistory.length > 20) _pushHistory = _pushHistory.slice(0, 20);
  renderPushHistory();
}

function renderPushHistory() {
  const el = $('#mcp-push-history');
  if (_pushHistory.length === 0) {
    el.innerHTML = '<div class="activity-empty">暂无推送记录</div>';
    return;
  }
  el.innerHTML = _pushHistory.map((p) => {
    const badge = p.forced ? '<span class="mcp-push-badge test">测试</span>'
                          : `<span class="mcp-push-badge ${p.isOn ? 'on' : 'off'}">${p.isOn ? 'ON' : 'OFF'}</span>`;
    return `<div class="mcp-push-row ${p.forced ? 'forced' : ''}">
      <span class="mcp-push-time">${escapeHtml(p.time)}</span>
      ${badge}
      <span class="mcp-push-detail">${escapeHtml(p.detail)}</span>
    </div>`;
  }).join('');
}

// **2026-07-02 改造**：测试按钮同时支持 mcWatcher + mcProbe
//   app 端 v1.0.17 之后订阅的是 /api/mc-probe/stream（用户配置 host:port）
//   所以点击测试时优先调 /api/admin/mc-probe/simulate-change（host:port 从 /api/admin/mc-status 读 cfg）
//   兜底：没有 cfg 时调 mcWatcher 旧接口
async function _getMcTargetConfig() {
  // **2026-07-02 改造**：优先用用户在 settings 里配的 "App 端 MC 服务器地址"
  //   之前只读 /api/admin/mc-status 的 config，但那是推送服务端**自己本地** mcWatcher 的 config
  //   （127.0.0.1:25565），跟 App 端配置的 mc.bananaikun.dynv6.net:25565 完全不一致
  //   → 触发 "missing host" 错误
  //   现在：用户可以填自己的 MC 地址（_settings.appMcTarget）→ 测试通知用这个
  //   兜底：没填时退回 mcWatcher 自己的 127.0.0.1:25565
  try {
    const userAddr = String(_settings?.appMcTarget || '').trim();
    if (userAddr) {
      const m = userAddr.match(/^(.*?):(\d{1,5})$/);
      if (m) {
        const port = parseInt(m[2], 10);
        if (Number.isFinite(port) && port >= 1 && port <= 65535) {
          return { host: m[1], port, source: 'mc-probe' };
        }
      } else {
        // 没带端口 → 用默认 25565（用户配的 mc.bananaikun.dynv6.net 走 SRV）
        return { host: userAddr, port: 25565, source: 'mc-probe' };
      }
    }
  } catch (_) {}
  // **2026-07-02 新增**：完全没配时用 mc.bananaikun.dynv6.net（无端口，靠 SRV 解析）
  return { host: 'mc.bananaikun.dynv6.net', port: 25565, source: 'mc-probe' };
}

on($('#btn-mcp-test-on'), 'click', async () => {
  try {
    const cfg = await _getMcTargetConfig();
    const path = cfg.source === 'mc-probe'
      ? '/api/admin/mc-probe/simulate-change'
      : '/api/admin/mc-status/simulate-change';
    const body = cfg.source === 'mc-probe'
      ? { host: cfg.host, port: cfg.port, curr: true }
      : { curr: true };
    const r = await api(path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    pushToHistory({ curr: true, status: { host: cfg.host, port: cfg.port } }, true);
    if (r.subscriberCount === 0 || r.hasSubscribers === false) {
      toast(`已触发 · 但 ${cfg.host}:${cfg.port} 当前没有订阅者（请确保 App 端已打开 MC 监控页）`, 'error');
    } else {
      toast(`已向 ${cfg.host}:${cfg.port} 的 ${r.subscriberCount} 个订阅者推送「服务器开启」`, 'success');
    }
    flashChain([3, 4]);
  } catch (e) { toast('触发失败: ' + e.message, 'error'); }
});

on($('#btn-mcp-test-off'), 'click', async () => {
  try {
    const cfg = await _getMcTargetConfig();
    const path = cfg.source === 'mc-probe'
      ? '/api/admin/mc-probe/simulate-change'
      : '/api/admin/mc-status/simulate-change';
    const body = cfg.source === 'mc-probe'
      ? { host: cfg.host, port: cfg.port, curr: false }
      : { curr: false };
    const r = await api(path, { method: 'POST', body, headers: { 'Content-Type': 'application/json' } });
    pushToHistory({ curr: false, status: { host: cfg.host, port: cfg.port } }, true);
    if (r.subscriberCount === 0 || r.hasSubscribers === false) {
      toast(`已触发 · 但 ${cfg.host}:${cfg.port} 当前没有订阅者`, 'error');
    } else {
      toast(`已向 ${cfg.host}:${cfg.port} 的 ${r.subscriberCount} 个订阅者推送「服务器关闭」`, 'success');
    }
    flashChain([3, 4]);
  } catch (e) { toast('触发失败: ' + e.message, 'error'); }
});

on($('#btn-mcp-test-endpoint'), 'click', async () => {
  const base = serverInfo?.publicBaseUrl || (serverInfo ? `http://127.0.0.1:${serverInfo.port}` : window.location.origin);
  // **2026-07-02 改造**：复制 mc-probe/stream（app 端订阅的接口）而不是 mc-status/stream
  const cfg = await _getMcTargetConfig();
  const streamPath = cfg.source === 'mc-probe'
    ? `/api/mc-probe/stream?host=${encodeURIComponent(cfg.host)}&port=${cfg.port}&intervalMs=10000&timeoutMs=1500`
    : '/api/mc-status/stream';
  const url = `${base.replace(/\/$/, '')}${streamPath}`;
  try {
    await navigator.clipboard.writeText(url);
    toast('已复制到剪贴板: ' + url, 'success');
  } catch (_) {
    prompt('SSE URL（手动复制）:', url);
  }
});

function flashChain(steps) {
  steps.forEach((n, i) => {
    setTimeout(() => {
      const el = $(`#mcp-chain-${n}`);
      el.classList.add('active');
      const status = $(`#mcp-chain-${n}-status`);
      const old = status.textContent;
      status.textContent = '⚡';
      setTimeout(() => {
        status.textContent = old === '⚡' ? '✓' : old;
      }, 800);
    }, i * 250);
  });
}

function renderMcMonitorMc(data, info) {
  const s = data.status || {};
  const cfg = s.config || {};
  const hist = data.history || [];
  // 更新大卡片
  const state = $('#mcp-mc-state');
  const dot = $('#mcp-mc-dot');
  const meta = $('#mcp-mc-meta');
  if (s.online === true) {
    state.textContent = '在线'; state.className = 'stat-value online';
    dot.className = 'mc-stat-dot online';
  } else if (s.online === false) {
    state.textContent = '离线'; state.className = 'stat-value offline';
    dot.className = 'mc-stat-dot offline';
  } else {
    state.textContent = '检测中…'; state.className = 'stat-value checking';
    dot.className = 'mc-stat-dot checking';
  }
  const latency = s.latencyMs != null ? `${s.latencyMs}ms` : '—';
  const lastCheck = s.lastCheckAt ? fmtTimeAgo(s.lastCheckAt) : '—';
  meta.textContent = `${cfg.host || '?'}:${cfg.port || '?'} · 延迟 ${latency} · 上次 ${lastCheck}${s.lastError ? ' · ' + s.lastError : ''}`;

  // 6 宫格
  $('#mcp-mc-addr').textContent = `${cfg.host || '?'}:${cfg.port || '?'}`;
  $('#mcp-mc-latency').textContent = latency;
  $('#mcp-mc-lastcheck').textContent = s.lastCheckAt ? fmtTimeAgo(s.lastCheckAt) : '—';
  $('#mcp-mc-lastchange').textContent = s.lastChangeAt ? fmtTimeAgo(s.lastChangeAt) : '从未';
  const upDown = computeUptimeDowntime(hist);
  $('#mcp-mc-uptime').textContent = upDown.uptime;
  $('#mcp-mc-downtime').textContent = upDown.downtime;

  // 时序图
  _mcPageHistory = hist.slice(-50);
  renderMcTimeline(_mcPageHistory);

  // 状态变化历史
  renderMcChanges(data.changes || []);

  // 配置面板（不冲掉用户编辑）
  if (!$('#mcp-set-mc-host').dataset.userEdited) $('#mcp-set-mc-host').value = cfg.host || '127.0.0.1';
  if (!$('#mcp-set-mc-port').dataset.userEdited) $('#mcp-set-mc-port').value = String(cfg.port || 25565);
  if (!$('#mcp-set-mc-interval').dataset.userEdited) $('#mcp-set-mc-interval').value = String(Math.round((cfg.intervalMs || 10000) / 1000));
  $('#mcp-set-mc-enabled').checked = cfg.enabled !== false;

  // banner 头部 meta
  $('#mcp-banner-meta').textContent = `interval ${Math.round((cfg.intervalMs || 10000) / 1000)}s · 探测 ${hist.length} 次`;

  // 推送服务自身卡片
  if (info) {
    $('#mcp-srv-state').textContent = '运行中';
    $('#mcp-srv-meta').textContent = `已运行 ${fmtUptime(info.uptime)} · 端口 ${info.port}`;
  }
}

function renderMcMonitorExt(data) {
  const s = data.status || {};
  const hist = data.history || [];
  const state = $('#mcp-ext-state');
  const dot = $('#mcp-ext-dot');
  const meta = $('#mcp-ext-meta');
  if (s.online === true) {
    state.textContent = '公网通'; state.className = 'stat-value online';
    dot.className = 'ext-stat-dot online';
  } else if (s.online === false) {
    state.textContent = '断网'; state.className = 'stat-value offline';
    dot.className = 'ext-stat-dot offline';
  } else {
    state.textContent = '探测中…'; state.className = 'stat-value checking';
    dot.className = 'ext-stat-dot checking';
  }
  const avg = s.avgLatencyMs != null ? `平均 ${s.avgLatencyMs}ms` : '';
  const lastCheck = s.lastCheckAt ? fmtTimeAgo(s.lastCheckAt) : '—';
  meta.textContent = `${s.successCount || 0}/${s.totalCount || 0} endpoint 通 · ${avg} · 上次 ${lastCheck}`;

  // endpoint 列表
  const list = $('#mcp-ext-list');
  if (!s.results || s.results.length === 0) {
    list.innerHTML = '<div class="activity-empty">暂无数据</div>';
  } else {
    list.innerHTML = s.results.map((r) => {
      const status = r.ok ? 'online' : 'offline';
      const latencyTxt = r.ok ? `${r.latencyMs}ms` : '—';
      const codeTxt = r.statusCode ? `HTTP ${r.statusCode}` : (r.error || '');
      return `<div class="mcp-ext-item">
        <span class="mcp-ext-dot ${status}"></span>
        <span class="mcp-ext-name">${escapeHtml(r.name)}</span>
        <span class="mcp-ext-url mono">${escapeHtml(r.url || (r.host ? r.host + ':' + r.port : ''))}</span>
        <span class="mcp-ext-latency ${status}">${escapeHtml(latencyTxt)}</span>
        <span class="mcp-ext-code">${escapeHtml(codeTxt)}</span>
      </div>`;
    }).join('');
  }

  $('#mcp-set-ext-enabled').checked = (s.config?.enabled) !== false;
}

function renderMcTimeline(hist) {
  const wrap = $('#mcp-timeline');
  if (!hist || hist.length === 0) {
    wrap.innerHTML = '<div class="activity-empty" style="margin:auto">暂无数据</div>';
    return;
  }
  wrap.innerHTML = hist.map((h) => {
    const cls = h.online ? 'online' : 'offline';
    const t = fmtTimeShort(h.ts);
    const latency = h.latencyMs != null ? `${h.latencyMs}ms` : '—';
    return `<div class="mcp-timeline-item ${cls}">
      <div class="mcp-timeline-tooltip">${t} · ${h.online ? '在线' : '离线'} · ${latency}</div>
    </div>`;
  }).join('');
}

function computeUptimeDowntime(hist) {
  // 简单统计：最近 hist.length 次探测中 online 比例 × 总时长近似
  if (!hist || hist.length < 2) return { uptime: '—', downtime: '—' };
  const span = hist[hist.length - 1].ts - hist[0].ts;
  if (span <= 0) return { uptime: '—', downtime: '—' };
  let onlineMs = 0, offlineMs = 0;
  for (let i = 1; i < hist.length; i++) {
    const dt = hist[i].ts - hist[i - 1].ts;
    if (hist[i - 1].online) onlineMs += dt;
    else offlineMs += dt;
  }
  return { uptime: fmtDuration(onlineMs), downtime: fmtDuration(offlineMs) };
}

function fmtDuration(ms) {
  if (ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h${m % 60}m`;
  const d = Math.floor(h / 24);
  return `${d}d${h % 24}h`;
}

function startMcPageStreams() {
  // **2026-07-02 优化**：不再单独订阅 /api/mc-status/stream
  //   - 主 SSE (_mcStatusEventSrc) 已经会推送 status/change 事件
  //   - startMcStatusStream 的 onmessage handler 已经检查 currentPage === 'mcmonitor'
  //   - 删掉重复的 _mcPageMcEventSrc 节省 1 个 SSE 连接
  // External SSE（保留独立 — 数据源不同）
  if (!_mcPageExtEventSrc) {
    try {
      _mcPageExtEventSrc = new EventSource('/api/external-status/stream');
      _mcPageExtEventSrc.addEventListener('status', (e) => {
        try {
          if (currentPage !== 'mcmonitor') return;
          // **2026-07-02 优化**：用 scheduleRefreshMcPage 替代直接调（防抖）
          scheduleRefreshMcPage();
        } catch (_) {}
      });
    } catch (e) { console.warn('外网 SSE 失败', e); }
  }
  // **2026-07-02 优化**：删掉 5s 轮询（已经有 SSE 推送 + scheduleRefreshMcPage 防抖）
  //   - 之前 startMcPageSubsPoll 每 5s 拉一次完整数据
  //   - 现在 SSE 推送时会自动 scheduleRefreshMcPage，不需要轮询兜底
}

// 按钮
on($('#btn-mcp-page-refresh'), 'click', () => refreshMcPage());
on($('#btn-mcp-page-ping'), 'click', async () => {
  try {
    $('#mcp-mc-dot').className = 'mc-stat-dot checking';
    await api('/api/admin/mc-status/ping', { method: 'POST' });
    await refreshMcPage();
    toast('已探测', 'success');
  } catch (e) { toast('探测失败: ' + e.message, 'error'); }
});
on($('#btn-mcp-ext-ping'), 'click', async () => {
  try {
    $('#mcp-ext-dot').className = 'ext-stat-dot checking';
    await api('/api/admin/external-status/ping', { method: 'POST' });
    await refreshMcPage();
    toast('已探测外网', 'success');
  } catch (e) { toast('探测失败: ' + e.message, 'error'); }
});
on($('#btn-mcp-mc-clear'), 'click', async () => {
  // 清空历史 = 改 interval 为 1s 触发一次或者直接刷新页面
  $('#mcp-changes-list').innerHTML = '<div class="activity-empty">已清空显示（实际历史在服务端）</div>';
  toast('显示已清空（重新进入页面会重新拉取）', 'success');
});

// MC 配置保存
async function saveMcPageConfig() {
  const patch = {
    enabled: $('#mcp-set-mc-enabled').checked,
    host: ($('#mcp-set-mc-host').value || '127.0.0.1').trim(),
    port: parseInt($('#mcp-set-mc-port').value, 10) || 25565,
    intervalMs: (parseInt($('#mcp-set-mc-interval').value, 10) || 10) * 1000,
  };
  try {
    const r = await api('/api/admin/mc-status/config', { method: 'PUT', body: patch });
    toast('已保存 · 间隔 ' + Math.round(r.config.intervalMs / 1000) + 's', 'success');
    ['#mcp-set-mc-host', '#mcp-set-mc-port', '#mcp-set-mc-interval'].forEach((s) => { $(s).dataset.userEdited = '1'; });
    await refreshMcPage();
  } catch (e) { toast('保存失败: ' + e.message, 'error'); }
}
on($('#mcp-set-mc-enabled'), 'change', saveMcPageConfig);
on($('#mcp-set-mc-host'), 'input', (e) => { e.target.dataset.userEdited = '1'; });
on($('#mcp-set-mc-port'), 'input', (e) => { e.target.dataset.userEdited = '1'; });
on($('#mcp-set-mc-interval'), 'change', saveMcPageConfig);
on($('#mcp-set-mc-host'), 'change', saveMcPageConfig);
on($('#mcp-set-mc-port'), 'change', saveMcPageConfig);

on($('#mcp-set-ext-enabled'), 'change', async (e) => {
  // 暂存 enabled 到 localStorage（避免破坏 settings 接口）
  try {
    const cur = await api('/api/admin/settings');
    const next = { ...cur, externalProbe: { ...(cur.externalProbe || {}), enabled: e.target.checked } };
    await api('/api/admin/settings', { method: 'PUT', body: next });
    toast('外网探测已' + (e.target.checked ? '启用' : '停用'), 'success');
  } catch (err) { toast('保存失败: ' + err.message, 'error'); }
});


// 离开 logs 页面时停掉 SSE
let _lastPage = null;
const _origLoadPage = loadPage;
function _wrapLoadPage(name) {
  if (_lastPage === 'logs' && name !== 'logs') stopLogSSE();
  _lastPage = name;
  _origLoadPage(name);
  // 2026-07-02：MC 监控页打开时启动订阅者轮询，关闭时停止
  if (name === 'mcmonitor') {
    startMcPageSubsPoll();
  } else {
    stopMcPageSubsPoll();
  }
}
// 替换全局 loadPage
window.__loadPage = loadPage;
const _navObserver = new MutationObserver(() => {});
_navObserver.observe(document.body, { childList: true, subtree: true });

// 2026-07-02 新增：MC 监控页订阅者轮询（5s 一次）
let _mcPageSubsPollTimer = null;
function startMcPageSubsPoll() {
  if (_mcPageSubsPollTimer) return;
  _mcPageSubsPollTimer = setInterval(async () => {
    if (currentPage !== 'mcmonitor') return;
    try {
      // **2026-07-02 修复**：同时拉三个数据源（mcWatcher + mcProbe + keepalive 心跳）
      const [subsWatcher, subsProbe, mcData, keepAlive] = await Promise.all([
        api('/api/admin/mc-status/subscribers'),
        api('/api/admin/mc-probe/subscribers'),
        api('/api/admin/mc-status'),
        api('/api/admin/keepalive/clients'),
      ]);
      renderMcSubPanel(subsWatcher, subsProbe, mcData, keepAlive);
    } catch (_) {}
  }, 5000);
}
function stopMcPageSubsPoll() {
  if (_mcPageSubsPollTimer) { clearInterval(_mcPageSubsPollTimer); _mcPageSubsPollTimer = null; }
}

// ============== Confirm Modal ==============
function confirmModal({ title = '确认', msg = '', okText = '确认' } = {}) {
  return new Promise((resolve) => {
    $('#confirm-title').textContent = title;
    $('#confirm-msg').innerHTML = msg;
    const okBtn = $('#confirm-ok');
    const cancelBtn = $('#confirm-cancel');
    okBtn.textContent = okText;
    const modal = $('#modal-confirm');
    modal.hidden = false;
    const close = (val) => {
      modal.hidden = true;
      okBtn.onclick = null;
      cancelBtn.onclick = null;
      resolve(val);
    };
    okBtn.onclick = () => close(true);
    cancelBtn.onclick = () => close(false);
  });
}

// ============== 退出 ==============
on($('#btn-logout'), 'click', () => {
  setToken('');
  showAuth();
});

// ============== 主题切换 ==============
on($('#btn-theme'), 'click', nextTheme);

// ============== 内网穿透监控（2026-07-03 多隧道版）==============
// 2 个隧道并行监控：
//   - MC 隧道 (lucky rule 2242) → mc.bananaikun.dynv6.net
//   - 推送服务端隧道 (lucky rule 24454) → v.bananaikun.dynv6.net
// 共享同一套 UI 模式：
//   - 3 stat cards (服务 / 隧道 / 域名)
//   - 实时状态面板
//   - autoRecover 配置面板
// 两边各调各的 /api/tunnel-status-push|all + /api/admin/tunnel-status-push|all
let _tunEventSrc = null;        // 兼容旧：单 MC SSE
let _tunPushEventSrc = null;    // push SSE
let _tunAllEventSrc = null;     // 聚合 SSE（mc + push 一次拿）

// **2026-07-03 改造**：用 /api/tunnel-status-all/stream 单条 SSE 同时订阅所有 tunnel
//   事件名：tunnel-{tunnelId}-status / tunnel-{tunnelId}-change / tunnel-{tunnelId}-recover
//   初始事件：status（一次拿所有 tunnel 状态）
function startTunnelStatusStream() {
  if (_tunAllEventSrc) return;
  try {
    _tunAllEventSrc = new EventSource('/api/tunnel-status-all/stream');
  } catch (e) {
    console.error('startTunnelStatusStream failed:', e);
    return;
  }
  _tunAllEventSrc.addEventListener('status', (e) => {
    try {
      const data = JSON.parse(e.data);
      for (const tid of Object.keys(data)) {
        if (tid === 'mc' || tid === 'push') renderTunnelStatus(data[tid], tid);
        else renderCustomTunnelStatus(tid, data[tid]);
      }
    } catch (_) {}
  });
  // 监听所有命名事件（tunnel-{id}-status / tunnel-{id}-change / tunnel-{id}-recover）
  const onAny = (e) => {
    try {
      const m = String(e.type).match(/^tunnel-(.+)-(status|change|recover)$/);
      if (m) {
        const tid = m[1];
        const kind = m[2];
        if (kind === 'status') {
          const s = JSON.parse(e.data);
          if (tid === 'mc' || tid === 'push') renderTunnelStatus(s, tid);
          else renderCustomTunnelStatus(tid, s);
        } else if (kind === 'change') {
          const data = JSON.parse(e.data);
          const desc = stateDesc(data.curr, tid);
          const label = tid === 'mc' ? 'MC 隧道' : tid === 'push' ? '推送服务端隧道' : tid + ' 隧道';
          tunnelToast(tid, data.curr, label + ' 状态变化：' + desc, data.curr === 'public_dead_service_alive' ? 'warn' : 'info');
        } else if (kind === 'recover') {
          const data = JSON.parse(e.data);
          const label = tid === 'mc' ? 'MC' : tid === 'push' ? '推送服务端' : tid;
          if (data.ok) toast(`${label} STUN 隧道已触发恢复`, 'success');
          else toast(`${label} STUN 隧道恢复失败：${data.error || '未知'}`, 'error');
        }
      }
    } catch (_) {}
  };
  // 监听所有可能的事件名
  for (const evt of ['tunnel-mc-status', 'tunnel-mc-change', 'tunnel-mc-recover', 'tunnel-push-status', 'tunnel-push-change', 'tunnel-push-recover']) {
    _tunAllEventSrc.addEventListener(evt, onAny);
  }
  // 旧端点也保持订阅（兼容老 webui 引用）
  if (!_tunEventSrc) {
    try {
      _tunEventSrc = new EventSource('/api/tunnel-status/stream');
    } catch (_) {}
  }
}

// toast 去重：每个 tunnel 独立 key
const _tunToastKeys = {};
const _tunToastTs = {};
function tunnelToast(which, key, msg, kind) {
  const now = Date.now();
  if (_tunToastKeys[which] === key && now - (_tunToastTs[which] || 0) < 5000) return;
  _tunToastKeys[which] = key;
  _tunToastTs[which] = now;
  toast(msg, kind);
}

function stopTunnelStatusStream() {
  if (_tunAllEventSrc) {
    try { _tunAllEventSrc.close(); } catch (_) {}
    _tunAllEventSrc = null;
  }
  if (_tunEventSrc) {
    try { _tunEventSrc.close(); } catch (_) {}
    _tunEventSrc = null;
  }
  if (_tunPushEventSrc) {
    try { _tunPushEventSrc.close(); } catch (_) {}
    _tunPushEventSrc = null;
  }
}

// **2026-07-03 改造**：state 名称从 mc → service（tunnelWatcher.js 改造后）
//   旧：tunnel_alive_mc_alive / tunnel_dead_mc_alive / tunnel_alive_mc_dead / tunnel_dead_mc_dead
//   新：tunnel_alive_service_alive / tunnel_dead_service_alive / tunnel_alive_service_alive_dead / tunnel_dead_service_dead
// 兼容旧名字（防止老 webui 残留）
function stateDesc(state, which) {
  const mcLabel = which === 'push' ? '推送服务端' : 'MC 服务器';
  switch (state) {
    case 'tunnel_alive_mc_alive':
    case 'tunnel_alive_service_alive': return '正常';
    case 'tunnel_dead_mc_alive':
    case 'tunnel_dead_service_alive': return '⚠️ 隧道断开（' + mcLabel + '活着）';
    case 'tunnel_alive_mc_dead':
    case 'tunnel_alive_service_dead': return '⚠️ ' + mcLabel + ' 关闭';
    case 'tunnel_dead_mc_dead':
    case 'tunnel_dead_service_dead': return '❌ 全部断开';
    default: return '探测中';
  }
}

function fmtTimeAgo(ts) {
  if (!ts) return '—';
  const ms = Date.now() - ts;
  if (ms < 1000) return '刚刚';
  if (ms < 60000) return `${Math.floor(ms / 1000)}s 前`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m 前`;
  return new Date(ts).toLocaleString('zh-CN');
}

// **2026-07-03 多隧道 + 公网端口改造**：renderTunnelStatus 增加 which 参数
//   - which = 'mc' → 渲染到 ID 前缀 tun-mc-/tun-tun-/tun-domain- 的元素（旧）
//   - which = 'push' → 渲染到 ID 前缀 tun-push-mc-/tun-push-tun-/tun-push-domain- 的元素
//   - 兼容旧调用：renderTunnelStatus(data) 默认 'mc'
//   - **2026-07-03 改造**：tunnel local port → public port (lucky PublicAddr)
function renderTunnelStatus(status, which = 'mc') {
  if (!status) return;
  const prefix = which === 'push' ? 'tun-push-' : 'tun-';

  // service 卡 — 表示后端服务是否活着
  const svc = status.service || status.mc || {};
  const svcDot = $('#' + prefix + 'mc-status-dot');
  const svcState = $('#' + prefix + 'mc-state');
  if (svc.online === true) {
    if (svcDot) svcDot.className = 'dot dot-success';
    if (svcState) svcState.textContent = '运行中';
  } else if (svc.online === false) {
    if (svcDot) svcDot.className = 'dot dot-error';
    if (svcState) svcState.textContent = '未连接';
  } else {
    if (svcDot) svcDot.className = 'dot dot-warning';
    if (svcState) svcState.textContent = '探测中...';
  }
  const svcAddr = $('#' + prefix + 'mc-addr');
  if (svcAddr) svcAddr.textContent = `${svc.host || '—'}:${svc.port || '—'}`;
  const svcLat = $('#' + prefix + 'mc-latency');
  if (svcLat) svcLat.textContent = svc.latencyMs != null ? `${svc.latencyMs}ms` : '—';
  const svcChecked = $('#' + prefix + 'mc-checked');
  if (svcChecked) svcChecked.textContent = fmtTimeAgo(svc.lastCheckAt);

  // 公网端口卡（2026-07-03：tunnel local port → public port from lucky PublicAddr）
  // 旧：tun-tun-status-dot 表示 lucky local port (34532)
  // 新：tun-tun-status-dot 表示 lucky STUN 协商的公网 IP+端口 (218.21.95.120:59455)
  const pub = status.public || status.tunnel || {};
  const tunDot = $('#' + prefix + 'tun-status-dot');
  const tunState = $('#' + prefix + 'tun-state');
  if (pub.online === true) {
    if (tunDot) tunDot.className = 'dot dot-success';
    if (tunState) tunState.textContent = pub.port ? `${pub.port}` : '正常';
  } else if (pub.online === false) {
    if (tunDot) tunDot.className = 'dot dot-error';
    if (tunState) tunState.textContent = '断开';
  } else {
    if (tunDot) tunDot.className = 'dot dot-warning';
    if (tunState) tunState.textContent = '探测中...';
  }
  const tunAddr = $('#' + prefix + 'tun-addr');
  if (tunAddr) {
    // 显示 source: lucky (PublicAddr) / srv (SRV 解析)
    const src = pub.source ? ` [${pub.source}]` : '';
    tunAddr.textContent = `${pub.host || '—'}:${pub.port || '—'}${src}`;
  }
  const tunLat = $('#' + prefix + 'tun-latency');
  if (tunLat) tunLat.textContent = pub.latencyMs != null ? `${pub.latencyMs}ms` : '—';
  const tunChecked = $('#' + prefix + 'tun-checked');
  if (tunChecked) tunChecked.textContent = fmtTimeAgo(pub.lastCheckAt);

  // 外网域名卡（SRV 解析）
  // **2026-07-03 修复**：优先用 status.public.port（lucky 实际公网端口，每次探测从 lucky Open API 拿，无缓存）
  //   之前用 status.domain.port 是 SRV 查询结果，受 OS DNS 缓存影响（dynv6 SRV 已经 PATCH 到 59455，
  //   但本地 DNS 缓存还在用旧的 34532，导致 stat-card 显示错的端口数分钟）
  //   - status.public.port 才是用户真正能连进来的端口（lucky STUN 协商的公网 IP:端口）
  //   - status.domain.port 退化为 fallback（仅在 public.port 无值时使用）
  const dom = status.domain || {};
  const pubForDomain = status.public || {};
  const domDot = $('#' + prefix + 'domain-status-dot');
  const domState = $('#' + prefix + 'domain-state');
  if (dom.online === true) {
    if (domDot) domDot.className = 'dot dot-success';
    if (domState) domState.textContent = '可访问';
  } else if (dom.online === false) {
    if (domDot) domDot.className = 'dot dot-error';
    if (domState) domState.textContent = '无法访问';
  } else if (dom.lastError === 'disabled') {
    if (domDot) domDot.className = 'dot dot-warning';
    if (domState) domState.textContent = '已禁用';
  } else {
    if (domDot) domDot.className = 'dot dot-warning';
    if (domState) domState.textContent = '探测中...';
  }
  // 端口显示：lucky 实际公网端口 > SRV 解析端口（前者更准）
  const displayPort = (pubForDomain.port && pubForDomain.port > 0) ? pubForDomain.port : (dom.port && dom.port > 0 ? dom.port : null);
  const domAddr = $('#' + prefix + 'domain-addr');
  if (domAddr) domAddr.textContent = `${dom.host || '—'}:${displayPort || '—'}`;
  // IP / 延迟用 SRV 探测的（实际可解析的 IP）
  const domIp = $('#' + prefix + 'domain-ip');
  if (domIp) domIp.textContent = dom.resolvedIp || pubForDomain.host || '—';
  const domLat = $('#' + prefix + 'domain-latency');
  if (domLat) domLat.textContent = dom.latencyMs != null ? `${dom.latencyMs}ms` : (pubForDomain.latencyMs != null ? `${pubForDomain.latencyMs}ms` : '—');

  // autoRecover 开关（避免覆盖用户编辑）
  const cfg = status.config || {};
  const toggle = $('#' + prefix + 'autorecover-toggle');
  if (toggle && document.activeElement !== toggle) {
    toggle.checked = !!cfg.autoRecover;
  }
  const recoverState = $('#' + prefix + 'recover-state');
  if (recoverState) {
    recoverState.textContent = cfg.autoRecover ? '已启用' : '关闭';
    recoverState.style.color = cfg.autoRecover ? 'var(--success)' : 'var(--text-secondary)';
  }
  // 状态机描述
  const stateDescEl = $('#' + prefix + 'state-desc');
  if (stateDescEl) {
    stateDescEl.textContent = stateDesc(status.state, which);
  }
  const banner = $('#' + prefix + 'banner-meta');
  if (banner) {
    banner.textContent = `最近探测 ${fmtTimeAgo(svc.lastCheckAt || Date.now())}`;
  }
  // 公网端口变化提示（2026-07-03 新增）
  if (status.publicPortChangedAt) {
    const ago = fmtTimeAgo(status.publicPortChangedAt);
    const changedEl = $('#' + prefix + 'port-changed-meta');
    if (changedEl) {
      const hist = (status.publicPortHistory || []).slice(-3);
      const last = hist[hist.length - 1];
      const prev = hist[hist.length - 2];
      if (last && prev) {
        changedEl.textContent = `公网端口 ${prev.port} → ${last.port}（${ago}）`;
        changedEl.style.color = 'var(--warning)';
      } else if (last) {
        changedEl.textContent = `当前公网端口 ${last.port}（${ago}）`;
      }
    }
  }
}

// **2026-07-03 兼容旧 renderTunnelStatus()** - 接受旧结构 status
// 旧结构: { mc: {...}, tunnel: {...}, domain: {...} }
// 新结构: { service: {...}, tunnel: {...}, domain: {...} }
// 上面的 renderTunnelStatus 已通过 status.service || status.mc 同时兼容两者

// **2026-07-03 改造**：fillTunnelConfigForm 接受 which 参数
//   - which = 'mc' → 填充 ID 前缀 tun-cfg- 的元素
//   - which = 'push' → 填充 ID 前缀 tun-push-cfg- 的元素
//   - **2026-07-03 移除**：tunnelPort 字段（穿透通道本地端口已废弃）
function fillTunnelConfigForm(cfg, which = 'mc') {
  if (!cfg) return;
  const prefix = which === 'push' ? 'tun-push-cfg-' : 'tun-cfg-';
  const setVal = (id, v) => { const el = $('#' + id); if (el) el.value = v == null ? '' : v; };
  const setCheck = (id, v) => { const el = $('#' + id); if (el) { if (document.activeElement !== el) el.checked = !!v; } };
  // 兼容旧 mcPort / 新 servicePort
  setVal(prefix + 'servicePort', cfg.servicePort != null ? cfg.servicePort : cfg.mcPort);
  setVal(prefix + 'mcPort', cfg.mcPort != null ? cfg.mcPort : cfg.servicePort);
  setVal(prefix + 'publicSource', cfg.publicSource || 'lucky');
  setVal(prefix + 'intervalMs', cfg.intervalMs);
  setVal(prefix + 'recoverBaseUrl', cfg.recoverBaseUrl);
  setVal(prefix + 'recoverToken', cfg.recoverToken);
  setVal(prefix + 'recoverStunKey', cfg.recoverStunKey);
  setVal(prefix + 'recoverStunName', cfg.recoverStunName);
  setVal(prefix + 'recoverDelayMs', cfg.recoverDelayMs);
  setVal(prefix + 'recoverMinIntervalMs', cfg.recoverMinIntervalMs);
  setVal(prefix + 'domainHost', cfg.domainHost);
  setVal(prefix + 'domainPort', cfg.domainPort);
  setVal(prefix + 'srvPrefix', cfg.srvPrefix);
  setCheck(prefix + 'domainEnabled', cfg.domainEnabled);
  setCheck(prefix + 'enabled', cfg.enabled);
}

// **2026-07-03 兼容旧 ID**：旧 fillTunnelConfigForm 用 tun-cfg-mcPort，迁移到 servicePort
//   新表单用 tun-cfg-servicePort；旧 ID tun-cfg-mcPort 也同步填一份保证兼容

// **2026-07-03 多隧道改造**：fetchTunnelStatus 接受 which 参数
async function fetchTunnelStatus(which = 'mc') {
  try {
    const path = which === 'push' ? '/api/admin/tunnel-status-push' : '/api/admin/tunnel-status';
    const r = await fetch(path, { headers: { 'Authorization': 'Bearer ' + getToken() } });
    const j = await r.json();
    if (j && j.status) {
      renderTunnelStatus(j.status, which);
    }
    if (j && j.config) {
      fillTunnelConfigForm(j.config, which);
    }
  } catch (e) { /* ignore */ }
}

async function loadTunnelMonitorPage() {
  // 初始拉一次状态（带 config）— 同时拉 mc + push
  await Promise.all([fetchTunnelStatus('mc'), fetchTunnelStatus('push')]);

  // 绑定按钮
  on($('#tun-recover-btn'), 'click', async () => {
    const btn = $('#tun-recover-btn');
    btn.disabled = true;
    btn.textContent = '恢复中...';
    try {
      const r = await fetch('/api/admin/tunnel-status/recover', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() } });
      const j = await r.json();
      if (j.ok) {
        toast(j.message || 'STUN 隧道已重启', 'success');
      } else {
        toast('恢复失败：' + (j.error || '未知'), 'error');
      }
    } catch (e) {
      toast('请求失败：' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '立即重启 STUN 隧道';
      fetchTunnelStatus('mc');
    }
  });

  on($('#tun-ping-btn'), 'click', async () => {
    try {
      const r = await fetch('/api/admin/tunnel-status/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() } });
      const j = await r.json();
      if (j.ok) {
        toast('已立即探测', 'info');
        renderTunnelStatus(j.status, 'mc');
      } else {
        toast('探测失败：' + (j.error || '未知'), 'error');
      }
    } catch (e) {
      toast('请求失败：' + e.message, 'error');
    }
  });

  on($('#tun-save-btn'), 'click', async () => {
    const status = $('#tun-save-status');
    status.textContent = '保存中...';
    const body = {
      servicePort: parseInt($('#tun-cfg-mcPort').value, 10) || 25565,
      publicSource: $('#tun-cfg-publicSource')?.value || 'lucky',
      intervalMs: parseInt($('#tun-cfg-intervalMs').value, 10) || 30000,
      recoverBaseUrl: $('#tun-cfg-recoverBaseUrl').value.trim(),
      recoverToken: $('#tun-cfg-recoverToken').value.trim(),
      recoverStunKey: $('#tun-cfg-recoverStunKey').value.trim(),
      recoverStunName: $('#tun-cfg-recoverStunName')?.value.trim() || '',
      recoverDelayMs: parseInt($('#tun-cfg-recoverDelayMs')?.value, 10) || 1500,
      recoverMinIntervalMs: parseInt($('#tun-cfg-recoverMinIntervalMs')?.value, 10) || 300000,
      autoRecover: $('#tun-autorecover-toggle').checked,
      enabled: $('#tun-cfg-enabled')?.checked !== false,
      domainHost: $('#tun-cfg-domainHost')?.value.trim() || '',
      domainPort: 0, // **2026-07-03 移除**：公网端口动态变化，UI 不再让用户填，统一强制走 SRV
      domainEnabled: $('#tun-cfg-domainEnabled')?.checked || false,
      srvPrefix: $('#tun-cfg-srvPrefix')?.value.trim() || '_minecraft._tcp',
    };
    try {
      const r = await fetch('/api/admin/tunnel-status/config', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        status.textContent = '✓ 已保存';
        fillTunnelConfigForm(j.config);
        const toggle = $('#tun-autorecover-toggle');
        if (toggle) delete toggle.dataset.userEdited;
        toast('配置已保存', 'success');
        setTimeout(() => { status.textContent = ''; }, 3000);
      } else {
        status.textContent = '✗ ' + (j.error || '保存失败');
      }
    } catch (e) {
      status.textContent = '✗ ' + e.message;
    }
  });

  // 标记用户编辑 autoRecover toggle（避免 SSE 推送覆盖）
  on($('#tun-autorecover-toggle'), 'change', (e) => {
    e.target.dataset.userEdited = '1';
  });
  // 同样标记 SRV 相关 toggle 避免 SSE 覆盖
  on($('#tun-cfg-domainEnabled'), 'change', (e) => { e.target.dataset.userEdited = '1'; });
  on($('#tun-cfg-autoDiscover'), 'change', (e) => { e.target.dataset.userEdited = '1'; });

  // **2026-07-03 多隧道**：Push 隧道按钮
  on($('#tun-push-recover-btn'), 'click', async () => {
    const btn = $('#tun-push-recover-btn');
    btn.disabled = true;
    btn.textContent = '恢复中...';
    try {
      const r = await fetch('/api/admin/tunnel-status-push/recover', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() } });
      const j = await r.json();
      if (j.ok) {
        toast(j.message || '推送服务端 STUN 隧道已重启', 'success');
      } else {
        toast('恢复失败：' + (j.error || '未知'), 'error');
      }
    } catch (e) {
      toast('请求失败：' + e.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = '立即重启推送服务端 STUN 隧道';
      fetchTunnelStatus('push');
    }
  });

  on($('#tun-push-ping-btn'), 'click', async () => {
    try {
      const r = await fetch('/api/admin/tunnel-status-push/ping', { method: 'POST', headers: { 'Authorization': 'Bearer ' + getToken() } });
      const j = await r.json();
      if (j.ok) {
        toast('已立即探测推送服务端隧道', 'info');
        renderTunnelStatus(j.status, 'push');
      } else {
        toast('探测失败：' + (j.error || '未知'), 'error');
      }
    } catch (e) {
      toast('请求失败：' + e.message, 'error');
    }
  });

  on($('#tun-push-save-btn'), 'click', async () => {
    const status = $('#tun-push-save-status');
    status.textContent = '保存中...';
    const body = {
      // **2026-07-03 移除**：tunnelPort 字段（穿透通道本地端口已废弃）
      servicePort: parseInt($('#tun-push-cfg-servicePort')?.value, 10) || 23443,
      intervalMs: parseInt($('#tun-push-cfg-intervalMs').value, 10) || 30000,
      recoverBaseUrl: $('#tun-push-cfg-recoverBaseUrl').value.trim(),
      recoverToken: $('#tun-push-cfg-recoverToken').value.trim(),
      recoverStunKey: $('#tun-push-cfg-recoverStunKey').value.trim(),
      recoverStunName: $('#tun-push-cfg-recoverStunName')?.value.trim() || '',
      recoverDelayMs: parseInt($('#tun-push-cfg-recoverDelayMs')?.value, 10) || 1500,
      recoverMinIntervalMs: parseInt($('#tun-push-cfg-recoverMinIntervalMs')?.value, 10) || 300000,
      autoRecover: $('#tun-push-autorecover-toggle').checked,
      enabled: $('#tun-push-cfg-enabled')?.checked !== false,
      domainHost: $('#tun-push-cfg-domainHost')?.value.trim() || '',
      domainPort: parseInt($('#tun-push-cfg-domainPort')?.value, 10) || 0,
      domainEnabled: $('#tun-push-cfg-domainEnabled')?.checked || false,
      srvPrefix: $('#tun-push-cfg-srvPrefix')?.value.trim() || '_hayenai-update._tcp',
    };
    try {
      const r = await fetch('/api/admin/tunnel-status-push/config', {
        method: 'PUT',
        headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.ok) {
        status.textContent = '✓ 已保存';
        fillTunnelConfigForm(j.config, 'push');
        toast('推送服务端隧道配置已保存', 'success');
        setTimeout(() => { status.textContent = ''; }, 3000);
      } else {
        status.textContent = '✗ ' + (j.error || '保存失败');
      }
    } catch (e) {
      status.textContent = '✗ ' + e.message;
    }
  });
  on($('#tun-push-autorecover-toggle'), 'change', (e) => { e.target.dataset.userEdited = '1'; });
  on($('#tun-push-cfg-domainEnabled'), 'change', (e) => { e.target.dataset.userEdited = '1'; });

  // **2026-07-03 多隧道 + 添加隧道**：拉取所有 watcher（mc + push + custom-*），
  //   对 custom-* 动态生成 section + 注册 SSE 事件
  await fetchTunnelWatchers();
}

// ============== 自定义隧道（动态添加 / 渲染，2026-07-03）==============
// 跟踪已渲染的自定义 tunnel id，避免重复插入 section
const _tunCustomRendered = new Set();

// **2026-07-03 改造**：拉取所有 watcher 列表（mc + push + custom-*）
//   - 对 custom-* 渲染一个新 section
//   - mc / push 已经在 HTML 静态部分了，不再额外渲染
async function fetchTunnelWatchers() {
  try {
    const r = await api('/api/admin/tunnel-watchers');
    const list = r.watchers || r.list || [];
    for (const w of list) {
      const tid = w.tunnelId || w.id;
      if (tid === 'mc' || tid === 'push') continue;  // 静态 section
      // 动态生成 section（如未渲染过）
      renderCustomTunnelStatus(tid, w.status || w);
    }
  } catch (e) {
    console.warn('fetchTunnelWatchers failed:', e);
  }
}

// **2026-07-03 改造**：动态生成 custom tunnel section（与 mc / push 完全一样的 UI 风格）
//   - 唯一差异：ID 前缀用 `tun-cust-{tid}-` 而不是 `tun-` 或 `tun-push-`
//   - 状态、配置、操作按钮（保存/探测/恢复/删除）都齐
function customTunnelSectionHTML(tunnelId, label) {
  const pfx = 'tun-cust-' + tunnelId + '-';
  const safeLabel = escapeHtml(label || tunnelId);
  return `
  <header class="page-header page-header-row" style="margin-top:32px">
    <div>
      <h1 class="page-title">${safeLabel} <span class="badge badge-info" style="font-size:11px;vertical-align:middle;margin-left:6px">自定义</span></h1>
      <p class="page-desc" id="${pfx}desc">tunnelId: <code>${escapeHtml(tunnelId)}</code></p>
    </div>
    <div class="page-header-actions">
      <button class="btn btn-secondary" id="${pfx}ping-btn" type="button">立即探测</button>
      <button class="btn btn-primary" id="${pfx}recover-btn" type="button">立即重启 STUN 隧道</button>
      <button class="btn btn-secondary" id="${pfx}delete-btn" type="button" style="color:var(--danger)">删除隧道</button>
    </div>
  </header>

  <div class="stat-grid">
    <div class="stat-card" id="${pfx}card-mc">
      <div class="stat-label"><span id="${pfx}mc-status-dot" class="dot dot-warning"></span>后端服务</div>
      <div class="stat-value" id="${pfx}mc-state">—</div>
      <div class="stat-sub" id="${pfx}mc-addr">—</div>
    </div>
    <div class="stat-card" id="${pfx}card-tunnel">
      <div class="stat-label"><span id="${pfx}tun-status-dot" class="dot dot-warning"></span>公网端口</div>
      <div class="stat-value" id="${pfx}tun-state">—</div>
      <div class="stat-sub" id="${pfx}tun-addr">—</div>
    </div>
    <div class="stat-card" id="${pfx}card-domain">
      <div class="stat-label"><span id="${pfx}domain-status-dot" class="dot dot-warning"></span>外网域名</div>
      <div class="stat-value" id="${pfx}domain-state">—</div>
      <div class="stat-sub" id="${pfx}domain-addr">—</div>
    </div>
  </div>

  <div class="dashboard-grid">
    <div class="panel">
      <div class="panel-header">
        <h2 class="panel-title">实时状态</h2>
        <span class="panel-meta" id="${pfx}banner-meta">—</span>
      </div>
      <div class="panel-body">
        <div class="mcp-status-grid">
          <div class="mcp-status-cell"><div class="mcp-status-label">服务地址</div><div class="mcp-status-value mono" id="${pfx}mc-addr2">—</div></div>
          <div class="mcp-status-cell"><div class="mcp-status-label">服务延迟</div><div class="mcp-status-value" id="${pfx}mc-latency">—</div></div>
          <div class="mcp-status-cell"><div class="mcp-status-label">公网延迟</div><div class="mcp-status-value" id="${pfx}tun-latency">—</div></div>
          <div class="mcp-status-cell"><div class="mcp-status-label">外网 IP</div><div class="mcp-status-value mono" id="${pfx}domain-ip">—</div></div>
          <div class="mcp-status-cell"><div class="mcp-status-label">外网延迟</div><div class="mcp-status-value" id="${pfx}domain-latency">—</div></div>
          <div class="mcp-status-cell"><div class="mcp-status-label">最近探测</div><div class="mcp-status-value" id="${pfx}mc-checked">—</div></div>
        </div>
        <div style="margin-top:12px;font-size:12px;color:var(--text-tertiary)" id="${pfx}port-changed-meta"></div>
      </div>
    </div>

    <div class="panel">
      <div class="panel-header">
        <h2 class="panel-title">autoRecover 自动恢复</h2>
        <span class="panel-meta" id="${pfx}recover-state">关闭</span>
      </div>
      <div class="panel-body">
        <div class="setting-row">
          <div><div class="setting-label">启用 autoRecover</div><div class="setting-desc">公网端口断开时自动调 lucky 重启 STUN 规则</div></div>
          <label class="switch"><input type="checkbox" id="${pfx}autorecover-toggle"><span class="switch-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">探测后端服务端口</div><div class="setting-desc">lucky 转发到的目标服务端口</div></div>
          <input type="number" id="${pfx}cfg-servicePort" class="input-outline mono">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">后端服务地址</div><div class="setting-desc">默认 127.0.0.1</div></div>
          <input type="text" id="${pfx}cfg-serviceHost" class="input-outline mono" value="127.0.0.1">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">公网端口探测源</div><div class="setting-desc">lucky / srv / both</div></div>
          <select id="${pfx}cfg-publicSource" class="select-outline mono">
            <option value="lucky">lucky（推荐）</option>
            <option value="srv">srv</option>
            <option value="both">both</option>
          </select>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">探测周期 (ms)</div><div class="setting-desc">默认 30000</div></div>
          <input type="number" id="${pfx}cfg-intervalMs" class="input-outline mono" value="30000">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">lucky Web admin URL</div><div class="setting-desc">如 http://127.0.0.1:16601/666</div></div>
          <input type="text" id="${pfx}cfg-recoverBaseUrl" class="input-outline mono">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">lucky OpenToken</div></div>
          <input type="text" id="${pfx}cfg-recoverToken" class="input-outline mono">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">STUN 规则 Key</div></div>
          <input type="text" id="${pfx}cfg-recoverStunKey" class="input-outline mono">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">STUN 规则 Name（可选）</div></div>
          <input type="text" id="${pfx}cfg-recoverStunName" class="input-outline mono">
        </div>
        <hr class="setting-divider">
        <div class="setting-row">
          <div><div class="setting-label">🌐 域名主机</div></div>
          <input type="text" id="${pfx}cfg-domainHost" class="input-outline mono">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">SRV 记录前缀</div></div>
          <input type="text" id="${pfx}cfg-srvPrefix" class="input-outline mono" value="_hayenai-update._tcp">
        </div>
        <div class="setting-row">
          <div><div class="setting-label">启用域名探测</div></div>
          <label class="switch"><input type="checkbox" id="${pfx}cfg-domainEnabled"><span class="switch-slider"></span></label>
        </div>
        <div class="setting-row">
          <div><div class="setting-label">启用隧道监控</div></div>
          <label class="switch"><input type="checkbox" id="${pfx}cfg-enabled" checked><span class="switch-slider"></span></label>
        </div>
        <div class="btn-row" style="margin-top:18px">
          <span id="${pfx}save-status" class="form-hint"></span>
          <button class="btn btn-primary" id="${pfx}save-btn" type="button">保存配置</button>
        </div>
      </div>
    </div>
  </div>`;
}

// 渲染或更新一个 custom tunnel section
function renderCustomTunnelStatus(tunnelId, status) {
  if (!tunnelId) return;
  // 1) 还没生成 section → 动态插入
  if (!_tunCustomRendered.has(tunnelId)) {
    const label = (status && status.config && status.config.label) || tunnelId;
    const container = $('#tun-custom-container');
    if (!container) return;
    const wrap = document.createElement('div');
    wrap.id = 'tun-cust-wrap-' + tunnelId;
    wrap.innerHTML = customTunnelSectionHTML(tunnelId, label);
    container.appendChild(wrap);
    _tunCustomRendered.add(tunnelId);
    // 绑定按钮事件
    bindCustomTunnelButtons(tunnelId);
  }
  // 2) 更新 DOM
  updateCustomTunnelDOM(tunnelId, status);
}

// 跟 renderTunnelStatus 完全一样的渲染逻辑，ID 前缀不同
function updateCustomTunnelDOM(tunnelId, status) {
  if (!status) return;
  const pfx = 'tun-cust-' + tunnelId + '-';
  const svc = status.service || status.mc || {};
  const pub = status.public || status.tunnel || {};
  const dom = status.domain || {};
  const cfg = status.config || {};
  // service
  const svcDot = $('#' + pfx + 'mc-status-dot');
  const svcState = $('#' + pfx + 'mc-state');
  if (svcDot) svcDot.className = 'dot ' + (svc.online === true ? 'dot-success' : svc.online === false ? 'dot-error' : 'dot-warning');
  if (svcState) svcState.textContent = svc.online === true ? '运行中' : svc.online === false ? '未连接' : '探测中...';
  const svcAddr = $('#' + pfx + 'mc-addr');
  if (svcAddr) svcAddr.textContent = (svc.host || '—') + ':' + (svc.port || '—');
  const svcAddr2 = $('#' + pfx + 'mc-addr2');
  if (svcAddr2) svcAddr2.textContent = (svc.host || '—') + ':' + (svc.port || '—');
  const svcLat = $('#' + pfx + 'mc-latency');
  if (svcLat) svcLat.textContent = svc.latencyMs != null ? svc.latencyMs + 'ms' : '—';
  const svcChk = $('#' + pfx + 'mc-checked');
  if (svcChk) svcChk.textContent = fmtTimeAgo(svc.lastCheckAt);
  // public port
  const tunDot = $('#' + pfx + 'tun-status-dot');
  const tunState = $('#' + pfx + 'tun-state');
  if (tunDot) tunDot.className = 'dot ' + (pub.online === true ? 'dot-success' : pub.online === false ? 'dot-error' : 'dot-warning');
  if (tunState) tunState.textContent = pub.online === true ? (pub.port ? String(pub.port) : '正常') : pub.online === false ? '断开' : '探测中...';
  const tunAddr = $('#' + pfx + 'tun-addr');
  if (tunAddr) tunAddr.textContent = (pub.host || '—') + ':' + (pub.port || '—') + (pub.source ? ' [' + pub.source + ']' : '');
  const tunLat = $('#' + pfx + 'tun-latency');
  if (tunLat) tunLat.textContent = pub.latencyMs != null ? pub.latencyMs + 'ms' : '—';
  // domain
  const domDot = $('#' + pfx + 'domain-status-dot');
  const domState = $('#' + pfx + 'domain-state');
  if (domDot) domDot.className = 'dot ' + (dom.online === true ? 'dot-success' : dom.online === false ? 'dot-error' : 'dot-warning');
  if (domState) domState.textContent = dom.online === true ? '可访问' : dom.online === false ? '无法访问' : dom.lastError === 'disabled' ? '已禁用' : '探测中...';
  const domAddr = $('#' + pfx + 'domain-addr');
  if (domAddr) domAddr.textContent = (dom.host || '—') + ':' + (dom.port || '—');
  const domIp = $('#' + pfx + 'domain-ip');
  if (domIp) domIp.textContent = dom.resolvedIp || '—';
  const domLat = $('#' + pfx + 'domain-latency');
  if (domLat) domLat.textContent = dom.latencyMs != null ? dom.latencyMs + 'ms' : '—';
  // recover
  const toggle = $('#' + pfx + 'autorecover-toggle');
  if (toggle && document.activeElement !== toggle) toggle.checked = !!cfg.autoRecover;
  const recState = $('#' + pfx + 'recover-state');
  if (recState) {
    recState.textContent = cfg.autoRecover ? '已启用' : '关闭';
    recState.style.color = cfg.autoRecover ? 'var(--success)' : 'var(--text-secondary)';
  }
  const banner = $('#' + pfx + 'banner-meta');
  if (banner) banner.textContent = '最近探测 ' + fmtTimeAgo(svc.lastCheckAt || Date.now());
  // public port history hint
  if (status.publicPortChangedAt) {
    const hist = (status.publicPortHistory || []).slice(-3);
    const last = hist[hist.length - 1];
    const prev = hist[hist.length - 2];
    const el = $('#' + pfx + 'port-changed-meta');
    if (el) {
      if (last && prev) {
        el.textContent = '公网端口 ' + prev.port + ' → ' + last.port + '（' + fmtTimeAgo(status.publicPortChangedAt) + '）';
        el.style.color = 'var(--warning)';
      } else if (last) {
        el.textContent = '当前公网端口 ' + last.port;
      }
    }
  }
  // 填入 config 表单（仅在没用户编辑时）
  fillCustomTunnelConfigForm(tunnelId, cfg);
}

// 填 custom tunnel 的配置表单
function fillCustomTunnelConfigForm(tunnelId, cfg) {
  if (!cfg) return;
  const pfx = 'tun-cust-' + tunnelId + '-';
  const setVal = (id, v) => { const el = $('#' + id); if (el && document.activeElement !== el) el.value = v == null ? '' : v; };
  const setCheck = (id, v) => { const el = $('#' + id); if (el && document.activeElement !== el) el.checked = !!v; };
  setVal(pfx + 'cfg-servicePort', cfg.servicePort);
  setVal(pfx + 'cfg-serviceHost', cfg.serviceHost || '127.0.0.1');
  setVal(pfx + 'cfg-publicSource', cfg.publicSource || 'lucky');
  setVal(pfx + 'cfg-intervalMs', cfg.intervalMs);
  setVal(pfx + 'cfg-recoverBaseUrl', cfg.recoverBaseUrl);
  setVal(pfx + 'cfg-recoverToken', cfg.recoverToken);
  setVal(pfx + 'cfg-recoverStunKey', cfg.recoverStunKey);
  setVal(pfx + 'cfg-recoverStunName', cfg.recoverStunName);
  setVal(pfx + 'cfg-domainHost', cfg.domainHost);
  setVal(pfx + 'cfg-srvPrefix', cfg.srvPrefix || '_hayenai-update._tcp');
  setCheck(pfx + 'cfg-domainEnabled', cfg.domainEnabled);
  setCheck(pfx + 'cfg-enabled', cfg.enabled !== false);
}

// 绑定 custom tunnel 的 4 个操作按钮
function bindCustomTunnelButtons(tunnelId) {
  const pfx = 'tun-cust-' + tunnelId + '-';
  on($('#' + pfx + 'recover-btn'), 'click', () => recoverCustomTunnel(tunnelId));
  on($('#' + pfx + 'ping-btn'), 'click', () => pingCustomTunnel(tunnelId));
  on($('#' + pfx + 'save-btn'), 'click', () => saveCustomTunnel(tunnelId));
  on($('#' + pfx + 'delete-btn'), 'click', () => deleteCustomTunnel(tunnelId));
}

async function recoverCustomTunnel(tunnelId) {
  try {
    const r = await api('/api/admin/tunnel-watchers/' + encodeURIComponent(tunnelId) + '/recover', { method: 'POST' });
    toast(r.ok ? (r.message || 'STUN 隧道已触发恢复') : ('恢复失败：' + (r.error || '未知')), r.ok ? 'success' : 'error');
  } catch (e) { toast('请求失败：' + e.message, 'error'); }
}

async function pingCustomTunnel(tunnelId) {
  try {
    const r = await api('/api/admin/tunnel-watchers/' + encodeURIComponent(tunnelId) + '/ping', { method: 'POST' });
    if (r && r.status) renderCustomTunnelStatus(tunnelId, r.status);
    toast('已立即探测', 'info');
  } catch (e) { toast('探测失败：' + e.message, 'error'); }
}

async function saveCustomTunnel(tunnelId) {
  const pfx = 'tun-cust-' + tunnelId + '-';
  const status = $('#' + pfx + 'save-status');
  if (status) status.textContent = '保存中...';
  const body = {
    servicePort: parseInt($('#' + pfx + 'cfg-servicePort').value, 10) || 0,
    serviceHost: ($('#' + pfx + 'cfg-serviceHost').value || '127.0.0.1').trim(),
    publicSource: $('#' + pfx + 'cfg-publicSource').value || 'lucky',
    intervalMs: parseInt($('#' + pfx + 'cfg-intervalMs').value, 10) || 30000,
    recoverBaseUrl: $('#' + pfx + 'cfg-recoverBaseUrl').value.trim(),
    recoverToken: $('#' + pfx + 'cfg-recoverToken').value.trim(),
    recoverStunKey: $('#' + pfx + 'cfg-recoverStunKey').value.trim(),
    recoverStunName: $('#' + pfx + 'cfg-recoverStunName').value.trim(),
    autoRecover: $('#' + pfx + 'autorecover-toggle').checked,
    enabled: $('#' + pfx + 'cfg-enabled').checked,
    domainHost: $('#' + pfx + 'cfg-domainHost').value.trim(),
    domainPort: parseInt($('#' + pfx + 'cfg-domainPort').value, 10) || 0,
    domainEnabled: $('#' + pfx + 'cfg-domainEnabled').checked,
    srvPrefix: $('#' + pfx + 'cfg-srvPrefix').value.trim() || '_hayenai-update._tcp',
  };
  try {
    const r = await api('/api/admin/tunnel-watchers/' + encodeURIComponent(tunnelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      if (status) status.textContent = '✓ 已保存';
      toast('配置已保存', 'success');
      setTimeout(() => { if (status) status.textContent = ''; }, 3000);
    } else {
      if (status) status.textContent = '✗ ' + (r.error || '保存失败');
    }
  } catch (e) {
    if (status) status.textContent = '✗ ' + e.message;
  }
}

async function deleteCustomTunnel(tunnelId) {
  const ok = await confirmModal({
    title: '删除隧道',
    msg: `确认删除自定义隧道 <b>${escapeHtml(tunnelId)}</b>？<br>settings.tunnelWatchers.${escapeHtml(tunnelId)} 会被移除，lucky STUN 不会自动关闭。`,
    okText: '删除',
  });
  if (!ok) return;
  try {
    await api('/api/admin/tunnel-watchers/' + encodeURIComponent(tunnelId), { method: 'DELETE' });
    // 移除 DOM
    const wrap = $('#tun-cust-wrap-' + tunnelId);
    if (wrap) wrap.remove();
    _tunCustomRendered.delete(tunnelId);
    toast('已删除', 'success');
  } catch (e) { toast('删除失败：' + e.message, 'error'); }
}

// ============== 添加隧道弹窗（2026-07-03 完善）==============
// modal HTML 在 index.html 末尾，函数内只控制显隐 + 提交
async function openAddTunnelModal() {
  // 重置表单
  const ids = ['tun-add-id', 'tun-add-label', 'tun-add-servicePort', 'tun-add-serviceHost',
    'tun-add-domainHost', 'tun-add-srvPrefix', 'tun-add-recoverStunKey', 'tun-add-recoverStunName',
    'tun-add-recoverBaseUrl', 'tun-add-recoverToken', 'tun-add-recoverDelayMs',
    'tun-add-recoverMinIntervalMs', 'tun-add-intervalMs', 'tun-add-timeoutMs'];
  ids.forEach((id) => {
    const el = $('#' + id);
    if (el) el.value = el.defaultValue || '';
  });
  const status = $('#tun-add-status');
  if (status) status.textContent = '';
  const testResult = $('#tun-add-test-result');
  if (testResult) { testResult.hidden = true; testResult.innerHTML = ''; testResult.className = 'test-result'; }
  const autoCb = $('#tun-add-autoRecover');
  if (autoCb) autoCb.checked = true;
  const domCb = $('#tun-add-domainEnabled');
  if (domCb) domCb.checked = false;
  const copySel = $('#tun-add-copy-from');
  if (copySel) copySel.value = '';
  const modal = $('#tun-add-modal');
  if (modal) modal.hidden = false;
  bindAddTunnelCopyHandler(); // **2026-07-03 新增**：绑定「从现有隧道复制」change handler
  setTimeout(() => $('#tun-add-id')?.focus(), 80);
}

function closeAddTunnelModal() {
  const modal = $('#tun-add-modal');
  if (modal) modal.hidden = true;
}

// **2026-07-03 新增**：从 mc / push 复制配置
async function copyTunnelConfig(sourceId) {
  if (!sourceId) return;
  try {
    const r = await api('/api/admin/tunnel-watchers/' + encodeURIComponent(sourceId) + '/copy-config');
    if (!r.ok || !r.config) {
      if (status = $('#tun-add-status')) status.textContent = '✗ 复制失败: ' + (r.error || 'unknown');
      return;
    }
    const c = r.config;
    const setVal = (id, v) => { const el = $('#' + id); if (el != null) el.value = v == null ? '' : String(v); };
    setVal('tun-add-label', c.label);
    setVal('tun-add-serviceHost', c.serviceHost);
    setVal('tun-add-servicePort', c.servicePort);
    setVal('tun-add-domainHost', c.domainHost);
    setVal('tun-add-srvPrefix', c.srvPrefix);
    setVal('tun-add-recoverStunKey', c.recoverStunKey);
    setVal('tun-add-recoverStunName', c.recoverStunName);
    setVal('tun-add-recoverBaseUrl', c.recoverBaseUrl);
    setVal('tun-add-recoverToken', c.recoverToken);
    setVal('tun-add-recoverDelayMs', c.recoverDelayMs);
    setVal('tun-add-recoverMinIntervalMs', c.recoverMinIntervalMs);
    setVal('tun-add-intervalMs', c.intervalMs);
    setVal('tun-add-timeoutMs', c.timeoutMs);
    const ps = $('#tun-add-publicSource'); if (ps) ps.value = c.publicSource || 'lucky';
    const ar = $('#tun-add-autoRecover'); if (ar) ar.checked = !!c.autoRecover;
    const de = $('#tun-add-domainEnabled'); if (de) de.checked = !!c.domainEnabled;
    const status = $('#tun-add-status');
    if (status) status.textContent = `✓ 已从 ${sourceId} 复制（请改 ID 和端口）`;
    // 自动聚焦到 ID 输入框，提示用户改
    setTimeout(() => $('#tun-add-id')?.focus(), 100);
  } catch (e) {
    const status = $('#tun-add-status');
    if (status) status.textContent = '✗ 复制失败: ' + (e?.message || e);
  }
}

// **2026-07-03 新增**：测试连接（调后端 test-connection 验证 lucky URL + token + STUN key）
async function testAddTunnelConnection() {
  const status = $('#tun-add-status');
  const result = $('#tun-add-test-result');
  const btn = $('#tun-add-test-btn');
  const recoverBaseUrl = ($('#tun-add-recoverBaseUrl')?.value || '').trim();
  const recoverToken = ($('#tun-add-recoverToken')?.value || '').trim();
  const recoverStunKey = ($('#tun-add-recoverStunKey')?.value || '').trim();
  const recoverStunName = ($('#tun-add-recoverStunName')?.value || '').trim();
  if (!recoverBaseUrl || !recoverToken || !recoverStunKey) {
    if (status) status.textContent = '✗ 请先填 lucky URL / Token / STUN Key';
    return;
  }
  if (result) { result.hidden = false; result.className = 'test-result'; result.innerHTML = '🔄 正在测试 lucky 连接 + STUN 规则…'; }
  if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
  if (status) status.textContent = '';
  try {
    const r = await api('/api/admin/tunnel-watchers/test-connection', {
      method: 'POST',
      body: { recoverBaseUrl, recoverToken, recoverStunKey, recoverStunName },
    });
    if (r.ok && r.publicPort) {
      if (result) {
        result.className = 'test-result test-ok';
        result.innerHTML = `✓ <b>连接成功</b> · STUN 规则 <span class="mono">${r.stunName || recoverStunKey}</span> · 公网地址 <span class="test-port">${r.publicAddr || '?'}</span> · 端口 <span class="test-port">${r.publicPort}</span><br><span class="muted">${r.hint || ''}</span>`;
      }
      if (status) status.textContent = '✓ lucky 可达且 STUN 已上线';
    } else if (r.ok && !r.publicPort) {
      if (result) {
        result.className = 'test-result test-fail';
        result.innerHTML = `⚠️ lucky 可达但 STUN 还没拿到公网端口 · 规则 <span class="mono">${r.stunName || recoverStunKey}</span><br><span class="muted">${r.hint || ''}</span>`;
      }
    } else {
      if (result) {
        result.className = 'test-result test-fail';
        result.innerHTML = `✗ <b>连接失败</b> · ${r.error || 'unknown'}<br><span class="muted">${r.hint || '检查 lucky URL / Token / STUN Key'}</span>`;
      }
      if (status) status.textContent = '✗ ' + (r.error || '连接失败');
    }
  } catch (e) {
    if (result) { result.className = 'test-result test-fail'; result.innerHTML = '✗ ' + (e?.message || e); }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔌 测试连接'; }
  }
}

async function submitAddTunnel() {
  const status = $('#tun-add-status');
  const tunnelId = ($('#tun-add-id')?.value || '').trim();
  if (!tunnelId) {
    if (status) status.textContent = '✗ 隧道 ID 必填';
    return;
  }
  if (!/^[a-zA-Z0-9_\-]{1,40}$/.test(tunnelId)) {
    if (status) status.textContent = '✗ ID 只能含字母/数字/_/-，最长 40 字符';
    return;
  }
  if (tunnelId === 'mc' || tunnelId === 'push') {
    if (status) status.textContent = '✗ mc / push 是保留 ID，请用其它名字';
    return;
  }
  const servicePort = parseInt($('#tun-add-servicePort')?.value, 10) || 0;
  if (!servicePort || servicePort < 1 || servicePort > 65535) {
    if (status) status.textContent = '✗ 后端服务端口必填（1-65535）';
    return;
  }
  const recoverStunKey = ($('#tun-add-recoverStunKey')?.value || '').trim();
  if (!recoverStunKey) {
    if (status) status.textContent = '✗ lucky STUN 规则 Key 必填';
    return;
  }
  const recoverBaseUrl = ($('#tun-add-recoverBaseUrl')?.value || '').trim();
  if (!recoverBaseUrl) {
    if (status) status.textContent = '✗ lucky Web admin URL 必填';
    return;
  }
  const recoverToken = ($('#tun-add-recoverToken')?.value || '').trim();
  if (!recoverToken) {
    if (status) status.textContent = '✗ lucky OpenToken 必填';
    return;
  }
  if (status) status.textContent = '提交中...';
  const num = (id) => { const v = parseInt($('#' + id)?.value, 10); return isNaN(v) || v <= 0 ? null : v; };
  const body = {
    serviceHost: ($('#tun-add-serviceHost')?.value || '127.0.0.1').trim(),
    servicePort,
    domainHost: ($('#tun-add-domainHost')?.value || '').trim(),
    srvPrefix: ($('#tun-add-srvPrefix')?.value || '_hayenai-update._tcp').trim(),
    domainPort: 0, // **2026-07-03**：公网端口动态变化，强制走 SRV
    publicSource: $('#tun-add-publicSource')?.value || 'lucky',
    recoverStunKey,
    recoverStunName: ($('#tun-add-recoverStunName')?.value || '').trim(),
    recoverBaseUrl,
    recoverToken,
    autoRecover: !!$('#tun-add-autoRecover')?.checked,
    domainEnabled: !!$('#tun-add-domainEnabled')?.checked,
    label: ($('#tun-add-label')?.value || '').trim() || tunnelId,
    // **2026-07-03 新增**：恢复/探测配置
    recoverDelayMs: num('tun-add-recoverDelayMs'),
    recoverMinIntervalMs: num('tun-add-recoverMinIntervalMs'),
    intervalMs: num('tun-add-intervalMs'),
    timeoutMs: num('tun-add-timeoutMs'),
  };
  try {
    const r = await api('/api/admin/tunnel-watchers/' + encodeURIComponent(tunnelId), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (r.ok) {
      if (status) status.textContent = '✓ 已添加';
      toast(`隧道 ${tunnelId} 已添加`, 'success');
      setTimeout(() => {
        closeAddTunnelModal();
        _tunCustomRendered.clear();
        const container = $('#tun-custom-container');
        if (container) container.innerHTML = '';
        fetchTunnelWatchers();
      }, 600);
    } else {
      if (status) status.textContent = '✗ ' + (r.error || '添加失败');
    }
  } catch (e) {
    if (status) status.textContent = '✗ ' + e.message;
  }
}

// **2026-07-03 新增**：绑定「从 mc / push 复制」change handler（在 DOMContentLoaded 或 openAddTunnelModal 调一次即可）
function bindAddTunnelCopyHandler() {
  const sel = $('#tun-add-copy-from');
  if (!sel || sel._boundCopy) return;
  sel._boundCopy = true;
  on(sel, 'change', (e) => {
    const v = e.target.value;
    if (v) copyTunnelConfig(v);
    e.target.value = ''; // 重置回 placeholder
  });
}

// ============== 启动 ==============

// **2026-07-03 全局错误兜底**：把 unhandledrejection / error 显示成 toast
//   - 之前 FCM 页面空白就是 Promise 抛错被吞了，没任何反馈
//   - 现在任何未捕获错误都显示到右下角 toast，方便用户反馈
window.addEventListener('unhandledrejection', (e) => {
  const msg = e?.reason?.message || e?.reason?.toString() || String(e?.reason || e);
  console.error('[unhandledrejection]', e.reason);
  try { showToast('⚠️ JS 错误: ' + msg.slice(0, 200), 'error', 8000); } catch {}
});
window.addEventListener('error', (e) => {
  const msg = e?.message || String(e);
  console.error('[window.error]', e);
  try { showToast('⚠️ 错误: ' + msg.slice(0, 200), 'error', 8000); } catch {}
});

window.addEventListener('DOMContentLoaded', async () => {
  // 恢复主题
  const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  applyTheme(savedTheme);
  const savedAccent = localStorage.getItem(ACCENT_KEY) || '#7C3AED';
  applyAccent(savedAccent);

  // 绑定鉴权事件
  on($('#auth-submit'), 'click', doLogin);
  on($('#auth-token'), 'keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  on($('#auth-toggle'), 'click', () => {
    const inp = $('#auth-token');
    inp.type = inp.type === 'password' ? 'text' : 'password';
  });

  // 自动登录
  if (await tryAutoLogin()) {
    showApp();
  } else {
    showAuth();
  }
});

// ====================== FCM 推送测试页（2026-07-03 新增）======================
let _fcmHistory = [];
let _fcmPollingTimer = null;
async function loadFcmTestPage() {
  // 防御性 try/catch —— 任何子调用失败都不阻塞页面显示
  try {
    await Promise.all([refreshFcmStatus(), refreshFcmDevices()]);
  } catch (e) {
    console.error('[fcm-test] init failed:', e);
  }
  // **2026-07-04 优化**：polling 改成 15s（原 5s 太频繁拖慢 webui）
  //   - 设备列表空时 5s 快轮询（等新设备）
  //   - 有设备后 15s 慢轮询
  if (_fcmPollingTimer) clearInterval(_fcmPollingTimer);
  const _pollingFcmTick = async () => {
    try { await refreshFcmDevices(); } catch {}
    try { await refreshFcmStatus(); } catch {}
    // 动态调整间隔
    const devCount = parseInt($('#fcm-stat-devices')?.textContent || '0', 10);
    const interval = devCount === 0 ? 5000 : 15000;
    if (_fcmPollingTimer) {
      clearInterval(_fcmPollingTimer);
      _fcmPollingTimer = setInterval(_pollingFcmTick, interval);
    }
  };
  _fcmPollingTimer = setInterval(_pollingFcmTick, 5000);
  // 离开页面时清掉 timer
  const stopPolling = () => {
    if (_fcmPollingTimer) { clearInterval(_fcmPollingTimer); _fcmPollingTimer = null; }
    document.removeEventListener('visibilitychange', onVis);
  };
  const onVis = () => { if (document.hidden) stopPolling(); else if (currentPage === 'fcmtest') loadFcmTestPage(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('hashchange', stopPolling, { once: true });
  // 即使 status/devices 拉取失败，也要绑定按钮 + 渲染表单
  bindFcmTestPage();
}

function bindFcmTestPage() {
  const dataInput = $('#fcm-data-input');
  if (dataInput && (!dataInput.value || /"ts":""/.test(dataInput.value))) {
    dataInput.value = JSON.stringify({ type: 'test', ts: String(Date.now()) });
  }
  on($('#fcm-send-btn'), 'click', sendFcm);
  on($('#fcm-broadcast-btn'), 'click', broadcastFcm);
  on($('#fcm-refresh-devices-btn'), 'click', async () => {
    try {
      await refreshFcmDevices();
      showToast('已刷新', 'success');
    } catch (e) {
      showToast('刷新失败: ' + (e?.message || e), 'error');
    }
  });
  on($('#fcm-device-select'), 'change', (e) => {
    const v = e.target.value;
    if (v) $('#fcm-token-input').value = v;
  });
  // **2026-07-03 新增**：手动注册 FCM token（客户端 initFcm 失败时调试用）
  on($('#fcm-manual-register-btn'), 'click', async () => {
    const token = ($('#fcm-manual-token-input')?.value || '').trim();
    const note = ($('#fcm-manual-note-input')?.value || '').trim();
    const appVersion = ($('#fcm-manual-appver-input')?.value || '').trim();
    if (!token || token.length < 10) {
      showToast('请填写有效的 FCM token（>=10 字符）', 'error');
      $('#fcm-manual-token-input')?.focus();
      return;
    }
    const btn = $('#fcm-manual-register-btn');
    if (btn) { btn.disabled = true; btn.textContent = '注册中…'; }
    try {
      const r = await api('/api/admin/fcm/devices', {
        method: 'POST',
        body: { token, platform: 'android', appVersion, note },
      });
      if (r && r.ok) {
        showToast('设备已注册（' + (r.device?.deviceId || r.device?.token?.slice(0, 12) || 'ok') + '）', 'success');
        $('#fcm-manual-token-input').value = '';
        await refreshFcmDevices();
        await refreshFcmStatus();
      } else {
        showToast('注册失败: ' + (r?.error || 'unknown'), 'error');
      }
    } catch (e) {
      showToast('注册失败: ' + (e?.message || e), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '📝 注册设备'; }
    }
  });
  on($('#fcm-manual-clear-btn'), 'click', () => {
    if ($('#fcm-manual-token-input')) $('#fcm-manual-token-input').value = '';
    if ($('#fcm-manual-note-input')) $('#fcm-manual-note-input').value = '手动注册';
    if ($('#fcm-manual-appver-input')) $('#fcm-manual-appver-input').value = '';
    showToast('已清空', 'info');
  });
  // **2026-07-03 新增**：FCM HTTP 代理配置（解决国内直连 Google 被 GFW 阻断）
  on($('#fcm-proxy-save-btn'), 'click', async () => {
    const input = $('#fcm-proxy-input');
    const url = (input?.value || '').trim();
    if (url && !/^https?:\/\//i.test(url)) {
      showToast('代理 URL 必须以 http:// 或 https:// 开头', 'error');
      return;
    }
    const btn = $('#fcm-proxy-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    try {
      const r = await api('/api/admin/fcm/proxy', { method: 'POST', body: { proxyUrl: url } });
      if (r && r.ok) {
        showToast(r.cleared ? '已清空代理（直连 Google）' : '已保存代理', 'success');
        await refreshFcmStatus();
      } else {
        showToast('保存失败: ' + (r?.error || 'unknown'), 'error');
      }
    } catch (e) {
      showToast('保存失败: ' + (e?.message || e), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 保存'; }
    }
  });
  on($('#fcm-proxy-test-btn'), 'click', async () => {
    const url = ($('#fcm-proxy-input')?.value || '').trim();
    if (!url) { showToast('先填代理 URL', 'error'); return; }
    const result = $('#fcm-proxy-test-result');
    const btn = $('#fcm-proxy-test-btn');
    if (result) { result.hidden = false; result.className = 'test-result'; result.innerHTML = '🔄 正在调 Google OAuth2 测试代理连通…'; }
    if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
    // **2026-07-03 修复**：先临时保存，再发送一次测试推送
    //   简化：先 GET 拿当前代理，临时设这个测试值，调一个无操作端点（fcm.status 不会触发 OAuth2）
    //   实际上验证代理要调 fcm.send/broadcast 才会真发 OAuth2 → 这里用一个轻量端点：
    //   POST /api/admin/fcm/proxy 先保存，再 POST /api/admin/fcm/send 试发（用第一个 device 的 token）
    try {
      await api('/api/admin/fcm/proxy', { method: 'POST', body: { proxyUrl: url } });
      // 用第一个设备 token 发一条测试
      const devs = await api('/api/admin/fcm/devices');
      if (!devs.devices || devs.devices.length === 0) {
        if (result) { result.className = 'test-result test-fail'; result.innerHTML = '⚠️ 没有可测试的设备（先注册一个）'; }
        return;
      }
      // 找一个最像真 token 的设备（>=100 字符 base64 随机）
      const realDev = devs.devices.find((d) => d.token && d.token.length >= 100) || devs.devices[0];
      const sendR = await api('/api/admin/fcm/send', {
        method: 'POST',
        body: { token: realDev.token, title: '代理测试', body: '代理连通性测试', data: { type: 'proxy-test', ts: String(Date.now()) } },
      });
      await refreshFcmStatus(); // 恢复 stat 显示
      if (sendR && sendR.ok) {
        if (result) { result.className = 'test-result test-ok'; result.innerHTML = `✓ 代理可用！推送成功：<span class="mono">${sendR.messageId || 'ok'}</span><br><span class="muted">已临时设代理 + 给设备发测试推送</span>`; }
      } else {
        if (result) { result.className = 'test-result test-fail'; result.innerHTML = `✗ 代理不可用 · <span class="mono">${sendR?.error || 'unknown'}</span><br><span class="muted">检查代理 URL（http://host:port）是否能连 Google</span>`; }
      }
    } catch (e) {
      if (result) { result.className = 'test-result test-fail'; result.innerHTML = '✗ ' + (e?.message || e); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔌 测试'; }
      await refreshFcmStatus();
    }
  });
  // **2026-07-03 新增**：加载当前代理配置到输入框
  (async () => {
    try {
      const r = await api('/api/admin/fcm/proxy');
      if (r && r.source != null) {
        const input = $('#fcm-proxy-input');
        if (input) input.value = r.source || '';
      }
    } catch (_) {}
  })();

  // **2026-07-03 新增**：Cloudflare Worker 中转配置（解决 GFW 阻断 FCM）
  // 优势：SEA 只连 Cloudflare 边缘（国内可达），Worker 走 Cloudflare 网络到 Google
  on($('#fcm-worker-save-btn'), 'click', async () => {
    const urlInput = $('#fcm-worker-url-input');
    const keyInput = $('#fcm-worker-key-input');
    const workerUrl = (urlInput?.value || '').trim();
    const apiKey = (keyInput?.value || '').trim();
    if (workerUrl && !/^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(workerUrl)) {
      showToast('Worker URL 必须是 https:// 开头格式', 'error');
      return;
    }
    if (workerUrl && !apiKey) {
      showToast('Worker URL 已填，API Key 必填', 'error');
      return;
    }
    const btn = $('#fcm-worker-save-btn');
    if (btn) { btn.disabled = true; btn.textContent = '保存中…'; }
    try {
      const r = await api('/api/admin/fcm/worker', { method: 'POST', body: { workerUrl, apiKey } });
      if (r && r.ok) {
        showToast(r.cleared ? '已清空 Worker（直连 Google）' : '已保存 Worker 中转', 'success');
        if (r.cleared && keyInput) keyInput.value = '';
        await refreshFcmStatus();
      } else {
        showToast('保存失败: ' + (r?.error || 'unknown'), 'error');
      }
    } catch (e) {
      showToast('保存失败: ' + (e?.message || e), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '💾 保存'; }
    }
  });
  on($('#fcm-worker-test-btn'), 'click', async () => {
    const result = $('#fcm-worker-test-result');
    const btn = $('#fcm-worker-test-btn');
    if (result) { result.hidden = false; result.className = 'test-result'; result.innerHTML = '🔄 正在测试 Worker 连通性…'; }
    if (btn) { btn.disabled = true; btn.textContent = '测试中…'; }
    try {
      // 先调 /test 端点验证连通
      const r = await api('/api/admin/fcm/worker/test', { method: 'POST' });
      if (r && r.ok && r.body && r.body.ok) {
        const sa = r.body.hasSA ? '✓ 已配' : '✗ 缺失';
        const key = r.body.hasKey ? '✓ 已配' : '✗ 缺失';
        if (result) {
          result.className = 'test-result test-ok';
          result.innerHTML = `✓ Worker 连通！<br>SERVICE_ACCOUNT: ${sa}<br>API_KEY: ${key}<br><span class="muted">可以推送了</span>`;
        }
      } else {
        if (result) {
          result.className = 'test-result test-fail';
          result.innerHTML = `✗ Worker 不可达 · HTTP ${r?.statusCode || '?'}<br><span class="mono">${r?.error || r?.body || 'unknown'}</span>`;
        }
      }
    } catch (e) {
      if (result) { result.className = 'test-result test-fail'; result.innerHTML = '✗ ' + (e?.message || e); }
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '🔌 测试连通'; }
    }
  });
  // 加载当前 Worker 配置
  (async () => {
    try {
      const r = await api('/api/admin/fcm/worker');
      if (r && r.source != null) {
        const urlInput = $('#fcm-worker-url-input');
        if (urlInput) urlInput.value = r.source || '';
        // API Key 不返回（安全），留空让用户重新填
      }
    } catch (_) {}
  })();
  // 注意：stat 状态（configured / dot）由 refreshFcmStatus() 设置
  // 之前这里在 bindFcmTestPage() 里强制覆盖成 "⏳ 加载中..." + warning，
  // 但 loadFcmTestPage 已经在 await 之后才调 bindFcmTestPage，会覆盖 refreshFcmStatus 的成功结果
  // → 2026-07-03 修复：删掉这段覆盖
}

async function refreshFcmStatus() {
  try {
    const r = await api('/api/admin/fcm/status');
    const el = $('#fcm-stat-configured');
    const dot = $('#fcm-stat-dot');
    if (r.configured) {
      if (el) el.textContent = '✅ 已配置';
      if (dot) dot.className = 'dot dot-success';
    } else {
      if (el) el.textContent = '❌ 未配置';
      if (dot) dot.className = 'dot dot-error';
    }
    const proj = $('#fcm-stat-projectid');
    if (proj) proj.textContent = r.projectId ? ('项目 ' + r.projectId) : '—';
    const devs = $('#fcm-stat-devices');
    if (devs) devs.textContent = String(r.deviceCount || 0);
    // **2026-07-03 新增**：代理状态显示在 stat-card
    const proxyEl = $('#fcm-stat-proxy');
    const proxyDot = $('#fcm-stat-proxy-dot');
    const proxySub = $('#fcm-stat-proxy-sub');
    const hasProxy = r.proxy && /已配置/.test(r.proxy);
    if (proxyEl) proxyEl.textContent = hasProxy ? '✅ 已配代理' : '⚠️ 未配代理';
    if (proxyEl) proxyEl.style.color = hasProxy ? '#22c55e' : '#f59e0b';
    if (proxyDot) proxyDot.className = 'dot ' + (hasProxy ? 'dot-success' : 'dot-warning');
    if (proxySub) proxySub.textContent = hasProxy ? '走 HTTP 代理连 Google' : '国内直连会被 GFW 阻断';
  } catch (e) {
    const el = $('#fcm-stat-configured');
    if (el) el.textContent = '加载失败';
    const dot = $('#fcm-stat-dot');
    if (dot) dot.className = 'dot dot-error';
  }
}

async function refreshFcmDevices() {
  const list = $('#fcm-device-list');
  const sel = $('#fcm-device-select');
  try {
    const r = await api('/api/admin/fcm/devices');
    const devices = r.devices || [];
    $('#fcm-stat-devices').textContent = String(devices.length);
    $('#fcm-device-count-label').textContent = '(' + devices.length + ')';
    if (devices.length === 0) {
      list.innerHTML = '<div class="fcm-empty">暂无设备注册<br><small>app 启动后会自动注册 token</small></div>';
    } else {
      list.innerHTML = devices.map((d) => {
        const ago = fmtTimeAgo(d.lastSeenAt);
        const tokShort = d.token.slice(0, 16) + '...' + d.token.slice(-8);
        return '<div class="fcm-device-item" data-token="' + escapeHtml(d.token) + '">' +
          '<div class="fcm-device-row1">' +
            '<code>' + escapeHtml(tokShort) + '</code>' +
            '<button class="btn-tiny fcm-device-del" data-token="' + escapeHtml(d.token) + '" title="删除">×</button>' +
          '</div>' +
          '<div class="fcm-device-row2">' +
            '<span class="muted">' + escapeHtml(d.platform || '?') + '</span>' +
            '<span class="muted">v' + escapeHtml(d.appVersion || '?') + '</span>' +
            '<span class="muted">' + ago + '</span>' +
            '<span class="muted">注册 ' + (d.registerCount || 1) + ' 次</span>' +
          '</div>' +
        '</div>';
      }).join('');
      $$('.fcm-device-del').forEach((b) => {
        on(b, 'click', async (e) => {
          e.stopPropagation();
          const t = b.getAttribute('data-token');
          if (!confirm('删除此设备？')) return;
          try {
            await api('/api/admin/fcm/devices/' + encodeURIComponent(t), { method: 'DELETE' });
            showToast('已删除', 'success');
            await refreshFcmDevices();
          } catch (err) {
            showToast('删除失败: ' + err.message, 'error');
          }
        });
      });
      $$('.fcm-device-item').forEach((it) => {
        on(it, 'click', () => {
          const t = it.getAttribute('data-token');
          $('#fcm-token-input').value = t;
          sel.value = t;
          showToast('已填入 token', 'success');
        });
      });
    }
    sel.innerHTML = '<option value="">— 选择已注册设备 —</option>' +
      devices.map((d) => {
        const ago = fmtTimeAgo(d.lastSeenAt);
        return '<option value="' + escapeHtml(d.token) + '">' + escapeHtml(d.platform || '?') + ' · v' + escapeHtml(d.appVersion || '?') + ' · ' + ago + ' · ' + d.token.slice(0, 12) + '...</option>';
      }).join('');
  } catch (e) {
    list.innerHTML = '<div class="fcm-empty">加载失败</div>';
  }
}

function buildFcmPayload() {
  const title = ($('#fcm-title-input').value || '').trim();
  const body = ($('#fcm-body-input').value || '').trim();
  const channelId = ($('#fcm-channel-input').value || 'hayenai_default').trim();
  const dataRaw = ($('#fcm-data-input').value || '').trim();
  let data = {};
  if (dataRaw) {
    try {
      data = JSON.parse(dataRaw);
    } catch (e) {
      throw new Error('data JSON 解析失败: ' + e.message);
    }
  }
  data.ts = data.ts || String(Date.now());
  if (!title) throw new Error('标题必填');
  return { title, body, data, channelId };
}

async function sendFcm() {
  const btn = $('#fcm-send-btn');
  let payload;
  try { payload = buildFcmPayload(); } catch (e) { showToast(e.message, 'error'); return; }
  const token = ($('#fcm-token-input').value || '').trim();
  if (!token) {
    showToast('请选择设备或填写 token', 'error');
    return;
  }
  btn.disabled = true;
  btn.textContent = '发送中...';
  try {
    const r = await api('/api/admin/fcm/send', {
      method: 'POST',
      body: JSON.stringify({ token: token, ...payload }),
    });
    if (r.ok) {
      showToast('✅ 已发送: ' + (r.messageId || ''), 'success');
      addFcmHistory({ ok: true, title: payload.title, body: payload.body, token: token.slice(0, 16) + '...', messageId: r.messageId, ts: Date.now() });
    } else {
      showToast('❌ 失败: ' + r.error, 'error');
      addFcmHistory({ ok: false, title: payload.title, body: payload.body, token: token.slice(0, 16) + '...', error: r.error, ts: Date.now() });
    }
  } catch (e) {
    showToast('❌ 异常: ' + e.message, 'error');
    addFcmHistory({ ok: false, title: payload.title, body: payload.body, token: token.slice(0, 16) + '...', error: e.message, ts: Date.now() });
  } finally {
    btn.disabled = false;
    btn.textContent = '🚀 发送';
  }
}

async function broadcastFcm() {
  const btn = $('#fcm-broadcast-btn');
  let payload;
  try { payload = buildFcmPayload(); } catch (e) { showToast(e.message, 'error'); return; }
  btn.disabled = true;
  btn.textContent = '广播中...';
  try {
    const r = await api('/api/admin/fcm/broadcast', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (r.ok) {
      showToast('✅ 广播完成: ' + r.okCount + '/' + r.count, 'success');
      addFcmHistory({ ok: true, broadcast: true, title: payload.title, body: payload.body, count: r.count, okCount: r.okCount, ts: Date.now() });
    } else {
      showToast('❌ 失败: ' + r.error, 'error');
    }
  } catch (e) {
    showToast('❌ 异常: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📡 广播给所有设备';
  }
}

function addFcmHistory(item) {
  _fcmHistory.unshift(item);
  if (_fcmHistory.length > 30) _fcmHistory.length = 30;
  renderFcmHistory();
}

function renderFcmHistory() {
  const el = $('#fcm-history');
  if (!el) return;
  if (_fcmHistory.length === 0) {
    el.innerHTML = '<div class="fcm-empty">还没有发送记录</div>';
    $('#fcm-history-label').textContent = '';
    return;
  }
  $('#fcm-history-label').textContent = '(最近 ' + _fcmHistory.length + ' 条)';
  el.innerHTML = _fcmHistory.map((h) => {
    const ago = fmtTimeAgo(h.ts);
    const status = h.ok ? 'state-alive' : 'state-dead';
    const statusText = h.ok ? '✅ 成功' : '❌ 失败';
    const tokenLine = h.broadcast
      ? '<div class="muted">广播 → ' + (h.okCount || 0) + '/' + (h.count || 0) + ' 设备成功</div>'
      : '<div class="muted">→ ' + escapeHtml(h.token || '') + '</div>';
    const detail = h.messageId
      ? '<code>' + escapeHtml(h.messageId) + '</code>'
      : '<code class="err">' + escapeHtml(h.error || '') + '</code>';
    return '<div class="fcm-history-item ' + status + '">' +
      '<div class="fcm-history-head"><span>' + statusText + '</span><span class="muted">' + ago + '</span></div>' +
      '<div><strong>' + escapeHtml(h.title || '') + '</strong> · ' + escapeHtml(h.body || '') + '</div>' +
      tokenLine +
      '<div class="muted" style="font-size:11px;word-break:break-all;">' + detail + '</div>' +
    '</div>';
  }).join('');
}


/** 2026-07-04 新增：公告管理（app 首页显示） */
async function loadAnnouncement() {
  try {
    const r = await api('/api/admin/announcements', { method: 'GET' });
    const a = (r && r.announcement) || {};
    $('#ann-enabled').checked = !!a.enabled;
    $('#ann-content').value = a.content || '';
    $('#ann-link').value = a.link || '';
    $('#ann-push-enabled').checked = a.pushEnabled !== false;
    $('#ann-push-title').value = a.pushTitle || '📢 新公告';
    $('#ann-push-body').value = a.pushBody || '';
    renderAnnouncementMeta(a);
    renderAnnouncementPreview();
    updateCharCount();
    updateStatusBadge(a);
  } catch (e) {
    console.warn('loadAnnouncement failed', e);
  }
}

/** **2026-07-04 优化**：字符计数 */
function updateCharCount() {
  const el = $('#ann-char-count');
  if (!el) return;
  const n = ($('#ann-content')?.value || '').length;
  el.textContent = n + ' 字符';
}

/** **2026-07-04 优化**：启用状态徽章 */
function updateStatusBadge(a) {
  const el = $('#announcement-status-badge');
  if (!el) return;
  if (!a) { el.textContent = '未加载'; el.dataset.state = 'loading'; return; }
  if (a.enabled && a.content && a.content.trim()) {
    el.dataset.state = 'enabled';
    const dt = a.updatedAt ? new Date(a.updatedAt).toLocaleString('zh-CN') : '';
    el.textContent = '✅ 已启用 · ' + dt;
  } else {
    el.dataset.state = 'disabled';
    el.textContent = '⏸  未启用';
  }
}

function renderAnnouncementMeta(a) {
  const meta = $('#announcement-meta');
  if (!meta) return;
  if (!a.updatedAt) { meta.textContent = '未设置'; return; }
  const dt = new Date(a.updatedAt);
  const txt = (a.enabled ? '✅ 已启用' : '⏸  未启用') + ' · 最后更新 ' + dt.toLocaleString('zh-CN');
  meta.textContent = txt;
}

function renderAnnouncementPreview() {
  const box = $('#ann-preview');
  if (!box) return;
  const enabled = $('#ann-enabled').checked;
  const content = $('#ann-content').value;
  const link = $('#ann-link').value.trim();
  if (!content.trim()) {
    box.innerHTML = '<div class="ann-preview-empty">输入内容后这里会显示 app 首页效果</div>';
    return;
  }
  if (!enabled) {
    box.innerHTML = '<div class="ann-preview-empty">⏸  公告未启用，app 端不会显示（上面切换启用开关可开启）</div>';
    return;
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const linkBadge = link ? '<span class="ann-preview-link">🔗 链接</span>' : '';
  box.innerHTML = '<div class="ann-preview-card">' +
    '<div class="ann-preview-icon">📢</div>' +
    '<div class="ann-preview-body">' +
      '<div class="ann-preview-title-row"><span class="ann-preview-title">公告</span>' + linkBadge + '</div>' +
      '<div class="ann-preview-content">' + esc(content).replace(/\n/g, '<br>') + '</div>' +
      '<div class="ann-preview-push-badge">📱 app 首页玻璃风格卡片</div>' +
    '</div>' +
  '</div>';
  updateCharCount();
}

async function saveAnnouncement() {
  const enabled = $('#ann-enabled').checked;
  const annContent = $('#ann-content').value;
  const link = $('#ann-link').value.trim();
  const pushEnabled = $('#ann-push-enabled').checked;
  const pushTitle = $('#ann-push-title').value.trim() || '📢 新公告';
  const pushBody = $('#ann-push-body').value;
  if (enabled && !annContent.trim()) {
    toast('启用状态下公告内容不能为空', 'error');
    return;
  }
  try {
    const r = await api('/api/admin/announcements', {
      method: 'PUT',
      body: JSON.stringify({ enabled, content: annContent, link, pushEnabled, pushTitle, pushBody }),
    });
    if (r && r.ok) {
      renderAnnouncementMeta(r.announcement);
      renderAnnouncementPreview();
      updateStatusBadge(r.announcement);
      updateCharCount();
      toast(pushEnabled ? '公告已保存 · 已触发 FCM 广播' : '公告已保存', 'success');
      logger.ui('announcement.saved', { enabled, hasLink: !!link, contentLen: annContent.length, pushEnabled });
    } else {
      toast('保存失败：' + (r && r.error || '未知错误'), 'error');
    }
  } catch (e) {
    toast('保存失败：' + e.message, 'error');
  }
}

function clearAnnouncement() {
  $('#ann-enabled').checked = false;
  $('#ann-content').value = '';
  $('#ann-link').value = '';
  renderAnnouncementPreview();
  updateCharCount();
  updateStatusBadge({ enabled: false, content: '', updatedAt: null });
}

/** **2026-07-04 新增**：手动触发公告推送（不修改内容） */
async function pushAnnouncement() {
  if (!confirm('立即向所有 app 推送当前公告？')) return;
  try {
    const r = await api('/api/admin/announcements/push', { method: 'POST', body: '{}' });
    if (r && r.ok) toast('已触发 FCM 广播', 'success');
    else toast('推送失败：' + (r && r.error || '未知错误'), 'error');
  } catch (e) {
    toast('推送失败：' + e.message, 'error');
  }
}

/** **2026-07-04 新增**：加载推送配置（应用版本推送 + 公告推送） */
async function loadPushConfig() {
  try {
    const r = await api('/api/admin/push-config', { method: 'GET' });
    const c = (r && r.config) || {};
    $('#pc-appver-enabled').checked = c.appVersionPushEnabled !== false;
    $('#pc-appver-title').value = c.appVersionPushTitle || '🚀 新版本发布';
    $('#pc-appver-body').value = c.appVersionPushBody || '{version} 已发布，点击查看详情';
    const meta = $('#push-config-meta');
    if (meta) {
      const now = new Date().toLocaleString('zh-CN');
      meta.textContent = (c.appVersionPushEnabled !== false ? '✅ 推送开启' : '⏸  推送关闭') + ' · 最后加载 ' + now;
    }
  } catch (e) {
    console.warn('loadPushConfig failed', e);
  }
}

async function savePushConfig() {
  const appVersionPushEnabled = $('#pc-appver-enabled').checked;
  const appVersionPushTitle = $('#pc-appver-title').value.trim() || '🚀 新版本发布';
  const appVersionPushBody = $('#pc-appver-body').value.trim() || '{version} 已发布，点击查看详情';
  try {
    const r = await api('/api/admin/push-config', {
      method: 'PUT',
      body: JSON.stringify({ appVersionPushEnabled, appVersionPushTitle, appVersionPushBody }),
    });
    if (r && r.ok) {
      toast('推送配置已保存', 'success');
      logger.ui('push_config.saved', { appVersionPushEnabled });
      // 重新加载 meta
      loadPushConfig();
    } else {
      toast('保存失败：' + (r && r.error || '未知错误'), 'error');
    }
  } catch (e) {
    toast('保存失败：' + e.message, 'error');
  }
}

on($('#ann-content'), 'input', () => { renderAnnouncementPreview(); });
on($('#ann-link'), 'input', renderAnnouncementPreview);
on($('#ann-enabled'), 'change', renderAnnouncementPreview);
on($('#ann-push-title'), 'input', renderAnnouncementPreview);
on($('#ann-push-body'), 'input', renderAnnouncementPreview);
on($('#ann-push-enabled'), 'change', renderAnnouncementPreview);
on($('#btn-ann-save'), 'click', saveAnnouncement);
on($('#btn-ann-clear'), 'click', clearAnnouncement);
on($('#btn-ann-push'), 'click', pushAnnouncement);
on($('#btn-push-config-save'), 'click', savePushConfig);


// ========== Changelog Page (2026-07-04) ==========
let changelogCache = null;
let changelogCacheTs = 0;
const CHANGELOG_TTL = 30_000;
let currentFilter = 'all';
let currentSearch = '';

async function loadChangelog(force) {
  force = force === true;
  const now = Date.now();
  if (!force && changelogCache && now - changelogCacheTs < CHANGELOG_TTL) {
    renderChangelog(changelogCache);
    return;
  }
  try {
    const r = await api('/api/changelog', { method: 'GET' });
    if (r && r.ok) {
      changelogCache = r.changelog || [];
      changelogCacheTs = now;
      renderChangelog(changelogCache);
      const meta = $('#changelog-meta');
      if (meta) meta.textContent = '\u2705 ' + r.total + ' \u6761\u8bb0\u5f55 \u00b7 ' + new Date().toLocaleString('zh-CN');
    } else {
      const meta = $('#changelog-meta');
      if (meta) meta.textContent = '\u274c \u52a0\u8f7d\u5931\u8d25';
    }
  } catch (e) {
    const meta = $('#changelog-meta');
    if (meta) meta.textContent = '\u274c ' + e.message;
  }
}

function renderChangelog(list) {
  const timeline = $('#changelog-timeline');
  const count = $('#changelog-count');
  if (!timeline) return;
  if (!list || list.length === 0) {
    timeline.innerHTML = '<div class="changelog-empty">\u6682\u65e0\u66f4\u65b0\u8bb0\u5f55</div>';
    if (count) count.textContent = '0 \u6761';
    return;
  }
  const filtered = list.filter((item) => {
    if (currentFilter !== 'all' && (item.category || 'app') !== currentFilter) return false;
    if (currentSearch) {
      const s = currentSearch.toLowerCase();
      if (!((item.version || '').toLowerCase().includes(s) ||
            (item.title || '').toLowerCase().includes(s) ||
            (item.changelog || '').toLowerCase().includes(s))) return false;
    }
    return true;
  });
  if (count) count.textContent = filtered.length + ' / ' + list.length + ' \u6761';
  if (filtered.length === 0) {
    timeline.innerHTML = '<div class="changelog-empty">\u65e0\u5339\u914d\u8bb0\u5f55</div>';
    return;
  }
  const esc = (s) => String(s || '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  const highlight = (s) => {
    if (!currentSearch) return esc(s);
    try {
      const re = new RegExp(currentSearch.replace(/[.*+?^$()|[\]\\]/g, '\\\\$&'), 'gi');
      return esc(s).replace(re, (m) => '<span class="changelog-highlight">' + m + '</span>');
    } catch (e) { return esc(s); }
  };
  const catLabel = (c) => ({ app: '\ud83d\udcf1 app', web: '\ud83c\udf10 web', server: '\u2699\ufe0f server' }[c] || 'app');
  const dateFmt = (s) => {
    if (!s) return '';
    try {
      const d = new Date(s);
      return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } catch (e) { return s; }
  };
  const downloadBtn = (item) => {
    if (item.isEarly || !item.downloadUrl) return "";
    return '<a class="changelog-download" href="' + item.downloadUrl + '" target="_blank" rel="noopener">⬇ 下载 APK</a>';
  };
  timeline.innerHTML = filtered.map((item) => {
    const cat = item.category || 'app';
    const title = item.title ? '<div class="changelog-title">' + highlight(item.title) + '</div>' : '';
    return '<div class="changelog-item" data-cat="' + cat + '">' +
      '<div class="changelog-item-row1">' +
        '<span class="changelog-version">' + highlight(item.version) + '</span>' +
        '<span class="changelog-cat" data-cat="' + cat + '">' + catLabel(cat) + '</span>' +
        '<span class="changelog-date">' + dateFmt(item.date) + '</span>' +
      '</div>' +
      title +
      '<div class="changelog-content">' + highlight(item.changelog) + '</div>' +
      '<div class="changelog-actions">' + downloadBtn(item) + '</div>' +
    '</div>';
  }).join("");
}

function bindChangelogUI() {
  document.querySelectorAll('.changelog-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.changelog-filter').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.cat || 'all';
      if (changelogCache) renderChangelog(changelogCache);
    });
  });
  const searchEl = $('#changelog-search');
  if (searchEl) {
    let timer;
    searchEl.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        currentSearch = searchEl.value.trim();
        if (changelogCache) renderChangelog(changelogCache);
      }, 200);
    });
  }
}

