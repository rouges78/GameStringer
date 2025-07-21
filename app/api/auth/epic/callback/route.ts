import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    console.log('[EPIC OAUTH] Callback ricevuto:', { code, error, errorDescription });

    if (error) {
      console.error('[EPIC OAUTH] Errore OAuth:', error, errorDescription);
      return NextResponse.redirect(new URL('/store-manager?epic_error=' + encodeURIComponent(error), request.url));
    }

    if (!code) {
      console.error('[EPIC OAUTH] Authorization code mancante');
      return NextResponse.redirect(new URL('/store-manager?epic_error=no_code', request.url));
    }

    // Qui dovremmo scambiare il code con un access token
    // Per ora, reindirizziamo alla store manager con il code
    const redirectUrl = new URL('/store-manager', request.url);
    redirectUrl.searchParams.set('epic_code', code);
    
    console.log('[EPIC OAUTH] Reindirizzamento a:', redirectUrl.toString());
    
    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('[EPIC OAUTH] Errore nel callback:', error);
    return NextResponse.redirect(new URL('/store-manager?epic_error=callback_error', request.url));
  }
}