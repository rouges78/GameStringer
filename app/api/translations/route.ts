import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// GET - Recupera tutte le traduzioni con filtri opzionali
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const gameId = searchParams.get('gameId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: any = {};
    
    if (gameId && gameId !== 'all') {
      where.gameId = gameId;
    }
    
    if (status && status !== 'all') {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { originalText: { contains: search } },
        { translatedText: { contains: search } }
      ];
    }

    const translations = await prisma.translation.findMany({
      where,
      include: {
        game: {
          select: {
            id: true,
            title: true,
            platform: true
          }
        },
        suggestions: {
          orderBy: {
            confidence: 'desc'
          }
        }
      },
      orderBy: {
        updatedAt: 'desc'
      }
    });

    return NextResponse.json(translations);
  } catch (error) {
    console.error('Errore nel recupero delle traduzioni:', error);
    return NextResponse.json(
      { error: 'Errore nel recupero delle traduzioni' },
      { status: 500 }
    );
  }
}

// POST - Crea una nuova traduzione
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const {
      gameId,
      filePath,
      originalText,
      translatedText,
      targetLanguage,
      sourceLanguage = 'en',
      context
    } = body;

    const translation = await prisma.translation.create({
      data: {
        gameId,
        filePath,
        originalText,
        translatedText: translatedText || '',
        targetLanguage,
        sourceLanguage,
        context,
        status: translatedText ? 'completed' : 'pending'
      },
      include: {
        game: true,
        suggestions: true
      }
    });

    return NextResponse.json(translation);
  } catch (error) {
    console.error('Errore nella creazione della traduzione:', error);
    return NextResponse.json(
      { error: 'Errore nella creazione della traduzione' },
      { status: 500 }
    );
  }
}

// PUT - Aggiorna una traduzione esistente
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { id, translatedText, status, isManualEdit } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'ID traduzione mancante' },
        { status: 400 }
      );
    }

    const updateData: any = {
      updatedAt: new Date()
    };

    if (translatedText !== undefined) {
      updateData.translatedText = translatedText;
      updateData.isManualEdit = true;
      updateData.status = 'edited';
    }

    if (status) {
      updateData.status = status;
    }

    if (isManualEdit !== undefined) {
      updateData.isManualEdit = isManualEdit;
    }

    const translation = await prisma.translation.update({
      where: { id },
      data: updateData,
      include: {
        game: true,
        suggestions: true
      }
    });

    return NextResponse.json(translation);
  } catch (error) {
    console.error('Errore nell\'aggiornamento della traduzione:', error);
    return NextResponse.json(
      { error: 'Errore nell\'aggiornamento della traduzione' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina una traduzione
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'ID traduzione mancante' },
        { status: 400 }
      );
    }

    await prisma.translation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione della traduzione:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione della traduzione' },
      { status: 500 }
    );
  }
}