import { NextResponse, type NextRequest } from 'next/server'
import { isSignedIn, SESSION_COOKIE } from '@/lib/auth'

// Locks every page and API route behind the app password (see lib/auth.ts).
export async function proxy(request: NextRequest) {
  if (await isSignedIn(request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next()
  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  const login = request.nextUrl.clone()
  login.pathname = '/login'
  login.search = ''
  return NextResponse.redirect(login)
}

export const config = {
  // Everything except the login page / endpoint, the health check, Vercel's own scripts (analytics)
  // and the public app files (icons, manifest, offline page)
  matcher: ['/((?!login|api/auth|api/health|_next/static|_next/image|_vercel|icons/|logo\\.svg|manifest\\.webmanifest|sw\\.js|offline\\.html|favicon).*)'],
}
