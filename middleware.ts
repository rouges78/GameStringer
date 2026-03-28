import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware di sicurezza per GameStringer (Tauri desktop app).
 *
 * L'auth è client-side (localStorage) perché il server Next.js gira
 * localmente sulla macchina dell'utente. Il middleware aggiunge security
 * headers e protegge le API da richieste esterne.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip per static files
  if (
    pathname.startsWith('/_next/') ||
    pathname.includes('.') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // API routes: verifica che la richiesta venga da localhost (protezione base)
  if (pathname.startsWith('/api/')) {
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0');
    if (!isLocalhost) {
      return NextResponse.json(
        { error: 'API accessible only from localhost' },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};