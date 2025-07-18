/**
 * @fileoverview Shared error handling patterns for Semantest
 * @module shared/patterns/error-handling
 */

/**
 * Base error class for all Semantest errors
 */
export class SemantestError extends Error {
  public readonly code: string;
  public readonly timestamp: Date;
  public readonly context?: Record<string, any>;

  constructor(message: string, code: string, context?: Record<string, any>) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.timestamp = new Date();
    this.context = context;
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      timestamp: this.timestamp,
      context: this.context,
      stack: this.stack
    };
  }
}

/**
 * Domain-specific error classes
 */
export class ValidationError extends SemantestError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'VALIDATION_ERROR', context);
  }
}

export class NetworkError extends SemantestError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'NETWORK_ERROR', context);
  }
}

export class StorageError extends SemantestError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'STORAGE_ERROR', context);
  }
}

export class PermissionError extends SemantestError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'PERMISSION_ERROR', context);
  }
}

export class ConfigurationError extends SemantestError {
  constructor(message: string, context?: Record<string, any>) {
    super(message, 'CONFIGURATION_ERROR', context);
  }
}

/**
 * Result type for error handling without exceptions
 */
export type Result<T, E = SemantestError> = 
  | { success: true; value: T }
  | { success: false; error: E };

export const Result = {
  ok<T>(value: T): Result<T> {
    return { success: true, value };
  },
  
  err<E = SemantestError>(error: E): Result<never, E> {
    return { success: false, error };
  },
  
  isOk<T, E>(result: Result<T, E>): result is { success: true; value: T } {
    return result.success;
  },
  
  isErr<T, E>(result: Result<T, E>): result is { success: false; error: E } {
    return !result.success;
  }
};

/**
 * Error boundary for async operations
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  errorHandler?: (error: Error) => void
): Promise<Result<T>> {
  try {
    const value = await operation();
    return Result.ok(value);
  } catch (error) {
    if (errorHandler) {
      errorHandler(error as Error);
    }
    
    if (error instanceof SemantestError) {
      return Result.err(error);
    }
    
    return Result.err(
      new SemantestError(
        error instanceof Error ? error.message : 'Unknown error',
        'UNKNOWN_ERROR',
        { originalError: error }
      )
    );
  }
}

/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffFactor = 2,
    shouldRetry = () => true
  } = options;

  let lastError: Error;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      await new Promise(resolve => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffFactor, maxDelay);
    }
  }

  throw lastError!;
}

/**
 * Global error handler for unhandled errors
 */
export class GlobalErrorHandler {
  private static handlers: ((error: Error, context?: string) => void)[] = [];

  static register(handler: (error: Error, context?: string) => void): void {
    this.handlers.push(handler);
  }

  static handle(error: Error, context?: string): void {
    console.error(`[${context || 'Global'}] Unhandled error:`, error);
    this.handlers.forEach(handler => {
      try {
        handler(error, context);
      } catch (handlerError) {
        console.error('Error in error handler:', handlerError);
      }
    });
  }

  static setup(): void {
    // Handle uncaught errors
    window.addEventListener('error', (event) => {
      this.handle(new Error(event.message), 'window.error');
    });

    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.handle(new Error(event.reason), 'unhandledrejection');
    });
  }
}