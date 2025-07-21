/**
 * @fileoverview Performance optimization utilities
 * @module shared/performance
 */
/**
 * Performance monitoring and optimization
 */
export class PerformanceMonitor {
    /**
     * Set performance threshold for a metric
     */
    static setThreshold(metric, threshold) {
        this.thresholds.set(metric, threshold);
    }
    /**
     * Record a performance metric
     */
    static record(metric, value) {
        if (!this.metrics.has(metric)) {
            this.metrics.set(metric, []);
        }
        const values = this.metrics.get(metric);
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
    static getStats(metric) {
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
    static clear() {
        this.metrics.clear();
    }
}
PerformanceMonitor.metrics = new Map();
PerformanceMonitor.thresholds = new Map();
/**
 * Debounce function calls
 */
export function debounce(func, wait) {
    let timeout = null;
    return function (...args) {
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
export function throttle(func, limit) {
    let inThrottle = false;
    return function (...args) {
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
export function memoize(func, getKey) {
    const cache = new Map();
    return function (...args) {
        const key = getKey ? getKey(...args) : JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = func.apply(this, args);
        cache.set(key, result);
        return result;
    };
}
/**
 * Lazy load modules
 */
export class LazyLoader {
    static async load(moduleId, loader) {
        if (!this.loaded.has(moduleId)) {
            this.loaded.set(moduleId, loader());
        }
        return this.loaded.get(moduleId);
    }
    static isLoaded(moduleId) {
        return this.loaded.has(moduleId);
    }
    static clear() {
        this.loaded.clear();
    }
}
LazyLoader.loaded = new Map();
/**
 * Resource pool for reusable objects
 */
export class ResourcePool {
    constructor(factory, reset, maxSize = 10) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;
        this.available = [];
        this.inUse = new Set();
        // Pre-create some resources
        for (let i = 0; i < Math.min(3, maxSize); i++) {
            this.available.push(this.factory());
        }
    }
    acquire() {
        let resource;
        if (this.available.length > 0) {
            resource = this.available.pop();
        }
        else if (this.inUse.size < this.maxSize) {
            resource = this.factory();
        }
        else {
            throw new Error('Resource pool exhausted');
        }
        this.inUse.add(resource);
        return resource;
    }
    release(resource) {
        if (!this.inUse.has(resource)) {
            return;
        }
        this.inUse.delete(resource);
        this.reset(resource);
        this.available.push(resource);
    }
    size() {
        return {
            available: this.available.length,
            inUse: this.inUse.size
        };
    }
}
/**
 * Batch operations for efficiency
 */
export class BatchProcessor {
    constructor(processor, batchSize = 10, maxWait = 100) {
        this.processor = processor;
        this.batchSize = batchSize;
        this.maxWait = maxWait;
        this.queue = [];
        this.timer = null;
    }
    async add(item) {
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });
            if (this.queue.length >= this.batchSize) {
                this.flush();
            }
            else if (!this.timer) {
                this.timer = setTimeout(() => this.flush(), this.maxWait);
            }
        });
    }
    async flush() {
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
        }
        catch (error) {
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
    static getUsage() {
        if (!performance.memory) {
            return null;
        }
        const { usedJSHeapSize, totalJSHeapSize, jsHeapSizeLimit } = performance.memory;
        return {
            usedJSHeapSize: Math.round(usedJSHeapSize / 1024 / 1024), // MB
            totalJSHeapSize: Math.round(totalJSHeapSize / 1024 / 1024), // MB
            jsHeapSizeLimit: Math.round(jsHeapSizeLimit / 1024 / 1024), // MB
            percentUsed: Math.round((usedJSHeapSize / jsHeapSizeLimit) * 100)
        };
    }
    static startMonitoring(interval = 5000) {
        const timer = setInterval(() => {
            const usage = this.getUsage();
            if (usage && usage.percentUsed > 80) {
                console.warn('High memory usage:', usage);
            }
        }, interval);
        return () => clearInterval(timer);
    }
}
