import NextAuth from 'next-auth';
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'steam-credentials',
      name: 'Steam',
      credentials: {
        steamid: { label: 'Steam ID', type: 'text' },
        userId: { label: 'User ID', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.steamid) {
          throw new Error('Steam ID richiesto');
        }

        // Validate Steam ID format (17 digits)
        if (!/^\d{17}$/.test(credentials.steamid)) {
          throw new Error('Steam ID non valido - deve essere un numero di 17 cifre');
        }

        try {
          // Here you would typically validate the Steam ID with Steam API
          // For now, we'll accept any valid format Steam ID
          return {
            id: credentials.userId || credentials.steamid,
            name: `Steam User ${credentials.steamid}`,
            email: `${credentials.steamid}@steam.local`
          };
        } catch (error) {
          console.error('Steam auth error:', error);
          throw new Error('Errore durante la verifica Steam ID');
        }
      }
    }),
    
    CredentialsProvider({
      id: 'epic-credentials',
      name: 'Epic Games',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        userId: { label: 'User ID', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e password richiesti');
        }

        // Here you would validate Epic Games credentials
        return {
          id: credentials.userId || credentials.email,
          name: `Epic User ${credentials.email}`,
          email: credentials.email,
          accounts: [{
            provider: 'epic-credentials',
            providerAccountId: credentials.email,
            type: 'credentials'
          }]
        };
      }
    }),

    CredentialsProvider({
      id: 'gog-credentials',
      name: 'GOG',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        userId: { label: 'User ID', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e password richiesti');
        }

        return {
          id: credentials.userId || credentials.email,
          name: `GOG User ${credentials.email}`,
          email: credentials.email,
          accounts: [{
            provider: 'gog-credentials',
            providerAccountId: credentials.email,
            type: 'credentials'
          }]
        };
      }
    }),

    CredentialsProvider({
      id: 'ubisoft-credentials',
      name: 'Ubisoft Connect',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        twoFactorCode: { label: '2FA Code', type: 'text' },
        userId: { label: 'User ID', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email e password richiesti');
        }

        return {
          id: credentials.userId || credentials.email,
          name: `Ubisoft User ${credentials.email}`,
          email: credentials.email,
          accounts: [{
            provider: 'ubisoft-credentials',
            providerAccountId: credentials.email,
            type: 'credentials'
          }]
        };
      }
    }),

    CredentialsProvider({
      id: 'itchio-credentials',
      name: 'itch.io',
      credentials: {
        accessToken: { label: 'API Key', type: 'text' },
        userId: { label: 'User ID', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.accessToken) {
          throw new Error('API Key richiesta');
        }

        return {
          id: credentials.userId || credentials.accessToken,
          name: 'itch.io User',
          email: `${credentials.accessToken}@itchio.local`,
          accounts: [{
            provider: 'itchio-credentials',
            providerAccountId: credentials.accessToken,
            type: 'credentials'
          }]
        };
      }
    })
  ],
  
  callbacks: {
    async jwt({ token, user, account }) {
      if (account && user) {
        token.accounts = user.accounts || [];
      }
      return token;
    },
    
    async session({ session, token }) {
      if (token.accounts) {
        session.user.accounts = token.accounts;
      }
      return session;
    }
  },
  
  pages: {
    signIn: '/stores',
    error: '/stores'
  },
  
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 giorni
  },
  
  debug: process.env.NODE_ENV === 'development',
  
  // Assicuriamoci che le risposte siano sempre JSON validi
  events: {
    async session(message) {
      console.log('[NextAuth] Session event:', message);
    },
    async signIn(message) {
      console.log('[NextAuth] SignIn event:', message);
    },
    async signOut(message) {
      console.log('[NextAuth] SignOut event:', message);
    }
  }
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
