import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { checkPassword, passwordConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth'

export const runtime = 'nodejs'

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

// POST /api/auth { password } — sign in on this device
export async function POST(req: NextRequest) {
  const parsed = z.object({ password: z.string().min(1) }).safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'WRONG_PASSWORD' }, { status: 400 })
  if (!passwordConfigured()) return NextResponse.json({ error: 'NO_PASSWORD_SET' }, { status: 503 })

  const token = await checkPassword(parsed.data.password)
  if (!token) {
    await new Promise((r) => setTimeout(r, 800)) // slows down guessing
    return NextResponse.json({ error: 'WRONG_PASSWORD' }, { status: 401 })
  }
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, token, { ...cookieOptions, maxAge: SESSION_MAX_AGE })
  return res
}

// DELETE /api/auth — sign out on this device
export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, '', { ...cookieOptions, maxAge: 0 })
  return res
}
