import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

interface ImportData {
  gameId: string;
  translations: {
    filePath: string;
    originalText: string;
    translatedText: string;
    targetLanguage: string;
    sourceLanguage?: string;
    context?: string;
  }[];
}

// POST - Importa traduzioni in batch
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body: ImportData = await request.json();
    const { gameId, translations } = body;

    if (!gameId || !translations || !Array.isArray(translations)) {
      return NextResponse.json(
        { error: 'Dati di importazione non validi' },
        { status: 400 }
      );
    }

    // Verifica che il gioco esista
    const game = await prisma.game.findUnique({
      where: { id: gameId }
    });

    if (!game) {
      return NextResponse.json(
        { error: 'Gioco non trovato' },
        { status: 404 }
      );
    }

    // Importa le traduzioni in batch
    const results = await Promise.all(
      translations.map(async (translation) => {
        try {
          // Cerca se esiste già una traduzione per questo testo
          const existing = await prisma.translation.findFirst({
            where: {
              gameId,
              originalText: translation.originalText,
              targetLanguage: translation.targetLanguage
            }
          });

          if (existing) {
            // Aggiorna la traduzione esistente
            return await prisma.translation.update({
              where: { id: existing.id },
              data: {
                translatedText: translation.translatedText,
                status: translation.translatedText ? 'completed' : 'pending',
                isManualEdit: true,
                context: translation.context || existing.context
              }
            });
          } else {
            // Crea una nuova traduzione
            return await prisma.translation.create({
              data: {
                gameId,
                filePath: translation.filePath,
                originalText: translation.originalText,
                translatedText: translation.translatedText || '',
                targetLanguage: translation.targetLanguage,
                sourceLanguage: translation.sourceLanguage || 'en',
                status: translation.translatedText ? 'completed' : 'pending',
                context: translation.context
              }
            });
          }
        } catch (error) {
          console.error('Errore nell\'importazione della traduzione:', error);
          return null;
        }
      })
    );

    const successCount = results.filter((r: any) => r !== null).length;
    const failedCount = results.filter((r: any) => r === null).length;

    return NextResponse.json({
      success: true,
      imported: successCount,
      failed: failedCount,
      total: translations.length
    });
  } catch (error) {
    console.error('Errore nell\'importazione delle traduzioni:', error);
    return NextResponse.json(
      { error: 'Errore nell\'importazione delle traduzioni' },
      { status: 500 }
    );
  }
}