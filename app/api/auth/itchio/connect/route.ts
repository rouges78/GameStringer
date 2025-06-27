import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env.ITCHIO_CLIENT_ID;
  // The callback URL must be registered in the itch.io app settings
  const redirectUri = `${process.env.NEXTAUTH_URL}/auth/itchio/callback`; 
  const scope = 'profile:me';

  const params = new URLSearchParams({
    client_id: clientId!,
    scope: scope,
    response_type: 'token', // Using implicit flow
    redirect_uri: redirectUri,
  });

  const authorizationUrl = `https://itch.io/user/oauth?${params.toString()}`;

  // Redirect the user to the itch.io authorization page
  return NextResponse.redirect(authorizationUrl);
}
