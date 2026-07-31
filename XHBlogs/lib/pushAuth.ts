// 推送管理默认鉴权 token (与后端 verifyAuth 一致)
export const PUSH_ADMIN_TOKEN = 'hayenai-admin-2024';

// 公共 fetch helper - 自动附带鉴权头
export async function pushFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PUSH_ADMIN_TOKEN}`,
    ...options.headers,
  };
  return fetch(url, { ...options, headers });
}
