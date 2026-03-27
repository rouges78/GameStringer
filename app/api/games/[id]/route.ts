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
  const include: any = {};
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
  if (includeTranslations && game.translations) {
    const stats = {
      total: game.translations.length,
      completed: game.translations.filter((t: any) => t.status === 'completed').length,
      pending: game.translations.filter((t: any) => t.status === 'pending').length,
      reviewed: game.translations.filter((t: any) => t.status === 'reviewed').length,
      edited: game.translations.filter((t: any) => t.status === 'edited').length,
      averageConfidence: game.translations.reduce((sum, t) => sum + t.confidence, 0) / game.translations.length || 0
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
