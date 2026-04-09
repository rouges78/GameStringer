import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware di sicurezza per GameStringer (Tauri desktop app).
 *
 * L'auth è client-side (localStorage) perché il server Next.js gira
 * localmente sulla macchina dell'utente. Il middleware aggiunge security
 * headers, CSRF protection, e rate limiting.
 */

// ── Rate Limiting (in-memory, per-process) ───────────────────
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Route-specific rate limits: [maxRequests, windowMs]
const RATE_LIMITS: Record<string, [number, number]> = {
  '/api/auth/':       [10, 15 * 60 * 1000],   // 10 req / 15 min
  '/api/translate':   [120, 60 * 1000],        // 120 req / min (OCR real-time)
  '/api/secrets':     [10, 60 * 1000],         // 10 req / min
};
const DEFAULT_RATE_LIMIT: [number, number] = [60, 60 * 1000]; // 60 req / min

function getRateLimit(pathname: string): [number, number] {
  for (const [prefix, limit] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(prefix)) return limit;
  }
  return DEFAULT_RATE_LIMIT;
}

function checkRateLimit(pathname: string, method: string): { allowed: boolean; remaining: number; resetAt: number } {
  // Only rate-limit mutative methods
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { allowed: true, remaining: 999, resetAt: 0 };
  }

  const [maxRequests, windowMs] = getRateLimit(pathname);
  const key = pathname;
  const now = Date.now();

  let entry = rateLimitStore.get(key);
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

// Cleanup stale entries every 5 minutes
if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore) {
      if (now >= entry.resetAt) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

// CSP policy — mirrors Tauri CSP but enforced at HTTP level too
const CSP_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://steamcdn-a.akamaihd.net https://cdn.akamai.steamstatic.com https://shared.akamai.steamstatic.com https://cdn.steamgriddb.com https://cdn2.steamgriddb.com https://media.steampowered.com https://cdn.cloudflare.steamstatic.com https://store.steampowered.com https://avatars.githubusercontent.com",
  "connect-src 'self' https://api.openai.com https://api.anthropic.com https://generativelanguage.googleapis.com https://api.deepseek.com https://api.mistral.ai https://openrouter.ai https://api.github.com https://api.nexusmods.com https://api.steampowered.com https://api.rawg.io https://api.igdb.com https://howlongtobeat.com https://www.steamgriddb.com http://127.0.0.1:* http://localhost:*",
  "font-src 'self' data:",
  "media-src 'self' blob:",
].join('; ');

// Allowed origins for CSRF protection (Tauri + local dev)
const ALLOWED_ORIGINS = [
  'tauri://localhost',
  'https://tauri.localhost',
  'http://tauri.localhost',
];

function isAllowedOrigin(origin: string): boolean {
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost on any port
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?$/.test(origin)) return true;
  return false;
}

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
  response.headers.set('Content-Security-Policy', CSP_POLICY);

  // API routes protection
  if (pathname.startsWith('/api/')) {
    // 1. Localhost-only check
    const host = request.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1') || host.startsWith('0.0.0.0');
    if (!isLocalhost) {
      return NextResponse.json(
        { error: 'API accessible only from localhost' },
        { status: 403 }
      );
    }

    // 2. Rate limiting for mutative methods
    const method = request.method;
    const rateCheck = checkRateLimit(pathname, method);
    if (!rateCheck.allowed) {
      const retryAfter = Math.ceil((rateCheck.resetAt - Date.now()) / 1000);
      return NextResponse.json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Remaining': '0',
          },
        }
      );
    }

    // 3. CSRF protection for state-changing methods
    if (method === 'POST' || method === 'PUT' || method === 'DELETE' || method === 'PATCH') {
      // Check Origin header
      const origin = request.headers.get('origin');
      if (origin && !isAllowedOrigin(origin)) {
        return NextResponse.json(
          { error: 'CSRF: origin not allowed' },
          { status: 403 }
        );
      }

      // Require custom header to prevent simple CORS requests
      const gsClient = request.headers.get('x-gs-client');
      if (gsClient !== 'gamestringer') {
        return NextResponse.json(
          { error: 'CSRF: missing client header' },
          { status: 403 }
        );
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};