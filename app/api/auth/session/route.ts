import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../[...nextauth]/route';

export async function GET(request: NextRequest) {
  try {
    console.log('[API Session] Richiesta GET session API...');
    
    // Usa authOptions per la configurazione corretta
    const session = await getServerSession(authOptions);
    
    console.log('[API Session] Session trovata:', session ? 'Sì' : 'No');
    
    // Restituisci sempre un JSON valido
    return NextResponse.json({
      user: session?.user || null,
      expires: session?.expires || null,
      authenticated: !!session
    });
    
  } catch (error) {
    console.error('[API Session] Errore GET:', error);
    
    // Anche in caso di errore, restituisci un JSON valido
    return NextResponse.json({
      user: null,
      expires: null,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('[API Session] Richiesta POST session API...');
    
    // Usa authOptions per la configurazione corretta
    const session = await getServerSession(authOptions);
    
    console.log('[API Session] Session trovata:', session ? 'Sì' : 'No');
    
    // Restituisci sempre un JSON valido (stesso formato di GET)
    return NextResponse.json({
      user: session?.user || null,
      expires: session?.expires || null,
      authenticated: !!session
    });
    
  } catch (error) {
    console.error('[API Session] Errore POST:', error);
    
    // Anche in caso di errore, restituisci un JSON valido
    return NextResponse.json({
      user: null,
      expires: null,
      authenticated: false,
      error: error instanceof Error ? error.message : 'Errore sconosciuto'
    }, { status: 500 });
  }
}
