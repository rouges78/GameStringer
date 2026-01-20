import { PrismaClient } from '@prisma/client';
import { createDatabaseHealthMonitor } from './database-health';

// Aggiungiamo 'prisma' al tipo globale di NodeJS per evitare errori di tipo in sviluppo.
declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
  // eslint-disable-next-line no-var
  var prismaHealthMonitor: boolean | undefined;
}

// Configurazione ottimizzata per connection pooling
const prismaConfig = {
  log: process.env.NODE_ENV === 'development' 
    ? ['query', 'info', 'warn', 'error'] as const
    : ['error'] as const,
  
  // Configurazione del datasource con ottimizzazioni per SQLite
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  
  // Ottimizzazioni per performance
  __internal: {
    engine: {
      // Connection pooling configuration for SQLite
      binaryTargets: ['native'],
    }
  }
};

// Creiamo un'unica istanza di PrismaClient con configurazione ottimizzata
// In sviluppo, la salviamo in una variabile globale per riutilizzarla tra gli hot-reload,
// evitando di esaurire le connessioni al database.
export const prisma = global.prisma || new PrismaClient(prismaConfig);

// Inizializza il monitoring della salute del database
if (!global.prismaHealthMonitor) {
  const healthMonitor = createDatabaseHealthMonitor(prisma, {
    maxConnections: 5,  // SQLite non supporta molte connessioni concurrent
    minConnections: 1,
    acquireTimeout: 20000,
    createTimeout: 20000,
    destroyTimeout: 5000,
    idleTimeout: 300000, // 5 minuti
    reapInterval: 1000
  });

  // Avvia il monitoraggio automatico solo in produzione
  if (process.env.NODE_ENV === 'production') {
    healthMonitor.startHealthMonitoring(60000); // Ogni minuto
  }

  global.prismaHealthMonitor = true;
}

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Gestione graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing database connections...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing database connections...');
  await prisma.$disconnect();
  process.exit(0);
});

// Database connection events - use process events instead of prisma.$on for Prisma 5.0+
process.on('beforeExit', async () => {
  console.log('Prisma is about to exit, cleaning up...');
  await prisma.$disconnect();
});

// Export health monitoring functions
export { createDatabaseHealthMonitor, getDatabaseHealthMonitor } from './database-health';
