import { NextRequest, NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/error-handler';
import { clientLogger } from '@/lib/client-logger';

export const GET = withErrorHandler(async function(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  clientLogger.debug('[EPIC OAUTH] Callback ricevuto', 'EPIC_OAUTH', { code: code ?? undefined, error: error ?? undefined, errorDescription: errorDescription ?? undefined });

  if (error) {
    clientLogger.error('[EPIC OAUTH] Errore OAuth', 'EPIC_OAUTH', { error, errorDescription });
    return NextResponse.redirect(new URL('/store-manager?epic_error=' + encodeURIComponent(error), request.url));
  }

  if (!code) {
    clientLogger.error('[EPIC OAUTH] Authorization code mancante');
    return NextResponse.redirect(new URL('/store-manager?epic_error=no_code', request.url));
  }

  // Qui dovremmo scambiare il code con un access token
  // Per ora, reindirizziamo alla store manager con il code
  const redirectUrl = new URL('/store-manager', request.url);
  redirectUrl.searchParams.set('epic_code', code);

  clientLogger.debug(`[EPIC OAUTH] Reindirizzamento a: ${redirectUrl.toString()}`, 'EPIC_OAUTH');

  return NextResponse.redirect(redirectUrl);
});
