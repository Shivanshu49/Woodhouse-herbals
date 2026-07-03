import { NextResponse, type NextRequest } from 'next/server';

// The access-token cookie set by the backend (Phase A). Its mere presence
// gates entry to the app shell; the real role check happens in the
// dashboard layout via GET /auth/me. When it's absent we skip rendering the
// protected tree and send the user to /login.
const ACCESS_COOKIE = 'wh_at';
const REFRESH_COOKIE = 'wh_rt';

const PUBLIC_PREFIXES = ['/login', '/forgot', '/reset'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSession =
    req.cookies.has(ACCESS_COOKIE) || req.cookies.has(REFRESH_COOKIE);

  if (!isPublic && !hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
