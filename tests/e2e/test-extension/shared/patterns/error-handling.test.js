/**
 * @fileoverview Tests for error handling patterns
 */
import { SemantestError, ValidationError, NetworkError, Result, withErrorBoundary, withRetry } from './error-handling';
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
            await withErrorBoundary(async () => { throw error; }, errorHandler);
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
            await expect(withRetry(operation, { maxAttempts: 2, initialDelay: 10 })).rejects.toThrow(error);
            expect(operation).toHaveBeenCalledTimes(2);
        });
        it('should respect shouldRetry predicate', async () => {
            const retryableError = new NetworkError('Timeout');
            const fatalError = new ValidationError('Invalid');
            const operation = jest.fn()
                .mockRejectedValueOnce(retryableError)
                .mockRejectedValueOnce(fatalError);
            await expect(withRetry(operation, {
                maxAttempts: 3,
                initialDelay: 10,
                shouldRetry: (err) => err instanceof NetworkError
            })).rejects.toThrow(fatalError);
            expect(operation).toHaveBeenCalledTimes(2);
        });
    });
});
