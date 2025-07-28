/**
 * @fileoverview Tests for error handling patterns
 */

import {
  SemantestError,
  ValidationError,
  NetworkError,
  StorageError,
  PermissionError,
  ConfigurationError,
  Result,
  withErrorBoundary,
  withRetry,
  GlobalErrorHandler
} from './error-handling';

describe('Error Handling Patterns', () => {
  describe('SemantestError', () => {
    it('should create error with correct properties', () => {
      const error = new SemantestError('Test error', 'TEST_CODE', { foo: 'bar' });
      
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.context).toEqual({ foo: 'bar' });
      expect(error.timestamp).toBeInstanceOf(Date);
      expect(error.name).toBe('SemantestError');
    });

    it('should serialize to JSON correctly', () => {
      const error = new SemantestError('Test error', 'TEST_CODE');
      const json = error.toJSON();
      
      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
    });
  });

  describe('Specific Error Classes', () => {
    it('should create ValidationError', () => {
      const error = new ValidationError('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.name).toBe('ValidationError');
    });

    it('should create NetworkError', () => {
      const error = new NetworkError('Connection failed');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.name).toBe('NetworkError');
    });
    
    it('should create StorageError', () => {
      const error = new StorageError('Storage quota exceeded', { quota: 5000000 });
      expect(error.code).toBe('STORAGE_ERROR');
      expect(error.name).toBe('StorageError');
      expect(error.context).toEqual({ quota: 5000000 });
    });
    
    it('should create PermissionError', () => {
      const error = new PermissionError('Access denied', { permission: 'storage' });
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.name).toBe('PermissionError');
      expect(error.context).toEqual({ permission: 'storage' });
    });
    
    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('Invalid configuration', { key: 'apiKey' });
      expect(error.code).toBe('CONFIGURATION_ERROR');
      expect(error.name).toBe('ConfigurationError');
      expect(error.context).toEqual({ key: 'apiKey' });
    });
  });

  describe('Result Type', () => {
    it('should create success result', () => {
      const result = Result.ok('success');
      expect(Result.isOk(result)).toBe(true);
      expect(Result.isErr(result)).toBe(false);
      if (Result.isOk(result)) {
        expect(result.value).toBe('success');
      }
    });

    it('should create error result', () => {
      const error = new SemantestError('Failed', 'FAIL');
      const result = Result.err(error);
      expect(Result.isErr(result)).toBe(true);
      expect(Result.isOk(result)).toBe(false);
      if (Result.isErr(result)) {
        expect(result.error).toBe(error);
      }
    });
  });

  describe('withErrorBoundary', () => {
    it('should return success result for successful operation', async () => {
      const result = await withErrorBoundary(async () => 'success');
      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value).toBe('success');
      }
    });

    it('should return error result for failed operation', async () => {
      const error = new ValidationError('Failed');
      const result = await withErrorBoundary(async () => {
        throw error;
      });
      
      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error).toBe(error);
      }
    });

    it('should call error handler on failure', async () => {
      const errorHandler = jest.fn();
      const error = new Error('Test error');
      
      await withErrorBoundary(
        async () => { throw error; },
        errorHandler
      );
      
      expect(errorHandler).toHaveBeenCalledWith(error);
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const result = await withRetry(operation);
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockResolvedValueOnce('success');
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelay: 10
      });
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should fail after max attempts', async () => {
      const error = new Error('Always fails');
      const operation = jest.fn().mockRejectedValue(error);
      
      await expect(
        withRetry(operation, { maxAttempts: 2, initialDelay: 10 })
      ).rejects.toThrow(error);
      
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('should respect shouldRetry predicate', async () => {
      const retryableError = new NetworkError('Timeout');
      const fatalError = new ValidationError('Invalid');
      
      const operation = jest.fn()
        .mockRejectedValueOnce(retryableError)
        .mockRejectedValueOnce(fatalError);
      
      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          initialDelay: 10,
          shouldRetry: (err) => err instanceof NetworkError
        })
      ).rejects.toThrow(fatalError);
      
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });
  
  describe('GlobalErrorHandler', () => {
    let consoleErrorSpy: jest.SpyInstance;
    
    beforeEach(() => {
      consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      // Clear handlers
      (GlobalErrorHandler as any).handlers = [];
    });
    
    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });
    
    it('should register and call handlers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      GlobalErrorHandler.register(handler1);
      GlobalErrorHandler.register(handler2);
      
      const error = new Error('Test error');
      GlobalErrorHandler.handle(error, 'test-context');
      
      expect(handler1).toHaveBeenCalledWith(error, 'test-context');
      expect(handler2).toHaveBeenCalledWith(error, 'test-context');
    });
    
    it('should log errors to console', () => {
      const error = new Error('Test error');
      GlobalErrorHandler.handle(error);
      
      expect(consoleErrorSpy).toHaveBeenCalledWith('[Global] Unhandled error:', error);
    });
    
    it('should handle errors in handlers gracefully', () => {
      const badHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const goodHandler = jest.fn();
      
      GlobalErrorHandler.register(badHandler);
      GlobalErrorHandler.register(goodHandler);
      
      const error = new Error('Test error');
      GlobalErrorHandler.handle(error);
      
      expect(badHandler).toHaveBeenCalled();
      expect(goodHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error in error handler:', expect.any(Error));
    });
    
    it('should setup window error handlers', () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
      
      GlobalErrorHandler.setup();
      
      expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
      expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
      
      addEventListenerSpy.mockRestore();
    });
  });
  
  describe('withErrorBoundary edge cases', () => {
    it('should handle non-Error throws', async () => {
      const result = await withErrorBoundary(async () => {
        throw 'string error';
      });
      
      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error).toBeInstanceOf(SemantestError);
        expect(result.error.message).toBe('Unknown error');
        expect(result.error.context?.originalError).toBe('string error');
      }
    });
    
    it('should handle null throws', async () => {
      const result = await withErrorBoundary(async () => {
        throw null;
      });
      
      expect(Result.isErr(result)).toBe(true);
      if (Result.isErr(result)) {
        expect(result.error).toBeInstanceOf(SemantestError);
        expect(result.error.message).toBe('Unknown error');
        expect(result.error.context?.originalError).toBe(null);
      }
    });
  });
  
  describe('withRetry edge cases', () => {
    it('should handle immediate success', async () => {
      const operation = jest.fn().mockResolvedValue('immediate');
      const result = await withRetry(operation, { maxAttempts: 5 });
      
      expect(result).toBe('immediate');
      expect(operation).toHaveBeenCalledTimes(1);
    });
    
    it('should respect maxDelay', async () => {
      const operation = jest.fn()
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      
      const result = await withRetry(operation, {
        maxAttempts: 3,
        initialDelay: 10,
        maxDelay: 20,
        backoffFactor: 10 // Would result in 100ms delay without maxDelay
      });
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      
      // Total time should be around 10ms + 20ms = 30ms (plus some execution time)
      // The second delay should be capped at maxDelay (20ms) instead of 100ms
      expect(totalTime).toBeLessThan(50);
    });
  });
});