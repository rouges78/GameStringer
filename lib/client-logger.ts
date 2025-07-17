'use client';

import { LogLevel, LogEntry } from './logger';

export interface ClientLogEntry extends Omit<LogEntry, 'timestamp'> {
  timestamp: string;
  url: string;
  userAgent: string;
  sessionId?: string;
  userId?: string;
}

export interface ClientLoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableRemote: boolean;
  bufferSize: number;
  flushInterval: number;
  remoteEndpoint: string;
  sensitiveFields: string[];
}

class ClientLogger {
  private static instance: ClientLogger;
  private config: ClientLoggerConfig;
  private logBuffer: ClientLogEntry[] = [];
  private flushTimer?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      level: 'info',
      enableConsole: true,
      enableRemote: true,
      bufferSize: 100,
      flushInterval: 10000, // 10 seconds
      remoteEndpoint: '/api/logs',
      sensitiveFields: ['password', 'apiKey', 'token', 'secret', 'key']
    };

    this.startFlushTimer();
    this.setupBeforeUnload();
  }

  public static getInstance(): ClientLogger {
    if (!ClientLogger.instance) {
      ClientLogger.instance = new ClientLogger();
    }
    return ClientLogger.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    return levels[level] >= levels[this.config.level];
  }

  private sanitizeData(data: any): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const sanitized = Array.isArray(data) ? [...data] : { ...data };

    for (const key in sanitized) {
      if (this.config.sensitiveFields.some(field => 
        key.toLowerCase().includes(field.toLowerCase())
      )) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object') {
        sanitized[key] = this.sanitizeData(sanitized[key]);
      }
    }

    return sanitized;
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    component?: string,
    metadata?: Record<string, any>
  ): ClientLogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      url: window.location.href,
      userAgent: navigator.userAgent,
      sessionId: this.getSessionId(),
      userId: this.getUserId(),
      metadata: metadata ? this.sanitizeData(metadata) : undefined
    };
  }

  private getSessionId(): string | undefined {
    try {
      return sessionStorage.getItem('sessionId') || undefined;
    } catch {
      return undefined;
    }
  }

  private getUserId(): string | undefined {
    try {
      return localStorage.getItem('userId') || undefined;
    } catch {
      return undefined;
    }
  }

  private logToConsole(entry: ClientLogEntry): void {
    if (!this.config.enableConsole) return;

    const { timestamp, level, message, component, metadata } = entry;
    const levelUpper = level.toUpperCase();
    const componentStr = component ? `[${component}]` : '';
    const logMessage = `${timestamp} ${levelUpper} ${componentStr} ${message}`;

    switch (level) {
      case 'debug':
        console.debug(logMessage, metadata);
        break;
      case 'info':
        console.info(logMessage, metadata);
        break;
      case 'warn':
        console.warn(logMessage, metadata);
        break;
      case 'error':
      case 'fatal':
        console.error(logMessage, metadata);
        break;
    }
  }

  private addToBuffer(entry: ClientLogEntry): void {
    this.logBuffer.push(entry);

    // Remove oldest entries if buffer is full
    if (this.logBuffer.length > this.config.bufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.config.bufferSize);
    }

    // Flush immediately for fatal errors
    if (entry.level === 'fatal') {
      this.flush();
    }
  }

  private async sendToRemote(entries: ClientLogEntry[]): Promise<void> {
    if (!this.config.enableRemote) return;

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ logs: entries })
      });

      if (!response.ok) {
        console.error('Failed to send logs to remote endpoint:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending logs to remote endpoint:', error);
    }
  }

  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private setupBeforeUnload(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.flush();
      });
    }
  }

  public log(
    level: LogLevel,
    message: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, component, metadata);
    
    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public debug(message: string, component?: string, metadata?: Record<string, any>): void {
    this.log('debug', message, component, metadata);
  }

  public info(message: string, component?: string, metadata?: Record<string, any>): void {
    this.log('info', message, component, metadata);
  }

  public warn(message: string, component?: string, metadata?: Record<string, any>): void {
    this.log('warn', message, component, metadata);
  }

  public error(message: string, component?: string, metadata?: Record<string, any>): void {
    this.log('error', message, component, metadata);
  }

  public fatal(message: string, component?: string, metadata?: Record<string, any>): void {
    this.log('fatal', message, component, metadata);
  }

  public logError(error: Error, component?: string, metadata?: Record<string, any>): void {
    this.log('error', error.message, component, {
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      },
      ...metadata
    });
  }

  public logUserAction(
    action: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `User action: ${action}`, component, {
      action,
      ...metadata
    });
  }

  public logPageView(page: string, metadata?: Record<string, any>): void {
    this.log('info', `Page view: ${page}`, 'NAVIGATION', {
      page,
      referrer: document.referrer,
      ...metadata
    });
  }

  public logPerformance(
    operation: string,
    duration: number,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `Performance: ${operation} took ${duration}ms`, component, {
      operation,
      duration,
      ...metadata
    });
  }

  public logApiCall(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>
  ): void {
    const level = statusCode >= 400 ? 'error' : 'info';
    this.log(level, `API: ${method} ${url} - ${statusCode} (${duration}ms)`, 'API', {
      method,
      url,
      statusCode,
      duration,
      ...metadata
    });
  }

  public async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    const entries = [...this.logBuffer];
    this.logBuffer = [];

    await this.sendToRemote(entries);
  }

  public updateConfig(updates: Partial<ClientLoggerConfig>): void {
    this.config = { ...this.config, ...updates };

    // Restart flush timer if interval changed
    if (updates.flushInterval && this.flushTimer) {
      clearInterval(this.flushTimer);
      this.startFlushTimer();
    }
  }

  public getConfig(): ClientLoggerConfig {
    return { ...this.config };
  }

  public getBufferSize(): number {
    return this.logBuffer.length;
  }

  public clearBuffer(): void {
    this.logBuffer = [];
  }

  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Export singleton instance
export const clientLogger = ClientLogger.getInstance();

// Utility functions for client-side logging
export function createClientComponentLogger(componentName: string) {
  return {
    debug: (message: string, metadata?: Record<string, any>) => 
      clientLogger.debug(message, componentName, metadata),
    info: (message: string, metadata?: Record<string, any>) => 
      clientLogger.info(message, componentName, metadata),
    warn: (message: string, metadata?: Record<string, any>) => 
      clientLogger.warn(message, componentName, metadata),
    error: (message: string, metadata?: Record<string, any>) => 
      clientLogger.error(message, componentName, metadata),
    fatal: (message: string, metadata?: Record<string, any>) => 
      clientLogger.fatal(message, componentName, metadata),
    logError: (error: Error, metadata?: Record<string, any>) => 
      clientLogger.logError(error, componentName, metadata),
    logUserAction: (action: string, metadata?: Record<string, any>) => 
      clientLogger.logUserAction(action, componentName, metadata),
    logPerformance: (operation: string, duration: number, metadata?: Record<string, any>) => 
      clientLogger.logPerformance(operation, duration, componentName, metadata)
  };
}

// Performance monitoring utilities
export function withClientPerformanceLogging<T extends any[]>(
  fn: (...args: T) => any,
  operation: string,
  component?: string
) {
  return (...args: T) => {
    const start = performance.now();
    
    try {
      const result = fn(...args);
      const duration = performance.now() - start;
      
      clientLogger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      clientLogger.logError(
        error instanceof Error ? error : new Error(String(error)),
        component,
        { operation, duration }
      );
      
      throw error;
    }
  };
}

export function withClientAsyncPerformanceLogging<T extends any[]>(
  fn: (...args: T) => Promise<any>,
  operation: string,
  component?: string
) {
  return async (...args: T) => {
    const start = performance.now();
    
    try {
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      clientLogger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      
      clientLogger.logError(
        error instanceof Error ? error : new Error(String(error)),
        component,
        { operation, duration }
      );
      
      throw error;
    }
  };
}