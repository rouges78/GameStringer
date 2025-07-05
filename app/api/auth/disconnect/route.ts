import { NextRequest, NextResponse } from 'next/server';

// Funzioni di utilità per localStorage (lato server simulato)
const removeStoredAccount = (providerId: string) => {
  // Questa è una simulazione - nel vero sistema server-side
  // qui rimuoveremmo l'account dal database
  console.log(`Account ${providerId} rimosso dal storage`);
};

export async function POST(request: NextRequest) {
  try {
    const { providerId } = await request.json();
    
    if (!providerId) {
      return NextResponse.json({
        error: 'Provider ID è richiesto'
      }, { status: 400 });
    }
    
    // Rimuovi account dal sistema di auth locale
    console.log(`Disconnessione richiesta per provider: ${providerId}`);
    
    // Simulazione rimozione account per diversi provider
    switch (providerId) {
      case 'steam-credentials':
        removeStoredAccount(providerId);
        console.log('Account Steam disconnesso');
        break;
      case 'epic-credentials':
        removeStoredAccount(providerId);
        console.log('Account Epic Games disconnesso');
        break;
      case 'ubisoft-credentials':
        removeStoredAccount(providerId);
        console.log('Account Ubisoft disconnesso');
        break;
      case 'gog-credentials':
        removeStoredAccount(providerId);
        console.log('Account GOG disconnesso');
        break;
      case 'origin-credentials':
        removeStoredAccount(providerId);
        console.log('Account EA Origin disconnesso');
        break;
      case 'battlenet-credentials':
        removeStoredAccount(providerId);
        console.log('Account Battle.net disconnesso');
        break;
      case 'itchio-credentials':
        removeStoredAccount(providerId);
        console.log('Account itch.io disconnesso');
        break;
      default:
        removeStoredAccount(providerId);
        console.log(`Account ${providerId} disconnesso`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Account ${providerId} disconnesso con successo`,
      provider: providerId
    });
    
  } catch (error) {
    console.error('Errore durante la disconnessione:', error);
    return NextResponse.json({
      error: 'Errore interno del server durante la disconnessione'
    }, { status: 500 });
  }
}
