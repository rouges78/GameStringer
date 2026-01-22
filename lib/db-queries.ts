import { prisma } from './prisma';
import type { Translation, Game, AISuggestion } from '@prisma/client';

// Tipi ottimizzati per query performance
export interface TranslationWithSuggestions extends Translation {
  suggestions: AISuggestion[];
}

export interface GameWithTranslations extends Game {
  translations: Translation[];
}

export interface TranslationQueryOptions {
  gameId?: string;
  status?: string;
  targetLanguage?: string;
  skip?: number;
  take?: number;
  orderBy?: 'createdAt' | 'updatedAt' | 'confidence';
  orderDirection?: 'asc' | 'desc';
}

export interface TranslationStats {
  total: number;
  completed: number;
  pending: number;
  reviewed: number;
  edited: number;
  averageConfidence: number;
}

/**
 * OTTIMIZZAZIONE #1: Query batch per traduzioni con pagination
 */
export async function getTranslationsBatch(options: TranslationQueryOptions = {}) {
  const {
    gameId,
    status,
    targetLanguage,
    skip = 0,
    take = 50,
    orderBy = 'updatedAt',
    orderDirection = 'desc'
  } = options;

  const where: any = {};
  if (gameId) where.gameId = gameId;
  if (status) where.status = status;
  if (targetLanguage) where.targetLanguage = targetLanguage;

  // Query ottimizzata con indexes
  const [translations, total] = await Promise.all([
    prisma.translation.findMany({
      where,
      skip,
      take,
      orderBy: { [orderBy]: orderDirection },
      include: {
        game: {
          select: {
            id: true,
            title: true,
            platform: true,
            imageUrl: true
          }
        },
        suggestions: {
          orderBy: { confidence: 'desc' },
          take: 3 // Limit AI suggestions per performance
        }
      }
    }),
    prisma.translation.count({ where })
  ]);

  return {
    translations,
    total,
    hasMore: skip + take < total,
    nextSkip: skip + take
  };
}

/**
 * OTTIMIZZAZIONE #2: Query aggregate per statistiche
 */
export async function getTranslationStats(gameId?: string): Promise<TranslationStats> {
  const where = gameId ? { gameId } : {};

  const [
    total,
    completed,
    pending,
    reviewed,
    edited,
    avgConfidence
  ] = await Promise.all([
    prisma.translation.count({ where }),
    prisma.translation.count({ where: { ...where, status: 'completed' } }),
    prisma.translation.count({ where: { ...where, status: 'pending' } }),
    prisma.translation.count({ where: { ...where, status: 'reviewed' } }),
    prisma.translation.count({ where: { ...where, status: 'edited' } }),
    prisma.translation.aggregate({
      where,
      _avg: { confidence: true }
    })
  ]);

  return {
    total,
    completed,
    pending,
    reviewed,
    edited,
    averageConfidence: avgConfidence._avg.confidence || 0
  };
}

/**
 * OTTIMIZZAZIONE #3: Query bulk update per traduzioni
 */
export async function bulkUpdateTranslations(
  translationIds: string[],
  updates: Partial<Translation>
) {
  if (translationIds.length === 0) return { count: 0 };

  const result = await prisma.translation.updateMany({
    where: {
      id: { in: translationIds }
    },
    data: {
      ...updates,
      updatedAt: new Date()
    }
  });

  return result;
}

/**
 * OTTIMIZZAZIONE #4: Query upsert per traduzioni
 */
export async function upsertTranslation(
  gameId: string,
  filePath: string,
  originalText: string,
  translationData: Partial<Translation>
) {
  const createData = {
    gameId,
    filePath,
    originalText,
    translatedText: translationData.translatedText || '',
    targetLanguage: translationData.targetLanguage || 'it',
    sourceLanguage: translationData.sourceLanguage || 'en',
    status: translationData.status || 'pending',
    confidence: translationData.confidence || 0,
    isManualEdit: translationData.isManualEdit || false,
    context: translationData.context || null,
  };
  
  return prisma.translation.upsert({
    where: {
      // Composite unique constraint simulata
      id: `${gameId}-${filePath}-${originalText.substring(0, 50)}`
    },
    update: {
      ...translationData,
      updatedAt: new Date()
    },
    create: createData
  });
}

/**
 * OTTIMIZZAZIONE #5: Query giochi con conteggio traduzioni
 */
export async function getGamesWithTranslationCount() {
  const games = await prisma.game.findMany({
    select: {
      id: true,
      title: true,
      platform: true,
      imageUrl: true,
      isInstalled: true,
      steamAppId: true,
      lastPlayed: true,
      _count: {
        select: {
          translations: true
        }
      }
    },
    orderBy: { lastPlayed: 'desc' }
  });

  return games.map(game => ({
    ...game,
    translationCount: game._count.translations
  }));
}

/**
 * OTTIMIZZAZIONE #6: Query ricerca full-text simulata
 */
export async function searchTranslations(
  searchTerm: string,
  options: TranslationQueryOptions = {}
) {
  const { gameId, status, targetLanguage, skip = 0, take = 50 } = options;

  const where: any = {
    OR: [
      { originalText: { contains: searchTerm } },
      { translatedText: { contains: searchTerm } },
      { context: { contains: searchTerm } }
    ]
  };

  if (gameId) where.gameId = gameId;
  if (status) where.status = status;
  if (targetLanguage) where.targetLanguage = targetLanguage;

  const [results, total] = await Promise.all([
    prisma.translation.findMany({
      where,
      skip,
      take,
      include: {
        game: {
          select: {
            id: true,
            title: true,
            platform: true
          }
        }
      },
      orderBy: { confidence: 'desc' }
    }),
    prisma.translation.count({ where })
  ]);

  return {
    results,
    total,
    hasMore: skip + take < total
  };
}

/**
 * OTTIMIZZAZIONE #7: Query batch per AI suggestions
 */
export async function getBatchAISuggestions(translationIds: string[]) {
  if (translationIds.length === 0) return [];

  return prisma.aISuggestion.findMany({
    where: {
      translationId: { in: translationIds }
    },
    orderBy: [
      { translationId: 'asc' },
      { confidence: 'desc' }
    ],
    take: translationIds.length * 3 // Max 3 suggestions per translation
  });
}

/**
 * OTTIMIZZAZIONE #8: Query performance monitoring
 */
export async function getQueryPerformanceMetrics() {
  const start = Date.now();
  
  const [
    totalTranslations,
    totalGames,
    totalSuggestions,
    recentTranslations
  ] = await Promise.all([
    prisma.translation.count(),
    prisma.game.count(),
    prisma.aISuggestion.count(),
    prisma.translation.findMany({
      take: 10,
      orderBy: { updatedAt: 'desc' },
      select: { id: true, updatedAt: true }
    })
  ]);

  const queryTime = Date.now() - start;

  return {
    totalTranslations,
    totalGames,
    totalSuggestions,
    recentTranslations: recentTranslations.length,
    queryTime
  };
}

/**
 * OTTIMIZZAZIONE #9: Connection pool management
 */
export async function checkDatabaseConnection() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'connected', timestamp: new Date() };
  } catch (error) {
    console.error('Database connection check failed:', error);
    return { status: 'disconnected', error: error.message, timestamp: new Date() };
  }
}

/**
 * OTTIMIZZAZIONE #10: Cleanup old suggestions
 */
export async function cleanupOldSuggestions(daysOld: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);

  const result = await prisma.aISuggestion.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      confidence: { lt: 0.5 } // Remove only low-confidence old suggestions
    }
  });

  return result;
}