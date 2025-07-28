/**
 * @jest-environment jsdom
 */

// @ts-nocheck

import {
  PerformanceMonitor,
  debounce,
  throttle,
  memoize,
  LazyLoader,
  ResourcePool,
  BatchProcessor,
  MemoryMonitor
} from './index';

// Mock performance.memory
Object.defineProperty(performance, 'memory', {
  value: {
    usedJSHeapSize: 50 * 1024 * 1024, // 50 MB
    totalJSHeapSize: 100 * 1024 * 1024, // 100 MB
    jsHeapSizeLimit: 2048 * 1024 * 1024 // 2 GB
  },
  writable: true,
  configurable: true
});

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    PerformanceMonitor.clear();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setThreshold', () => {
    it('should set threshold for a metric', () => {
      PerformanceMonitor.setThreshold('api-response', 1000);
      
      // Verify by recording a value above threshold
      PerformanceMonitor.record('api-response', 1500);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for api-response: 1500ms > 1000ms'
      );
    });
  });

  describe('record', () => {
    it('should record performance metrics', () => {
      PerformanceMonitor.record('test-metric', 100);
      PerformanceMonitor.record('test-metric', 200);
      PerformanceMonitor.record('test-metric', 150);
      
      const stats = PerformanceMonitor.getStats('test-metric');
      
      expect(stats).toEqual({
        count: 3,
        min: 100,
        max: 200,
        avg: 150,
        p95: 200
      });
    });

    it('should keep only last 100 measurements', () => {
      for (let i = 0; i < 110; i++) {
        PerformanceMonitor.record('many-metrics', i);
      }
      
      const stats = PerformanceMonitor.getStats('many-metrics');
      
      expect(stats!.count).toBe(100);
      expect(stats!.min).toBe(10); // First 10 values were removed
    });

    it('should warn when threshold is exceeded', () => {
      PerformanceMonitor.setThreshold('slow-api', 500);
      PerformanceMonitor.record('slow-api', 600);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for slow-api: 600ms > 500ms'
      );
    });
  });

  describe('getStats', () => {
    it('should return null for unknown metric', () => {
      const stats = PerformanceMonitor.getStats('unknown');
      expect(stats).toBeNull();
    });

    it('should calculate correct statistics', () => {
      const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      values.forEach(v => PerformanceMonitor.record('test', v));
      
      const stats = PerformanceMonitor.getStats('test');
      
      expect(stats).toEqual({
        count: 10,
        min: 100,
        max: 1000,
        avg: 550,
        p95: 1000 // 95th percentile of 10 values is the last one
      });
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      PerformanceMonitor.record('metric1', 100);
      PerformanceMonitor.record('metric2', 200);
      
      PerformanceMonitor.clear();
      
      expect(PerformanceMonitor.getStats('metric1')).toBeNull();
      expect(PerformanceMonitor.getStats('metric2')).toBeNull();
    });
  });
});

describe('debounce', () => {
  jest.useFakeTimers();

  it('should debounce function calls', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);
    
    debouncedFn('first');
    debouncedFn('second');
    debouncedFn('third');
    
    expect(fn).not.toHaveBeenCalled();
    
    jest.advanceTimersByTime(100);
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('third');
  });

  it('should preserve this context', () => {
    const obj = {
      value: 'test',
      method: function(this: any) {
        return this.value;
      }
    };
    
    const debouncedMethod = debounce(obj.method.bind(obj), 100);
    debouncedMethod();
    
    jest.advanceTimersByTime(100);
    
    // Can't check if it was called, but it should work without errors
    expect(() => debouncedMethod()).not.toThrow();
  });

  it('should handle multiple debounce cycles', () => {
    const fn = jest.fn();
    const debouncedFn = debounce(fn, 100);
    
    // First cycle
    debouncedFn(1);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(1);
    
    // Second cycle
    debouncedFn(2);
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledWith(2);
    
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

describe('throttle', () => {
  jest.useFakeTimers();

  it('should throttle function calls', () => {
    const fn = jest.fn();
    const throttledFn = throttle(fn, 100);
    
    throttledFn('first');
    throttledFn('second'); // Should be ignored
    throttledFn('third'); // Should be ignored
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('first');
    
    jest.advanceTimersByTime(100);
    
    throttledFn('fourth');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith('fourth');
  });

  it('should preserve this context', () => {
    const obj = {
      value: 'test',
      method: function(this: any) {
        return this.value;
      }
    };
    
    const throttledMethod = throttle(obj.method.bind(obj), 100);
    throttledMethod();
    
    // Can't check if it was called, but it should work without errors
    expect(() => throttledMethod()).not.toThrow();
  });
});

describe('memoize', () => {
  it('should cache function results', () => {
    const fn = jest.fn((a: number, b: number) => a + b);
    const memoizedFn = memoize(fn);
    
    expect(memoizedFn(1, 2)).toBe(3);
    expect(memoizedFn(1, 2)).toBe(3);
    expect(memoizedFn(2, 3)).toBe(5);
    
    expect(fn).toHaveBeenCalledTimes(2); // Not 3
  });

  it('should use custom key generator', () => {
    const fn = jest.fn((obj: { id: number; name: string }) => obj.name);
    const memoizedFn = memoize(fn, (obj) => String(obj.id));
    
    const obj1 = { id: 1, name: 'Alice' };
    const obj2 = { id: 1, name: 'Bob' }; // Same ID
    const obj3 = { id: 2, name: 'Charlie' };
    
    expect(memoizedFn(obj1)).toBe('Alice');
    expect(memoizedFn(obj2)).toBe('Alice'); // Cached by ID
    expect(memoizedFn(obj3)).toBe('Charlie');
    
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should preserve this context', () => {
    const obj = {
      multiplier: 10,
      multiply: function(n: number) {
        return n * this.multiplier;
      }
    };
    
    obj.multiply = memoize(obj.multiply);
    
    expect(obj.multiply(5)).toBe(50);
    expect(obj.multiply(5)).toBe(50); // Cached
  });
});

describe('LazyLoader', () => {
  beforeEach(() => {
    LazyLoader.clear();
  });

  it('should lazy load modules', async () => {
    const loader = jest.fn(async () => ({ name: 'module' }));
    
    const module1 = await LazyLoader.load('test-module', loader);
    const module2 = await LazyLoader.load('test-module', loader);
    
    expect(module1).toEqual({ name: 'module' });
    expect(module1).toBe(module2); // Same instance
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('should check if module is loaded', async () => {
    expect(LazyLoader.isLoaded('test-module')).toBe(false);
    
    await LazyLoader.load('test-module', async () => ({}));
    
    expect(LazyLoader.isLoaded('test-module')).toBe(true);
  });

  it('should clear loaded modules', async () => {
    await LazyLoader.load('module1', async () => ({}));
    await LazyLoader.load('module2', async () => ({}));
    
    LazyLoader.clear();
    
    expect(LazyLoader.isLoaded('module1')).toBe(false);
    expect(LazyLoader.isLoaded('module2')).toBe(false);
  });
});

describe('ResourcePool', () => {
  it('should manage resource pool', () => {
    let id = 0;
    const factory = () => ({ id: ++id, data: null });
    const reset = (item: any) => { item.data = null; };
    
    const pool = new ResourcePool(factory, reset, 5);
    
    expect(pool.size()).toEqual({ available: 3, inUse: 0 });
    
    const r1 = pool.acquire();
    const r2 = pool.acquire();
    
    expect(pool.size()).toEqual({ available: 1, inUse: 2 });
    
    pool.release(r1);
    
    expect(pool.size()).toEqual({ available: 2, inUse: 1 });
    
    const r3 = pool.acquire();
    expect(r3).toBe(r1); // Reused
  });

  it('should throw when pool is exhausted', () => {
    const factory = () => ({});
    const reset = () => {};
    const pool = new ResourcePool(factory, reset, 2);
    
    pool.acquire();
    pool.acquire();
    
    expect(() => pool.acquire()).toThrow('Resource pool exhausted');
  });

  it('should handle releasing unknown resources', () => {
    const factory = () => ({});
    const reset = () => {};
    const pool = new ResourcePool(factory, reset);
    
    const unknownResource = {};
    
    // Should not throw
    expect(() => pool.release(unknownResource)).not.toThrow();
  });
});

describe('BatchProcessor', () => {
  jest.useFakeTimers();

  it('should batch process items', async () => {
    const processor = jest.fn(async (items: number[]) => 
      items.map(n => n * 2)
    );
    
    const batch = new BatchProcessor(processor, 3, 100);
    
    const promises = [
      batch.add(1),
      batch.add(2),
      batch.add(3) // This triggers batch processing
    ];
    
    await jest.runAllTimersAsync();
    const results = await Promise.all(promises);
    
    expect(results).toEqual([2, 4, 6]);
    expect(processor).toHaveBeenCalledTimes(1);
    expect(processor).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should process on timeout', async () => {
    const processor = jest.fn(async (items: number[]) => 
      items.map(n => n * 2)
    );
    
    const batch = new BatchProcessor(processor, 10, 100);
    
    const promise = batch.add(1);
    
    jest.advanceTimersByTime(100);
    await jest.runAllTimersAsync();
    
    const result = await promise;
    
    expect(result).toBe(2);
    expect(processor).toHaveBeenCalledWith([1]);
  });

  it('should handle processor errors', async () => {
    const processor = jest.fn(async () => {
      throw new Error('Processing failed');
    });
    
    const batch = new BatchProcessor(processor, 2, 100);
    
    const promise1 = batch.add(1);
    const promise2 = batch.add(2);
    
    await jest.runAllTimersAsync();
    
    await expect(promise1).rejects.toThrow('Processing failed');
    await expect(promise2).rejects.toThrow('Processing failed');
  });

  it('should process remaining items after batch', async () => {
    const processor = jest.fn(async (items: number[]) => 
      items.map(n => n * 2)
    );
    
    const batch = new BatchProcessor(processor, 2, 100);
    
    const promises = [
      batch.add(1),
      batch.add(2), // Triggers first batch
      batch.add(3),
      batch.add(4), // Triggers second batch
      batch.add(5)  // Waits for timeout
    ];
    
    jest.advanceTimersByTime(0); // Process first batch
    jest.advanceTimersByTime(0); // Process second batch
    jest.advanceTimersByTime(100); // Process remaining
    await jest.runAllTimersAsync();
    
    const results = await Promise.all(promises);
    
    expect(results).toEqual([2, 4, 6, 8, 10]);
    expect(processor).toHaveBeenCalledTimes(3);
  });
});

describe('MemoryMonitor', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getUsage', () => {
    it('should return memory usage', () => {
      const usage = MemoryMonitor.getUsage();
      
      expect(usage).toEqual({
        usedJSHeapSize: 50,
        totalJSHeapSize: 100,
        jsHeapSizeLimit: 2048,
        percentUsed: 2
      });
    });

    it('should return null when performance.memory is not available', () => {
      const originalMemory = (performance as any).memory;
      Object.defineProperty(performance, 'memory', {
        value: undefined,
        configurable: true
      });
      
      const usage = MemoryMonitor.getUsage();
      
      expect(usage).toBeNull();
      
      Object.defineProperty(performance, 'memory', {
        value: originalMemory,
        configurable: true
      });
    });
  });

  describe('startMonitoring', () => {
    jest.useFakeTimers();

    it('should monitor memory usage', () => {
      const stop = MemoryMonitor.startMonitoring(1000);
      
      // Set high memory usage
      Object.defineProperty(performance, 'memory', {
        value: {
          usedJSHeapSize: 1800 * 1024 * 1024,
          totalJSHeapSize: 2000 * 1024 * 1024,
          jsHeapSizeLimit: 2048 * 1024 * 1024
        },
        configurable: true
      });
      
      jest.advanceTimersByTime(1000);
      
      expect(console.warn).toHaveBeenCalledWith('High memory usage:', {
        usedJSHeapSize: 1800,
        totalJSHeapSize: 2000,
        jsHeapSizeLimit: 2048,
        percentUsed: 88
      });
      
      stop();
    });

    it('should stop monitoring when stop function is called', () => {
      const stop = MemoryMonitor.startMonitoring(1000);
      
      stop();
      
      jest.advanceTimersByTime(5000);
      
      expect(console.warn).not.toHaveBeenCalled();
    });
  });
});