import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { checkPassword, isSignedIn, sessionToken, SESSION_COOKIE } from '@/lib/auth'
import { POST as signIn, DELETE as signOut } from '@/app/api/auth/route'
import { proxy } from '@/proxy'

afterEach(() => vi.unstubAllEnvs())

const login = (password: string) =>
  signIn(new NextRequest('http://test.local/api/auth', { method: 'POST', body: JSON.stringify({ password }), headers: { 'content-type': 'application/json' } }))
const visit = (path: string, cookie?: string) =>
  proxy(new NextRequest(`http://test.local${path}`, { headers: cookie ? { cookie: `${SESSION_COOKIE}=${cookie}` } : {} }))

describe('app password', () => {
  it('accepts only the right password and never stores the password itself', async () => {
    vi.stubEnv('APP_PASSWORD', 'secret-1')
    expect(await checkPassword('wrong')).toBeNull()
    const token = await checkPassword('secret-1')
    expect(token).toBe(await sessionToken('secret-1'))
    expect(token).not.toContain('secret-1')
    expect(await isSignedIn(token!)).toBe(true)
    expect(await isSignedIn('forged')).toBe(false)
  })

  it('changing the password signs every device out', async () => {
    vi.stubEnv('APP_PASSWORD', 'old')
    const token = await checkPassword('old')
    vi.stubEnv('APP_PASSWORD', 'new')
    expect(await isSignedIn(token!)).toBe(false)
  })

  it('production without APP_PASSWORD stays locked; development is open', async () => {
    vi.stubEnv('APP_PASSWORD', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(await isSignedIn(undefined)).toBe(false)
    vi.stubEnv('NODE_ENV', 'development')
    expect(await isSignedIn(undefined)).toBe(true)
  })

  it('sign-in sets an http-only cookie; a wrong password gets 401', async () => {
    vi.stubEnv('APP_PASSWORD', 'secret-1')
    expect((await login('nope')).status).toBe(401)
    const ok = await login('secret-1')
    expect(ok.status).toBe(200)
    const cookie = ok.headers.get('set-cookie') ?? ''
    expect(cookie).toContain(`${SESSION_COOKIE}=${await sessionToken('secret-1')}`)
    expect(cookie.toLowerCase()).toContain('httponly')
    expect((await signOut()).headers.get('set-cookie')).toMatch(/Max-Age=0/i)
  })

  it('the proxy sends signed-out pages to /login and refuses the API', async () => {
    vi.stubEnv('APP_PASSWORD', 'secret-1')
    vi.stubEnv('NODE_ENV', 'production')
    const page = await visit('/')
    expect(page.status).toBe(307)
    expect(page.headers.get('location')).toBe('http://test.local/login')
    expect((await visit('/api/sales')).status).toBe(401)
    expect((await visit('/api/sales', await sessionToken('secret-1'))).headers.get('x-middleware-next')).toBe('1')
  })
})
