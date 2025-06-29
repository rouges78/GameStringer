import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const provider = process.env.AI_PROVIDER;
    let apiKey;

    if (provider === 'openai') {
      apiKey = process.env.OPENAI_API_KEY;
    } else if (provider === 'abacusai') {
      apiKey = process.env.ABACUSAI_API_KEY;
    } // Aggiungere altri provider se necessario

    if (!provider || !apiKey) {
      return NextResponse.json(
        { error: 'Configurazione AI non trovata o incompleta nel file .env.local' },
        { status: 500 }
      );
    }

    return NextResponse.json({ provider, apiKey });
  } catch (error) {
    console.error('Errore nel recupero della configurazione AI:', error);
    return NextResponse.json(
      { error: 'Errore interno del server durante il recupero della configurazione AI.' },
      { status: 500 }
    );
  }
}
