import { NextRequest, NextResponse } from 'next/server';

const STEAMGRIDDB_API = 'https://www.steamgriddb.com/api/v2';

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get('search');
  const apiKey = request.headers.get('X-API-Key');

  if (!search) {
    return NextResponse.json({ error: 'Missing search parameter' }, { status: 400 });
  }

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
  }

  try {
    // Search for game
    const searchResponse = await fetch(`${STEAMGRIDDB_API}/search/autocomplete/${encodeURIComponent(search)}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!searchResponse.ok) {
      return NextResponse.json({ error: 'SteamGridDB search failed' }, { status: searchResponse.status });
    }

    const searchData = await searchResponse.json();
    const games = searchData?.data || [];

    if (games.length === 0) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }

    const gameId = games[0].id;

    // Get grids for the game
    const gridsResponse = await fetch(`${STEAMGRIDDB_API}/grids/game/${gameId}?dimensions=600x900`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!gridsResponse.ok) {
      return NextResponse.json({ error: 'Failed to fetch grids' }, { status: gridsResponse.status });
    }

    const gridsData = await gridsResponse.json();

    return NextResponse.json({
      game: games[0],
      grids: gridsData?.data || [],
    });
  } catch (error) {
    console.error('SteamGridDB error:', error);
    return NextResponse.json({ error: 'Failed to fetch SteamGridDB data' }, { status: 500 });
  }
}
