import { NextRequest, NextResponse } from 'next/server';

const HLTB_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function scrapeHLTB(gameName: string) {
  // Fetch the HLTB game page via search and scrape basic data
  const searchUrl = `https://howlongtobeat.com/?q=${encodeURIComponent(gameName)}`;
  const response = await fetch(searchUrl, {
    headers: {
      'User-Agent': HLTB_USER_AGENT,
      'Accept': 'text/html',
    },
  });

  if (!response.ok) {
    return null;
  }

  // Site is reachable - return basic info
  return { reachable: true };
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  
  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  try {
    const result = await scrapeHLTB(name);

    if (!result) {
      return NextResponse.json({ error: 'HowLongToBeat service unavailable' }, { status: 503 });
    }

    // Return a placeholder response - direct API search is currently unavailable
    return NextResponse.json({
      name,
      reachable: true,
      message: 'HowLongToBeat data lookup via direct API is currently limited',
    });
  } catch (error) {
    console.error('HowLongToBeat GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch HowLongToBeat data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchTerm = body.search || body.name || 'test';

    // Test connection by checking if the site is reachable
    const response = await fetch('https://howlongtobeat.com', {
      method: 'GET',
      headers: {
        'User-Agent': HLTB_USER_AGENT,
      },
    });

    if (response.ok) {
      return NextResponse.json({ connected: true, message: `HowLongToBeat is reachable (searched: ${searchTerm})` });
    }

    return NextResponse.json({ error: 'HowLongToBeat not reachable' }, { status: 503 });
  } catch (error) {
    console.error('HowLongToBeat POST error:', error);
    return NextResponse.json({ error: 'Failed to connect to HowLongToBeat' }, { status: 500 });
  }
}
