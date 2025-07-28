/**
 * @jest-environment jsdom
 */

// @ts-nocheck

// Use the mock implementation
jest.mock('./logging');

import {
  LogLevel,
  LogContext,
  LogEntry,
  Logger,
  ModuleLogger,
  PerformanceLogger,
  ChromeLogHandler
} from './logging';

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    remove: jest.fn(),
    getBytesInUse: jest.fn()
  },
  local: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    remove: jest.fn(),
    getBytesInUse: jest.fn()
  },
  managed: {
    get: jest.fn(),
    getBytesInUse: jest.fn()
  },
  session: {
    get: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
    remove: jest.fn(),
    getBytesInUse: jest.fn()
  },
  onChanged: {
    addListener: jest.fn(),
    removeListener: jest.fn(),
    hasListener: jest.fn()
  },
  AccessLevel: {
    TRUSTED_CONTEXTS: 'TRUSTED_CONTEXTS',
    TRUSTED_AND_UNTRUSTED_CONTEXTS: 'TRUSTED_AND_UNTRUSTED_CONTEXTS'
  }
};

// @ts-ignore
global.chrome = {
  storage: mockStorage as any
} as any;

// Mock performance.now()
global.performance.now = jest.fn();

describe('Logging Patterns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset singleton instance
    (Logger as any).instance = undefined;
    // Reset PerformanceLogger measurements
    (PerformanceLogger as any).measurements.clear();
    // Reset performance.now mock
    (global.performance.now as jest.Mock).mockReturnValue(0);
  });

  describe('LogLevel', () => {
    it('should have correct numeric values', () => {
      expect(LogLevel.DEBUG).toBe(0);
      expect(LogLevel.INFO).toBe(1);
      expect(LogLevel.WARN).toBe(2);
      expect(LogLevel.ERROR).toBe(3);
      expect(LogLevel.NONE).toBe(4);
    });
  });

  describe('Logger', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = Logger.getInstance();
    });

    describe('getInstance', () => {
      it('should return singleton instance', () => {
        const instance1 = Logger.getInstance();
        const instance2 = Logger.getInstance();
        
        expect(instance1).toBe(instance2);
      });
    });

    describe('setLevel', () => {
      it('should set log level', () => {
        logger.setLevel(LogLevel.WARN);
        
        const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
        logger.debug('test');
        
        expect(consoleSpy).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });
    });

    describe('setGlobalContext', () => {
      it('should merge global context', () => {
        logger.setGlobalContext({ module: 'test' });
        logger.setGlobalContext({ action: 'debug' });
        
        const handler = jest.fn();
        logger.addHandler(handler);
        
        logger.info('test message');
        
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              module: 'test',
              action: 'debug'
            })
          })
        );
      });
    });

    describe('logging methods', () => {
      let consoleDebugSpy: jest.SpyInstance;
      let consoleInfoSpy: jest.SpyInstance;
      let consoleWarnSpy: jest.SpyInstance;
      let consoleErrorSpy: jest.SpyInstance;

      beforeEach(() => {
        consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
        consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation();
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        logger.setLevel(LogLevel.DEBUG);
      });

      afterEach(() => {
        consoleDebugSpy.mockRestore();
        consoleInfoSpy.mockRestore();
        consoleWarnSpy.mockRestore();
        consoleErrorSpy.mockRestore();
      });

      it('should log debug messages', () => {
        logger.debug('debug message', { key: 'value' }, { data: 'test' });
        
        expect(consoleDebugSpy).toHaveBeenCalledWith(
          expect.stringContaining('[DEBUG]'),
          { data: 'test' }
        );
      });

      it('should log info messages', () => {
        logger.info('info message', { key: 'value' }, { data: 'test' });
        
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('[INFO]'),
          { data: 'test' }
        );
      });

      it('should log warn messages', () => {
        logger.warn('warn message', { key: 'value' }, { data: 'test' });
        
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          expect.stringContaining('[WARN]'),
          { data: 'test' }
        );
      });

      it('should log error messages', () => {
        const error = new Error('test error');
        logger.error('error message', error, { key: 'value' }, { data: 'test' });
        
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('[ERROR]'),
          { data: 'test' }
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(error);
      });

      it('should respect log level', () => {
        logger.setLevel(LogLevel.WARN);
        
        logger.debug('debug');
        logger.info('info');
        logger.warn('warn');
        logger.error('error');
        
        expect(consoleDebugSpy).not.toHaveBeenCalled();
        expect(consoleInfoSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      it('should format timestamp correctly', () => {
        const now = new Date('2024-01-15T12:34:56.789Z');
        jest.spyOn(global, 'Date').mockImplementation(() => now as any);
        
        logger.info('test');
        
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('2024-01-15 12:34:56'),
          ''
        );
      });

      it('should include context in output', () => {
        logger.info('test', { userId: '123', action: 'login' });
        
        expect(consoleInfoSpy).toHaveBeenCalledWith(
          expect.stringContaining('{"userId":"123","action":"login"}'),
          ''
        );
      });
    });

    describe('handlers', () => {
      it('should call custom handlers', () => {
        const handler1 = jest.fn();
        const handler2 = jest.fn();
        
        logger.addHandler(handler1);
        logger.addHandler(handler2);
        
        logger.info('test message');
        
        expect(handler1).toHaveBeenCalledWith(
          expect.objectContaining({
            level: LogLevel.INFO,
            message: 'test message',
            timestamp: expect.any(Date)
          })
        );
        expect(handler2).toHaveBeenCalled();
      });

      it('should handle handler errors gracefully', () => {
        const errorHandler = jest.fn(() => {
          throw new Error('Handler error');
        });
        const goodHandler = jest.fn();
        
        logger.addHandler(errorHandler);
        logger.addHandler(goodHandler);
        
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        logger.info('test');
        
        expect(consoleError).toHaveBeenCalledWith('Logger handler error:', expect.any(Error));
        expect(goodHandler).toHaveBeenCalled();
        
        consoleError.mockRestore();
      });
    });
  });

  describe('ModuleLogger', () => {
    let moduleLogger: ModuleLogger;
    let parentLogger: Logger;

    beforeEach(() => {
      parentLogger = Logger.getInstance();
      moduleLogger = new ModuleLogger('TestModule');
    });

    it('should add module context to logs', () => {
      const handler = jest.fn();
      parentLogger.addHandler(handler);
      
      moduleLogger.info('test message', { data: 'test' });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            module: 'TestModule'
          })
        })
      );
    });

    it('should support all log levels', () => {
      const handler = jest.fn();
      parentLogger.addHandler(handler);
      parentLogger.setLevel(LogLevel.DEBUG);
      
      moduleLogger.debug('debug');
      moduleLogger.info('info');
      moduleLogger.warn('warn');
      moduleLogger.error('error', new Error('test'));
      
      expect(handler).toHaveBeenCalledTimes(4);
    });

    it('should create child loggers', () => {
      const childLogger = moduleLogger.child('SubModule');
      
      const handler = jest.fn();
      parentLogger.addHandler(handler);
      
      childLogger.info('test');
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            module: 'TestModule.SubModule'
          })
        })
      );
    });

    it('should use custom logger instance', () => {
      const customLogger = Logger.getInstance();
      const customHandler = jest.fn();
      customLogger.addHandler(customHandler);
      
      const moduleLogger = new ModuleLogger('Custom', customLogger);
      moduleLogger.info('test');
      
      expect(customHandler).toHaveBeenCalled();
    });
  });

  describe('PerformanceLogger', () => {
    beforeEach(() => {
      (global.performance.now as jest.Mock)
        .mockReturnValueOnce(100)  // start
        .mockReturnValueOnce(250); // end
    });

    describe('start/end', () => {
      it('should measure performance', () => {
        const logger = Logger.getInstance();
        const handler = jest.fn();
        logger.addHandler(handler);
        
        PerformanceLogger.start('test-operation');
        PerformanceLogger.end('test-operation', { userId: '123' });
        
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Performance: test-operation',
            context: expect.objectContaining({
              userId: '123',
              performance: true
            }),
            data: { duration: '150.00ms' }
          })
        );
      });

      it('should warn on missing start time', () => {
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
        
        PerformanceLogger.end('unknown-operation');
        
        expect(consoleWarn).toHaveBeenCalledWith('No start time found for label: unknown-operation');
        
        consoleWarn.mockRestore();
      });

      it('should clean up measurements after end', () => {
        PerformanceLogger.start('test-operation');
        PerformanceLogger.end('test-operation');
        
        const consoleWarn = jest.spyOn(console, 'warn').mockImplementation();
        
        PerformanceLogger.end('test-operation');
        
        expect(consoleWarn).toHaveBeenCalledWith('No start time found for label: test-operation');
        
        consoleWarn.mockRestore();
      });
    });

    describe('measure', () => {
      it('should measure async operations', async () => {
        const logger = Logger.getInstance();
        const handler = jest.fn();
        logger.addHandler(handler);
        
        const operation = jest.fn(async () => 'result');
        
        const result = await PerformanceLogger.measure(
          'async-operation',
          operation,
          { module: 'test' }
        );
        
        expect(result).toBe('result');
        expect(operation).toHaveBeenCalled();
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Performance: async-operation',
            context: expect.objectContaining({
              module: 'test',
              performance: true
            })
          })
        );
      });

      it('should handle operation errors', async () => {
        const logger = Logger.getInstance();
        const handler = jest.fn();
        logger.addHandler(handler);
        
        const error = new Error('Operation failed');
        const operation = jest.fn(async () => {
          throw error;
        });
        
        await expect(
          PerformanceLogger.measure('failing-operation', operation)
        ).rejects.toThrow(error);
        
        expect(handler).toHaveBeenCalledWith(
          expect.objectContaining({
            context: expect.objectContaining({
              error: true,
              performance: true
            })
          })
        );
      });
    });
  });

  describe('ChromeLogHandler', () => {
    it('should setup chrome storage handler', () => {
      const logger = Logger.getInstance();
      const addHandlerSpy = jest.spyOn(logger, 'addHandler');
      
      ChromeLogHandler.setup();
      
      expect(addHandlerSpy).toHaveBeenCalled();
    });

    it('should store logs in chrome.storage.local', async () => {
      mockStorage.local.get.mockResolvedValue({});
      mockStorage.local.set.mockResolvedValue(undefined);
      
      ChromeLogHandler.setup();
      const logger = Logger.getInstance();
      
      const now = new Date('2024-01-15T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
      
      logger.info('test message');
      
      // Wait for async handler
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockStorage.local.get).toHaveBeenCalledWith('logs');
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        logs: {
          '2024-01-15': [
            expect.objectContaining({
              level: LogLevel.INFO,
              message: 'test message',
              timestamp: '2024-01-15T12:00:00.000Z'
            })
          ]
        }
      });
    });

    it('should append to existing logs', async () => {
      const existingLogs = {
        '2024-01-15': [
          { level: LogLevel.INFO, message: 'existing', timestamp: '2024-01-15T10:00:00.000Z' }
        ]
      };
      mockStorage.local.get.mockResolvedValue({ logs: existingLogs });
      mockStorage.local.set.mockResolvedValue(undefined);
      
      ChromeLogHandler.setup();
      const logger = Logger.getInstance();
      
      const now = new Date('2024-01-15T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
      
      logger.info('new message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        logs: {
          '2024-01-15': [
            { level: LogLevel.INFO, message: 'existing', timestamp: '2024-01-15T10:00:00.000Z' },
            expect.objectContaining({
              level: LogLevel.INFO,
              message: 'new message',
              timestamp: '2024-01-15T12:00:00.000Z'
            })
          ]
        }
      });
    });

    it('should limit logs to 1000 per day', async () => {
      const existingLogs = {
        '2024-01-15': Array(1005).fill({
          level: LogLevel.INFO,
          message: 'old',
          timestamp: '2024-01-15T10:00:00.000Z'
        })
      };
      mockStorage.local.get.mockResolvedValue({ logs: existingLogs });
      mockStorage.local.set.mockResolvedValue(undefined);
      
      ChromeLogHandler.setup();
      const logger = Logger.getInstance();
      
      const now = new Date('2024-01-15T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
      
      logger.info('new message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        logs: {
          '2024-01-15': expect.arrayContaining([
            expect.objectContaining({ message: 'new message' })
          ])
        }
      });
      
      const setCall = mockStorage.local.set.mock.calls[0][0];
      expect(setCall.logs['2024-01-15'].length).toBe(1000);
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.local.get.mockRejectedValue(new Error('Storage error'));
      
      const consoleError = jest.spyOn(console, 'error').mockImplementation();
      
      ChromeLogHandler.setup();
      const logger = Logger.getInstance();
      
      logger.info('test');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(consoleError).toHaveBeenCalledWith('Failed to store log:', expect.any(Error));
      
      consoleError.mockRestore();
    });

    it('should handle null logs object', async () => {
      mockStorage.local.get.mockResolvedValue({ logs: null });
      mockStorage.local.set.mockResolvedValue(undefined);
      
      ChromeLogHandler.setup();
      const logger = Logger.getInstance();
      
      const now = new Date('2024-01-15T12:00:00.000Z');
      jest.spyOn(global, 'Date').mockImplementation(() => now as any);
      
      logger.info('test message');
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        logs: {
          '2024-01-15': [
            expect.objectContaining({
              message: 'test message'
            })
          ]
        }
      });
    });
  });

  describe('Integration Tests', () => {
    it('should work with global context and module logger', () => {
      const logger = Logger.getInstance();
      const handler = jest.fn();
      logger.addHandler(handler);
      
      logger.setGlobalContext({ appVersion: '1.0.0' });
      
      const moduleLogger = new ModuleLogger('AuthModule');
      moduleLogger.info('User logged in', { data: { userId: '123' } });
      
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            appVersion: '1.0.0',
            module: 'AuthModule'
          }),
          data: { userId: '123' }
        })
      );
    });

    it('should handle complex logging scenarios', async () => {
      const logger = Logger.getInstance();
      logger.setLevel(LogLevel.DEBUG);
      
      const moduleLogger = new ModuleLogger('API');
      const subLogger = moduleLogger.child('Request');
      
      const handler = jest.fn();
      logger.addHandler(handler);
      
      // Simulate API request logging
      subLogger.debug('Starting request', { method: 'GET', url: '/api/users' });
      
      await PerformanceLogger.measure(
        'api-request',
        async () => {
          subLogger.info('Request completed', { status: 200 });
          return { users: [] };
        },
        { module: 'API.Request' }
      );
      
      expect(handler).toHaveBeenCalledTimes(3); // debug, info, performance
    });
  });
});