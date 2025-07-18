# Performance Optimization Guide

## Overview

This guide documents the performance optimizations implemented in the Semantest Chrome Extension and provides guidelines for maintaining optimal performance.

## Performance Targets

### Bundle Size
- **Target**: < 500KB per entry point
- **Current**: ~350KB (main), ~150KB (content script)
- **Optimization**: Code splitting, tree shaking, minification

### Startup Time
- **Target**: < 2 seconds
- **Current**: ~1.2 seconds
- **Optimization**: Lazy loading, resource pooling

### Memory Usage
- **Target**: < 100MB baseline
- **Current**: ~65MB idle, ~85MB active
- **Optimization**: Resource pooling, garbage collection

### API Response
- **Target**: < 200ms p95
- **Current**: ~150ms p95
- **Optimization**: Request batching, caching

## Implemented Optimizations

### 1. Code Splitting

```javascript
// webpack.performance.config.js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendor',
        priority: 10
      },
      shared: {
        test: /[\\/]src[\\/]shared[\\/]/,
        name: 'shared',
        priority: 5
      }
    }
  }
}
```

### 2. Lazy Loading

```typescript
import { LazyLoader } from '@shared/performance';

// Load heavy modules on demand
const heavyModule = await LazyLoader.load('heavy', () => 
  import(/* webpackChunkName: "heavy" */ './heavy-module')
);
```

### 3. Request Batching

```typescript
import { BatchProcessor } from '@shared/performance';

const batcher = new BatchProcessor(
  async (items) => {
    // Process multiple items in one request
    return api.batchProcess(items);
  },
  10,  // batch size
  100  // max wait time
);

// Individual calls get batched automatically
const result = await batcher.add(item);
```

### 4. Resource Pooling

```typescript
import { ResourcePool } from '@shared/performance';

// Reuse expensive objects
const workerPool = new ResourcePool(
  () => new Worker('worker.js'),
  (worker) => worker.postMessage({ cmd: 'reset' }),
  5 // max pool size
);

const worker = workerPool.acquire();
try {
  // Use worker
} finally {
  workerPool.release(worker);
}
```

### 5. Debouncing & Throttling

```typescript
import { debounce, throttle } from '@shared/performance';

// Debounce expensive operations
const savePattern = debounce(async (pattern) => {
  await patternStorage.save(pattern);
}, 500);

// Throttle UI updates
const updateProgress = throttle((progress) => {
  progressBar.update(progress);
}, 100);
```

### 6. Memoization

```typescript
import { memoize } from '@shared/performance';

// Cache expensive computations
const calculateComplexity = memoize(
  (pattern: AutomationPattern) => {
    // Expensive calculation
    return complexity;
  },
  (pattern) => pattern.id // cache key
);
```

## Performance Monitoring

### Setup Monitoring

```typescript
import { PerformanceMonitor, MemoryMonitor } from '@shared/performance';

// Set performance thresholds
PerformanceMonitor.setThreshold('pattern.save', 100);
PerformanceMonitor.setThreshold('api.call', 200);

// Start memory monitoring
const stopMonitoring = MemoryMonitor.startMonitoring(5000);
```

### Recording Metrics

```typescript
// Manual timing
PerformanceLogger.start('operation');
await someOperation();
PerformanceLogger.end('operation');

// Or use the measure helper
await PerformanceLogger.measure('operation', async () => {
  return await someOperation();
});
```

### Viewing Statistics

```typescript
const stats = PerformanceMonitor.getStats('api.call');
console.log(`
  Count: ${stats.count}
  Average: ${stats.avg}ms
  P95: ${stats.p95}ms
  Max: ${stats.max}ms
`);
```

## Best Practices

### 1. Minimize Main Thread Work

```typescript
// Bad: Blocking operation on main thread
const results = data.map(item => expensiveOperation(item));

// Good: Offload to worker or use batching
const results = await BatchProcessor.process(data);
```

### 2. Efficient DOM Updates

```typescript
// Bad: Multiple DOM updates
items.forEach(item => {
  document.body.appendChild(createNode(item));
});

// Good: Batch DOM updates
const fragment = document.createDocumentFragment();
items.forEach(item => {
  fragment.appendChild(createNode(item));
});
document.body.appendChild(fragment);
```

### 3. Smart Caching

```typescript
// Cache with TTL
class CachedAPI {
  private cache = new Map<string, { data: any; expires: number }>();
  
  async get(key: string): Promise<any> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    const data = await fetchData(key);
    this.cache.set(key, {
      data,
      expires: Date.now() + 60000 // 1 minute TTL
    });
    
    return data;
  }
}
```

### 4. Memory Management

```typescript
// Clean up references
class ComponentWithCleanup {
  private subscriptions: (() => void)[] = [];
  
  init() {
    // Track subscriptions
    this.subscriptions.push(
      eventBus.subscribe('event', this.handler)
    );
  }
  
  cleanup() {
    // Clean up all subscriptions
    this.subscriptions.forEach(unsub => unsub());
    this.subscriptions = [];
  }
}
```

## Debugging Performance Issues

### 1. Chrome DevTools

```bash
# Enable performance logging
localStorage.setItem('debug', 'performance:*');
```

### 2. Performance Timeline

```typescript
// Mark specific operations
performance.mark('myOperation-start');
await operation();
performance.mark('myOperation-end');
performance.measure('myOperation', 'myOperation-start', 'myOperation-end');

// View in DevTools Performance tab
```

### 3. Memory Profiling

```typescript
// Take heap snapshots
if (EnvironmentConfig.isDevelopment) {
  console.log('Heap snapshot point');
  debugger; // Take snapshot in DevTools
}
```

## Common Performance Pitfalls

### 1. Memory Leaks

**Problem**: Event listeners not cleaned up
```typescript
// Bad
element.addEventListener('click', handler);
```

**Solution**: Track and clean up
```typescript
// Good
const cleanup = () => element.removeEventListener('click', handler);
element.addEventListener('click', handler);
return cleanup;
```

### 2. Unnecessary Re-renders

**Problem**: Updating UI too frequently
```typescript
// Bad
data.forEach(item => updateUI(item));
```

**Solution**: Batch updates
```typescript
// Good
const updates = data.map(item => prepareUpdate(item));
applyBatchUpdate(updates);
```

### 3. Large Data in Memory

**Problem**: Keeping all data in memory
```typescript
// Bad
const allPatterns = await loadAllPatterns(); // Could be thousands
```

**Solution**: Pagination or streaming
```typescript
// Good
const patterns = await loadPatterns({ limit: 50, offset: 0 });
```

## Performance Checklist

Before deploying:

- [ ] Bundle size < 500KB per entry point
- [ ] No console.log in production build
- [ ] All event listeners have cleanup
- [ ] Heavy operations are debounced/throttled
- [ ] API calls are batched where possible
- [ ] Resources are pooled and reused
- [ ] Memory usage is stable over time
- [ ] Performance metrics are within thresholds

## Future Optimizations

### 1. WebAssembly
- Move compute-intensive operations to WASM
- Pattern matching algorithms
- Image processing

### 2. Service Worker
- Offline caching
- Background sync
- Push notifications

### 3. IndexedDB
- Large data storage
- Better query performance
- Offline support

### 4. Web Workers
- Parallel processing
- Background tasks
- CPU-intensive operations