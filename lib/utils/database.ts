// Database Utilities for UX Enhancements
import { PrismaClient } from '@prisma/client';
import type { UserTutorialProgress } from '@/lib/types/tutorial';
import type { TranslationMemoryEntry, GlossaryEntry, TranslationProject } from '@/lib/types/translation-memory';
import type { BatchResult } from '@/lib/types/batch';

// Singleton Prisma client
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// Type-safe Prisma client with new models
const db = prisma as any;

// Tutorial Progress Database Operations
export class TutorialDatabase {
  static async getUserProgress(userId: string): Promise<UserTutorialProgress | null> {
    try {
      const progress = await db.tutorialProgress.findMany({
        where: { userId }
      });

      if (progress.length === 0) return null;

      const completedTutorials = progress
        .filter((p: any) => p.completed)
        .map((p: any) => p.tutorialId);

      const currentTutorial = progress.find((p: any) => !p.completed && !p.skipped);

      return {
        userId,
        completedTutorials,
        currentTutorial: currentTutorial ? {
          id: currentTutorial.tutorialId,
          currentStep: currentTutorial.currentStep,
          startedAt: currentTutorial.startedAt
        } : undefined,
        preferences: {
          showHints: true,
          autoAdvance: true,
          skipAnimations: false
        }
      };
    } catch (error) {
      console.error('Error fetching tutorial progress:', error);
      return null;
    }
  }

  static async updateProgress(
    userId: string, 
    tutorialId: string, 
    currentStep: number,
    completed: boolean = false
  ): Promise<void> {
    try {
      await db.tutorialProgress.upsert({
        where: {
          userId_tutorialId: {
            userId,
            tutorialId
          }
        },
        update: {
          currentStep,
          completed,
          completedAt: completed ? new Date() : null
        },
        create: {
          userId,
          tutorialId,
          currentStep,
          completed,
          completedAt: completed ? new Date() : null
        }
      });
    } catch (error) {
      console.error('Error updating tutorial progress:', error);
      throw error;
    }
  }

  static async markTutorialSkipped(userId: string, tutorialId: string): Promise<void> {
    try {
      await db.tutorialProgress.upsert({
        where: {
          userId_tutorialId: {
            userId,
            tutorialId
          }
        },
        update: {
          skipped: true
        },
        create: {
          userId,
          tutorialId,
          skipped: true
        }
      });
    } catch (error) {
      console.error('Error marking tutorial as skipped:', error);
      throw error;
    }
  }
}

// Translation Memory Database Operations
export class TranslationMemoryDatabase {
  static async addEntry(entry: Omit<TranslationMemoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      // Check for existing entry
      const existing = await db.translationMemoryEntry.findFirst({
        where: {
          sourceText: entry.sourceText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          projectId: entry.projectId || null
        }
      });

      if (existing) {
        // Update usage count and target text if different
        await db.translationMemoryEntry.update({
          where: { id: existing.id },
          data: {
            targetText: entry.targetText,
            confidence: Math.max(existing.confidence, entry.confidence),
            usageCount: existing.usageCount + 1,
            updatedAt: new Date()
          }
        });
        return existing.id;
      }

      // Create new entry
      const created = await db.translationMemoryEntry.create({
        data: {
          sourceText: entry.sourceText,
          targetText: entry.targetText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          context: entry.context,
          confidence: entry.confidence,
          projectId: entry.projectId,
          gameId: entry.gameId,
          filePath: entry.filePath,
          tags: entry.tags ? JSON.stringify(entry.tags) : null
        }
      });

      return created.id;
    } catch (error) {
      console.error('Error adding translation memory entry:', error);
      throw error;
    }
  }

  static async searchEntries(
    sourceText: string,
    sourceLanguage: string,
    targetLanguage: string,
    projectId?: string,
    limit: number = 10
  ): Promise<TranslationMemoryEntry[]> {
    try {
      const entries = await db.translationMemoryEntry.findMany({
        where: {
          sourceLanguage,
          targetLanguage,
          projectId: projectId || undefined,
          OR: [
            { sourceText: { contains: sourceText } },
            { sourceText: sourceText } // Exact match gets priority
          ]
        },
        orderBy: [
          { usageCount: 'desc' },
          { confidence: 'desc' },
          { updatedAt: 'desc' }
        ],
        take: limit
      });

      return entries.map((entry: any) => ({
        id: entry.id,
        sourceText: entry.sourceText,
        targetText: entry.targetText,
        sourceLanguage: entry.sourceLanguage,
        targetLanguage: entry.targetLanguage,
        context: entry.context || undefined,
        confidence: entry.confidence,
        createdAt: entry.createdAt,
        updatedAt: entry.updatedAt,
        usageCount: entry.usageCount,
        projectId: entry.projectId || undefined,
        gameId: entry.gameId || undefined,
        filePath: entry.filePath || undefined,
        tags: entry.tags ? JSON.parse(entry.tags) : undefined
      }));
    } catch (error) {
      console.error('Error searching translation memory:', error);
      return [];
    }
  }

  static async incrementUsage(entryId: string): Promise<void> {
    try {
      await db.translationMemoryEntry.update({
        where: { id: entryId },
        data: {
          usageCount: { increment: 1 },
          updatedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error incrementing usage count:', error);
    }
  }
}

// Glossary Database Operations
export class GlossaryDatabase {
  static async addTerm(term: Omit<GlossaryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const created = await db.glossaryEntry.create({
        data: {
          term: term.term,
          translation: term.translation,
          sourceLanguage: term.sourceLanguage,
          targetLanguage: term.targetLanguage,
          definition: term.definition,
          category: term.category,
          projectId: term.project,
          approved: term.approved || false,
          notes: term.notes,
          createdBy: term.createdBy
        }
      });

      return created.id;
    } catch (error) {
      console.error('Error adding glossary term:', error);
      throw error;
    }
  }

  static async searchTerms(
    query: string,
    sourceLanguage: string,
    targetLanguage: string,
    projectId?: string
  ): Promise<GlossaryEntry[]> {
    try {
      const terms = await db.glossaryEntry.findMany({
        where: {
          sourceLanguage,
          targetLanguage,
          projectId: projectId || undefined,
          OR: [
            { term: { contains: query } },
            { translation: { contains: query } },
            { definition: { contains: query } }
          ]
        },
        orderBy: [
          { approved: 'desc' },
          { term: 'asc' }
        ]
      });

      return terms.map((term: any) => ({
        id: term.id,
        term: term.term,
        translation: term.translation,
        sourceLanguage: term.sourceLanguage,
        targetLanguage: term.targetLanguage,
        definition: term.definition || undefined,
        category: term.category || undefined,
        project: term.projectId || undefined,
        createdAt: term.createdAt,
        updatedAt: term.updatedAt,
        createdBy: term.createdBy || undefined,
        approved: term.approved,
        notes: term.notes || undefined
      }));
    } catch (error) {
      console.error('Error searching glossary terms:', error);
      return [];
    }
  }
}

// Batch Operations Database
export class BatchOperationDatabase {
  static async createOperation(
    operationType: string,
    totalItems: number
  ): Promise<string> {
    try {
      const operation = await db.batchOperation.create({
        data: {
          operationType,
          totalItems,
          status: 'pending'
        }
      });

      return operation.id;
    } catch (error) {
      console.error('Error creating batch operation:', error);
      throw error;
    }
  }

  static async updateProgress(
    operationId: string,
    completedItems: number,
    failedItems: number,
    progress: number,
    status?: string
  ): Promise<void> {
    try {
      await db.batchOperation.update({
        where: { id: operationId },
        data: {
          completedItems,
          failedItems,
          progress,
          status: status || undefined
        }
      });
    } catch (error) {
      console.error('Error updating batch operation progress:', error);
    }
  }

  static async completeOperation(
    operationId: string,
    result: BatchResult
  ): Promise<void> {
    try {
      await db.batchOperation.update({
        where: { id: operationId },
        data: {
          status: 'completed',
          completedItems: result.successCount,
          failedItems: result.failureCount,
          progress: 100,
          results: JSON.stringify(result),
          completedAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error completing batch operation:', error);
    }
  }
}

// Database cleanup and maintenance
export class DatabaseMaintenance {
  static async cleanupOldBatchOperations(daysOld: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      await db.batchOperation.deleteMany({
        where: {
          completedAt: {
            lt: cutoffDate
          },
          status: {
            in: ['completed', 'failed', 'cancelled']
          }
        }
      });
    } catch (error) {
      console.error('Error cleaning up old batch operations:', error);
    }
  }

  static async getMemoryStats(): Promise<{
    totalEntries: number;
    totalGlossaryTerms: number;
    totalProjects: number;
  }> {
    try {
      const [memoryCount, glossaryCount, projectCount] = await Promise.all([
        db.translationMemoryEntry.count(),
        db.glossaryEntry.count(),
        db.translationProject.count()
      ]);

      return {
        totalEntries: memoryCount,
        totalGlossaryTerms: glossaryCount,
        totalProjects: projectCount
      };
    } catch (error) {
      console.error('Error getting memory stats:', error);
      return {
        totalEntries: 0,
        totalGlossaryTerms: 0,
        totalProjects: 0
      };
    }
  }
}