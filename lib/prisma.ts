import { PrismaClient } from '@prisma/client';

// Aggiungiamo 'prisma' al tipo globale di NodeJS per evitare errori di tipo in sviluppo.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Creiamo un'unica istanza di PrismaClient e la esportiamo.
// In sviluppo, la salviamo in una variabile globale per riutilizzarla tra gli hot-reload,
// evitando di esaurire le connessioni al database.
export const prisma = global.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}
