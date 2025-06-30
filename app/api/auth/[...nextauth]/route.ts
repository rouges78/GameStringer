import NextAuth, { NextAuthOptions, User } from "next-auth";
import { NextRequest, NextResponse } from 'next/server';
import { PrismaAdapter } from "@next-auth/prisma-adapter";

import { Prisma, PrismaClient, User as PrismaUser } from "@prisma/client";
import CredentialsProvider from "next-auth/providers/credentials";

const prisma = new PrismaClient();

/**
 * Handles linking a provider account to an existing user or creating a new user.
 * This centralized function prevents duplicate users and correctly manages multi-provider authentication.
 *
 * @param provider - The name of the authentication provider (e.g., 'steam-credentials').
 * @param providerAccountId - The unique ID for the user on the provider's platform.
 * @param userId - The optional ID of the currently logged-in user (for linking).
 * @param accountData - Additional data for the account record (e.g., access_token).
 * @param userCreateData - Data for creating a new user if one doesn't exist.
 * @returns The user object (either found, linked, or newly created).
 */
async function linkOrCreateUser(
  provider: string,
  providerAccountId: string,
  userId: string | undefined,
  accountData: Omit<Prisma.AccountUncheckedCreateInput, 'userId' | 'type' | 'provider' | 'providerAccountId'>,
  userCreateData: { name?: string | null, image?: string | null }
): Promise<User> {
  // 1. Check if this provider account is already linked to ANY user.
  // This handles the case where a user is logging back in.
  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider, providerAccountId },
    },
    include: { user: true },
  });

  if (existingAccount) {
    console.log(`[AUTH] Found existing account for provider ${provider}. Returning user ${existingAccount.user.id}`);
    const { user } = existingAccount;
    return { id: user.id, name: user.name, email: user.email, image: user.image };
  }

  // 2. Account does not exist. Determine the target user for linking.
  let targetUser: PrismaUser;

  if (userId) {
    // Case A: User is already logged in (userId is provided). Link this new account to them.
    console.log(`[AUTH] Linking new ${provider} account to existing user ${userId}`);
    const userToLink = await prisma.user.findUnique({ where: { id: userId } });
    if (!userToLink) throw new Error(`User with ID ${userId} not found for linking.`);
    targetUser = userToLink;
  } else {
    // Case B: New sign-in. Create a new user for this provider account.
    const syntheticEmail = `${providerAccountId}@${provider}.local`;
    console.log(`[AUTH] New sign-in with ${provider}. Using synthetic email: ${syntheticEmail}`);
    
    // We use upsert to safely find an existing user with that synthetic email or create a new one.
    targetUser = await prisma.user.upsert({
        where: { email: syntheticEmail },
        update: {}, // Nothing to update if found
        create: {
            email: syntheticEmail,
            name: userCreateData.name ?? `user_${providerAccountId}`,
            image: userCreateData.image,
        }
    });
    console.log(`[AUTH] Upserted user ${targetUser.id} for new ${provider} account.`);
  }
  
  // 3. Create the new account link in the database.
  await prisma.account.create({
    data: {
      userId: targetUser.id,
      type: 'credentials',
      provider,
      providerAccountId,
      ...accountData,
    },
  });
  console.log(`[AUTH] Successfully created account link for provider ${provider} and user ${targetUser.id}`);

  // 4. Return a standard NextAuth User object.
  return {
    id: targetUser.id,
    name: targetUser.name,
    email: targetUser.email,
    image: targetUser.image,
  };
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    // Provider #1: Steam Credentials (manual flow)
    CredentialsProvider({
      id: 'steam-credentials',
      name: 'Steam Credentials',
      credentials: {
        steamid: { label: "Steam ID", type: "text" },
        userId: { label: "User ID", type: "text" }, // For linking
      },
      async authorize(credentials) {
        if (!credentials?.steamid) return null;
        
        return await linkOrCreateUser(
            'steam-credentials',
            credentials.steamid,
            credentials.userId,
            {}, // No extra account data for steam
            { name: `user_${credentials.steamid}` }
        );
      },
    }),

    // Provider #2: itch.io Credentials (manual flow)
    CredentialsProvider({
      id: 'itchio-credentials',
      name: 'Itch.io Credentials',
      credentials: {
        accessToken: { label: 'Access Token', type: 'text' },
        userId: { label: "User ID", type: "text" }, // For linking
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) {
          throw new Error('No access token provided');
        }

        // 1. Fetch user profile from Itch.io
        const apiUrl = `https://itch.io/api/1/${credentials.accessToken}/me`;
        const profileRes = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Accept': 'application/json',
            'User-Agent': 'GameStringerApp/1.0',
          },
        });

        if (!profileRes.ok) {
          throw new Error(`Failed to fetch Itch.io profile: ${profileRes.statusText}`);
        }

        const profileData = await profileRes.json();
        const itchUser = profileData.user;
        if (!itchUser || !itchUser.id) {
          throw new Error('Invalid Itch.io profile data');
        }
        const providerAccountId = itchUser.id.toString();

        // 2. Link or create user
        return await linkOrCreateUser(
            'itchio-credentials',
            providerAccountId,
            credentials.userId,
            { access_token: credentials.accessToken },
            { name: itchUser.username, image: itchUser.cover_url }
        );
      },
    }),

    CredentialsProvider({
      id: 'ubisoft-credentials',
      name: 'Ubisoft Connect',
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e password sono obbligatori.');
        }

        const { email, password } = credentials;
        const { UbiServicesApi } = await import('ubisoft-demux');
        const ubiServices = new UbiServicesApi();

        try {
          const { ticket } = await ubiServices.login(email, password);
          if (!ticket) {
            throw new Error('Credenziali Ubisoft non valide o 2FA attivo.');
          }

          const profileResponse = await fetch('https://public-ubiservices.ubi.com/v3/profiles/me', {
            headers: {
              'Authorization': `Ubi_v1 t=${ticket}`,
              'Ubi-AppId': '39baebad-39e5-4552-8c25-2c9b9190622a',
            }
          });

          if (!profileResponse.ok) {
            throw new Error('Impossibile recuperare il profilo Ubisoft dopo il login.');
          }

          const profile = await profileResponse.json();
          if (!profile.userId) {
            throw new Error('ID utente non trovato nella risposta del profilo Ubisoft.');
          }

          const userIdToLink = req.body?.userId || undefined;

          const user = await linkOrCreateUser(
            'ubisoft-credentials',
            profile.userId,
            userIdToLink,
            {},
            {
              name: profile.nameOnPlatform,
              image: profile.avatarUrl146 || profile.avatarUrl256 || null,
            }
          );
          return user;

        } catch (error: any) {
          console.error("[UBISOFT_AUTH_ERROR]", error.message);
          throw new Error(error.message || "Errore durante l'autenticazione con Ubisoft.");
        }
      }
    }),

    {
            id: "epicgames",
            name: "Epic Games",
            type: "oauth",
            clientId: process.env.EPIC_CLIENT_ID,
            clientSecret: process.env.EPIC_CLIENT_SECRET,
            authorization: {
                url: "https://www.epicgames.com/id/authorize",
                params: { scope: "basic_profile" },
            },
            token: "https://api.epicgames.dev/epic/oauth/v1/token",
            userinfo: "https://api.epicgames.dev/epic/oauth/v1/userInfo",
            profile(profile) {
                console.log("[AUTH - Epic Profile]", profile);
                return {
                    id: profile.sub, 
                    name: profile.display_name || profile.preferred_username,
                    email: `${profile.sub}@epicgames.local`,
                    image: null,
                };
            },
        },
        // Other providers (like Epic Games, etc.) can be added here
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      // This callback is called whenever a JWT is created or updated.
      // `user` is only passed on initial sign-in.
      if (user) {
        token.id = user.id;
      }

      // On any subsequent request, reload accounts from DB to ensure the session is fresh.
      if (token.id) {
        const userWithAccounts = await prisma.user.findUnique({
          where: { id: token.id as string },
          include: { accounts: true }, // Fetch the full account objects
        });
        if (userWithAccounts) {
          token.accounts = userWithAccounts.accounts;
          // For legacy support or simple checks, keep the provider list
          token.connectedProviders = userWithAccounts.accounts.map(a => a.provider);
        }
      }
      return token;
    },
    async session({ session, token }) {
      // This callback is called whenever a session is checked.
      // We forward the custom properties from the token to the session.
      if (session.user) {
        session.user.id = token.id as string;
        // Find the steam account and explicitly add the steamId to the session user object
        const steamAccount = token.accounts?.find(acc => acc.provider === 'steam-credentials');
        if (steamAccount) {
          session.user.steamId = steamAccount.providerAccountId;
        }
        session.user.accounts = token.accounts; // Keep the full list for other purposes
        session.user.connectedProviders = token.connectedProviders;
      }
      return session;
    },
  },
  pages: {
    signIn: '/stores', // Redirect to stores page on auth errors
  },
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
