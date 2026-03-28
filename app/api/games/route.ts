import { NextRequest, NextResponse } from 'next/server';
import { getGamesWithTranslationCount } from '@/lib/db-queries';
import { prisma } from '@/lib/prisma';
import { withErrorHandler } from '@/lib/error-handler';

export const GET = withErrorHandler(async function(request: NextRequest) {
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
  const where: Record<string, unknown> = {};
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
});

export const POST = withErrorHandler(async function(request: NextRequest) {
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
});

export const PUT = withErrorHandler(async function(request: NextRequest) {
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
});

export const DELETE = withErrorHandler(async function(request: NextRequest) {
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
});
