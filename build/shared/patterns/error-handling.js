/**
 * @fileoverview Shared error handling patterns for Semantest
 * @module shared/patterns/error-handling
 */
/**
 * Base error class for all Semantest errors
 */
export class SemantestError extends Error {
    constructor(message, code, context) {
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
    constructor(message, context) {
        super(message, 'VALIDATION_ERROR', context);
    }
}
export class NetworkError extends SemantestError {
    constructor(message, context) {
        super(message, 'NETWORK_ERROR', context);
    }
}
export class StorageError extends SemantestError {
    constructor(message, context) {
        super(message, 'STORAGE_ERROR', context);
    }
}
export class PermissionError extends SemantestError {
    constructor(message, context) {
        super(message, 'PERMISSION_ERROR', context);
    }
}
export class ConfigurationError extends SemantestError {
    constructor(message, context) {
        super(message, 'CONFIGURATION_ERROR', context);
    }
}
export const Result = {
    ok(value) {
        return { success: true, value };
    },
    err(error) {
        return { success: false, error };
    },
    isOk(result) {
        return result.success;
    },
    isErr(result) {
        return !result.success;
    }
};
/**
 * Error boundary for async operations
 */
export async function withErrorBoundary(operation, errorHandler) {
    try {
        const value = await operation();
        return Result.ok(value);
    }
    catch (error) {
        if (errorHandler) {
            errorHandler(error);
        }
        if (error instanceof SemantestError) {
            return Result.err(error);
        }
        return Result.err(new SemantestError(error instanceof Error ? error.message : 'Unknown error', 'UNKNOWN_ERROR', { originalError: error }));
    }
}
/**
 * Retry mechanism with exponential backoff
 */
export async function withRetry(operation, options = {}) {
    const { maxAttempts = 3, initialDelay = 1000, maxDelay = 30000, backoffFactor = 2, shouldRetry = () => true } = options;
    let lastError;
    let delay = initialDelay;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await operation();
        }
        catch (error) {
            lastError = error;
            if (attempt === maxAttempts || !shouldRetry(lastError)) {
                throw lastError;
            }
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * backoffFactor, maxDelay);
        }
    }
    throw lastError;
}
/**
 * Global error handler for unhandled errors
 */
export class GlobalErrorHandler {
    static register(handler) {
        this.handlers.push(handler);
    }
    static handle(error, context) {
        console.error(`[${context || 'Global'}] Unhandled error:`, error);
        this.handlers.forEach(handler => {
            try {
                handler(error, context);
            }
            catch (handlerError) {
                console.error('Error in error handler:', handlerError);
            }
        });
    }
    static setup() {
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
GlobalErrorHandler.handlers = [];
