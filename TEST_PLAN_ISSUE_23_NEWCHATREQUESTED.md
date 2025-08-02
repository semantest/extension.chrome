# Test Plan: Issue #23 - NewChatRequested Event

## Feature Overview
Implement a `NewChatRequested` event that fires when users initiate a new chat session, allowing addons to perform initialization tasks.

## Test Categories

### 1. Event Emission Tests

#### 1.1 Basic Event Firing
```typescript
describe('NewChatRequested Event', () => {
  it('should emit event when new chat is initiated', async () => {
    const eventListener = jest.fn();
    messageBus.on('NewChatRequested', eventListener);
    
    // Simulate new chat action
    await simulateNewChat();
    
    expect(eventListener).toHaveBeenCalledWith({
      timestamp: expect.any(Number),
      chatId: expect.any(String),
      source: expect.stringMatching(/user|api|addon/)
    });
  });

  it('should include correct metadata in event payload', async () => {
    const eventPromise = waitForEvent('NewChatRequested');
    
    await simulateNewChat();
    const event = await eventPromise;
    
    expect(event).toMatchObject({
      timestamp: expect.any(Number),
      chatId: expect.stringMatching(/^chat-\d+-\w+$/),
      source: 'user',
      metadata: {
        url: expect.any(String),
        tabId: expect.any(Number),
        platform: expect.stringMatching(/chatgpt|claude|bard/)
      }
    });
  });
});
```

#### 1.2 Event Timing Tests
```typescript
describe('Event Timing', () => {
  it('should emit before any addon initialization', async () => {
    const callOrder: string[] = [];
    
    messageBus.on('NewChatRequested', () => {
      callOrder.push('NewChatRequested');
    });
    
    addonManager.on('addon:initialize', () => {
      callOrder.push('addon:initialize');
    });
    
    await simulateNewChat();
    
    expect(callOrder).toEqual(['NewChatRequested', 'addon:initialize']);
  });

  it('should not emit for page refreshes', async () => {
    const eventListener = jest.fn();
    messageBus.on('NewChatRequested', eventListener);
    
    // Simulate page refresh
    await simulatePageRefresh();
    
    expect(eventListener).not.toHaveBeenCalled();
  });
});
```

### 2. Integration Tests

#### 2.1 Addon Response Tests
```typescript
describe('Addon Integration', () => {
  it('should allow addons to respond to NewChatRequested', async () => {
    const testAddon = {
      id: 'test-addon',
      onNewChatRequested: jest.fn()
    };
    
    addonManager.register(testAddon);
    await simulateNewChat();
    
    expect(testAddon.onNewChatRequested).toHaveBeenCalledWith({
      chatId: expect.any(String),
      timestamp: expect.any(Number)
    });
  });

  it('should handle multiple addon listeners', async () => {
    const listeners = [
      jest.fn(),
      jest.fn(),
      jest.fn()
    ];
    
    listeners.forEach(listener => {
      messageBus.on('NewChatRequested', listener);
    });
    
    await simulateNewChat();
    
    listeners.forEach(listener => {
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
```

#### 2.2 Error Handling Tests
```typescript
describe('Error Handling', () => {
  it('should continue if addon throws error', async () => {
    const errorAddon = {
      id: 'error-addon',
      onNewChatRequested: jest.fn(() => {
        throw new Error('Addon initialization failed');
      })
    };
    
    const successAddon = {
      id: 'success-addon',
      onNewChatRequested: jest.fn()
    };
    
    addonManager.register(errorAddon);
    addonManager.register(successAddon);
    
    await simulateNewChat();
    
    expect(successAddon.onNewChatRequested).toHaveBeenCalled();
  });

  it('should log errors from addon handlers', async () => {
    const consoleSpy = jest.spyOn(console, 'error');
    
    messageBus.on('NewChatRequested', () => {
      throw new Error('Handler error');
    });
    
    await simulateNewChat();
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('NewChatRequested handler error'),
      expect.any(Error)
    );
  });
});
```

### 3. Platform-Specific Tests

#### 3.1 ChatGPT Integration
```typescript
describe('ChatGPT Platform', () => {
  beforeEach(() => {
    mockChatGPTEnvironment();
  });

  it('should detect new chat via URL change', async () => {
    const eventListener = jest.fn();
    messageBus.on('NewChatRequested', eventListener);
    
    // Simulate ChatGPT new chat URL pattern
    await navigateTo('https://chat.openai.com/chat');
    
    expect(eventListener).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          platform: 'chatgpt',
          url: 'https://chat.openai.com/chat'
        }
      })
    );
  });

  it('should detect new chat via button click', async () => {
    const eventListener = jest.fn();
    messageBus.on('NewChatRequested', eventListener);
    
    // Simulate clicking "New Chat" button
    const newChatButton = document.querySelector('[data-testid="new-chat-button"]');
    await userEvent.click(newChatButton);
    
    expect(eventListener).toHaveBeenCalled();
  });
});
```

### 4. Performance Tests

#### 4.1 Event Performance
```typescript
describe('Performance', () => {
  it('should emit event within 50ms', async () => {
    const startTime = performance.now();
    let eventTime: number;
    
    messageBus.on('NewChatRequested', () => {
      eventTime = performance.now();
    });
    
    await simulateNewChat();
    
    expect(eventTime! - startTime).toBeLessThan(50);
  });

  it('should not block UI thread', async () => {
    const heavyAddon = {
      id: 'heavy-addon',
      onNewChatRequested: async () => {
        // Simulate heavy computation
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    };
    
    addonManager.register(heavyAddon);
    
    const startTime = performance.now();
    await simulateNewChat();
    const endTime = performance.now();
    
    // Event should return quickly even with slow addon
    expect(endTime - startTime).toBeLessThan(100);
  });
});
```

### 5. State Management Tests

#### 5.1 Chat Session Tracking
```typescript
describe('Chat Session State', () => {
  it('should generate unique chat IDs', async () => {
    const chatIds = new Set<string>();
    
    messageBus.on('NewChatRequested', (event) => {
      chatIds.add(event.chatId);
    });
    
    // Create multiple chats
    for (let i = 0; i < 5; i++) {
      await simulateNewChat();
    }
    
    expect(chatIds.size).toBe(5);
  });

  it('should maintain chat context between events', async () => {
    let currentChatId: string;
    
    messageBus.on('NewChatRequested', (event) => {
      currentChatId = event.chatId;
    });
    
    messageBus.on('MessageSent', (event) => {
      expect(event.chatId).toBe(currentChatId);
    });
    
    await simulateNewChat();
    await simulateMessageSend('Test message');
  });
});
```

## Test Utilities

```typescript
// Test helper functions
async function simulateNewChat() {
  // Platform-specific logic to trigger new chat
  const platform = detectPlatform();
  
  switch (platform) {
    case 'chatgpt':
      await navigateTo('https://chat.openai.com/chat');
      break;
    case 'claude':
      await clickElement('[data-testid="new-conversation"]');
      break;
    default:
      throw new Error(`Unknown platform: ${platform}`);
  }
}

async function waitForEvent(eventName: string): Promise<any> {
  return new Promise(resolve => {
    messageBus.once(eventName, resolve);
  });
}

function mockChatGPTEnvironment() {
  // Set up ChatGPT-specific DOM and globals
  global.location = new URL('https://chat.openai.com');
  document.body.innerHTML = chatGPTMockHTML;
}
```

## Edge Cases to Test

1. **Rapid New Chat Creation**: Multiple new chats in quick succession
2. **Network Interruptions**: New chat during offline/online transitions
3. **Tab Switching**: New chat while switching between tabs
4. **Extension Reload**: New chat immediately after extension update
5. **Memory Pressure**: New chat when system is low on memory
6. **Concurrent Addons**: 10+ addons responding to the same event
7. **Browser Variations**: Chrome, Firefox, Edge, Safari differences

## Coverage Requirements

- **Unit Tests**: 95% coverage of event emission logic
- **Integration Tests**: 90% coverage of addon interactions
- **E2E Tests**: Cover all major user flows
- **Performance Tests**: Sub-50ms event emission verified

## Success Criteria

✅ Event fires reliably on all platforms
✅ Addons can initialize properly on new chats
✅ No performance degradation
✅ Backward compatibility maintained
✅ Error handling prevents cascade failures
✅ Documentation includes migration guide