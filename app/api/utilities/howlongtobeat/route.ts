import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  
  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  try {
    const response = await fetch('https://howlongtobeat.com/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://howlongtobeat.com',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        searchType: 'games',
        searchTerms: name.split(' '),
        searchPage: 1,
        size: 1,
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
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'HowLongToBeat API error' }, { status: response.status });
    }

    const data = await response.json();
    const game = data?.data?.[0];

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
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
    console.error('HowLongToBeat error:', error);
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

    const response = await fetch('https://howlongtobeat.com/api/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://howlongtobeat.com',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify({
        searchType: 'games',
        searchTerms: searchTerm.split(' '),
        searchPage: 1,
        size: 5,
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
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'HowLongToBeat API error' }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json({ results: data?.data || [] });
  } catch (error) {
    console.error('HowLongToBeat POST error:', error);
    return NextResponse.json({ error: 'Failed to search HowLongToBeat' }, { status: 500 });
  }
}
