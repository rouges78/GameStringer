import { NextRequest, NextResponse } from 'next/server';

async function searchHLTB(searchTerm: string, size: number = 1) {
  // HowLongToBeat API uses dynamic hash in endpoint - try multiple known patterns
  const endpoints = [
    'https://howlongtobeat.com/api/search',
    'https://howlongtobeat.com/api/search/results',
    'https://howlongtobeat.com/api/find',
  ];

  const headers = {
    'Content-Type': 'application/json',
    'Referer': 'https://howlongtobeat.com',
    'Origin': 'https://howlongtobeat.com',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
  };

  const payload = {
    searchType: 'games',
    searchTerms: searchTerm.split(' '),
    searchPage: 1,
    size,
    searchOptions: {
      games: {
        userId: 0,
        platform: '',
        sortCategory: 'popular',
        rangeCategory: 'main',
        rangeTime: { min: null, max: null },
        gameplay: { perspective: '', flow: '', genre: '' },
        rangeYear: { min: '', max: '' },
        modifier: '',
      },
      users: { sortCategory: 'postcount' },
      filter: '',
      sort: 0,
      randomizer: 0,
    },
  };

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        if (data?.data) return data;
      }
    } catch {
      continue;
    }
  }

  // Fallback: try to reach the site to confirm it's online
  try {
    const pingResponse = await fetch('https://howlongtobeat.com', {
      method: 'HEAD',
      headers: { 'User-Agent': headers['User-Agent'] },
    });
    if (pingResponse.ok) {
      return { reachable: true, data: [] };
    }
  } catch {
    // site unreachable
  }

  return null;
}

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  
  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  try {
    const result = await searchHLTB(name, 1);

    if (!result) {
      return NextResponse.json({ error: 'HowLongToBeat service unavailable' }, { status: 503 });
    }

    const game = result.data?.[0];
    if (!game) {
      return NextResponse.json({ error: 'Game not found', reachable: result.reachable || false }, { status: 404 });
    }

    return NextResponse.json({
      name: game.game_name,
      imageUrl: game.game_image ? `https://howlongtobeat.com/games/${game.game_image}` : null,
      mainStory: Math.round((game.comp_main || 0) / 3600),
      mainExtra: Math.round((game.comp_plus || 0) / 3600),
      completionist: Math.round((game.comp_100 || 0) / 3600),
      allStyles: Math.round((game.comp_all || 0) / 3600),
    });
  } catch (error) {
    console.error('HowLongToBeat GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch HowLongToBeat data' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const searchTerm = body.search || body.name;

    if (!searchTerm) {
      return NextResponse.json({ error: 'Missing search term' }, { status: 400 });
    }

    const result = await searchHLTB(searchTerm, 5);

    if (!result) {
      return NextResponse.json({ error: 'HowLongToBeat service unavailable' }, { status: 503 });
    }

    // If site is reachable but API changed, still report success for connection test
    if (result.reachable) {
      return NextResponse.json({ connected: true, message: 'HowLongToBeat is reachable (API format may have changed)', results: [] });
    }

    return NextResponse.json({ connected: true, results: result.data || [] });
  } catch (error) {
    console.error('HowLongToBeat POST error:', error);
    return NextResponse.json({ error: 'Failed to search HowLongToBeat' }, { status: 500 });
  }
}
