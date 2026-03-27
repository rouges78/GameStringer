import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';

/**
 * Proxy generico per API LLM che bloccano CORS dal browser.
 * Inoltra le richieste server-side evitando il blocco CORS.
 */
export const POST = withErrorHandler(async function(request: NextRequest) {
  const body = await request.json();
  const { endpoint, apiKey, payload, authHeader } = body;

  if (!endpoint || !apiKey || !payload) {
    return NextResponse.json({ error: 'Missing endpoint, apiKey, or payload' }, { status: 400 });
  }

  // Whitelist di endpoint consentiti
  const ALLOWED_HOSTS = [
    'api.openai.com',
    'api.anthropic.com',
    'api.cohere.ai',
    'api.cohere.com',
  ];

  const url = new URL(endpoint);
  if (!ALLOWED_HOSTS.includes(url.hostname)) {
    return NextResponse.json({ error: `Host non consentito: ${url.hostname}` }, { status: 403 });
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Supporta diversi formati di auth header
  if (authHeader === 'x-api-key') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data?.error?.message || `API error ${res.status}`, status: res.status }, { status: res.status });
  }

  return NextResponse.json(data);
});
