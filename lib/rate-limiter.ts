import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export interface RateLimitConfig {
  windowMs: number;        // Finestra di tempo in millisecondi
  maxRequests: number;     // Numero massimo di richieste per finestra
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: NextRequest) => string;
  message?: string;
  statusCode?: number;
  headers?: boolean;
  onLimitReached?: (req: NextRequest, identifier: string) => void;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  identifier: string;
}

export class RateLimiter {
  private store: Map<string, { count: number; resetTime: number }> = new Map();
  private config: Required<RateLimitConfig>;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      skipSuccessfulRequests: config.skipSuccessfulRequests ?? false,
      skipFailedRequests: config.skipFailedRequests ?? false,
      keyGenerator: config.keyGenerator ?? this.defaultKeyGenerator,
      message: config.message ?? 'Too many requests, please try again later.',
      statusCode: config.statusCode ?? 429,
      headers: config.headers ?? true,
      onLimitReached: config.onLimitReached ?? (() => {})
    };

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  private defaultKeyGenerator(req: NextRequest): string {
    // Use IP address as default identifier
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    const ip = forwarded ? forwarded.split(',')[0] : realIp || 'unknown';
    return ip;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  public check(req: NextRequest): RateLimitResult {
    const identifier = this.config.keyGenerator(req);
    const now = Date.now();
    
    let entry = this.store.get(identifier);
    
    if (!entry || now > entry.resetTime) {
      // Create new entry or reset expired one
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
      this.store.set(identifier, entry);
    }

    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const allowed = entry.count < this.config.maxRequests;

    if (allowed) {
      entry.count++;
    } else {
      // Rate limit exceeded
      this.config.onLimitReached(req, identifier);
      
      logger.warn('Rate limit exceeded', 'RATE_LIMITER', {
        identifier,
        count: entry.count,
        maxRequests: this.config.maxRequests,
        windowMs: this.config.windowMs,
        path: req.nextUrl.pathname,
        method: req.method
      });
    }

    return {
      allowed,
      remaining: allowed ? remaining - 1 : 0,
      resetTime: entry.resetTime,
      identifier
    };
  }

  public createMiddleware() {
    return (req: NextRequest) => {
      const result = this.check(req);

      if (!result.allowed) {
        const response = NextResponse.json(
          { 
            error: 'Rate limit exceeded',
            message: this.config.message,
            retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000)
          },
          { status: this.config.statusCode }
        );

        if (this.config.headers) {
          response.headers.set('X-RateLimit-Limit', this.config.maxRequests.toString());
          response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
          response.headers.set('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
          response.headers.set('Retry-After', Math.ceil((result.resetTime - Date.now()) / 1000).toString());
        }

        return response;
      }

      return null; // Continue to next middleware
    };
  }
}

// Predefined rate limiters for different use cases
export const rateLimiters = {
  // API endpoints generici
  api: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minuti
    maxRequests: 100,
    message: 'Too many API requests, please try again later.',
  }),

  // Endpoint di autenticazione
  auth: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minuti
    maxRequests: 10,
    message: 'Too many authentication attempts, please try again later.',
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
      return `auth:${ip}`;
    },
  }),

  // Endpoint di traduzione (aumentato per OCR real-time)
  translation: new RateLimiter({
    windowMs: 1 * 60 * 1000, // 1 minuto
    maxRequests: 60, // ~1 richiesta/secondo per OCR
    message: 'Too many translation requests, please try again later.',
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
      return `translation:${ip}`;
    },
  }),

  // Endpoint di upload/file operations
  upload: new RateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 5,
    message: 'Too many upload requests, please try again later.',
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
      return `upload:${ip}`;
    },
  }),

  // Health check e monitoring
  health: new RateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30,
    message: 'Too many health check requests, please try again later.',
  }),

  // Steam API calls
  steam: new RateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10,
    message: 'Too many Steam API requests, please try again later.',
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
      return `steam:${ip}`;
    },
  }),

  // Database intensive operations
  database: new RateLimiter({
    windowMs: 5 * 60 * 1000, // 5 minuti
    maxRequests: 20,
    message: 'Too many database requests, please try again later.',
  }),

  // AI/Translation service calls
  ai: new RateLimiter({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 5,
    message: 'Too many AI service requests, please try again later.',
    keyGenerator: (req) => {
      const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || req.headers.get('x-real-ip') || 'unknown';
      return `ai:${ip}`;
    },
  }),
};

// Utility function to apply rate limiting to API routes
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  limiter: RateLimiter
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const rateLimitResult = limiter.check(req);

    if (!rateLimitResult.allowed) {
      const response = NextResponse.json(
        { 
          error: 'Rate limit exceeded',
          message: 'Too many requests, please try again later.',
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000)
        },
        { status: 429 }
      );

      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', limiter['config'].maxRequests.toString());
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
      response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
      response.headers.set('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());

      return response;
    }

    // Add rate limit headers to successful responses
    const response = await handler(req);
    
    response.headers.set('X-RateLimit-Limit', limiter['config'].maxRequests.toString());
    response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    response.headers.set('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());

    return response;
  };
}

// Advanced rate limiting with multiple tiers
export class TieredRateLimiter {
  private limiters: Map<string, RateLimiter> = new Map();

  constructor(private configs: Record<string, RateLimitConfig>) {
    for (const [tier, config] of Object.entries(configs)) {
      this.limiters.set(tier, new RateLimiter(config));
    }
  }

  public check(req: NextRequest, tier: string = 'default'): RateLimitResult {
    const limiter = this.limiters.get(tier);
    if (!limiter) {
      throw new Error(`Rate limiter tier '${tier}' not found`);
    }
    return limiter.check(req);
  }

  public createMiddleware(tier: string = 'default') {
    const limiter = this.limiters.get(tier);
    if (!limiter) {
      throw new Error(`Rate limiter tier '${tier}' not found`);
    }
    return limiter.createMiddleware();
  }
}

// Global rate limiting statistics
export class RateLimitStats {
  private static instance: RateLimitStats;
  private stats: Map<string, { requests: number; blocked: number; lastReset: number }> = new Map();

  static getInstance(): RateLimitStats {
    if (!RateLimitStats.instance) {
      RateLimitStats.instance = new RateLimitStats();
    }
    return RateLimitStats.instance;
  }

  public recordRequest(identifier: string, blocked: boolean = false): void {
    const now = Date.now();
    const key = identifier.split(':')[0]; // Get the rate limiter type
    
    let stat = this.stats.get(key);
    if (!stat || now - stat.lastReset > 60000) { // Reset every minute
      stat = { requests: 0, blocked: 0, lastReset: now };
      this.stats.set(key, stat);
    }

    stat.requests++;
    if (blocked) {
      stat.blocked++;
    }
  }

  public getStats(): Record<string, { requests: number; blocked: number; blockRate: number }> {
    const result: Record<string, { requests: number; blocked: number; blockRate: number }> = {};
    
    for (const [key, stat] of this.stats.entries()) {
      result[key] = {
        requests: stat.requests,
        blocked: stat.blocked,
        blockRate: stat.requests > 0 ? (stat.blocked / stat.requests) * 100 : 0
      };
    }
    
    return result;
  }

  public reset(): void {
    this.stats.clear();
  }
}

// Update rate limiters to use stats
Object.entries(rateLimiters).forEach(([name, limiter]) => {
  const originalOnLimitReached = limiter['config'].onLimitReached;
  limiter['config'].onLimitReached = (req: NextRequest, identifier: string) => {
    RateLimitStats.getInstance().recordRequest(identifier, true);
    originalOnLimitReached(req, identifier);
  };
});

export default rateLimiters;