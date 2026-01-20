import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export interface LoggerConfig {
  level: LogLevel;
  enableConsole: boolean;
  enableFile: boolean;
  enableDatabase: boolean;
  enableRemote: boolean;
  logDirectory: string;
  maxFileSize: number; // MB
  maxFiles: number;
  remoteEndpoint?: string;
  sensitiveFields: string[];
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4
};

class Logger {
  private static instance: Logger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private isBufferFlushing = false;

  private constructor() {
    this.config = {
      level: (process.env.LOG_LEVEL as LogLevel) || 'info',
      enableConsole: process.env.NODE_ENV === 'development',
      enableFile: true,
      enableDatabase: false,
      enableRemote: process.env.NODE_ENV === 'production',
      logDirectory: process.env.LOG_DIRECTORY || './logs',
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10'),
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      remoteEndpoint: process.env.LOG_REMOTE_ENDPOINT,
      sensitiveFields: ['password', 'apiKey', 'token', 'secret', 'key']
    };

    this.ensureLogDirectory();
    this.startBufferFlush();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private ensureLogDirectory(): void {
    if (this.config.enableFile && !existsSync(this.config.logDirectory)) {
      mkdirSync(this.config.logDirectory, { recursive: true });
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.level];
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
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      component,
      metadata: metadata ? this.sanitizeData(metadata) : undefined
    };

    // Add request context if available
    if (typeof window === 'undefined' && process.env.REQUEST_ID) {
      entry.requestId = process.env.REQUEST_ID;
    }

    return entry;
  }

  private formatConsoleOutput(entry: LogEntry): string {
    const { timestamp, level, message, component, metadata } = entry;
    const levelUpper = level.toUpperCase().padEnd(5);
    const componentStr = component ? `[${component}]` : '';
    const metadataStr = metadata ? `\n${JSON.stringify(metadata, null, 2)}` : '';
    
    return `${timestamp} ${levelUpper} ${componentStr} ${message}${metadataStr}`;
  }

  private formatFileOutput(entry: LogEntry): string {
    return JSON.stringify(entry) + '\n';
  }

  private logToConsole(entry: LogEntry): void {
    if (!this.config.enableConsole) return;

    const formatted = this.formatConsoleOutput(entry);
    
    switch (entry.level) {
      case 'debug':
        console.debug(formatted);
        break;
      case 'info':
        console.info(formatted);
        break;
      case 'warn':
        console.warn(formatted);
        break;
      case 'error':
      case 'fatal':
        console.error(formatted);
        break;
    }
  }

  private logToFile(entry: LogEntry): void {
    if (!this.config.enableFile) return;

    try {
      const filename = `${entry.level}-${new Date().toISOString().split('T')[0]}.log`;
      const filepath = join(this.config.logDirectory, filename);
      const formatted = this.formatFileOutput(entry);

      appendFileSync(filepath, formatted);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }
  }

  private async logToRemote(entry: LogEntry): Promise<void> {
    if (!this.config.enableRemote || !this.config.remoteEndpoint) return;

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry)
      });

      if (!response.ok) {
        console.error('Failed to send log to remote endpoint:', response.statusText);
      }
    } catch (error) {
      console.error('Error sending log to remote endpoint:', error);
    }
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > 1000) {
      this.logBuffer = this.logBuffer.slice(-800);
    }
  }

  private startBufferFlush(): void {
    setInterval(() => {
      this.flushBuffer();
    }, 5000); // Flush every 5 seconds
  }

  private async flushBuffer(): Promise<void> {
    if (this.isBufferFlushing || this.logBuffer.length === 0) return;

    this.isBufferFlushing = true;
    const entries = [...this.logBuffer];
    this.logBuffer = [];

    try {
      for (const entry of entries) {
        this.logToFile(entry);
        
        if (this.config.enableRemote) {
          await this.logToRemote(entry);
        }
      }
    } catch (error) {
      console.error('Error flushing log buffer:', error);
      // Re-add entries to buffer if flush failed
      this.logBuffer.unshift(...entries);
    }

    this.isBufferFlushing = false;
  }

  public log(
    level: LogLevel,
    message: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    if (!this.shouldLog(level)) return;

    const entry = this.createLogEntry(level, message, component, metadata);
    
    // Always log to console immediately
    this.logToConsole(entry);
    
    // Add to buffer for file/remote logging
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
    const entry = this.createLogEntry('error', error.message, component, metadata);
    entry.error = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };

    this.logToConsole(entry);
    this.addToBuffer(entry);
  }

  public logApiRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `${method} ${url} - ${statusCode} (${duration}ms)`, 'API', {
      method,
      url,
      statusCode,
      duration,
      userId,
      ...metadata
    });
  }

  public logUserAction(
    action: string,
    userId: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `User action: ${action}`, component || 'USER', {
      action,
      userId,
      ...metadata
    });
  }

  public logSystemEvent(
    event: string,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `System event: ${event}`, component || 'SYSTEM', metadata);
  }

  public logPerformance(
    operation: string,
    duration: number,
    component?: string,
    metadata?: Record<string, any>
  ): void {
    this.log('info', `Performance: ${operation} took ${duration}ms`, component || 'PERF', {
      operation,
      duration,
      ...metadata
    });
  }

  public logSecurity(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    userId?: string,
    metadata?: Record<string, any>
  ): void {
    const level: LogLevel = severity === 'critical' ? 'fatal' : 
                           severity === 'high' ? 'error' : 'warn';
    
    this.log(level, `Security event: ${event}`, 'SECURITY', {
      event,
      severity,
      userId,
      ...metadata
    });
  }

  public async flush(): Promise<void> {
    await this.flushBuffer();
  }

  public getConfig(): LoggerConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...updates };
    this.ensureLogDirectory();
  }

  public getBufferSize(): number {
    return this.logBuffer.length;
  }

  public clearBuffer(): void {
    this.logBuffer = [];
  }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Utility functions
export function createComponentLogger(componentName: string) {
  return {
    debug: (message: string, metadata?: Record<string, any>) => 
      logger.debug(message, componentName, metadata),
    info: (message: string, metadata?: Record<string, any>) => 
      logger.info(message, componentName, metadata),
    warn: (message: string, metadata?: Record<string, any>) => 
      logger.warn(message, componentName, metadata),
    error: (message: string, metadata?: Record<string, any>) => 
      logger.error(message, componentName, metadata),
    fatal: (message: string, metadata?: Record<string, any>) => 
      logger.fatal(message, componentName, metadata),
    logError: (error: Error, metadata?: Record<string, any>) => 
      logger.logError(error, componentName, metadata)
  };
}

export function withLogging<T extends any[]>(
  fn: (...args: T) => any,
  operation: string,
  component?: string
) {
  return (...args: T) => {
    const start = Date.now();
    
    try {
      const result = fn(...args);
      const duration = Date.now() - start;
      
      logger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.logError(error instanceof Error ? error : new Error(String(error)), component, {
        operation,
        duration,
        args: args.length > 0 ? args : undefined
      });
      
      throw error;
    }
  };
}

export function withAsyncLogging<T extends any[]>(
  fn: (...args: T) => Promise<any>,
  operation: string,
  component?: string
) {
  return async (...args: T) => {
    const start = Date.now();
    
    try {
      const result = await fn(...args);
      const duration = Date.now() - start;
      
      logger.logPerformance(operation, duration, component);
      
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      
      logger.logError(error instanceof Error ? error : new Error(String(error)), component, {
        operation,
        duration,
        args: args.length > 0 ? args : undefined
      });
      
      throw error;
    }
  };
}