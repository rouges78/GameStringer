import NextAuth, { NextAuthOptions } from "next-auth";
import { NextRequest, NextResponse } from 'next/server';

import CredentialsProvider from "next-auth/providers/credentials";


export const authOptions: NextAuthOptions = {
  providers: [

    // Provider #2: A credentials provider to handle the final login step.
    // We will call this ourselves after manually verifying the OpenID response.
    CredentialsProvider({
      id: 'steam-credentials',
      name: 'Steam Credentials',
      credentials: {
        steamid: { label: "Steam ID", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.steamid) {
          console.error("[AUTH] Missing steamid");
          return null;
        }

        const steamId = credentials.steamid;

        try {
          const apiKey = process.env.STEAM_API_KEY;
          if (!apiKey) {
            console.error("[AUTH] Missing STEAM_API_KEY");
            return null;
          }

          const response = await fetch(
            `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=${apiKey}&steamids=${steamId}`
          );

          if (!response.ok) {
            console.error(`[AUTH] Steam API fetch failed with status: ${response.status}`);
            return null;
          }

          const data = await response.json();

          if (data.response.players && data.response.players.length > 0) {
            const player = data.response.players[0];
            // Return the user object if found
            return {
              id: player.steamid,
              steam: {
                steamid: player.steamid,
                personaname: player.personaname,
                avatar: player.avatarfull,
                id: 'steam' // Identificatore del provider
              }
            };
          } else {
            // If no player is found, return null
            console.error("[AUTH] Steam user not found for SteamID:", steamId);
            return null;
          }
        } catch (error) {
          console.error("[AUTH] Error in Steam credentials provider:", error);
          return null;
        }
      },
    }),

    // Provider #3: Epic Games Custom OAuth
    {
      id: "epic",
      name: "Epic Games",
      type: "oauth",
      clientId: process.env.EPIC_CLIENT_ID!,
      clientSecret: process.env.EPIC_CLIENT_SECRET!,
      authorization: {
        url: "https://www.epicgames.com/id/authorize",
        params: { scope: "basic_profile" },
      },
      token: "https://api.epicgames.dev/epic/oauth/v2/token",
      userinfo: "https://api.epicgames.dev/epic/oauth/v2/tokenInfo", // This is for introspection, but profile callback is better
      profile(profile) {
        return {
          id: profile.account_id,
          name: profile.display_name, // This might come from a different endpoint or JWT decode
          // Epic doesn't provide email or image in this flow by default
          email: null,
          image: null,
        };
      },
    },
  ],
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // This callback is called whenever a JWT is created or updated.
      // `user`, `account`, `profile` are only passed on initial sign-in.

      // 1. Handle initial sign-in
      if (user) {
        token.id = user.id; // Persist the user ID from the provider
        // Check if this is a steam login and persist steam-specific data
        // The user object is the one returned from the authorize callback
        if ((user as any).steam) {
          token.steam = (user as any).steam;
        }
      }

      // 2. Handle OAuth providers (like Epic Games)
      if (account?.provider === 'epic' && user) {
         token.epic = {
          id: user.id,       // Epic account ID from profile mapping
          name: user.name,   // Epic display name from profile mapping
          provider: 'epic'
        };
      }

      return token;
    },

    async session({ session, token }) {
      // This callback is called whenever a session is checked.
      // We pass the custom data from the token to the session object.

      if (token.id) {
        session.user.id = token.id as string;
      }
      if (token.steam) {
        session.user.steam = token.steam;
      }
      if (token.epic) {
        session.user.epic = token.epic;
      }

      return session;
    },
  },
  pages: {
    signIn: '/stores', // Redirect to stores page on error
  }
};

// The main handler that wraps NextAuth.js
async function handler(req: NextRequest, context: { params: { nextauth: string[] } }) {
  // Check if this is the callback from Steam
  if (context.params.nextauth?.includes("callback") && context.params.nextauth?.includes("steam")) {
    try {
      const requestUrl = new URL(req.url);
      const params = requestUrl.searchParams;

      // 1. Manually verify the OpenID response from Steam
      const verificationParams = new URLSearchParams(params.toString());
      verificationParams.set('openid.mode', 'check_authentication');

      const verificationRes = await fetch("https://steamcommunity.com/openid/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: verificationParams.toString(),
        cache: 'no-store'
      });

      const verificationText = await verificationRes.text();

      if (!verificationText.includes("is_valid:true")) {
        console.error("Steam OpenID verification failed.");
        const errorUrl = new URL('/stores?error=SteamAuthFailed', requestUrl.origin);
        return NextResponse.redirect(errorUrl);
      }

      // 2. Extract SteamID from the claimed_id
      const claimedId = params.get('openid.claimed_id');
      const steamIdMatch = claimedId?.match(/^https?:\/\/steamcommunity\.com\/openid\/id\/([0-9]{17,25})/);
      const steamid = steamIdMatch?.[1];

      if (steamid) {
        // 3. Redirect to a client-side page that will trigger the credentials sign-in.
        const redirectUrl = new URL(`/auth/steam/verify`, requestUrl.origin);
        redirectUrl.searchParams.set('steamId', steamid);
        return NextResponse.redirect(redirectUrl);
      } else {
        throw new Error("Could not parse SteamID from claimed_id.");
      }
    } catch (error) {
      console.error("Error during Steam callback verification:", error);
      const errorUrl = new URL('/stores?error=SteamAuthFailed', new URL(req.url).origin);
      return NextResponse.redirect(errorUrl);
    }
  }

  // For all other requests, pass them to the default NextAuth handler
  return NextAuth(authOptions)(req, context);
}

export { handler as GET, handler as POST };
