import { NextRequest, NextResponse } from 'next/server';
import { HowLongToBeatService } from 'howlongtobeat';

const hltbService = new HowLongToBeatService();

export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get('name');
  
  if (!name) {
    return NextResponse.json({ error: 'Missing name parameter' }, { status: 400 });
  }

  try {
    const results = await hltbService.search(name);

    if (!results || results.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const game = results[0];
    return NextResponse.json({
      name: game.name,
      imageUrl: game.imageUrl,
      mainStory: game.gameplayMain,
      mainExtra: game.gameplayMainExtra,
      completionist: game.gameplayCompletionist,
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

    const results = await hltbService.search(searchTerm);
    return NextResponse.json({ connected: true, results: results || [] });
  } catch (error) {
    console.error('HowLongToBeat POST error:', error);
    return NextResponse.json({ error: 'Failed to search HowLongToBeat' }, { status: 500 });
  }
}
