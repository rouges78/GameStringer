import { NextResponse } from 'next/server';

/**
 * 🔌 GameStringer Public API v1 - Health Check
 * 
 * GET /api/v1/health
 * 
 * Returns API status and version info.
 */

export async function GET() {
  const startTime = Date.now();
  
  // Check libre API
  let libreStatus = 'unknown';
  try {
    const response = await fetch(
      'https://api.mymemory.translated.net/get?q=test&langpair=en|it',
      { signal: AbortSignal.timeout(5000) }
    );
    libreStatus = response.ok ? 'ok' : 'error';
  } catch {
    libreStatus = 'timeout';
  }
  
  const responseTime = Date.now() - startTime;
  
  return NextResponse.json({
    status: 'healthy',
    version: '1.0.0',
    api: 'GameStringer Public API',
    timestamp: new Date().toISOString(),
    uptime: process.uptime ? Math.floor(process.uptime()) : null,
    responseTimeMs: responseTime,
    services: {
      libre: libreStatus,
      gemini: 'requires_key',
      openai: 'requires_key',
      claude: 'requires_key'
    },
    endpoints: {
      translate: '/api/v1/translate',
      batch: '/api/v1/batch',
      languages: '/api/v1/languages',
      health: '/api/v1/health'
    },
    limits: {
      batchMaxTexts: 100,
      maxTextLength: 5000,
      cacheTTL: '1 hour'
    }
  });
}
