import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { logger } from '@/lib/logger';

// Funzioni di utilità per localStorage (lato server simulato)
const removeStoredAccount = (providerId: string) => {
  // Questa è una simulazione - nel vero sistema server-side
  // qui rimuoveremmo l'account dal database
  logger.debug(`Account ${providerId} rimosso dal storage`);
};

export const POST = withErrorHandler(async function(request: NextRequest) {
  const { providerId } = await request.json();

  if (!providerId) {
    return NextResponse.json({
      error: 'Provider ID è richiesto'
    }, { status: 400 });
  }

  // Rimuovi account dal sistema di auth locale
  logger.debug(`Disconnessione richiesta per provider: ${providerId}`);

  // Simulazione rimozione account per diversi provider
  switch (providerId) {
    case 'steam-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account Steam disconnesso');
      break;
    case 'epic-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account Epic Games disconnesso');
      break;
    case 'ubisoft-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account Ubisoft disconnesso');
      break;
    case 'gog-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account GOG disconnesso');
      break;
    case 'origin-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account EA Origin disconnesso');
      break;
    case 'battlenet-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account Battle.net disconnesso');
      break;
    case 'itchio-credentials':
      removeStoredAccount(providerId);
      logger.debug('Account itch.io disconnesso');
      break;
    default:
      removeStoredAccount(providerId);
      logger.debug(`Account ${providerId} disconnesso`);
  }

  return NextResponse.json({
    success: true,
    message: `Account ${providerId} disconnesso con successo`,
    provider: providerId
  });
});
