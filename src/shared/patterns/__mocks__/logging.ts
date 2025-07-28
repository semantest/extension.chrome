// Mock implementation of logging module

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4
}

export interface LogContext {
  module?: string;
  action?: string;
  userId?: string;
  sessionId?: string;
  [key: string]: any;
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: LogContext;
  error?: Error;
  data?: any;
}

export class Logger {
  private static instance: Logger;
  private level: LogLevel = LogLevel.INFO;
  private handlers: ((entry: LogEntry) => void)[] = [];
  private globalContext: LogContext = {};

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setGlobalContext(context: LogContext): void {
    this.globalContext = { ...this.globalContext, ...context };
  }

  addHandler(handler: (entry: LogEntry) => void): void {
    this.handlers.push(handler);
  }

  private log(level: LogLevel, message: string, context?: LogContext, data?: any, error?: Error): void {
    if (level < this.level) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context: { ...this.globalContext, ...context },
      data,
      error
    };

    // Console output
    const consoleMethod = this.getConsoleMethod(level);
    const prefix = `[${LogLevel[level]}] [${this.formatTimestamp(entry.timestamp)}]`;
    const contextStr = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    
    consoleMethod(`${prefix} ${message}${contextStr}`, data || '');
    if (error) {
      console.error(error);
    }

    // Custom handlers
    this.handlers.forEach(handler => {
      try {
        handler(entry);
      } catch (err) {
        console.error('Logger handler error:', err);
      }
    });
  }

  debug(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.DEBUG, message, context, data);
  }

  info(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.INFO, message, context, data);
  }

  warn(message: string, context?: LogContext, data?: any): void {
    this.log(LogLevel.WARN, message, context, data);
  }

  error(message: string, error?: Error, context?: LogContext, data?: any): void {
    this.log(LogLevel.ERROR, message, context, data, error);
  }

  private getConsoleMethod(level: LogLevel): (...args: any[]) => void {
    switch (level) {
      case LogLevel.DEBUG:
        return console.debug;
      case LogLevel.INFO:
        return console.info;
      case LogLevel.WARN:
        return console.warn;
      case LogLevel.ERROR:
        return console.error;
      default:
        return console.log;
    }
  }

  private formatTimestamp(date: Date): string {
    return date.toISOString().replace('T', ' ').slice(0, -5);
  }
}

export class ModuleLogger {
  constructor(
    private moduleName: string,
    private logger: Logger = Logger.getInstance()
  ) {}

  debug(message: string, data?: any): void {
    this.logger.debug(message, { module: this.moduleName }, data);
  }

  info(message: string, data?: any): void {
    this.logger.info(message, { module: this.moduleName }, data);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(message, { module: this.moduleName }, data);
  }

  error(message: string, error?: Error, data?: any): void {
    this.logger.error(message, error, { module: this.moduleName }, data);
  }

  child(subModule: string): ModuleLogger {
    return new ModuleLogger(`${this.moduleName}.${subModule}`, this.logger);
  }
}

export class PerformanceLogger {
  private static measurements = new Map<string, number>();

  static start(label: string): void {
    this.measurements.set(label, performance.now());
  }

  static end(label: string, context?: LogContext): void {
    const start = this.measurements.get(label);
    if (!start) {
      console.warn(`No start time found for label: ${label}`);
      return;
    }

    const duration = performance.now() - start;
    this.measurements.delete(label);

    Logger.getInstance().info(
      `Performance: ${label}`,
      { ...context, performance: true },
      { duration: `${duration.toFixed(2)}ms` }
    );
  }

  static async measure<T>(
    label: string,
    operation: () => Promise<T>,
    context?: LogContext
  ): Promise<T> {
    this.start(label);
    try {
      const result = await operation();
      this.end(label, context);
      return result;
    } catch (error) {
      this.end(label, { ...context, error: true });
      throw error;
    }
  }
}

export class ChromeLogHandler {
  static setup(): void {
    const logger = Logger.getInstance();
    
    // Store logs in chrome.storage.local for debugging
    logger.addHandler(async (entry) => {
      try {
        const storage = (global as any).chrome?.storage?.local;
        if (!storage) return;

        // Get current logs
        const result = await new Promise((resolve) => {
          storage.get('logs', (data: any) => resolve(data || {}));
        });
        const logs = (result as any).logs || (result as any) || {};
        
        const todayKey = new Date().toISOString().split('T')[0];
        
        if (!logs[todayKey]) {
          logs[todayKey] = [];
        }
        
        logs[todayKey].push({
          ...entry,
          timestamp: entry.timestamp.toISOString()
        });
        
        // Keep only last 1000 logs per day
        if (logs[todayKey].length > 1000) {
          logs[todayKey] = logs[todayKey].slice(-1000);
        }
        
        await new Promise((resolve) => {
          storage.set({ logs }, resolve);
        });
      } catch (err) {
        console.error('Failed to store log:', err);
      }
    });
  }
}