import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withErrorHandler } from '@/lib/error-handler';

export const GET = withErrorHandler(async function(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const includeTranslations = searchParams.get('includeTranslations') === 'true';

  // Build the query based on what data is requested
  const include: Record<string, unknown> = {};
  if (includeTranslations) {
    include.translations = {
      include: {
        suggestions: {
          orderBy: { confidence: 'desc' },
          take: 3
        }
      },
      orderBy: { updatedAt: 'desc' }
    };
  }

  const game = await prisma.game.findUnique({
    where: { id },
    include
  });

  if (!game) {
    return NextResponse.json(
      { error: 'Game not found' },
      { status: 404 }
    );
  }

  // If translations are included, add summary stats
  const gameAny = game as Record<string, unknown>;
  const translations = gameAny.translations as Array<{ status: string; confidence: number }> | undefined;
  if (includeTranslations && translations) {
    const stats = {
      total: translations.length,
      completed: translations.filter((t) => t.status === 'completed').length,
      pending: translations.filter((t) => t.status === 'pending').length,
      reviewed: translations.filter((t) => t.status === 'reviewed').length,
      edited: translations.filter((t) => t.status === 'edited').length,
      averageConfidence: translations.reduce((sum, t) => sum + t.confidence, 0) / translations.length || 0
    };

    return NextResponse.json({
      ...game,
      translationStats: stats
    });
  }

  return NextResponse.json(game);
});

export const PUT = withErrorHandler(async function(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const game = await prisma.game.update({
    where: { id },
    data: {
      ...body,
      updatedAt: new Date()
    }
  });

  return NextResponse.json(game, { status: 200 });
});

export const DELETE = withErrorHandler(async function(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  await prisma.game.delete({
    where: { id }
  });

  return NextResponse.json({ message: 'Game deleted successfully' }, { status: 200 });
});
