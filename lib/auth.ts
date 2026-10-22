/**
 * Simple password lock for the whole app (one shared password for the family / business).
 *
 * APP_PASSWORD is set on the server (Vercel env var). After entering it, the browser keeps a
 * session cookie holding a SHA-256 of the password — never the password itself. Changing
 * APP_PASSWORD logs every device out. Without APP_PASSWORD, production stays locked;
 * local development is open.
 */
export const SESSION_COOKIE = 'mezgeb_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 365 // a year: an older user shouldn't be logged out often

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Constant-time comparison, so response timing reveals nothing about the token. */
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export const sessionToken = (password: string) => sha256Hex(`mezgeb-session:${password}`)

export const passwordConfigured = () => !!process.env.APP_PASSWORD

/** True when the request may use the app. */
export async function isSignedIn(cookieValue: string | undefined) {
  const password = process.env.APP_PASSWORD
  if (!password) return process.env.NODE_ENV !== 'production'
  return !!cookieValue && sameString(cookieValue, await sessionToken(password))
}

/** Checks a typed password; on success returns the cookie value to store. */
export async function checkPassword(input: string) {
  const password = process.env.APP_PASSWORD
  if (!password) return null
  const [given, expected] = await Promise.all([sessionToken(input), sessionToken(password)])
  return sameString(given, expected) ? expected : null
}
