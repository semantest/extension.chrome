/**
 * Unit Tests for PerformanceOptimizer
 * Tests caching, lazy loading, and performance monitoring functionality
 */

import { PerformanceOptimizer, globalPerformanceOptimizer } from './performance-optimizer';
import { MessageState } from './message-store';

// Mock performance API
const mockPerformance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1024 * 1024 * 50, // 50MB
    totalJSHeapSize: 1024 * 1024 * 100,
    jsHeapSizeLimit: 1024 * 1024 * 500
  }
};

// Replace global performance
(global as any).performance = mockPerformance;

// Mock window.gc
(global as any).window = {
  gc: jest.fn()
};

// Mock btoa for browser environment
global.btoa = (str: string) => Buffer.from(str).toString('base64');

describe('PerformanceOptimizer', () => {
  let optimizer: PerformanceOptimizer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    optimizer = new PerformanceOptimizer();
  });

  afterEach(() => {
    optimizer.destroy();
    jest.useRealTimers();
  });

  describe('Message Caching', () => {
    const createMockMessage = (id: string): MessageState => ({
      correlationId: `corr-${id}`,
      type: 'text',
      status: 'success',
      direction: 'outbound',
      timestamp: Date.now(),
      payload: { text: `Message ${id}` },
      metadata: {
        extensionId: 'test-extension',
        tabId: 123,
        windowId: 456,
        url: 'https://test.com',
        userAgent: 'test-agent'
      }
    });

    test('should cache message by correlation ID', () => {
      const message = createMockMessage('1');
      optimizer.cacheMessage(message);
      
      const cached = optimizer.getCachedMessage('corr-1');
      expect(cached).toEqual(message);
    });

    test('should return null for non-existent message', () => {
      const cached = optimizer.getCachedMessage('non-existent');
      expect(cached).toBeNull();
    });

    test('should update access metrics on cache hit', () => {
      const message = createMockMessage('1');
      optimizer.cacheMessage(message);
      
      // Multiple accesses
      optimizer.getCachedMessage('corr-1');
      optimizer.getCachedMessage('corr-1');
      optimizer.getCachedMessage('corr-1');
      
      // Check performance stats show cache usage
      const stats = optimizer.getPerformanceStats();
      expect(stats.cacheStats.messageCache.size).toBe(1);
    });

    test('should expire cached messages after TTL', () => {
      const message = createMockMessage('1');
      optimizer.cacheMessage(message);
      
      // Advance time beyond TTL (5 minutes)
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      const cached = optimizer.getCachedMessage('corr-1');
      expect(cached).toBeNull();
    });

    test('should evict LRU when cache is full', () => {
      // Create a new optimizer instance with small cache size
      const smallOptimizer = new PerformanceOptimizer();
      (smallOptimizer as any).MAX_CACHE_SIZE = 3;
      
      // Fill cache
      smallOptimizer.cacheMessage(createMockMessage('1'));
      smallOptimizer.cacheMessage(createMockMessage('2'));
      smallOptimizer.cacheMessage(createMockMessage('3'));
      
      // Access messages to update LRU
      smallOptimizer.getCachedMessage('corr-2');
      smallOptimizer.getCachedMessage('corr-3');
      
      // Add new message, should evict corr-1
      smallOptimizer.cacheMessage(createMockMessage('4'));
      
      expect(smallOptimizer.getCachedMessage('corr-1')).toBeNull();
      expect(smallOptimizer.getCachedMessage('corr-4')).toBeDefined();
      
      // Clean up
      smallOptimizer.destroy();
    });
  });

  describe('Query Caching', () => {
    const mockMessages: MessageState[] = [
      {
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Message 1' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      },
      {
        correlationId: 'corr-2',
        type: 'image',
        status: 'pending',
        direction: 'inbound',
        timestamp: Date.now() - 1000,
        payload: { url: 'image.png' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      }
    ];

    test('should cache query results', () => {
      const queryKey = 'test-query';
      optimizer.cacheQuery(queryKey, mockMessages);
      
      const cached = optimizer.getCachedQuery(queryKey);
      expect(cached).toEqual(mockMessages);
    });

    test('should return shallow copy of cached data', () => {
      const queryKey = 'test-query';
      optimizer.cacheQuery(queryKey, mockMessages);
      
      const cached = optimizer.getCachedQuery(queryKey);
      expect(cached).not.toBe(mockMessages); // Different array reference
      expect(cached).toEqual(mockMessages); // Same content
    });

    test('should expire query cache after TTL', () => {
      const queryKey = 'test-query';
      optimizer.cacheQuery(queryKey, mockMessages);
      
      jest.advanceTimersByTime(6 * 60 * 1000); // Beyond TTL
      
      const cached = optimizer.getCachedQuery(queryKey);
      expect(cached).toBeNull();
    });
  });

  describe('Query Key Generation', () => {
    test('should generate consistent cache keys for same filters', () => {
      const filters = {
        types: ['text', 'image'],
        statuses: ['pending', 'success', 'error'] as const,
        directions: ['inbound', 'outbound'] as const,
        dateRange: null
      };
      
      const key1 = optimizer.generateQueryKey(filters);
      const key2 = optimizer.generateQueryKey(filters);
      
      expect(key1).toBe(key2);
    });

    test('should sort filter arrays for consistent keys', () => {
      const filters1 = {
        types: ['text', 'image'],
        statuses: ['pending', 'success'] as const,
        directions: ['inbound', 'outbound'] as const,
        dateRange: null
      };
      
      const filters2 = {
        types: ['image', 'text'], // Different order
        statuses: ['success', 'pending'] as const, // Different order
        directions: ['outbound', 'inbound'] as const, // Different order
        dateRange: null
      };
      
      const key1 = optimizer.generateQueryKey(filters1);
      const key2 = optimizer.generateQueryKey(filters2);
      
      expect(key1).toBe(key2);
    });

    test('should include sort parameter in key', () => {
      const filters = {
        types: [],
        statuses: [],
        directions: [],
        dateRange: null
      };
      
      const key1 = optimizer.generateQueryKey(filters, 'timestamp');
      const key2 = optimizer.generateQueryKey(filters, 'type');
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Lazy Loading', () => {
    const createMessages = (count: number): MessageState[] => {
      return Array.from({ length: count }, (_, i) => ({
        correlationId: `corr-${i}`,
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now() - i * 1000,
        payload: { text: `Message ${i}` },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      }));
    };

    test('should create lazy loader with correct metadata', () => {
      const messages = createMessages(100);
      const loader = optimizer.createLazyMessageLoader(messages, 20);
      
      expect(loader.totalCount).toBe(100);
      expect(loader.pageSize).toBe(20);
      expect(loader.currentPage).toBe(0);
    });

    test('should load pages correctly', () => {
      const messages = createMessages(55);
      const loader = optimizer.createLazyMessageLoader(messages, 20);
      
      // Load first page
      const page0 = loader.loadPage(0);
      expect(page0).toHaveLength(20);
      expect(page0[0].correlationId).toBe('corr-0');
      expect(page0[19].correlationId).toBe('corr-19');
      
      // Load second page
      const page1 = loader.loadPage(1);
      expect(page1).toHaveLength(20);
      expect(page1[0].correlationId).toBe('corr-20');
      
      // Load last partial page
      const page2 = loader.loadPage(2);
      expect(page2).toHaveLength(15);
      expect(page2[0].correlationId).toBe('corr-40');
      expect(page2[14].correlationId).toBe('corr-54');
    });

    test('should return empty array for out of bounds page', () => {
      const messages = createMessages(10);
      const loader = optimizer.createLazyMessageLoader(messages, 20);
      
      const page = loader.loadPage(1);
      expect(page).toEqual([]);
    });

    test('should correctly determine next/previous page availability', () => {
      const messages = createMessages(55);
      const loader = optimizer.createLazyMessageLoader(messages, 20);
      
      // First page
      expect(loader.hasNextPage(0)).toBe(true);
      expect(loader.hasPreviousPage(0)).toBe(false);
      
      // Middle page
      expect(loader.hasNextPage(1)).toBe(true);
      expect(loader.hasPreviousPage(1)).toBe(true);
      
      // Last page
      expect(loader.hasNextPage(2)).toBe(false);
      expect(loader.hasPreviousPage(2)).toBe(true);
    });
  });

  describe('Optimized Filtering', () => {
    const messages: MessageState[] = [
      {
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Text message' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      },
      {
        correlationId: 'corr-2',
        type: 'image',
        status: 'pending',
        direction: 'inbound',
        timestamp: Date.now() - 1000,
        payload: { url: 'image.png' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      },
      {
        correlationId: 'corr-3',
        type: 'text',
        status: 'error',
        direction: 'outbound',
        timestamp: Date.now() - 2000,
        payload: { text: 'Failed message' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      }
    ];

    test('should create indexes for filtering', () => {
      const filter = optimizer.createOptimizedFilter(messages);
      
      // Filter by type
      const textMessages = filter.filterByType(['text']);
      expect(textMessages).toHaveLength(2);
      expect(textMessages.every(m => m.type === 'text')).toBe(true);
      
      // Filter by status
      const successMessages = filter.filterByStatus(['success']);
      expect(successMessages).toHaveLength(1);
      expect(successMessages[0].status).toBe('success');
      
      // Filter by direction
      const inboundMessages = filter.filterByDirection(['inbound']);
      expect(inboundMessages).toHaveLength(1);
      expect(inboundMessages[0].direction).toBe('inbound');
    });

    test('should return all messages when no filter specified', () => {
      const filter = optimizer.createOptimizedFilter(messages);
      
      expect(filter.filterByType([])).toEqual(messages);
      expect(filter.filterByStatus([])).toEqual(messages);
      expect(filter.filterByDirection([])).toEqual(messages);
    });

    test('should handle multiple filter values', () => {
      const filter = optimizer.createOptimizedFilter(messages);
      
      const results = filter.filterByStatus(['success', 'pending']);
      expect(results).toHaveLength(2);
      expect(results.some(m => m.status === 'success')).toBe(true);
      expect(results.some(m => m.status === 'pending')).toBe(true);
    });

    test('should not duplicate messages in results', () => {
      const filter = optimizer.createOptimizedFilter(messages);
      
      // Even if we filter by multiple values that match same message
      const results = filter.filterByType(['text', 'text']);
      expect(results).toHaveLength(2); // Not 4
    });
  });

  describe('Performance Metrics', () => {
    test('should record metrics correctly', () => {
      optimizer.recordMetric('messageProcessingTime', 10);
      optimizer.recordMetric('messageProcessingTime', 20);
      optimizer.recordMetric('messageProcessingTime', 30);
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.messageProcessing.avg).toBe(20);
      expect(stats.messageProcessing.min).toBe(10);
      expect(stats.messageProcessing.max).toBe(30);
      expect(stats.messageProcessing.count).toBe(3);
    });

    test('should limit metric array size', () => {
      // Record more than 100 metrics
      for (let i = 0; i < 150; i++) {
        optimizer.recordMetric('uiRenderTime', i);
      }
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.uiRendering.count).toBe(100);
    });

    test('should handle empty metrics', () => {
      const stats = optimizer.getPerformanceStats();
      expect(stats.messageProcessing.avg).toBe(0);
      expect(stats.messageProcessing.count).toBe(0);
    });

    test('should record memory usage periodically', () => {
      // Create a new optimizer to ensure clean start
      const newOptimizer = new PerformanceOptimizer();
      
      // Advance time to trigger memory monitoring
      jest.advanceTimersByTime(30000);
      
      const stats = newOptimizer.getPerformanceStats();
      expect(stats.memoryUsage.count).toBeGreaterThan(0);
      
      // Clean up
      newOptimizer.destroy();
    });
  });

  describe('Time Execution', () => {
    test('should time synchronous function execution', () => {
      const syncFn = jest.fn(() => 'result');
      
      const result = optimizer.timeExecution(syncFn, 'messageProcessingTime');
      
      expect(result).toBe('result');
      expect(syncFn).toHaveBeenCalled();
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.messageProcessing.count).toBe(1);
    });

    test('should time async function execution', async () => {
      const asyncFn = jest.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'async result';
      });
      
      const resultPromise = optimizer.timeExecution(asyncFn, 'storageOperationTime');
      expect(resultPromise).toBeInstanceOf(Promise);
      
      // Advance timers before awaiting
      jest.advanceTimersByTime(100);
      
      const result = await resultPromise;
      expect(result).toBe('async result');
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.storageOperations.count).toBe(1);
    }, 10000);
  });

  describe('Debounce', () => {
    test('should debounce function calls', () => {
      const fn = jest.fn();
      const debounced = optimizer.debounce(fn, 100);
      
      // Call multiple times rapidly
      debounced('arg1');
      debounced('arg2');
      debounced('arg3');
      
      expect(fn).not.toHaveBeenCalled();
      
      // Advance time to trigger debounced call
      jest.advanceTimersByTime(100);
      
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg3'); // Last call wins
    });

    test('should handle multiple debounce cycles', () => {
      const fn = jest.fn();
      const debounced = optimizer.debounce(fn, 100);
      
      // First cycle
      debounced('first');
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('first');
      
      // Second cycle
      debounced('second');
      jest.advanceTimersByTime(100);
      expect(fn).toHaveBeenCalledWith('second');
      
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  describe('Throttle', () => {
    test('should throttle function calls', () => {
      const fn = jest.fn();
      const throttled = optimizer.throttle(fn, 100);
      
      // First call goes through immediately
      throttled('arg1');
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith('arg1');
      
      // Subsequent calls are throttled
      throttled('arg2');
      throttled('arg3');
      expect(fn).toHaveBeenCalledTimes(1);
      
      // After delay, next call goes through
      jest.advanceTimersByTime(100);
      throttled('arg4');
      expect(fn).toHaveBeenCalledTimes(2);
      expect(fn).toHaveBeenCalledWith('arg4');
    });
  });

  describe('Memory Management', () => {
    test('should clear all caches', () => {
      // Add some data to caches
      optimizer.cacheMessage({
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Test' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      });
      optimizer.cacheQuery('test-query', []);
      
      optimizer.clearCaches();
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.cacheStats.messageCache.size).toBe(0);
      expect(stats.cacheStats.queryCache.size).toBe(0);
    });

    test('should optimize memory and trigger gc if available', () => {
      const gcSpy = jest.spyOn(window as any, 'gc');
      
      optimizer.optimizeMemory();
      
      expect(gcSpy).toHaveBeenCalled();
      
      const stats = optimizer.getPerformanceStats();
      expect(new Date(stats.lastCleanup).getTime()).toBeCloseTo(Date.now(), -2);
      
      gcSpy.mockRestore();
    });

    test('should estimate memory usage', () => {
      // Add some cached data
      optimizer.cacheMessage({
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Test message content' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      });
      
      const usage = optimizer.getMemoryUsage();
      expect(usage.estimated).toBeGreaterThan(0);
      expect(usage.cacheSize).toBe(1);
    });
  });

  describe('Cache Cleanup', () => {
    test('should clean up expired entries periodically', () => {
      // Add entries
      optimizer.cacheMessage({
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Test' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      });
      
      // Advance time past TTL and cleanup interval
      jest.advanceTimersByTime(6 * 60 * 1000);
      
      const stats = optimizer.getPerformanceStats();
      expect(stats.cacheStats.messageCache.size).toBe(0);
    });
  });

  describe('Destroy', () => {
    test('should clean up resources on destroy', () => {
      // Add some data
      optimizer.cacheMessage({
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Test' },
        metadata: {
          extensionId: 'test-extension',
          tabId: 123,
          windowId: 456,
          url: 'https://test.com',
          userAgent: 'test-agent'
        }
      });
      
      optimizer.destroy();
      
      // Verify cleanup
      const stats = optimizer.getPerformanceStats();
      expect(stats.cacheStats.messageCache.size).toBe(0);
      
      // Verify timer is cleared by checking it doesn't run
      jest.advanceTimersByTime(60000);
      // No errors should occur
    });
  });

  describe('Global Instance', () => {
    test('should export global instance', () => {
      expect(globalPerformanceOptimizer).toBeInstanceOf(PerformanceOptimizer);
    });
  });
});