import { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';

export const GET = withErrorHandler(async function() {
  return NextResponse.json({ connected: true, service: 'howlongtobeat' });
});

export const POST = withErrorHandler(async function() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://howlongtobeat.com', {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return NextResponse.json({
      connected: response.ok,
      status: response.status,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ connected: false, error: message }, { status: 200 });
  }
});
