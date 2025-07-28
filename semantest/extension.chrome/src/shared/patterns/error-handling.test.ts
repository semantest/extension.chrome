/**
 * @fileoverview Tests for error-handling patterns
 * @module shared/patterns/error-handling.test
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

describe('SemantestError', () => {
  it('should create error with required properties', () => {
    const error = new SemantestError('Test error', 'TEST_CODE', { key: 'value' });
    
    expect(error.message).toBe('Test error');
    expect(error.code).toBe('TEST_CODE');
    expect(error.context).toEqual({ key: 'value' });
    expect(error.timestamp).toBeInstanceOf(Date);
    expect(error.name).toBe('SemantestError');
  });
  
  it('should serialize to JSON correctly', () => {
    const error = new SemantestError('Test error', 'TEST_CODE', { key: 'value' });
    const json = error.toJSON();
    
    expect(json).toMatchObject({
      name: 'SemantestError',
      message: 'Test error',
      code: 'TEST_CODE',
      context: { key: 'value' },
      timestamp: error.timestamp,
      stack: expect.any(String)
    });
  });
  
  it('should capture stack trace when available', () => {
    const error = new SemantestError('Test error', 'TEST_CODE');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('SemantestError');
  });
});

describe('Domain-specific errors', () => {
  it('should create ValidationError correctly', () => {
    const error = new ValidationError('Invalid input', { field: 'email' });
    
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.context).toEqual({ field: 'email' });
    expect(error.name).toBe('ValidationError');
  });
  
  it('should create NetworkError correctly', () => {
    const error = new NetworkError('Connection failed', { url: 'https://api.example.com' });
    
    expect(error.message).toBe('Connection failed');
    expect(error.code).toBe('NETWORK_ERROR');
    expect(error.context).toEqual({ url: 'https://api.example.com' });
    expect(error.name).toBe('NetworkError');
  });
  
  it('should create StorageError correctly', () => {
    const error = new StorageError('Storage quota exceeded', { quota: 5242880 });
    
    expect(error.message).toBe('Storage quota exceeded');
    expect(error.code).toBe('STORAGE_ERROR');
    expect(error.context).toEqual({ quota: 5242880 });
    expect(error.name).toBe('StorageError');
  });
  
  it('should create PermissionError correctly', () => {
    const error = new PermissionError('Permission denied', { permission: 'storage' });
    
    expect(error.message).toBe('Permission denied');
    expect(error.code).toBe('PERMISSION_ERROR');
    expect(error.context).toEqual({ permission: 'storage' });
    expect(error.name).toBe('PermissionError');
  });
  
  it('should create ConfigurationError correctly', () => {
    const error = new ConfigurationError('Invalid config', { setting: 'apiUrl' });
    
    expect(error.message).toBe('Invalid config');
    expect(error.code).toBe('CONFIGURATION_ERROR');
    expect(error.context).toEqual({ setting: 'apiUrl' });
    expect(error.name).toBe('ConfigurationError');
  });
});

describe('Result type', () => {
  it('should create success result', () => {
    const result = Result.ok('value');
    
    expect(result).toEqual({
      success: true,
      value: 'value'
    });
  });
  
  it('should create error result', () => {
    const error = new SemantestError('Error', 'ERROR_CODE');
    const result = Result.err(error);
    
    expect(result).toEqual({
      success: false,
      error: error
    });
  });
  
  it('should check if result is ok', () => {
    const okResult = Result.ok('value');
    const errResult = Result.err(new Error('error'));
    
    expect(Result.isOk(okResult)).toBe(true);
    expect(Result.isOk(errResult)).toBe(false);
  });
  
  it('should check if result is error', () => {
    const okResult = Result.ok('value');
    const errResult = Result.err(new Error('error'));
    
    expect(Result.isErr(okResult)).toBe(false);
    expect(Result.isErr(errResult)).toBe(true);
  });
});

describe('withErrorBoundary', () => {
  it('should return result on success', async () => {
    const fn = async () => 'success';
    const result = await withErrorBoundary(fn);
    
    expect(result).toEqual({
      success: true,
      value: 'success'
    });
  });
  
  it('should catch and return SemantestError', async () => {
    const error = new ValidationError('Validation failed');
    const fn = async () => { throw error; };
    const result = await withErrorBoundary(fn);
    
    expect(result).toEqual({
      success: false,
      error: error
    });
  });
  
  it('should wrap non-SemantestError in SemantestError', async () => {
    const fn = async () => { throw new Error('Generic error'); };
    const result = await withErrorBoundary(fn);
    
    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(SemantestError);
      expect(result.error.message).toBe('Generic error');
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
  });
  
  it('should handle non-Error throws', async () => {
    const fn = async () => { throw 'string error'; };
    const result = await withErrorBoundary(fn);
    
    expect(Result.isErr(result)).toBe(true);
    if (Result.isErr(result)) {
      expect(result.error).toBeInstanceOf(SemantestError);
      expect(result.error.message).toBe('An unknown error occurred');
      expect(result.error.code).toBe('UNKNOWN_ERROR');
    }
  });
});

describe('withRetry', () => {
  it('should succeed on first try', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const wrapped = withRetry(fn, { maxAttempts: 3 });
    
    const result = await wrapped();
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });
  
  it('should retry on failure and eventually succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');
    
    const wrapped = withRetry(fn, { maxAttempts: 3, delay: 10 });
    
    const result = await wrapped();
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  
  it('should fail after max attempts', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('Always fails'));
    const wrapped = withRetry(fn, { maxAttempts: 3, delay: 10 });
    
    await expect(wrapped()).rejects.toThrow('Always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });
  
  it('should apply exponential backoff', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');
    
    const startTime = Date.now();
    const wrapped = withRetry(fn, { 
      maxAttempts: 3, 
      delay: 10,
      backoff: true 
    });
    
    await wrapped();
    const elapsed = Date.now() - startTime;
    
    // Should have delays of 10ms and 20ms (exponential backoff)
    expect(elapsed).toBeGreaterThanOrEqual(30);
    expect(fn).toHaveBeenCalledTimes(3);
  });
  
  it('should only retry on retryable errors', async () => {
    const retryableError = new NetworkError('Network error');
    const nonRetryableError = new ValidationError('Validation error');
    
    const fn = jest.fn()
      .mockRejectedValueOnce(retryableError)
      .mockRejectedValueOnce(nonRetryableError);
    
    const wrapped = withRetry(fn, {
      maxAttempts: 3,
      delay: 10,
      retryOn: (error) => error instanceof NetworkError
    });
    
    await expect(wrapped()).rejects.toThrow('Validation error');
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let mockLogger: any;
  
  beforeEach(() => {
    mockLogger = {
      error: jest.fn()
    };
    handler = new GlobalErrorHandler(mockLogger);
  });
  
  it('should handle error events', () => {
    const errorEvent = new ErrorEvent('error', {
      message: 'Test error',
      filename: 'test.js',
      lineno: 10,
      colno: 5
    });
    
    handler.handleError(errorEvent);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled error',
      expect.objectContaining({
        message: 'Test error',
        source: 'test.js',
        line: 10,
        column: 5
      })
    );
  });
  
  it('should handle rejection events', () => {
    const promise = Promise.reject(new Error('Rejected'));
    const event = new PromiseRejectionEvent('unhandledrejection', {
      promise,
      reason: new Error('Rejected')
    });
    
    handler.handleRejection(event);
    
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Unhandled promise rejection',
      expect.objectContaining({
        reason: expect.any(Error)
      })
    );
  });
  
  it('should install and uninstall handlers', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    
    handler.install();
    
    expect(addEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(addEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    
    handler.uninstall();
    
    expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('unhandledrejection', expect.any(Function));
    
    addEventListenerSpy.mockRestore();
    removeEventListenerSpy.mockRestore();
  });
});