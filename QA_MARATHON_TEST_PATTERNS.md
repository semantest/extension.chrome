# QA Marathon Test Patterns Guide

## Overview
This guide documents successful test patterns discovered during the 60+ hour QA marathon that achieved 56.76% test coverage (+11.76% improvement).

## Successful Test Patterns

### 1. Chrome API Mocking Pattern
**Problem**: Chrome APIs are not available in Jest environment  
**Solution**: Create comprehensive mocks in `__mocks__/chrome.js`

```javascript
// Example: Mock chrome.storage API
global.chrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.()),
      remove: jest.fn((keys, callback) => callback?.()),
      clear: jest.fn((callback) => callback?.())
    },
    sync: {
      get: jest.fn((keys, callback) => callback({})),
      set: jest.fn((items, callback) => callback?.())
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn((msg, callback) => callback?.()),
    lastError: null
  }
};
```

### 2. Event Emitter Testing Pattern
**File**: `shared/patterns/event-handling.test.ts`  
**Coverage**: 95.45%

```typescript
// Avoid emitting actual Error objects in tests
test('cleanup removes error listener', () => {
  const errorHandler = jest.fn();
  const cleanup = handleErrors(emitter, errorHandler);
  
  // Don't emit actual Error - causes unhandled error
  emitter.emit('error', { message: 'test error' } as any);
  expect(errorHandler).toHaveBeenCalledTimes(1);
  
  cleanup();
  emitter.emit('error', { message: 'another error' } as any);
  expect(errorHandler).toHaveBeenCalledTimes(1);
});
```

### 3. Redux-like Store Testing Pattern
**File**: `message-store.test.ts`  
**Coverage**: 100%

```typescript
describe('MessageStore', () => {
  let store: MessageStore;
  
  beforeEach(() => {
    store = new MessageStore();
  });
  
  test('should handle async actions', async () => {
    const asyncAction = async (dispatch: Dispatch) => {
      dispatch({ type: 'LOADING', payload: true });
      await new Promise(resolve => setTimeout(resolve, 10));
      dispatch({ type: 'LOADING', payload: false });
    };
    
    await store.dispatch(asyncAction);
    expect(store.getState().loading).toBe(false);
  });
});
```

### 4. Performance Optimization Testing Pattern
**File**: `performance-optimizer.test.ts`  
**Coverage**: 90.96%

```typescript
describe('PerformanceOptimizer', () => {
  test('should throttle function calls', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const throttled = throttle(fn, 100);
    
    // Call multiple times rapidly
    for (let i = 0; i < 10; i++) {
      throttled(i);
    }
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(0);
    
    jest.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenCalledWith(9);
    
    jest.useRealTimers();
  });
});
```

### 5. TypeScript-EDA Mocking Pattern
**Problem**: External dependencies causing import errors  
**Solution**: Create module mocks

```javascript
// __mocks__/typescript-eda.js
module.exports = {
  Event: class Event {
    constructor(type, payload) {
      this.type = type;
      this.payload = payload;
      this.metadata = { timestamp: Date.now() };
    }
  },
  Entity: class Entity {
    constructor(id) {
      this.id = id;
      this.events = [];
    }
    addEvent(event) {
      this.events.push(event);
    }
  }
};
```

### 6. Health Check Testing Pattern
**File**: `health-checks/tab-health.test.ts`  
**Coverage**: 100%

```typescript
describe('TabHealthCheck', () => {
  test('should detect unhealthy tabs', async () => {
    chrome.tabs.query.mockResolvedValue([
      { id: 1, status: 'complete', url: 'https://example.com' },
      { id: 2, status: 'loading', url: 'https://slow-site.com' }
    ]);
    
    const health = await checkTabHealth();
    expect(health.healthy).toBe(false);
    expect(health.issues).toContain('Tab 2 is still loading');
  });
});
```

## Common Testing Challenges & Solutions

### 1. IndexedDB Mocking
**Challenge**: IndexedDB not available in Jest  
**Solution**: Use fake-indexeddb package or mock completely

```javascript
// Setup file
require('fake-indexeddb/auto');

// Or mock
global.indexedDB = {
  open: jest.fn(() => ({
    onsuccess: jest.fn(),
    onerror: jest.fn()
  }))
};
```

### 2. Async Chrome API Testing
**Challenge**: Chrome APIs use callbacks, not promises  
**Solution**: Promisify or use callback patterns

```typescript
// Helper to promisify Chrome APIs
const promisify = (fn: Function) => (...args: any[]) =>
  new Promise((resolve, reject) => {
    fn(...args, (result: any) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result);
      }
    });
  });

// Usage
const getStorage = promisify(chrome.storage.local.get);
const data = await getStorage(['key']);
```

### 3. Testing Time-based Functions
**Challenge**: Testing debounce, throttle, timeouts  
**Solution**: Use Jest fake timers

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

test('debounce delays execution', () => {
  const fn = jest.fn();
  const debounced = debounce(fn, 1000);
  
  debounced();
  expect(fn).not.toHaveBeenCalled();
  
  jest.advanceTimersByTime(1000);
  expect(fn).toHaveBeenCalledTimes(1);
});
```

## Test Organization Best Practices

### 1. File Structure
```
src/
  feature/
    feature.ts
    feature.test.ts    # Unit tests next to source
  __tests__/
    integration/       # Integration tests
    e2e/              # End-to-end tests
  __mocks__/          # Shared mocks
```

### 2. Test Naming Convention
```typescript
describe('FeatureName', () => {
  describe('methodName', () => {
    test('should handle success case', () => {});
    test('should handle error case', () => {});
    test('should validate input', () => {});
  });
});
```

### 3. Setup and Teardown
```typescript
describe('Feature', () => {
  let instance: Feature;
  let mockDependency: jest.Mocked<Dependency>;
  
  beforeEach(() => {
    mockDependency = createMockDependency();
    instance = new Feature(mockDependency);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
});
```

## Coverage Improvement Strategies

### 1. Focus on High-Impact Files
- Prioritize core business logic
- Test error paths and edge cases
- Cover all exported functions

### 2. Use Coverage Reports
```bash
npm test -- --coverage --coverageReporters=html
# Open coverage/lcov-report/index.html
```

### 3. Identify Untested Branches
- Look for uncovered if/else branches
- Test error handling paths
- Cover default parameter values

### 4. Mock External Dependencies
- Mock all Chrome APIs
- Mock network requests
- Mock file system operations

## Lessons Learned

1. **Start with the easiest tests first** - Build momentum
2. **Mock early and comprehensively** - Prevents cascading failures
3. **Use TypeScript for better IDE support** - Catch errors early
4. **Keep tests focused and isolated** - One concept per test
5. **Document unusual patterns** - Help future developers
6. **Run tests frequently** - Catch regressions immediately
7. **Celebrate small wins** - 1% improvement is still progress!

## Next Steps

1. Fix TypeScript compilation errors in remaining test files
2. Complete Chrome API mock implementation
3. Add integration tests for critical user paths
4. Implement E2E tests using Playwright
5. Set up continuous coverage monitoring

---

Generated during QA Marathon Hour 60+ by Quinn
Coverage achieved: 56.76% (+11.76% improvement)
Tests passing: 185
High coverage files: 8 (>85% coverage)