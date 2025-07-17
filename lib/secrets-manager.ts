import { logger } from './logger';

export interface Secret {
  key: string;
  value: string;
  isRequired: boolean;
  description: string;
  validationPattern?: RegExp;
}

export interface SecretsConfig {
  [key: string]: Secret;
}

export class SecretsManager {
  private static instance: SecretsManager;
  private secrets: Map<string, string> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SecretsManager {
    if (!SecretsManager.instance) {
      SecretsManager.instance = new SecretsManager();
    }
    return SecretsManager.instance;
  }

  // Configuration for all required secrets
  private getSecretsConfig(): SecretsConfig {
    return {
      // Database
      DATABASE_URL: {
        key: 'DATABASE_URL',
        value: process.env.DATABASE_URL || '',
        isRequired: true,
        description: 'Database connection string',
        validationPattern: /^(file:|postgresql:|sqlite:)/
      },

      // AI Services
      OPENAI_API_KEY: {
        key: 'OPENAI_API_KEY',
        value: process.env.OPENAI_API_KEY || '',
        isRequired: false,
        description: 'OpenAI API key for translation services',
        validationPattern: /^sk-[a-zA-Z0-9]{32,}$/
      },
      ABACUSAI_API_KEY: {
        key: 'ABACUSAI_API_KEY',
        value: process.env.ABACUSAI_API_KEY || '',
        isRequired: false,
        description: 'AbacusAI API key for advanced AI features',
        validationPattern: /^s2_[a-zA-Z0-9]{32,}$/
      },

      // Steam API
      STEAM_API_KEY: {
        key: 'STEAM_API_KEY',
        value: process.env.STEAM_API_KEY || '',
        isRequired: false,
        description: 'Steam Web API key',
        validationPattern: /^[A-F0-9]{32}$/
      },
      STEAM_LOGIN_SECURE_COOKIE: {
        key: 'STEAM_LOGIN_SECURE_COOKIE',
        value: process.env.STEAM_LOGIN_SECURE_COOKIE || '',
        isRequired: false,
        description: 'Steam login secure cookie for authenticated requests'
      },
      STEAMGRIDDB_API_KEY: {
        key: 'STEAMGRIDDB_API_KEY',
        value: process.env.STEAMGRIDDB_API_KEY || '',
        isRequired: false,
        description: 'SteamGridDB API key for game artwork',
        validationPattern: /^[a-f0-9]{32}$/
      },

      // Epic Games
      EPIC_CLIENT_ID: {
        key: 'EPIC_CLIENT_ID',
        value: process.env.EPIC_CLIENT_ID || '',
        isRequired: false,
        description: 'Epic Games Store client ID'
      },
      EPIC_CLIENT_SECRET: {
        key: 'EPIC_CLIENT_SECRET',
        value: process.env.EPIC_CLIENT_SECRET || '',
        isRequired: false,
        description: 'Epic Games Store client secret'
      },

      // itch.io
      ITCHIO_CLIENT_ID: {
        key: 'ITCHIO_CLIENT_ID',
        value: process.env.ITCHIO_CLIENT_ID || '',
        isRequired: false,
        description: 'itch.io client ID'
      },
      ITCHIO_CLIENT_SECRET: {
        key: 'ITCHIO_CLIENT_SECRET',
        value: process.env.ITCHIO_CLIENT_SECRET || '',
        isRequired: false,
        description: 'itch.io client secret'
      },

      // Security
      NEXTAUTH_SECRET: {
        key: 'NEXTAUTH_SECRET',
        value: process.env.NEXTAUTH_SECRET || '',
        isRequired: true,
        description: 'NextAuth.js secret key for JWT signing',
        validationPattern: /^.{32,}$/
      },
      NEXTAUTH_URL: {
        key: 'NEXTAUTH_URL',
        value: process.env.NEXTAUTH_URL || '',
        isRequired: true,
        description: 'NextAuth.js URL',
        validationPattern: /^https?:\/\/.+$/
      },

      // Logging
      LOG_REMOTE_ENDPOINT: {
        key: 'LOG_REMOTE_ENDPOINT',
        value: process.env.LOG_REMOTE_ENDPOINT || '',
        isRequired: false,
        description: 'Remote logging endpoint URL',
        validationPattern: /^https?:\/\/.+$/
      }
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    const config = this.getSecretsConfig();
    const missingRequired: string[] = [];
    const invalidSecrets: string[] = [];

    for (const [key, secret] of Object.entries(config)) {
      const value = secret.value;

      // Check if required secret is missing
      if (secret.isRequired && !value) {
        missingRequired.push(key);
        continue;
      }

      // Skip validation for empty optional secrets
      if (!value && !secret.isRequired) {
        continue;
      }

      // Validate secret format if pattern is provided
      if (secret.validationPattern && !secret.validationPattern.test(value)) {
        invalidSecrets.push(key);
        logger.warn(`Invalid format for secret: ${key}`, 'SECRETS_MANAGER');
        continue;
      }

      // Store valid secret
      this.secrets.set(key, value);
      logger.debug(`Loaded secret: ${key}`, 'SECRETS_MANAGER');
    }

    // Handle missing required secrets
    if (missingRequired.length > 0) {
      const message = `Missing required secrets: ${missingRequired.join(', ')}`;
      logger.error(message, 'SECRETS_MANAGER');
      throw new Error(message);
    }

    // Log invalid secrets (but don't fail)
    if (invalidSecrets.length > 0) {
      logger.warn(`Invalid secrets detected: ${invalidSecrets.join(', ')}`, 'SECRETS_MANAGER');
    }

    this.isInitialized = true;
    logger.info(`Secrets manager initialized with ${this.secrets.size} secrets`, 'SECRETS_MANAGER');
  }

  public get(key: string): string | undefined {
    if (!this.isInitialized) {
      throw new Error('SecretsManager not initialized. Call initialize() first.');
    }

    return this.secrets.get(key);
  }

  public getRequired(key: string): string {
    const value = this.get(key);
    if (!value) {
      throw new Error(`Required secret not found: ${key}`);
    }
    return value;
  }

  public has(key: string): boolean {
    return this.secrets.has(key);
  }

  public isAvailable(key: string): boolean {
    const value = this.get(key);
    return value !== undefined && value !== '' && value !== 'placeholder';
  }

  public getSecretsList(): string[] {
    return Array.from(this.secrets.keys());
  }

  public validateSecret(key: string, value: string): boolean {
    const config = this.getSecretsConfig();
    const secret = config[key];
    
    if (!secret) {
      return false;
    }

    if (secret.validationPattern) {
      return secret.validationPattern.test(value);
    }

    return true;
  }

  public getSecretInfo(key: string): { description: string; isRequired: boolean; isConfigured: boolean } | undefined {
    const config = this.getSecretsConfig();
    const secret = config[key];
    
    if (!secret) {
      return undefined;
    }

    return {
      description: secret.description,
      isRequired: secret.isRequired,
      isConfigured: this.isAvailable(key)
    };
  }

  public getConfigurationStatus(): {
    total: number;
    configured: number;
    required: number;
    requiredConfigured: number;
    missing: string[];
    invalid: string[];
  } {
    const config = this.getSecretsConfig();
    const total = Object.keys(config).length;
    const required = Object.values(config).filter(s => s.isRequired).length;
    const configured = this.secrets.size;
    const requiredConfigured = Object.entries(config)
      .filter(([_, secret]) => secret.isRequired && this.isAvailable(secret.key))
      .length;

    const missing = Object.entries(config)
      .filter(([_, secret]) => secret.isRequired && !this.isAvailable(secret.key))
      .map(([key]) => key);

    const invalid = Object.entries(config)
      .filter(([key, secret]) => {
        const value = this.get(key);
        return value && secret.validationPattern && !secret.validationPattern.test(value);
      })
      .map(([key]) => key);

    return {
      total,
      configured,
      required,
      requiredConfigured,
      missing,
      invalid
    };
  }

  public generateSecretKey(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  public destroy(): void {
    this.secrets.clear();
    this.isInitialized = false;
    logger.info('Secrets manager destroyed', 'SECRETS_MANAGER');
  }
}

// Export singleton instance
export const secretsManager = SecretsManager.getInstance();

// Utility functions
export async function initializeSecrets(): Promise<void> {
  await secretsManager.initialize();
}

export function getSecret(key: string): string | undefined {
  return secretsManager.get(key);
}

export function getRequiredSecret(key: string): string {
  return secretsManager.getRequired(key);
}

export function isSecretAvailable(key: string): boolean {
  return secretsManager.isAvailable(key);
}

export function getSecretsStatus() {
  return secretsManager.getConfigurationStatus();
}