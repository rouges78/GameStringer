import { NextRequest, NextResponse } from 'next/server';
import { getGamesWithTranslationCount } from '@/lib/db-queries';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeTranslationCount = searchParams.get('includeTranslationCount') === 'true';
    const platform = searchParams.get('platform');
    const isInstalled = searchParams.get('isInstalled');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');

    if (includeTranslationCount) {
      // Use optimized query for games with translation counts
      const games = await getGamesWithTranslationCount();
      return NextResponse.json(games);
    }

    // Build where clause
    const where: any = {};
    if (platform) where.platform = platform;
    if (isInstalled !== null) where.isInstalled = isInstalled === 'true';

    // Regular games query with pagination
    const [games, total] = await Promise.all([
      prisma.game.findMany({
        where,
        skip,
        take,
        orderBy: { lastPlayed: 'desc' }
      }),
      prisma.game.count({ where })
    ]);

    return NextResponse.json({
      games,
      total,
      hasMore: skip + take < total
    });

  } catch (error) {
    console.error('Error fetching games:', error);
    return NextResponse.json(
      { error: 'Failed to fetch games' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, platform, ...gameData } = body;

    if (!title || !platform) {
      return NextResponse.json(
        { error: 'Missing required fields: title, platform' },
        { status: 400 }
      );
    }

    // Check if game already exists
    const existingGame = await prisma.game.findFirst({
      where: {
        title,
        platform,
        steamAppId: gameData.steamAppId || undefined
      }
    });

    if (existingGame) {
      return NextResponse.json(
        { error: 'Game already exists' },
        { status: 409 }
      );
    }

    const game = await prisma.game.create({
      data: {
        title,
        platform,
        ...gameData
      }
    });

    return NextResponse.json(game, { status: 201 });

  } catch (error) {
    console.error('Error creating game:', error);
    return NextResponse.json(
      { error: 'Failed to create game' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing game ID' },
        { status: 400 }
      );
    }

    const game = await prisma.game.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      }
    });

    return NextResponse.json(game);

  } catch (error) {
    console.error('Error updating game:', error);
    return NextResponse.json(
      { error: 'Failed to update game' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing game ID' },
        { status: 400 }
      );
    }

    await prisma.game.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Game deleted successfully' });

  } catch (error) {
    console.error('Error deleting game:', error);
    return NextResponse.json(
      { error: 'Failed to delete game' },
      { status: 500 }
    );
  }
}