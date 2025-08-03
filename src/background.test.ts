/**
 * @jest-environment jsdom
 */

import './background';

// Mock dependencies
jest.mock('./message-store.js', () => ({
  globalMessageStore: {
    addInboundMessage: jest.fn(),
    addOutboundMessage: jest.fn(),
    getState: jest.fn().mockReturnValue({
      messages: [],
      currentIndex: -1,
      isTimeTraveling: false
    }),
    subscribe: jest.fn()
  },
  messageStoreActions: {
    jumpToMessage: jest.fn(),
    setTimeTravel: jest.fn(),
    resetTimeTravelState: jest.fn()
  }
}));

jest.mock('./time-travel-ui.js', () => ({
  globalTimeTravelUI: {
    updateUI: jest.fn(),
    show: jest.fn(),
    hide: jest.fn()
  }
}));

jest.mock('./health-checks/index.js', () => ({
  healthCheckHandler: {
    setupMessageListeners: jest.fn(),
    handleHealthCheckRequest: jest.fn().mockResolvedValue({ healthy: true }),
    handleImageGenerationRequest: jest.fn().mockResolvedValue({ success: true })
  }
}));

// Mock chrome APIs
const mockRuntime = {
  onMessage: {
    addListener: jest.fn()
  },
  onMessageExternal: {
    addListener: jest.fn()
  },
  onConnect: {
    addListener: jest.fn()
  },
  onConnectExternal: {
    addListener: jest.fn()
  },
  sendMessage: jest.fn(),
  id: 'test-extension-id',
  lastError: null
};

const mockTabs = {
  query: jest.fn(),
  sendMessage: jest.fn(),
  create: jest.fn()
};

const mockAction = {
  setBadgeText: jest.fn(),
  setBadgeBackgroundColor: jest.fn()
};

global.chrome = {
  runtime: mockRuntime,
  tabs: mockTabs,
  action: mockAction
} as any;

// Mock WebSocket
class MockWebSocket {
  url: string;
  readyState: number;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    this.readyState = WebSocket.CONNECTING;
    MockWebSocket.instances.push(this);
    
    // Simulate connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      if (this.onopen) {
        this.onopen(new Event('open'));
      }
    }, 10);
  }

  send(data: string) {
    MockWebSocket.sentMessages.push(data);
  }

  close() {
    this.readyState = WebSocket.CLOSED;
    if (this.onclose) {
      this.onclose(new CloseEvent('close'));
    }
  }

  static instances: MockWebSocket[] = [];
  static sentMessages: string[] = [];
  static reset() {
    MockWebSocket.instances = [];
    MockWebSocket.sentMessages = [];
  }
}

global.WebSocket = MockWebSocket as any;

describe('Background Script', () => {
  let messageListener: any;
  let externalMessageListener: any;

  beforeEach(() => {
    jest.clearAllMocks();
    MockWebSocket.reset();
    
    // Capture message listeners
    messageListener = mockRuntime.onMessage.addListener.mock.calls[0]?.[0];
    externalMessageListener = mockRuntime.onMessageExternal.addListener.mock.calls[0]?.[0];
    
    // Reset global test data
    (globalThis as any).extensionTestData = {
      lastReceivedMessage: null,
      lastResponse: null,
      webSocketMessages: []
    };
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection on connect message', async () => {
      const sendResponse = jest.fn();
      
      await messageListener(
        { action: 'connect', serverUrl: 'ws://localhost:3003/ws' },
        {},
        sendResponse
      );

      expect(MockWebSocket.instances).toHaveLength(1);
      expect(MockWebSocket.instances[0].url).toBe('ws://localhost:3003/ws');
      
      // Wait for connection
      await new Promise(resolve => setTimeout(resolve, 20));
      
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        status: expect.objectContaining({
          connected: true,
          serverUrl: 'ws://localhost:3003/ws'
        })
      });
    });

    it('should handle WebSocket connection errors', async () => {
      const sendResponse = jest.fn();
      
      // Mock WebSocket to fail
      const OriginalWebSocket = global.WebSocket;
      global.WebSocket = jest.fn().mockImplementation(() => {
        throw new Error('Connection failed');
      });

      await messageListener(
        { action: 'connect', serverUrl: 'ws://invalid-url' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        status: expect.objectContaining({
          connected: false,
          lastError: expect.stringContaining('Connection failed')
        })
      });

      global.WebSocket = OriginalWebSocket;
    });

    it('should disconnect WebSocket on disconnect message', async () => {
      const sendResponse = jest.fn();
      
      // First connect
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Then disconnect
      await messageListener(
        { action: 'disconnect' },
        {},
        sendResponse
      );

      expect(MockWebSocket.instances[0].readyState).toBe(WebSocket.CLOSED);
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        status: expect.objectContaining({
          connected: false
        })
      });
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      // Establish connection first
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    it('should handle sendToServer action', async () => {
      const sendResponse = jest.fn();
      const testPayload = { type: 'TEST', data: 'test data' };

      await messageListener(
        { action: 'sendToServer', payload: testPayload },
        {},
        sendResponse
      );

      expect(MockWebSocket.sentMessages).toHaveLength(1);
      const sentMessage = JSON.parse(MockWebSocket.sentMessages[0]);
      expect(sentMessage).toMatchObject({
        type: 'IMAGE_REQUEST',
        payload: testPayload,
        extensionId: 'test-extension-id'
      });

      expect(sendResponse).toHaveBeenCalledWith({ success: true });
    });

    it('should handle incoming WebSocket messages', async () => {
      const ws = MockWebSocket.instances[0];
      const testMessage = {
        type: 'TEST_RESPONSE',
        payload: { result: 'success' }
      };

      // Simulate incoming message
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify(testMessage)
        }));
      }

      expect((globalThis as any).extensionTestData.lastReceivedMessage).toEqual(testMessage);
      expect((globalThis as any).extensionTestData.webSocketMessages).toHaveLength(1);
    });

    it('should relay messages to content scripts', async () => {
      mockTabs.query.mockResolvedValue([
        { id: 1, url: 'https://chat.openai.com' },
        { id: 2, url: 'https://example.com' }
      ]);

      const ws = MockWebSocket.instances[0];
      const testMessage = {
        type: 'RELAY_TO_CONTENT',
        payload: { action: 'test' }
      };

      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: JSON.stringify(testMessage)
        }));
      }

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTabs.query).toHaveBeenCalledWith({ url: 'https://chat.openai.com/*' });
      expect(mockTabs.sendMessage).toHaveBeenCalledWith(
        1,
        testMessage,
        expect.any(Function)
      );
    });
  });

  describe('Status Management', () => {
    it('should update badge on connection status change', async () => {
      // Connect
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: '✓' });
      expect(mockAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#4CAF50' });

      // Disconnect
      await messageListener(
        { action: 'disconnect' },
        {},
        jest.fn()
      );

      expect(mockAction.setBadgeText).toHaveBeenCalledWith({ text: '✗' });
      expect(mockAction.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#F44336' });
    });

    it('should get connection status', async () => {
      const sendResponse = jest.fn();

      await messageListener(
        { action: 'getStatus' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        status: expect.objectContaining({
          connected: expect.any(Boolean),
          serverUrl: expect.any(String)
        })
      });
    });
  });

  describe('External Message Handling', () => {
    it('should handle health check requests from server', async () => {
      const sendResponse = jest.fn();

      await externalMessageListener(
        { type: 'HEALTH_CHECK' },
        { id: 'server-extension' },
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        health: { healthy: true }
      });
    });

    it('should handle image generation requests from server', async () => {
      const sendResponse = jest.fn();

      await externalMessageListener(
        { 
          type: 'IMAGE_REQUEST',
          payload: { prompt: 'test image' }
        },
        { id: 'server-extension' },
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        result: { success: true }
      });
    });
  });

  describe('Auto-reconnect', () => {
    it('should auto-reconnect when enabled', async () => {
      // Enable auto-reconnect
      await messageListener(
        { action: 'setAutoReconnect', enabled: true },
        {},
        jest.fn()
      );

      // Connect
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const ws = MockWebSocket.instances[0];
      
      // Simulate disconnect
      if (ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }

      // Wait for reconnect attempt
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Should have created a new connection
      expect(MockWebSocket.instances).toHaveLength(2);
    });

    it('should not auto-reconnect when disabled', async () => {
      // Connect without auto-reconnect
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const ws = MockWebSocket.instances[0];
      
      // Simulate disconnect
      if (ws.onclose) {
        ws.onclose(new CloseEvent('close'));
      }

      // Wait to ensure no reconnect
      await new Promise(resolve => setTimeout(resolve, 2100));

      // Should not have created a new connection
      expect(MockWebSocket.instances).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle WebSocket errors gracefully', async () => {
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const ws = MockWebSocket.instances[0];
      
      // Simulate error
      if (ws.onerror) {
        ws.onerror(new Event('error'));
      }

      // Should update status with error
      const sendResponse = jest.fn();
      await messageListener(
        { action: 'getStatus' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        status: expect.objectContaining({
          connected: true, // Still connected until close event
          lastError: expect.stringContaining('WebSocket error')
        })
      });
    });

    it('should handle malformed WebSocket messages', async () => {
      await messageListener(
        { action: 'connect' },
        {},
        jest.fn()
      );
      
      await new Promise(resolve => setTimeout(resolve, 20));

      const ws = MockWebSocket.instances[0];
      
      // Send malformed JSON
      if (ws.onmessage) {
        ws.onmessage(new MessageEvent('message', {
          data: 'invalid json'
        }));
      }

      // Should not crash, just log error
      expect((globalThis as any).extensionTestData.webSocketMessages).toHaveLength(0);
    });
  });
});