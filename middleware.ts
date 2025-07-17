import { NextResponse } from "next/server";
import type { NextRequest } from 'next/server';
import { rateLimiters, RateLimitStats } from '@/lib/rate-limiter';

// Edge-compatible edgeLogger
const edgeLogger = {
  info: (message: string, component: string, metadata?: any) => {
    console.info(`[${component}] ${message}`, metadata);
  },
  warn: (message: string, component: string, metadata?: any) => {
    console.warn(`[${component}] ${message}`, metadata);
  },
  error: (message: string, component: string, metadata?: any) => {
    console.error(`[${component}] ${message}`, metadata);
  }
};

// Unified auth session validation
const validateSession = (req: NextRequest): boolean => {
  try {
    // Check for session cookie or auth header
    const sessionCookie = req.cookies.get('gs_session');
    const authHeader = req.headers.get('authorization');
    
    if (sessionCookie) {
      // Basic validation - in production, verify signature
      const sessionData = JSON.parse(sessionCookie.value);
      const expiresAt = new Date(sessionData.expiresAt);
      return sessionData.isValid && new Date() < expiresAt;
    }
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // API token validation
      const token = authHeader.substring(7);
      return token.length > 0; // Basic check
    }
    
    return false;
  } catch (error) {
    edgeLogger.error('Session validation failed', 'AUTH_MIDDLEWARE', { error });
    return false;
  }
};

// Apply rate limiting based on request path
function applyRateLimit(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;
  const stats = RateLimitStats.getInstance();
  
  try {
    let rateLimitResult;
    
    // Authentication endpoints
    if (path.startsWith('/api/auth') || path.includes('/login') || path.includes('/verify')) {
      rateLimitResult = rateLimiters.auth.check(req);
    }
    // Translation endpoints
    else if (path.startsWith('/api/translations') || path.startsWith('/api/translate')) {
      rateLimitResult = rateLimiters.translation.check(req);
    }
    // Steam API endpoints
    else if (path.includes('/steam') || path.includes('/stores/status')) {
      rateLimitResult = rateLimiters.steam.check(req);
    }
    // Health check endpoints
    else if (path.startsWith('/api/health')) {
      rateLimitResult = rateLimiters.health.check(req);
    }
    // AI service endpoints
    else if (path.includes('/ai') || path.includes('/suggestions')) {
      rateLimitResult = rateLimiters.ai.check(req);
    }
    // Database intensive endpoints
    else if (path.startsWith('/api/library') || path.startsWith('/api/games')) {
      rateLimitResult = rateLimiters.database.check(req);
    }
    // Generic API endpoints
    else if (path.startsWith('/api/')) {
      rateLimitResult = rateLimiters.api.check(req);
    }
    // No rate limiting for non-API routes
    else {
      return null;
    }
    
    // Record request statistics
    stats.recordRequest(rateLimitResult.identifier, !rateLimitResult.allowed);
    
    if (!rateLimitResult.allowed) {
      edgeLogger.warn('Rate limit exceeded', 'RATE_LIMITER', {
        path,
        identifier: rateLimitResult.identifier,
        resetTime: rateLimitResult.resetTime
      });
      
      const response = NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      );

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', '100'); // Default limit
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
      response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

      return response;
    }
    
    return null; // Continue processing
    
  } catch (error) {
    edgeLogger.error('Rate limiting error', 'RATE_LIMITER', { error, path });
    // Don't block requests if rate limiting fails
    return null;
  }
}

export default function middleware(req: NextRequest) {
  const start = Date.now();
  const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Log incoming request
  edgeLogger.info(`${req.method} ${req.url}`, 'MIDDLEWARE', {
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    ip: req.ip || req.headers.get('x-forwarded-for'),
    timestamp: new Date().toISOString()
  });

  // Rate limiting check
  const rateLimitResult = applyRateLimit(req);
  if (rateLimitResult) {
    return rateLimitResult;
  }

  // Auth check for protected routes
  const isProtectedRoute = req.nextUrl.pathname.startsWith('/api/protected') ||
                          req.nextUrl.pathname.startsWith('/api/translations') ||
                          req.nextUrl.pathname.startsWith('/api/games') ||
                          req.nextUrl.pathname.startsWith('/api/logs') ||
                          req.nextUrl.pathname.startsWith('/api/error-reports');

  if (isProtectedRoute) {
    const hasValidSession = validateSession(req);
    
    edgeLogger.info(`Auth check for ${req.nextUrl.pathname}`, 'AUTH', {
      hasValidSession,
      path: req.nextUrl.pathname,
      ip: req.ip || req.headers.get('x-forwarded-for')
    });
    
    if (!hasValidSession) {
      edgeLogger.warn(`Unauthorized access attempt to ${req.nextUrl.pathname}`, 'AUTH', {
        path: req.nextUrl.pathname,
        ip: req.ip || req.headers.get('x-forwarded-for')
      });
      
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Valid session required' },
        { status: 401 }
      );
    }
  }

  // Process request
  const response = NextResponse.next();

  // Add response headers
  response.headers.set('x-request-id', requestId);
  response.headers.set('x-response-time', `${Date.now() - start}ms`);

  // Log response
  const duration = Date.now() - start;
  edgeLogger.info(`${req.method} ${req.url} - ${response.status} (${duration}ms)`, 'MIDDLEWARE', {
    requestId,
    method: req.method,
    url: req.url,
    statusCode: response.status,
    duration,
    userAgent: req.headers.get('user-agent'),
    ip: req.ip || req.headers.get('x-forwarded-for')
  });

  return response;
}

export const config = {
  matcher: [
    '/api/auth/:path*', 
    '/api/protected/:path*',
    '/api/translations/:path*',
    '/api/games/:path*',
    '/api/logs/:path*',
    '/api/error-reports/:path*'
  ]
};
