# Testing Best Practices Guide

## Introduction
This guide captures testing best practices discovered during the QA marathon that improved coverage from 45% to 56.76% in 60+ hours.

## Core Testing Principles

### 1. Test Pyramid Strategy
```
         /\
        /E2E\       (5%)  - Critical user journeys
       /------\
      /  Integ  \   (15%) - Component interactions  
     /------------\
    /   Unit Tests  \ (80%) - Individual functions
   /-----------------\
```

### 2. FIRST Principles
- **F**ast: Tests should run quickly (<100ms per test)
- **I**ndependent: No test should depend on another
- **R**epeatable: Same result every time
- **S**elf-validating: Pass/fail without manual inspection
- **T**imely: Write tests with or before code

## Chrome Extension Testing Best Practices

### 1. Environment Setup
```javascript
// jest.setup.js
global.chrome = require('./__mocks__/chrome');
require('fake-indexeddb/auto');

// Reset mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
  chrome.runtime.lastError = null;
});
```

### 2. Mocking Chrome APIs
```javascript
// Comprehensive Chrome API mock
const createChromeApiMock = () => ({
  runtime: {
    onMessage: createEventMock(),
    sendMessage: jest.fn((msg, responseCallback) => {
      // Simulate async response
      if (responseCallback) {
        setTimeout(() => responseCallback({ success: true }), 0);
      }
    }),
    lastError: null,
    getManifest: () => ({ version: '1.0.0' })
  },
  storage: {
    local: createStorageMock(),
    sync: createStorageMock()
  },
  tabs: {
    query: jest.fn(() => Promise.resolve([])),
    sendMessage: jest.fn(),
    create: jest.fn(),
    update: jest.fn()
  }
});
```

### 3. Testing Async Chrome APIs
```typescript
// Utility to convert callback to promise
function chromeApiPromise<T>(
  apiCall: (callback: (result: T) => void) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    apiCall((result) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(result);
      }
    });
  });
}

// Usage in tests
test('should get storage data', async () => {
  chrome.storage.local.get.mockImplementation((keys, cb) => {
    cb({ theme: 'dark' });
  });
  
  const data = await chromeApiPromise((cb) => 
    chrome.storage.local.get(['theme'], cb)
  );
  
  expect(data.theme).toBe('dark');
});
```

## Writing Effective Tests

### 1. Arrange-Act-Assert Pattern
```typescript
test('should calculate total price with tax', () => {
  // Arrange
  const items = [
    { price: 10, quantity: 2 },
    { price: 5, quantity: 1 }
  ];
  const taxRate = 0.08;
  
  // Act
  const total = calculateTotal(items, taxRate);
  
  // Assert
  expect(total).toBe(27); // (20 + 5) * 1.08
});
```

### 2. Test Naming Conventions
```typescript
describe('UserService', () => {
  describe('createUser', () => {
    test('should create user with valid data', () => {});
    test('should throw error when email is invalid', () => {});
    test('should hash password before saving', () => {});
    test('should emit UserCreated event', () => {});
  });
});
```

### 3. Testing Error Cases
```typescript
describe('Error Handling', () => {
  test('should handle network errors gracefully', async () => {
    const networkError = new Error('Network failed');
    fetchMock.mockRejectedValueOnce(networkError);
    
    const result = await fetchDataWithRetry();
    
    expect(result).toEqual({ 
      success: false, 
      error: 'Network failed',
      retries: 3 
    });
  });
  
  test('should validate input and throw specific errors', () => {
    expect(() => processData(null))
      .toThrow('Data cannot be null');
      
    expect(() => processData({ invalid: true }))
      .toThrow(ValidationError);
  });
});
```

## Testing Patterns for Common Scenarios

### 1. Event-Driven Testing
```typescript
describe('EventEmitter', () => {
  let emitter: EventEmitter;
  
  beforeEach(() => {
    emitter = new EventEmitter();
  });
  
  test('should emit and handle events', () => {
    const handler = jest.fn();
    emitter.on('test', handler);
    
    emitter.emit('test', { data: 'value' });
    
    expect(handler).toHaveBeenCalledWith({ data: 'value' });
  });
  
  test('should remove listeners', () => {
    const handler = jest.fn();
    const unsubscribe = emitter.on('test', handler);
    
    unsubscribe();
    emitter.emit('test', {});
    
    expect(handler).not.toHaveBeenCalled();
  });
});
```

### 2. Timer-based Testing
```typescript
describe('Debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  
  afterEach(() => {
    jest.useRealTimers();
  });
  
  test('should debounce rapid calls', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 500);
    
    // Rapid calls
    debounced(1);
    debounced(2);
    debounced(3);
    
    expect(fn).not.toHaveBeenCalled();
    
    // Fast forward time
    jest.advanceTimersByTime(500);
    
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3); // Last call wins
  });
});
```

### 3. State Management Testing
```typescript
describe('Store', () => {
  let store: Store;
  
  beforeEach(() => {
    store = createStore(rootReducer);
  });
  
  test('should update state on action', () => {
    store.dispatch({ type: 'SET_USER', payload: { id: 1, name: 'Test' } });
    
    const state = store.getState();
    expect(state.user).toEqual({ id: 1, name: 'Test' });
  });
  
  test('should notify subscribers', () => {
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);
    
    store.dispatch({ type: 'UPDATE' });
    
    expect(listener).toHaveBeenCalledTimes(1);
    
    unsubscribe();
    store.dispatch({ type: 'UPDATE' });
    
    expect(listener).toHaveBeenCalledTimes(1); // Not called again
  });
});
```

## Testing Anti-Patterns to Avoid

### 1. ❌ Testing Implementation Details
```typescript
// Bad - tests private method
test('should set _internalFlag to true', () => {
  instance.process();
  expect(instance._internalFlag).toBe(true);
});

// Good - tests observable behavior
test('should process data successfully', () => {
  const result = instance.process();
  expect(result.status).toBe('completed');
});
```

### 2. ❌ Excessive Mocking
```typescript
// Bad - mocks everything
test('should work', () => {
  const mockEverything = {
    db: { query: jest.fn() },
    logger: { log: jest.fn() },
    config: { get: jest.fn() },
    // ... 20 more mocks
  };
});

// Good - minimal mocking
test('should query user by id', async () => {
  const mockDb = { query: jest.fn().mockResolvedValue({ id: 1 }) };
  const service = new UserService(mockDb);
  
  const user = await service.getUser(1);
  expect(user.id).toBe(1);
});
```

### 3. ❌ Flaky Tests
```typescript
// Bad - depends on timing
test('should complete in 1 second', (done) => {
  startProcess();
  setTimeout(() => {
    expect(isComplete()).toBe(true);
    done();
  }, 1000);
});

// Good - uses fake timers or promises
test('should complete after delay', async () => {
  jest.useFakeTimers();
  const promise = startProcess();
  
  jest.advanceTimersByTime(1000);
  await promise;
  
  expect(isComplete()).toBe(true);
  jest.useRealTimers();
});
```

## Debugging Failed Tests

### 1. Use Descriptive Assertions
```typescript
// Less helpful
expect(result).toBe(false);

// More helpful
expect(result).toBe(false, 
  `Expected validation to fail for email: ${email}`);
```

### 2. Debug Helpers
```typescript
// Temporary debug logging
test.only('debugging specific test', () => {
  console.log('State before:', state);
  const result = complexOperation(state);
  console.log('Result:', result);
  
  expect(result).toMatchObject({ /* ... */ });
});
```

### 3. Snapshot Testing for Complex Objects
```typescript
test('should generate correct configuration', () => {
  const config = generateConfig({ env: 'prod' });
  expect(config).toMatchSnapshot();
});
```

## Continuous Testing Practices

### 1. Pre-commit Hooks
```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:staged"
    }
  },
  "scripts": {
    "test:staged": "jest --findRelatedTests"
  }
}
```

### 2. Coverage Thresholds
```javascript
// jest.config.js
module.exports = {
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    },
    './src/core/': {
      branches: 90,
      functions: 90
    }
  }
};
```

### 3. Test Performance Monitoring
```typescript
// Custom reporter to track slow tests
class PerformanceReporter {
  onTestResult(test, testResult) {
    const slowTests = testResult.testResults
      .filter(t => t.duration > 500)
      .map(t => ({ 
        name: t.title, 
        duration: t.duration 
      }));
      
    if (slowTests.length > 0) {
      console.warn('Slow tests detected:', slowTests);
    }
  }
}
```

## Conclusion

Following these best practices will help you:
- Write more reliable and maintainable tests
- Achieve higher test coverage efficiently
- Catch bugs before they reach production
- Build confidence in your codebase

Remember: **Good tests are an investment in your code's future!**

---

Created by Quinn during the QA Marathon
"The best time to write a test was yesterday. The second best time is now."