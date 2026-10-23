import { NextRequest, NextResponse } from 'next/server';

// Pages accessibles sans être connecté
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/forgot-password', '/reset-password'];

// En HTTPS, better-auth préfixe le cookie avec __Secure-
const SESSION_COOKIES = ['better-auth.session_token', '__Secure-better-auth.session_token'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_ROUTES.includes(pathname)) {
    return NextResponse.next();
  }

  const hasSession = SESSION_COOKIES.some((name) => request.cookies.get(name)?.value);

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Exclut aussi les fichiers statiques de /public (logo.png, icônes…)
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|.*\\.[a-zA-Z0-9]+$).*)'],
};
