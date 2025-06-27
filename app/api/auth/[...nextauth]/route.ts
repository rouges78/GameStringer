import NextAuth, { NextAuthOptions } from "next-auth";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaAdapter } from "@auth/prisma-adapter";
import { PrismaClient } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

        // Trova l'utente tramite l'account collegato
        const account = await prisma.account.findUnique({
          where: {
            provider_providerAccountId: {
              provider: 'steam-credentials',
              providerAccountId: steamId,
            },
          },
        });

        if (account) {
          // Account trovato, restituisci l'utente associato
          const user = await prisma.user.findUnique({ where: { id: account.userId } });
          return user;
        }

        // Primo login: crea un nuovo utente e un nuovo account
        const user = await prisma.user.create({
          data: {
            name: `user_${steamId}`, // Nome utente provvisorio
          },
        });

        await prisma.account.create({
          data: {
            userId: user.id,
            type: 'credentials',
            provider: 'steam-credentials',
            providerAccountId: steamId,
          },
        });

        return user;
      },
    }),

    // Provider #3: itch.io Credentials for manual flow
    CredentialsProvider({
      id: 'itchio-credentials',
      name: 'itch.io Credentials',
      credentials: {
        accessToken: { label: "Access Token", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) {
          console.error("[AUTH] Missing itch.io access token");
          return null;
        }

        try {
          // Use the token to get user info from itch.io API (server-side)
          const profileRes = await fetch('https://itch.io/api/1/me', {
            headers: {
              Authorization: `Bearer ${credentials.accessToken}`,
              'Accept': 'application/json',
              'User-Agent': 'GameStringer/1.0',
            },
          });

          if (!profileRes.ok) {
            console.error('[AUTH] Failed to fetch user from itch.io:', await profileRes.text());
            return null;
          }

          const profile = await profileRes.json();
          const itchUser = profile.user;

          if (!itchUser) {
            console.error('[AUTH] Invalid user data from itch.io');
            return null;
          }

          const providerAccountId = itchUser.id.toString();

          const account = await prisma.account.findUnique({
            where: {
              provider_providerAccountId: {
                provider: 'itchio',
                providerAccountId: providerAccountId,
              },
            },
          });

          if (account) {
            const user = await prisma.user.findUnique({ where: { id: account.userId } });
            return user;
          }

          const user = await prisma.user.create({
            data: {
              name: itchUser.username,
              image: itchUser.cover_url,
            },
          });

          await prisma.account.create({
            data: {
              userId: user.id,
              type: 'oauth',
              provider: 'itchio',
              providerAccountId: providerAccountId,
            },
          });

          return user;

        } catch (error) {
          console.error("[AUTH] Error during itch.io authorization:", error);
          return null;
        }
      },
    }),

    // Provider: itch.io Custom OAuth (now disabled, kept for reference)

    {
      id: "itchio",
      name: "itch.io",
      type: "oauth",
      clientId: process.env.ITCHIO_CLIENT_ID!,
      clientSecret: process.env.ITCHIO_CLIENT_SECRET!,
      authorization: "https://itch.io/user/oauth?scope=profile:me",
      token: "https://itch.io/api/1/oauth/token",
      userinfo: "https://itch.io/api/1/me",
      profile(profile) {
        return {
          id: profile.user.id.toString(),
          name: profile.user.username,
          image: profile.user.cover_url,
          email: null, // itch.io API doesn't provide email
        };
      },
    },

    // Provider #4: Epic Games Custom OAuth
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
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user, account, profile }) {
      // This callback is called whenever a JWT is created or updated.
      // `user`, `account`, `profile` are only passed on initial sign-in.

      // Se l'adapter Prisma è attivo, l'ID utente sarà già nel token dal database.
      // Questa callback serve a persistere l'ID utente nel token JWT.
      if (user) {
        token.id = user.id;
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
      if (session.user && token.id) {
        // Aggiungi l'ID utente alla sessione
        session.user.id = token.id as string;

        // Carica i provider connessi dal database
        const userAccounts = await prisma.account.findMany({
          where: { userId: token.id as string },
          select: { provider: true },
        });
        
        // Aggiungi l'elenco dei provider alla sessione
        session.user.connectedProviders = userAccounts.map((acc: { provider: string }) => acc.provider);
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
