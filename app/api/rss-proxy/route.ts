import { NextRequest, NextResponse } from 'next/server';

/**
 * RSS Proxy — bypass CORS per feed RSS in dev mode.
 * In produzione (Tauri) il frontend usa invoke('fetch_rss_feed') dal backend Rust.
 * Questo endpoint serve solo come fallback in dev mode (browser puro).
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'Accept': 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
        'User-Agent': 'GameStringer/1.5 RSS Reader',
      },
      redirect: 'follow',
    });

    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json(
        { error: `HTTP ${res.status} for ${url}` },
        { status: res.status }
      );
    }

    const text = await res.text();

    return new NextResponse(text, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=900', // 15 min cache
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
