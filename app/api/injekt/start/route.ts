import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getInjectionService } from '@/lib/injection-service';

interface TranslationConfig {
  enabled: boolean;
  sourceLang: string;
  targetLang: string;
  overlayPosition: string;
  overlayOpacity: number;
  fontSize: number;
  backgroundColor: string;
  textColor: string;
  hotkey: string;
  autoDetectLanguage: boolean;
  cacheTranslations: boolean;
  showOriginalText: boolean;
}

// Mappa temporanea per memorizzare le sessioni attive
// In produzione useresti Redis o un database
export const activeSessions = new Map<number, any>();

const injectionService = getInjectionService();

export async function POST(request: Request) {
  try {
    const { processId, processName, config } = await request.json();

    // Verifica se la sessione è già attiva
    if (activeSessions.has(processId)) {
      return NextResponse.json({
        success: false,
        message: 'Sessione già attiva per questo processo'
      });
    }

    // Crea una nuova sessione
    const session = {
      processId,
      config,
      startTime: new Date(),
      status: 'active',
      translatedCount: 0,
      cache: new Map()
    };

    activeSessions.set(processId, session);

    // In futuro si potrebbe aggiungere il logging nel database
    // Per ora logghiamo solo in console

    // Verifica se servono privilegi admin
    if (injectionService.requiresAdmin()) {
      return NextResponse.json({
        success: false,
        message: 'Richiesti privilegi di amministratore. Riavvia GameStringer come amministratore.',
        requiresAdmin: true
      }, { status: 403 });
    }

    // Ottieni info sul processo
    const processInfo = await injectionService.getProcessInfo(processId);
    if (!processInfo) {
      return NextResponse.json({
        success: false,
        message: 'Impossibile accedere al processo. Verifica che il gioco sia in esecuzione.'
      }, { status: 404 });
    }

    console.log(`[INJEKT] Processo ${processId} - 64bit: ${processInfo.is64Bit}`);
    console.log(`[INJEKT] Moduli caricati: ${processInfo.modules.length}`);

    try {
      // Esegui injection reale usando il sistema di profili
      // Le traduzioni vengono caricate automaticamente dal profilo del gioco
      const injectionResult = await injectionService.injectTranslations(
        processId,
        processName
      );

      console.log(`[INJEKT] Injection completata:`, injectionResult);
      
      // Aggiorna sessione con risultati
      (session as any).injectionResult = injectionResult;
      (session as any).isInjected = injectionResult.success;
      session.translatedCount = injectionResult.injectedCount;

    } catch (error) {
      console.error('[INJEKT] Errore injection:', error);
      // Continua comunque per testing
    }

    return NextResponse.json({
      success: true,
      message: 'Traduzione avviata con successo',
      sessionId: processId
    });

  } catch (error) {
    console.error('Errore avvio injection:', error);
    return NextResponse.json({
      success: false,
      message: 'Errore durante l\'avvio della traduzione'
    }, { status: 500 });
  }
}


