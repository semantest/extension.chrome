# Dynamic Addon Loading Implementation Review

## Overview
Review of the new dynamic addon loading system that fetches addons from a REST server instead of bundling them statically.

## Architecture Analysis

### 1. Service Worker Implementation (`service-worker-dynamic.js`)

**Strengths:**
- Clean separation of concerns with dedicated dynamic loading
- Uses `importScripts` for addon manager integration
- Maintains global extension state

**Observations:**
- Comment notes that `message-bus.js` uses window object (not available in service worker)
- This is a known limitation of service workers that needs proper handling

### 2. Dynamic Addon Manager (`addon-manager-dynamic.js`)

**Key Features:**
- REST API integration at `http://localhost:3003`
- Caching of remote addons to reduce server calls
- Tab-specific addon activation tracking
- Message channel creation for addon communication

**Architecture Highlights:**
```javascript
class DynamicAddonManager {
  constructor() {
    this.addons = new Map();          // Local addon registry
    this.activeAddons = new Map();    // tabId -> addonId mapping
    this.addonChannels = new Map();   // tabId -> MessageBus
    this.remoteAddons = new Map();    // Cache of remote addons
    this.serverUrl = 'http://localhost:3003';
  }
}
```

## Testing Considerations

### 1. REST API Mocking
```typescript
describe('Dynamic Addon Loading', () => {
  let mockServer: MockServer;
  
  beforeEach(() => {
    mockServer = createMockServer('http://localhost:3003');
    
    mockServer.get('/api/addons', {
      addons: [
        { id: 'chatgpt', name: 'ChatGPT Addon', version: '1.0.0' },
        { id: 'claude', name: 'Claude Addon', version: '1.0.0' }
      ]
    });
    
    mockServer.get('/api/addons/:id/code', (req) => {
      return { code: mockAddonCode[req.params.id] };
    });
  });
});
```

### 2. Service Worker Testing Challenges

**Issue**: Service workers don't have access to `window` object
**Impact**: Message bus integration needs special handling

**Recommended Test Approach:**
```typescript
describe('Service Worker Message Handling', () => {
  it('should handle messages without window object', async () => {
    // Use service worker test environment
    const sw = await navigator.serviceWorker.register(
      '/src/background/service-worker-dynamic.js'
    );
    
    // Test message passing through chrome.runtime API
    const response = await chrome.runtime.sendMessage({
      type: 'addon:load',
      addonId: 'chatgpt'
    });
    
    expect(response.success).toBe(true);
  });
});
```

### 3. Caching Strategy Tests
```typescript
describe('Addon Caching', () => {
  it('should cache fetched addons', async () => {
    const manager = new DynamicAddonManager();
    
    // First fetch
    await manager.fetchAddon('chatgpt');
    const firstCallCount = mockServer.getCallCount('/api/addons/chatgpt/code');
    
    // Second fetch should use cache
    await manager.fetchAddon('chatgpt');
    const secondCallCount = mockServer.getCallCount('/api/addons/chatgpt/code');
    
    expect(firstCallCount).toBe(1);
    expect(secondCallCount).toBe(1); // No additional call
  });
  
  it('should invalidate cache on version change', async () => {
    // Test cache invalidation logic
  });
});
```

### 4. Error Handling Tests
```typescript
describe('Network Error Handling', () => {
  it('should fallback gracefully when server is unavailable', async () => {
    mockServer.stop();
    
    const manager = new DynamicAddonManager();
    const result = await manager.initialize();
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to connect');
  });
  
  it('should handle malformed addon code', async () => {
    mockServer.get('/api/addons/broken/code', {
      code: 'invalid javascript {'
    });
    
    const result = await manager.loadAddon('broken');
    expect(result.success).toBe(false);
  });
});
```

### 5. Security Considerations

**Critical Security Tests Needed:**
```typescript
describe('Security', () => {
  it('should validate addon code before execution', async () => {
    const maliciousCode = `
      // Attempt to access sensitive APIs
      chrome.cookies.getAll({}, console.log);
    `;
    
    mockServer.get('/api/addons/malicious/code', { code: maliciousCode });
    
    const consoleSpy = jest.spyOn(console, 'error');
    await manager.loadAddon('malicious');
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Addon validation failed')
    );
  });
  
  it('should sandbox addon execution', async () => {
    // Test that addons run in isolated context
  });
});
```

## Recommendations

### 1. Add Content Security Policy
```javascript
// In addon loader
const addonCSP = {
  'script-src': ["'self'", serverUrl],
  'connect-src': ["'self'", serverUrl],
  'object-src': ["'none'"]
};
```

### 2. Implement Version Checking
```javascript
async fetchAddonWithVersionCheck(addonId) {
  const cached = this.remoteAddons.get(addonId);
  const latestVersion = await this.getAddonVersion(addonId);
  
  if (cached && cached.version === latestVersion) {
    return cached;
  }
  
  return this.fetchAddon(addonId);
}
```

### 3. Add Retry Logic
```javascript
async fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetch(url);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}
```

### 4. Message Bus Alternative for Service Workers
```javascript
// Use chrome.runtime messaging instead of MessageBus
class ServiceWorkerMessenger {
  constructor() {
    this.listeners = new Map();
  }
  
  on(event, handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === event) {
        handler(message.payload, sender, sendResponse);
      }
    });
  }
  
  emit(event, payload) {
    chrome.runtime.sendMessage({ type: event, payload });
  }
}
```

## Test Coverage Requirements

- **Unit Tests**: 90% coverage of addon manager logic
- **Integration Tests**: Test full addon lifecycle
- **Security Tests**: 100% coverage of validation logic
- **Performance Tests**: Verify caching effectiveness
- **Error Scenarios**: Network, parsing, execution errors

## Summary

The dynamic addon loading system is well-architected but needs:
1. Robust error handling and retry logic
2. Security validations before code execution
3. Service worker-compatible messaging
4. Comprehensive test coverage
5. Cache invalidation strategy

Ready to implement these test scenarios! 🧪