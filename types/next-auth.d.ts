import 'next-auth';
import 'next-auth/jwt';
import type { Account, User as PrismaUser } from '@prisma/client';

// NOTA: Questo file non viene rilevato automaticamente da TypeScript.
// Devi aggiungerlo all'array "include" nel tuo tsconfig.json.

declare module 'next-auth' {
  /**
   * Estende la sessione predefinita per includere i nostri dati personalizzati.
   */
  interface Session {
    user: {
      id: string;
      /** The user's Steam ID, if connected. */
      steamId?: string;
      /** Elenco completo degli account collegati all'utente. */
      accounts?: Account[];
      /** Elenco semplice dei nomi dei provider collegati. */
      connectedProviders?: string[];
    } & Omit<PrismaUser, 'emailVerified'>; // Usa il tipo User di Prisma, omettendo i campi non necessari
  }
}

declare module 'next-auth/jwt' {
  /** Estende il token JWT predefinito per includere i nostri dati personalizzati. */
  interface JWT {
    id?: string;
    /** Elenco completo degli account collegati all'utente. */
    accounts?: Account[];
    /** Elenco semplice dei nomi dei provider collegati. */
    connectedProviders?: string[];
  }
}
