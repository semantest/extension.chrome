# Test Implementation Examples - NewChatRequested Event

## Quick Start Test Implementation for Alex

### 1. Basic Event Test Setup
```typescript
// tests/events/new-chat-requested.test.ts
import { messageBus } from '../../src/core/message-bus';
import { addonManager } from '../../src/core/addon-manager';

describe('NewChatRequested Event Implementation', () => {
  let eventSpy: jest.Mock;
  
  beforeEach(() => {
    eventSpy = jest.fn();
    messageBus.on('NewChatRequested', eventSpy);
  });
  
  afterEach(() => {
    messageBus.off('NewChatRequested', eventSpy);
    jest.clearAllMocks();
  });
  
  it('should emit NewChatRequested when new chat is created', async () => {
    // Simulate new chat creation
    await simulateNewChatCreation();
    
    expect(eventSpy).toHaveBeenCalledTimes(1);
    expect(eventSpy).toHaveBeenCalledWith({
      chatId: expect.stringMatching(/^chat-\d+-\w+$/),
      timestamp: expect.any(Number),
      source: 'user',
      metadata: {
        platform: 'chatgpt',
        url: expect.any(String),
        tabId: expect.any(Number)
      }
    });
  });
});
```

### 2. Mock Implementation Helper
```typescript
// tests/helpers/chat-simulation.ts
export async function simulateNewChatCreation(platform = 'chatgpt') {
  const mockChatId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Emit the event as the implementation would
  messageBus.emit('NewChatRequested', {
    chatId: mockChatId,
    timestamp: Date.now(),
    source: 'user',
    metadata: {
      platform,
      url: window.location.href,
      tabId: chrome.tabs?.TAB_ID_NONE || 1
    }
  });
  
  // Wait for event propagation
  await new Promise(resolve => setTimeout(resolve, 0));
  
  return mockChatId;
}
```

### 3. Integration Test Example
```typescript
// tests/integration/addon-new-chat.test.ts
describe('Addon NewChatRequested Integration', () => {
  it('should notify all registered addons', async () => {
    const mockAddon1 = {
      id: 'test-addon-1',
      onNewChatRequested: jest.fn()
    };
    
    const mockAddon2 = {
      id: 'test-addon-2',
      onNewChatRequested: jest.fn()
    };
    
    addonManager.register(mockAddon1);
    addonManager.register(mockAddon2);
    
    const chatId = await simulateNewChatCreation();
    
    expect(mockAddon1.onNewChatRequested).toHaveBeenCalledWith(
      expect.objectContaining({ chatId })
    );
    expect(mockAddon2.onNewChatRequested).toHaveBeenCalledWith(
      expect.objectContaining({ chatId })
    );
  });
});
```

### 4. Platform-Specific Test
```typescript
// tests/platforms/chatgpt-new-chat.test.ts
describe('ChatGPT New Chat Detection', () => {
  beforeEach(() => {
    // Mock ChatGPT environment
    Object.defineProperty(window, 'location', {
      value: new URL('https://chat.openai.com'),
      writable: true
    });
  });
  
  it('should detect new chat via URL change', async () => {
    const eventPromise = new Promise(resolve => {
      messageBus.once('NewChatRequested', resolve);
    });
    
    // Simulate URL change to new chat
    window.history.pushState({}, '', '/chat');
    window.dispatchEvent(new PopStateEvent('popstate'));
    
    const event = await eventPromise;
    expect(event).toMatchObject({
      metadata: {
        platform: 'chatgpt',
        url: 'https://chat.openai.com/chat'
      }
    });
  });
});
```

### 5. Error Handling Test
```typescript
// tests/error-handling/new-chat-errors.test.ts
describe('NewChatRequested Error Handling', () => {
  it('should handle addon errors gracefully', async () => {
    const errorAddon = {
      id: 'error-addon',
      onNewChatRequested: jest.fn(() => {
        throw new Error('Addon initialization failed');
      })
    };
    
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    addonManager.register(errorAddon);
    
    // Should not throw
    await expect(simulateNewChatCreation()).resolves.toBeTruthy();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Addon error'),
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });
});
```

## Implementation Checklist for Alex

- [ ] Add event emission in chat initialization code
- [ ] Ensure unique chat ID generation
- [ ] Include proper metadata (platform, URL, tab)
- [ ] Handle errors without blocking chat creation
- [ ] Add event to message bus documentation
- [ ] Test across all supported platforms
- [ ] Verify addon notification order
- [ ] Performance test with multiple addons

## Quick Test Commands
```bash
# Run specific test
npm test -- new-chat-requested.test.ts

# Run with coverage
npm test -- --coverage new-chat-requested

# Watch mode for development
npm test -- --watch new-chat-requested
```