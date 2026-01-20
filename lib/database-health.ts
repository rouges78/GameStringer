import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

export interface DatabaseHealthStatus {
  isHealthy: boolean;
  latency: number;
  connections: {
    active: number;
    idle: number;
    total: number;
  };
  uptime: number;
  lastCheck: string;
  errors: string[];
  version?: string;
  diskSpace?: {
    used: number;
    available: number;
    total: number;
  };
}

export interface ConnectionPoolConfig {
  maxConnections: number;
  minConnections: number;
  acquireTimeout: number;
  createTimeout: number;
  destroyTimeout: number;
  idleTimeout: number;
  reapInterval: number;
}

export class DatabaseHealthMonitor {
  private prisma: PrismaClient;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck: DatabaseHealthStatus | null = null;
  private connectionPoolConfig: ConnectionPoolConfig;
  private startTime: number;

  constructor(prisma: PrismaClient, poolConfig?: Partial<ConnectionPoolConfig>) {
    this.prisma = prisma;
    this.startTime = Date.now();
    
    this.connectionPoolConfig = {
      maxConnections: 10,
      minConnections: 2,
      acquireTimeout: 30000,
      createTimeout: 30000,
      destroyTimeout: 5000,
      idleTimeout: 300000, // 5 minutes
      reapInterval: 1000,
      ...poolConfig
    };
  }

  /**
   * Avvia il monitoraggio automatico della salute del database
   */
  startHealthMonitoring(intervalMs: number = 60000): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Scheduled health check failed', 'DATABASE_HEALTH', { error });
      }
    }, intervalMs);

    logger.info(`Database health monitoring started (interval: ${intervalMs}ms)`, 'DATABASE_HEALTH');
  }

  /**
   * Ferma il monitoraggio automatico
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Database health monitoring stopped', 'DATABASE_HEALTH');
    }
  }

  /**
   * Esegue un health check completo del database
   */
  async performHealthCheck(): Promise<DatabaseHealthStatus> {
    const startTime = Date.now();
    const errors: string[] = [];
    let isHealthy = true;

    try {
      // Test 1: Basic connectivity
      await this.testBasicConnectivity();
      logger.debug('Database basic connectivity test passed', 'DATABASE_HEALTH');

    } catch (error) {
      errors.push(`Connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isHealthy = false;
      logger.error('Database connectivity test failed', 'DATABASE_HEALTH', { error });
    }

    // Test 2: Query performance
    let queryLatency = 0;
    try {
      queryLatency = await this.testQueryPerformance();
      logger.debug(`Database query performance test passed (${queryLatency}ms)`, 'DATABASE_HEALTH');

      // Flag as unhealthy if queries are too slow
      if (queryLatency > 5000) { // 5 seconds threshold
        errors.push(`High query latency: ${queryLatency}ms`);
        isHealthy = false;
      }
    } catch (error) {
      errors.push(`Query performance test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isHealthy = false;
      logger.error('Database query performance test failed', 'DATABASE_HEALTH', { error });
    }

    // Test 3: Transaction capability
    try {
      await this.testTransactionCapability();
      logger.debug('Database transaction capability test passed', 'DATABASE_HEALTH');

    } catch (error) {
      errors.push(`Transaction test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      isHealthy = false;
      logger.error('Database transaction capability test failed', 'DATABASE_HEALTH', { error });
    }

    const totalLatency = Date.now() - startTime;
    const uptime = Date.now() - this.startTime;

    const healthStatus: DatabaseHealthStatus = {
      isHealthy,
      latency: totalLatency,
      connections: await this.getConnectionInfo(),
      uptime,
      lastCheck: new Date().toISOString(),
      errors
    };

    // Try to get additional database info
    try {
      const version = await this.getDatabaseVersion();
      healthStatus.version = version;
    } catch (error) {
      logger.warn('Failed to get database version', 'DATABASE_HEALTH', { error });
    }

    try {
      const diskSpace = await this.getDiskSpaceInfo();
      healthStatus.diskSpace = diskSpace;
    } catch (error) {
      logger.warn('Failed to get disk space info', 'DATABASE_HEALTH', { error });
    }

    this.lastHealthCheck = healthStatus;

    // Log health status
    if (isHealthy) {
      logger.info(`Database health check passed (${totalLatency}ms)`, 'DATABASE_HEALTH', {
        latency: totalLatency,
        connections: healthStatus.connections,
        uptime
      });
    } else {
      logger.error(`Database health check failed (${totalLatency}ms)`, 'DATABASE_HEALTH', {
        latency: totalLatency,
        errors,
        connections: healthStatus.connections
      });
    }

    return healthStatus;
  }

  /**
   * Test di connettività base
   */
  private async testBasicConnectivity(): Promise<void> {
    await this.prisma.$queryRaw`SELECT 1 as test`;
  }

  /**
   * Test di performance delle query
   */
  private async testQueryPerformance(): Promise<number> {
    const startTime = Date.now();
    
    // Test query on Game table (likely to have data)
    await this.prisma.game.count();
    
    // Test query on Translation table
    await this.prisma.translation.count();
    
    return Date.now() - startTime;
  }

  /**
   * Test delle capacità transazionali
   */
  private async testTransactionCapability(): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Simple transaction test - create and rollback
      const testRecord = await tx.game.findFirst();
      // Just query, don't modify anything
      return testRecord;
    });
  }

  /**
   * Ottiene informazioni sulle connessioni
   */
  private async getConnectionInfo(): Promise<{ active: number; idle: number; total: number }> {
    try {
      // For SQLite, connection info is limited
      // We can provide estimated values based on Prisma client state
      return {
        active: 1, // SQLite typically uses one connection
        idle: 0,
        total: 1
      };
    } catch (error) {
      logger.warn('Failed to get connection info', 'DATABASE_HEALTH', { error });
      return {
        active: 0,
        idle: 0,
        total: 0
      };
    }
  }

  /**
   * Ottiene la versione del database
   */
  private async getDatabaseVersion(): Promise<string> {
    const result = await this.prisma.$queryRaw<Array<{ 'sqlite_version()': string }>>`SELECT sqlite_version()`;
    return result[0]['sqlite_version()'];
  }

  /**
   * Ottiene informazioni sullo spazio disco (per SQLite)
   */
  private async getDiskSpaceInfo(): Promise<{ used: number; available: number; total: number }> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Get database file path from DATABASE_URL
      const dbUrl = process.env.DATABASE_URL || '';
      const dbPath = dbUrl.replace('file:', '');
      
      if (fs.existsSync(dbPath)) {
        const stats = fs.statSync(dbPath);
        return {
          used: stats.size,
          available: 0, // Not easily available for SQLite
          total: stats.size
        };
      }
      
      return {
        used: 0,
        available: 0,
        total: 0
      };
    } catch (error) {
      throw new Error(`Failed to get disk space info: ${error}`);
    }
  }

  /**
   * Ottiene l'ultimo health check
   */
  getLastHealthCheck(): DatabaseHealthStatus | null {
    return this.lastHealthCheck;
  }

  /**
   * Forza la disconnessione e riconnessione del database
   */
  async reconnect(): Promise<void> {
    try {
      logger.info('Forcing database reconnection', 'DATABASE_HEALTH');
      
      await this.prisma.$disconnect();
      await this.prisma.$connect();
      
      logger.info('Database reconnection completed', 'DATABASE_HEALTH');
    } catch (error) {
      logger.error('Database reconnection failed', 'DATABASE_HEALTH', { error });
      throw error;
    }
  }

  /**
   * Pulisce le risorse e disconnette
   */
  async cleanup(): Promise<void> {
    this.stopHealthMonitoring();
    
    try {
      await this.prisma.$disconnect();
      logger.info('Database health monitor cleanup completed', 'DATABASE_HEALTH');
    } catch (error) {
      logger.error('Database health monitor cleanup failed', 'DATABASE_HEALTH', { error });
    }
  }

  /**
   * Ottiene statistiche dettagliate del database
   */
  async getDatabaseStats(): Promise<{
    tables: Array<{
      name: string;
      rowCount: number;
      size?: number;
    }>;
    totalRows: number;
    performance: {
      avgQueryTime: number;
      slowQueries: number;
    };
  }> {
    try {
      const tables = [];
      let totalRows = 0;

      // Get table statistics
      const gameCount = await this.prisma.game.count();
      const translationCount = await this.prisma.translation.count();
      const aiSuggestionCount = await this.prisma.aISuggestion.count();
      const userPreferencesCount = await this.prisma.userPreference.count();

      tables.push(
        { name: 'Game', rowCount: gameCount },
        { name: 'Translation', rowCount: translationCount },
        { name: 'AISuggestion', rowCount: aiSuggestionCount },
        { name: 'UserPreferences', rowCount: userPreferencesCount }
      );

      totalRows = gameCount + translationCount + aiSuggestionCount + userPreferencesCount;

      // Performance stats (simplified for SQLite)
      const avgQueryTime = this.lastHealthCheck?.latency || 0;

      return {
        tables,
        totalRows,
        performance: {
          avgQueryTime,
          slowQueries: avgQueryTime > 1000 ? 1 : 0
        }
      };
    } catch (error) {
      logger.error('Failed to get database stats', 'DATABASE_HEALTH', { error });
      throw error;
    }
  }
}

// Singleton instance
let healthMonitor: DatabaseHealthMonitor | null = null;

export function createDatabaseHealthMonitor(prisma: PrismaClient, poolConfig?: Partial<ConnectionPoolConfig>): DatabaseHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new DatabaseHealthMonitor(prisma, poolConfig);
  }
  return healthMonitor;
}

export function getDatabaseHealthMonitor(): DatabaseHealthMonitor | null {
  return healthMonitor;
}