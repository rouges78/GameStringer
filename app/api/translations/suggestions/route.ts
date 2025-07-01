import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

// Simulazione di un servizio AI per generare suggerimenti
async function generateAISuggestions(text: string, targetLanguage: string): Promise<string[]> {
  // In un'implementazione reale, qui chiameresti un servizio AI come OpenAI, DeepL, etc.
  
  // Simulazione di suggerimenti per l'italiano
  if (targetLanguage === 'it') {
    const suggestions: Record<string, string[]> = {
      'Welcome to Night City, the most dangerous place on Earth.': [
        'Benvenuti a Night City, il luogo più pericoloso del mondo.',
        'Benvenuto a Night City, la località più pericolosa sulla Terra.',
        'Ti diamo il benvenuto a Night City, il posto più rischioso del pianeta.'
      ],
      'Your reputation in Night City will determine your story.': [
        'La reputazione che avrai a Night City plasmerà la tua storia.',
        'La tua fama a Night City influenzerà il tuo destino.',
        'Il tuo prestigio a Night City definirà il tuo percorso.'
      ],
      'Hunt mechanical beasts in a lush, post-apocalyptic world.': [
        'Caccia bestie meccaniche in un mondo post-apocalittico rigoglioso.',
        'Dai la caccia a creature meccaniche in un lussureggiante mondo post-apocalittico.',
        'Insegui bestie robotiche in un florido ambiente post-apocalittico.'
      ]
    };
    
    return suggestions[text] || [
      `Traduzione automatica di: ${text}`,
      `Versione alternativa: ${text}`,
      `Suggerimento AI: ${text}`
    ];
  }
  
  // Default per altre lingue
  return [
    `AI Translation 1: ${text}`,
    `AI Translation 2: ${text}`,
    `AI Translation 3: ${text}`
  ];
}

// POST - Genera suggerimenti AI per una traduzione
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const body = await request.json();
    const { translationId, originalText, targetLanguage } = body;

    if (!translationId || !originalText || !targetLanguage) {
      return NextResponse.json(
        { error: 'Parametri mancanti' },
        { status: 400 }
      );
    }

    // Genera suggerimenti AI
    const aiSuggestions = await generateAISuggestions(originalText, targetLanguage);
    
    // Salva i suggerimenti nel database
    const suggestions = await Promise.all(
      aiSuggestions.map((suggestion, index) =>
        prisma.aISuggestion.create({
          data: {
            translationId,
            suggestion,
            confidence: 0.95 - (index * 0.05), // Confidenza decrescente
            provider: 'openai'
          }
        })
      )
    );

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Errore nella generazione dei suggerimenti:', error);
    return NextResponse.json(
      { error: 'Errore nella generazione dei suggerimenti' },
      { status: 500 }
    );
  }
}

// DELETE - Elimina tutti i suggerimenti per una traduzione
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const translationId = searchParams.get('translationId');

    if (!translationId) {
      return NextResponse.json(
        { error: 'ID traduzione mancante' },
        { status: 400 }
      );
    }

    await prisma.aISuggestion.deleteMany({
      where: { translationId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Errore nell\'eliminazione dei suggerimenti:', error);
    return NextResponse.json(
      { error: 'Errore nell\'eliminazione dei suggerimenti' },
      { status: 500 }
    );
  }
}