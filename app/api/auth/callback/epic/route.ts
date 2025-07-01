import { NextRequest, NextResponse } from 'next/server';
import { signIn } from 'next-auth/react';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('[Epic Games Callback] Error:', error);
      return NextResponse.redirect(new URL('/stores?error=EpicAuthFailed', request.url));
    }

    if (!code) {
      console.error('[Epic Games Callback] No authorization code received');
      return NextResponse.redirect(new URL('/stores?error=NoAuthCode', request.url));
    }

    // Epic Games OAuth flow is handled by NextAuth
    // Redirect to NextAuth callback
    const callbackUrl = new URL('/api/auth/callback/epicgames', request.url);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    return NextResponse.redirect(callbackUrl);
  } catch (error) {
    console.error('[Epic Games Callback] Unexpected error:', error);
    return NextResponse.redirect(new URL('/stores?error=UnexpectedError', request.url));
  }
}