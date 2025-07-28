/**
 * @fileoverview Performance optimization utilities
 * @module shared/performance
 */

import { PerformanceLogger } from '../patterns/logging';

/**
 * Performance monitoring and optimization
 */
export class PerformanceMonitor {
  private static metrics = new Map<string, number[]>();
  private static thresholds = new Map<string, number>();

  /**
   * Set performance threshold for a metric
   */
  static setThreshold(metric: string, threshold: number): void {
    this.thresholds.set(metric, threshold);
  }

  /**
   * Record a performance metric
   */
  static record(metric: string, value: number): void {
    if (!this.metrics.has(metric)) {
      this.metrics.set(metric, []);
    }
    
    const values = this.metrics.get(metric)!;
    values.push(value);
    
    // Keep only last 100 measurements
    if (values.length > 100) {
      values.shift();
    }

    // Check threshold
    const threshold = this.thresholds.get(metric);
    if (threshold && value > threshold) {
      console.warn(`Performance threshold exceeded for ${metric}: ${value}ms > ${threshold}ms`);
    }
  }

  /**
   * Get performance statistics for a metric
   */
  static getStats(metric: string): {
    count: number;
    min: number;
    max: number;
    avg: number;
    p95: number;
  } | null {
    const values = this.metrics.get(metric);
    if (!values || values.length === 0) {
      return null;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const p95Index = Math.floor(sorted.length * 0.95);

    return {
      count: values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      p95: sorted[p95Index]
    };
  }

  /**
   * Clear all metrics
   */
  static clear(): void {
    this.metrics.clear();
  }
}

/**
 * Debounce function calls
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (timeout) {
      clearTimeout(timeout);
    }
    
    timeout = setTimeout(() => {
      func.apply(context, args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle function calls
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function(this: any, ...args: Parameters<T>) {
    const context = this;
    
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}

/**
 * Memoize function results
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  getKey?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>();
  
  return function(this: any, ...args: Parameters<T>): ReturnType<T> {
    const key = getKey ? getKey(...args) : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key)!;
    }
    
    const result = func.apply(this, args);
    cache.set(key, result);
    
    return result;
  } as T;
}

/**
 * Lazy load modules
 */
export class LazyLoader {
  private static loaded = new Map<string, Promise<any>>();

  static async load<T>(
    moduleId: string,
    loader: () => Promise<T>
  ): Promise<T> {
    if (!this.loaded.has(moduleId)) {
      this.loaded.set(moduleId, loader());
    }
    
    return this.loaded.get(moduleId)!;
  }

  static isLoaded(moduleId: string): boolean {
    return this.loaded.has(moduleId);
  }

  static clear(): void {
    this.loaded.clear();
  }
}

/**
 * Resource pool for reusable objects
 */
export class ResourcePool<T> {
  private available: T[] = [];
  private inUse = new Set<T>();
  
  constructor(
    private factory: () => T,
    private reset: (item: T) => void,
    private maxSize: number = 10
  ) {
    // Pre-create some resources
    for (let i = 0; i < Math.min(3, maxSize); i++) {
      this.available.push(this.factory());
    }
  }

  acquire(): T {
    let resource: T;
    
    if (this.available.length > 0) {
      resource = this.available.pop()!;
    } else if (this.inUse.size < this.maxSize) {
      resource = this.factory();
    } else {
      throw new Error('Resource pool exhausted');
    }
    
    this.inUse.add(resource);
    return resource;
  }

  release(resource: T): void {
    if (!this.inUse.has(resource)) {
      return;
    }
    
    this.inUse.delete(resource);
    this.reset(resource);
    this.available.push(resource);
  }

  size(): { available: number; inUse: number } {
    return {
      available: this.available.length,
      inUse: this.inUse.size
    };
  }
}

/**
 * Batch operations for efficiency
 */
export class BatchProcessor<T, R> {
  private queue: { item: T; resolve: (result: R) => void; reject: (error: any) => void }[] = [];
  private timer: NodeJS.Timeout | null = null;
  
  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private batchSize: number = 10,
    private maxWait: number = 100
  ) {}

  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });
      
      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.timer) {
        this.timer = setTimeout(() => this.flush(), this.maxWait);
      }
    });
  }

  private async flush(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    
    if (this.queue.length === 0) {
      return;
    }
    
    const batch = this.queue.splice(0, this.batchSize);
    const items = batch.map(b => b.item);
    
    try {
      const results = await this.processor(items);
      batch.forEach((b, i) => b.resolve(results[i]));
    } catch (error) {
      batch.forEach(b => b.reject(error));
    }
    
    // Process remaining items
    if (this.queue.length > 0) {
      this.timer = setTimeout(() => this.flush(), 0);
    }
  }
}

/**
 * Memory usage monitor
 */
export class MemoryMonitor {
  static getUsage(): {
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
    percentUsed: number;
  } | null {
    if (!(performance as any).memory) {
      return null;
    }
    
    const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = (performance as any).memory;
    
    return {
      usedJSHeapSize: Math.round(usedJSHeapSize / 1024 / 1024), // MB
      totalJSHeapSize: Math.round(totalJSHeapSize / 1024 / 1024), // MB
      jsHeapSizeLimit: Math.round(jsHeapSizeLimit / 1024 / 1024), // MB
      percentUsed: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100)
    };
  }

  static startMonitoring(interval: number = 5000): () => void {
    const timer = setInterval(() => {
      const usage = this.getUsage();
      if (usage && usage.percentUsed > 80) {
        console.warn('High memory usage:', usage);
      }
    }, interval);
    
    return () => clearInterval(timer);
  }
}