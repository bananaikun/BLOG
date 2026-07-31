/**
 * NCM Cookie 预处理工具
 *
 * 修复 NCM 包的 cookieToJson BUG (util/index.js:39-54):
 *   let arr = item.split('=')   // 按所有 = 分割
 *   if (arr.length === 2) {     // 长度必须等于 2 才保留
 *     obj[arr[0].trim()] = arr[1].trim()
 *   }
 *
 * 问题: base64 编码的 token (如 MUSIC_U) 通常以 = 或 == 结尾,
 *       split('=') 后长度 > 2, MUSIC_U 字段被直接丢弃!
 *       导致网易云把登录用户当游客, 返回 30 秒试听 URL
 *
 * 修复策略: 把 cookie 值里的 = 替换成 %3D (URL 编码),
 *          NCM 包的 cookieObjToString 会用 encodeURIComponent 再次编码,
 *          最终发送给网易云时 %3D 会被解码回 =, 不影响实际值
 *          但 split('=') 时只会按分隔符分割一次, MUSIC_U 不会被丢弃
 *
 * 注意: NCM 包的 cookieToJson 用 split('='), 不是 split('; '),
 *       所以我们要保证每个 key=value 对中, value 不含 =
 */

/**
 * 预处理 cookie 字符串, 修复 NCM 包的 cookieToJson BUG
 * 把每个 value 中的 = 替换成 %3D, 确保 split('=') 后长度为 2
 */
export function fixNcmCookie(cookie: string): string {
  if (!cookie || typeof cookie !== 'string') return cookie

  // 按 ; 分割每个 cookie 对
  const pairs = cookie.split(';')
  const fixed: string[] = []

  for (const pair of pairs) {
    const trimmed = pair.trim()
    if (!trimmed) continue

    // 找到第一个 = 的位置 (key=value 的分隔符)
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) {
      // 没有 = 的项 (异常), 原样保留
      fixed.push(trimmed)
      continue
    }

    const key = trimmed.substring(0, eqIdx).trim()
    // value 中所有 = 都替换成 %3D
    const value = trimmed.substring(eqIdx + 1).trim().replace(/=/g, '%3D')
    fixed.push(`${key}=${value}`)
  }

  return fixed.join('; ')
}
