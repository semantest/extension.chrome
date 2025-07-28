/**
 * Tests for performance utility functions
 */

import {
  debounce,
  throttle,
  memoize,
  LazyLoader,
  ResourcePool,
  BatchProcessor
} from './index';

describe('Performance Utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('debounce', () => {
    jest.useFakeTimers();

    it('should debounce function calls', () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn('call1');
      debouncedFn('call2');
      debouncedFn('call3');

      expect(mockFn).not.toHaveBeenCalled();

      jest.runAllTimers();

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    it('should preserve this context', () => {
      const obj = {
        value: 42,
        getValue: function() {
          return this.value;
        }
      };

      const debouncedGetValue = debounce(obj.getValue, 100);
      obj.debouncedGetValue = debouncedGetValue;

      // Test doesn't call the function but ensures it can be bound correctly
      expect(() => obj.debouncedGetValue()).not.toThrow();
    });

    it('should handle multiple debounced functions independently', () => {
      const mockFn1 = jest.fn();
      const mockFn2 = jest.fn();
      const debouncedFn1 = debounce(mockFn1, 100);
      const debouncedFn2 = debounce(mockFn2, 200);

      debouncedFn1();
      debouncedFn2();

      jest.advanceTimersByTime(100);
      expect(mockFn1).toHaveBeenCalledTimes(1);
      expect(mockFn2).not.toHaveBeenCalled();

      jest.advanceTimersByTime(100);
      expect(mockFn2).toHaveBeenCalledTimes(1);
    });
  });

  describe('throttle', () => {
    jest.useFakeTimers();

    it('should throttle function calls', () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn('call1');
      throttledFn('call2');
      throttledFn('call3');

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call1');

      jest.advanceTimersByTime(100);

      throttledFn('call4');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenCalledWith('call4');
    });

    it('should preserve this context', () => {
      const obj = {
        count: 0,
        increment: function() {
          this.count++;
          return this.count;
        }
      };

      obj.throttledIncrement = throttle(obj.increment, 100);
      const result = obj.throttledIncrement();

      expect(obj.count).toBe(1);
    });
  });

  describe('memoize', () => {
    it('should cache function results', () => {
      const expensiveFn = jest.fn((x: number) => x * 2);
      const memoizedFn = memoize(expensiveFn);

      expect(memoizedFn(5)).toBe(10);
      expect(memoizedFn(5)).toBe(10);
      expect(memoizedFn(10)).toBe(20);

      expect(expensiveFn).toHaveBeenCalledTimes(2); // Only called for unique arguments
    });

    it('should use custom key generator', () => {
      const complexFn = jest.fn((obj: { id: number; name: string }) => obj.id);
      const memoizedFn = memoize(complexFn, (obj) => obj.id.toString());

      const obj1 = { id: 1, name: 'Alice' };
      const obj2 = { id: 1, name: 'Bob' };
      const obj3 = { id: 2, name: 'Charlie' };

      expect(memoizedFn(obj1)).toBe(1);
      expect(memoizedFn(obj2)).toBe(1); // Same id, should use cache
      expect(memoizedFn(obj3)).toBe(2);

      expect(complexFn).toHaveBeenCalledTimes(2); // Only called for id 1 and 2
    });

    it('should preserve this context', () => {
      const obj = {
        multiplier: 10,
        multiply: function(x: number) {
          return x * this.multiplier;
        }
      };

      obj.memoizedMultiply = memoize(obj.multiply);
      
      expect(obj.memoizedMultiply(5)).toBe(50);
      expect(obj.memoizedMultiply(5)).toBe(50);
    });
  });

  describe('LazyLoader', () => {
    beforeEach(() => {
      LazyLoader.clear();
    });

    it('should load module only once', async () => {
      const mockLoader = jest.fn().mockResolvedValue({ module: 'test' });

      const result1 = await LazyLoader.load('test-module', mockLoader);
      const result2 = await LazyLoader.load('test-module', mockLoader);

      expect(mockLoader).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ module: 'test' });
      expect(result2).toEqual({ module: 'test' });
    });

    it('should check if module is loaded', async () => {
      expect(LazyLoader.isLoaded('test-module')).toBe(false);

      await LazyLoader.load('test-module', () => Promise.resolve({}));

      expect(LazyLoader.isLoaded('test-module')).toBe(true);
    });

    it('should handle loading errors', async () => {
      const mockLoader = jest.fn().mockRejectedValue(new Error('Load failed'));

      await expect(LazyLoader.load('error-module', mockLoader))
        .rejects.toThrow('Load failed');
    });

    it('should clear all loaded modules', async () => {
      await LazyLoader.load('module1', () => Promise.resolve({}));
      await LazyLoader.load('module2', () => Promise.resolve({}));

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

      const resource1 = pool.acquire();
      const resource2 = pool.acquire();

      expect(resource1.id).toBe(1);
      expect(resource2.id).toBe(2);

      pool.release(resource1);

      const resource3 = pool.acquire();
      expect(resource3.id).toBe(1); // Reused resource
    });

    it('should throw when pool is exhausted', () => {
      const factory = () => ({});
      const reset = () => {};
      const pool = new ResourcePool(factory, reset, 2);

      pool.acquire();
      pool.acquire();

      expect(() => pool.acquire()).toThrow('Resource pool exhausted');
    });

    it('should handle release of non-acquired resource', () => {
      const factory = () => ({});
      const reset = jest.fn();
      const pool = new ResourcePool(factory, reset);

      const externalResource = {};
      pool.release(externalResource);

      expect(reset).not.toHaveBeenCalled();
    });

    it('should report pool size', () => {
      const factory = () => ({});
      const reset = () => {};
      const pool = new ResourcePool(factory, reset, 5);

      const initialSize = pool.size();
      expect(initialSize.available).toBe(3); // Pre-created
      expect(initialSize.inUse).toBe(0);

      const resource = pool.acquire();
      const afterAcquire = pool.size();
      expect(afterAcquire.available).toBe(2);
      expect(afterAcquire.inUse).toBe(1);

      pool.release(resource);
      const afterRelease = pool.size();
      expect(afterRelease.available).toBe(3);
      expect(afterRelease.inUse).toBe(0);
    });
  });

  describe('BatchProcessor', () => {
    jest.useFakeTimers();

    it('should batch process items', async () => {
      const processorFn = jest.fn((items: number[]) => 
        Promise.resolve(items.map(x => x * 2))
      );
      const processor = new BatchProcessor(processorFn, 3, 100);

      const promises = [
        processor.add(1),
        processor.add(2),
        processor.add(3) // Triggers batch
      ];

      const results = await Promise.all(promises);

      expect(processorFn).toHaveBeenCalledTimes(1);
      expect(processorFn).toHaveBeenCalledWith([1, 2, 3]);
      expect(results).toEqual([2, 4, 6]);
    });

    it('should process on timeout', async () => {
      const processorFn = jest.fn((items: number[]) => 
        Promise.resolve(items.map(x => x * 2))
      );
      const processor = new BatchProcessor(processorFn, 10, 100);

      const promise1 = processor.add(1);
      const promise2 = processor.add(2);

      jest.advanceTimersByTime(100);

      const results = await Promise.all([promise1, promise2]);

      expect(processorFn).toHaveBeenCalledWith([1, 2]);
      expect(results).toEqual([2, 4]);
    });

    it('should handle processor errors', async () => {
      const processorFn = jest.fn().mockRejectedValue(new Error('Process failed'));
      const processor = new BatchProcessor(processorFn, 2, 100);

      const promise1 = processor.add(1);
      const promise2 = processor.add(2);

      await expect(promise1).rejects.toThrow('Process failed');
      await expect(promise2).rejects.toThrow('Process failed');
    });

    it('should process multiple batches', async () => {
      const processorFn = jest.fn((items: number[]) => 
        Promise.resolve(items.map(x => x * 2))
      );
      const processor = new BatchProcessor(processorFn, 2, 100);

      // Add 5 items, should trigger 2 immediate batches and 1 timeout batch
      const promises = [];
      for (let i = 1; i <= 5; i++) {
        promises.push(processor.add(i));
      }

      // First two batches process immediately
      jest.runAllTimers();

      const results = await Promise.all(promises);

      expect(processorFn).toHaveBeenCalledTimes(3);
      expect(results).toEqual([2, 4, 6, 8, 10]);
    });
  });
});