import { NextResponse } from 'next/server';
import { activeSessions } from '../start/route';

export async function POST(request: Request) {
  try {
    const { processId } = await request.json();

    // Verifica se la sessione esiste
    if (!activeSessions.has(processId)) {
      return NextResponse.json({
        success: false,
        message: 'Nessuna sessione attiva trovata'
      });
    }

    // Rimuovi la sessione
    const session = activeSessions.get(processId);
    activeSessions.delete(processId);

    console.log(`[INJEKT] Fermata sessione per processo ${processId}`);
    console.log(`[INJEKT] Traduzioni effettuate: ${session.translatedCount}`);

    return NextResponse.json({
      success: true,
      message: 'Traduzione fermata con successo',
      stats: {
        translatedCount: session.translatedCount,
        duration: Date.now() - session.startTime.getTime()
      }
    });

  } catch (error) {
    console.error('Errore stop injection:', error);
    return NextResponse.json({
      success: false,
      message: 'Errore durante l\'arresto della traduzione'
    }, { status: 500 });
  }
}
