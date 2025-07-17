import { NextRequest, NextResponse } from 'next/server';
import { 
  getTranslationsBatch, 
  getTranslationStats, 
  bulkUpdateTranslations,
  searchTranslations,
  upsertTranslation
} from '@/lib/db-queries';
import { prisma } from '@/lib/prisma';
import { withErrorHandler, ValidationError } from '@/lib/error-handler';

export const GET = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Extract query parameters
    const gameId = searchParams.get('gameId');
    const status = searchParams.get('status');
    const targetLanguage = searchParams.get('targetLanguage');
    const search = searchParams.get('search');
    const skip = parseInt(searchParams.get('skip') || '0');
    const take = parseInt(searchParams.get('take') || '50');
    const orderBy = searchParams.get('orderBy') as 'createdAt' | 'updatedAt' | 'confidence' || 'updatedAt';
    const orderDirection = searchParams.get('orderDirection') as 'asc' | 'desc' || 'desc';
    const statsOnly = searchParams.get('stats') === 'true';

    // Return only statistics if requested
    if (statsOnly) {
      const stats = await getTranslationStats(gameId || undefined);
      return NextResponse.json(stats);
    }

    // Handle search queries
    if (search) {
      const results = await searchTranslations(search, {
        gameId: gameId || undefined,
        status: status || undefined,
        targetLanguage: targetLanguage || undefined,
        skip,
        take
      });
      return NextResponse.json(results);
    }

    // Handle regular queries with optimization
    const result = await getTranslationsBatch({
      gameId: gameId || undefined,
      status: status || undefined,
      targetLanguage: targetLanguage || undefined,
      skip,
      take,
      orderBy,
      orderDirection
    });

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error fetching translations:', error);
    throw error;
  }
});

export const POST = withErrorHandler(async function(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId, filePath, originalText, ...translationData } = body;

    if (!gameId || !filePath || !originalText) {
      throw new ValidationError('Missing required fields: gameId, filePath, originalText');
    }

    // Use optimized upsert
    const translation = await upsertTranslation(
      gameId,
      filePath,
      originalText,
      translationData
    );

    return NextResponse.json(translation, { status: 201 });

  } catch (error) {
    console.error('Error creating translation:', error);
    throw error;
  }
});

export const PUT = withErrorHandler(async function(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ids, ...updateData } = body;

    // Handle bulk updates
    if (ids && Array.isArray(ids)) {
      const result = await bulkUpdateTranslations(ids, updateData);
      return NextResponse.json({ 
        message: `Updated ${result.count} translations`,
        count: result.count
      });
    }

    // Handle single update
    if (!id) {
      throw new ValidationError('Missing translation ID');
    }

    const translation = await prisma.translation.update({
      where: { id },
      data: {
        ...updateData,
        updatedAt: new Date()
      },
      include: {
        suggestions: {
          orderBy: { confidence: 'desc' },
          take: 3
        }
      }
    });

    return NextResponse.json(translation);

  } catch (error) {
    console.error('Error updating translation:', error);
    throw error;
  }
});

export const DELETE = withErrorHandler(async function(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const ids = searchParams.get('ids')?.split(',');

    // Handle bulk deletion
    if (ids && ids.length > 0) {
      const result = await prisma.translation.deleteMany({
        where: { id: { in: ids } }
      });
      return NextResponse.json({ 
        message: `Deleted ${result.count} translations`,
        count: result.count
      });
    }

    // Handle single deletion
    if (!id) {
      throw new ValidationError('Missing translation ID');
    }

    await prisma.translation.delete({
      where: { id }
    });

    return NextResponse.json({ message: 'Translation deleted successfully' });

  } catch (error) {
    console.error('Error deleting translation:', error);
    throw error;
  }
});