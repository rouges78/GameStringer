import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { providerId } = await request.json();
    
    if (!providerId) {
      return NextResponse.json({ error: 'Provider ID richiesto' }, { status: 400 });
    }

    // Here you would typically remove the provider from the user's account
    // For now, we'll just return success
    console.log(`Disconnecting provider: ${providerId} for user: ${session.user?.email}`);
    
    return NextResponse.json({ 
      success: true, 
      message: `Provider ${providerId} disconnesso con successo` 
    });
    
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: 'Errore durante la disconnessione' }, 
      { status: 500 }
    );
  }
}
