import { NextRequest, NextResponse } from 'next/server';

// In-memory storage for translations (in production, use a database)
const translations: any[] = [];

// GET /api/translations - Get all translations with optional filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    let filtered = [...translations];

    if (gameId && gameId !== 'all') {
      filtered = filtered.filter(t => t.gameId === gameId);
    }

    if (status && status !== 'all') {
      filtered = filtered.filter(t => t.status === status);
    }

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(t => 
        t.originalText?.toLowerCase().includes(searchLower) ||
        t.translatedText?.toLowerCase().includes(searchLower)
      );
    }

    return NextResponse.json(filtered);
  } catch (error) {
    console.error('Error fetching translations:', error);
    return NextResponse.json({ error: 'Failed to fetch translations' }, { status: 500 });
  }
}

// POST /api/translations - Create a new translation
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const newTranslation = {
      id: `trans-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      gameId: body.gameId || 'unknown',
      filePath: body.filePath || '',
      originalText: body.originalText || '',
      translatedText: body.translatedText || '',
      targetLanguage: body.targetLanguage || 'it',
      sourceLanguage: body.sourceLanguage || 'en',
      status: body.status || 'pending',
      confidence: body.confidence || 0,
      isManualEdit: body.isManualEdit || false,
      context: body.context || '',
      updatedAt: new Date().toISOString(),
      game: body.game || { id: body.gameId || 'unknown', title: 'Unknown Game', platform: 'Unknown' },
      suggestions: body.suggestions || []
    };

    translations.push(newTranslation);

    return NextResponse.json(newTranslation, { status: 201 });
  } catch (error) {
    console.error('Error creating translation:', error);
    return NextResponse.json({ error: 'Failed to create translation' }, { status: 500 });
  }
}

// PUT /api/translations - Update an existing translation
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Translation ID is required' }, { status: 400 });
    }

    const index = translations.findIndex(t => t.id === id);
    
    if (index === -1) {
      // If translation doesn't exist, create it
      const newTranslation = {
        id,
        gameId: updates.gameId || 'unknown',
        filePath: updates.filePath || '',
        originalText: updates.originalText || '',
        translatedText: updates.translatedText || '',
        targetLanguage: updates.targetLanguage || 'it',
        sourceLanguage: updates.sourceLanguage || 'en',
        status: updates.status || 'edited',
        confidence: updates.confidence || 0,
        isManualEdit: true,
        context: updates.context || '',
        updatedAt: new Date().toISOString(),
        game: updates.game || { id: updates.gameId || 'unknown', title: 'Unknown Game', platform: 'Unknown' },
        suggestions: updates.suggestions || []
      };
      translations.push(newTranslation);
      return NextResponse.json(newTranslation);
    }

    translations[index] = {
      ...translations[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    return NextResponse.json(translations[index]);
  } catch (error) {
    console.error('Error updating translation:', error);
    return NextResponse.json({ error: 'Failed to update translation' }, { status: 500 });
  }
}

// DELETE /api/translations - Delete a translation
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Translation ID is required' }, { status: 400 });
    }

    const index = translations.findIndex(t => t.id === id);
    
    if (index === -1) {
      return NextResponse.json({ error: 'Translation not found' }, { status: 404 });
    }

    translations.splice(index, 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting translation:', error);
    return NextResponse.json({ error: 'Failed to delete translation' }, { status: 500 });
  }
}
