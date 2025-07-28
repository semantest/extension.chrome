/**
 * Unit Tests for Plugin Communication System
 * Tests plugin messaging, event handling, and inter-plugin communication
 */

import { PluginCommunicationManager, MessageType, CommunicationEventType } from './plugin-communication';
import {
  PluginEvent,
  PluginEventBus,
  PluginError,
  PluginCommunicationService
} from './plugin-interface';

// Mock event bus
class MockEventBus implements PluginEventBus {
  private handlers: Map<string, Function[]> = new Map();
  public emittedEvents: PluginEvent[] = [];

  async emit(event: PluginEvent): Promise<void> {
    this.emittedEvents.push(event);
    const eventHandlers = this.handlers.get(event.type) || [];
    await Promise.all(eventHandlers.map(handler => handler(event)));
  }

  on(eventType: string, handler: Function): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
  }

  off(eventType: string, handler: Function): void {
    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      const index = eventHandlers.indexOf(handler);
      if (index > -1) {
        eventHandlers.splice(index, 1);
      }
    }
  }
}

// Mock chrome runtime
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    id: 'test-extension-id'
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('PluginCommunicationManager', () => {
  let communicationManager: PluginCommunicationManager;
  let eventBus: MockEventBus;

  beforeEach(() => {
    jest.clearAllMocks();
    eventBus = new MockEventBus();
    communicationManager = new PluginCommunicationManager(eventBus);
  });

  describe('Plugin Registration', () => {
    test('should register communication service for plugin', () => {
      const service = communicationManager.registerPlugin('test-plugin');
      
      expect(service).toBeDefined();
      expect(service).toHaveProperty('sendMessage');
      expect(service).toHaveProperty('onMessage');
      expect(service).toHaveProperty('broadcast');
    });

    test('should prevent duplicate plugin registration', () => {
      communicationManager.registerPlugin('test-plugin');
      
      expect(() => {
        communicationManager.registerPlugin('test-plugin');
      }).toThrow(PluginError);
    });

    test('should unregister plugin', () => {
      communicationManager.registerPlugin('test-plugin');
      communicationManager.unregisterPlugin('test-plugin');
      
      // Should be able to register again after unregistering
      const service = communicationManager.registerPlugin('test-plugin');
      expect(service).toBeDefined();
    });
  });

  describe('Message Sending', () => {
    let service: PluginCommunicationService;

    beforeEach(() => {
      service = communicationManager.registerPlugin('test-plugin');
    });

    test('should send message to specific plugin', async () => {
      const targetService = communicationManager.registerPlugin('target-plugin');
      const messageHandler = jest.fn();
      targetService.onMessage('test-type', messageHandler);

      await service.sendMessage('target-plugin', {
        type: 'test-type',
        data: { message: 'hello' }
      });

      expect(messageHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-type',
          data: { message: 'hello' }
        }),
        'test-plugin'
      );
    });

    test('should handle message response', async () => {
      const targetService = communicationManager.registerPlugin('target-plugin');
      targetService.onMessage('request', async (message) => {
        return { success: true, result: message.data.value * 2 };
      });

      const response = await service.sendMessage('target-plugin', {
        type: 'request',
        data: { value: 5 }
      });

      expect(response).toEqual({ success: true, result: 10 });
    });

    test('should timeout on no response', async () => {
      const targetService = communicationManager.registerPlugin('target-plugin');
      // Don't register handler to simulate no response

      await expect(service.sendMessage('target-plugin', {
        type: 'test',
        data: {}
      }, { timeout: 100 })).rejects.toThrow('Message timeout');
    });

    test('should throw error for unknown target', async () => {
      await expect(service.sendMessage('unknown-plugin', {
        type: 'test',
        data: {}
      })).rejects.toThrow(PluginError);
    });
  });

  describe('Message Broadcasting', () => {
    test('should broadcast message to all plugins', async () => {
      const service1 = communicationManager.registerPlugin('plugin1');
      const service2 = communicationManager.registerPlugin('plugin2');
      const service3 = communicationManager.registerPlugin('plugin3');

      const handler1 = jest.fn();
      const handler2 = jest.fn();
      const handler3 = jest.fn();

      service1.onMessage('broadcast', handler1);
      service2.onMessage('broadcast', handler2);
      service3.onMessage('broadcast', handler3);

      await service1.broadcast({
        type: 'broadcast',
        data: { message: 'hello all' }
      });

      // Sender should not receive its own broadcast
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'hello all' } }),
        'plugin1'
      );
      expect(handler3).toHaveBeenCalledWith(
        expect.objectContaining({ data: { message: 'hello all' } }),
        'plugin1'
      );
    });

    test('should filter broadcasts by type', async () => {
      const service1 = communicationManager.registerPlugin('plugin1');
      const service2 = communicationManager.registerPlugin('plugin2');

      const handlerA = jest.fn();
      const handlerB = jest.fn();

      service2.onMessage('type-a', handlerA);
      service2.onMessage('type-b', handlerB);

      await service1.broadcast({ type: 'type-a', data: {} });

      expect(handlerA).toHaveBeenCalled();
      expect(handlerB).not.toHaveBeenCalled();
    });
  });

  describe('Message Handlers', () => {
    let service: PluginCommunicationService;

    beforeEach(() => {
      service = communicationManager.registerPlugin('test-plugin');
    });

    test('should register message handler', () => {
      const handler = jest.fn();
      const unsubscribe = service.onMessage('test-type', handler);

      expect(unsubscribe).toBeInstanceOf(Function);
    });

    test('should unregister message handler', async () => {
      const handler = jest.fn();
      const unsubscribe = service.onMessage('test-type', handler);

      const sender = communicationManager.registerPlugin('sender');
      
      await sender.sendMessage('test-plugin', { type: 'test-type', data: {} });
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await sender.sendMessage('test-plugin', { type: 'test-type', data: {} });
      expect(handler).toHaveBeenCalledTimes(1); // Still 1, not called again
    });

    test('should handle multiple handlers for same type', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      service.onMessage('test-type', handler1);
      service.onMessage('test-type', handler2);

      const sender = communicationManager.registerPlugin('sender');
      await sender.sendMessage('test-plugin', { type: 'test-type', data: {} });

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
    });

    test('should pass sender ID to handler', async () => {
      const handler = jest.fn();
      service.onMessage('test-type', handler);

      const sender = communicationManager.registerPlugin('sender-plugin');
      await sender.sendMessage('test-plugin', { type: 'test-type', data: {} });

      expect(handler).toHaveBeenCalledWith(
        expect.any(Object),
        'sender-plugin'
      );
    });
  });

  describe('Event Bus Integration', () => {
    test('should emit events for plugin communication', async () => {
      const service1 = communicationManager.registerPlugin('plugin1');
      const service2 = communicationManager.registerPlugin('plugin2');

      service2.onMessage('test', jest.fn());

      await service1.sendMessage('plugin2', { type: 'test', data: {} });

      const events = eventBus.emittedEvents;
      expect(events).toContainEqual(
        expect.objectContaining({
          type: CommunicationEventType.MESSAGE_SENT,
          source: 'plugin1',
          target: 'plugin2'
        })
      );
      expect(events).toContainEqual(
        expect.objectContaining({
          type: CommunicationEventType.MESSAGE_RECEIVED,
          source: 'plugin1',
          target: 'plugin2'
        })
      );
    });

    test('should emit broadcast events', async () => {
      const service = communicationManager.registerPlugin('plugin1');
      communicationManager.registerPlugin('plugin2');
      communicationManager.registerPlugin('plugin3');

      await service.broadcast({ type: 'test', data: {} });

      const events = eventBus.emittedEvents;
      expect(events).toContainEqual(
        expect.objectContaining({
          type: CommunicationEventType.BROADCAST_SENT,
          source: 'plugin1'
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle handler errors gracefully', async () => {
      const service1 = communicationManager.registerPlugin('plugin1');
      const service2 = communicationManager.registerPlugin('plugin2');

      service2.onMessage('test', () => {
        throw new Error('Handler error');
      });

      await expect(service1.sendMessage('plugin2', {
        type: 'test',
        data: {}
      })).rejects.toThrow('Handler error');

      // Should emit error event
      expect(eventBus.emittedEvents).toContainEqual(
        expect.objectContaining({
          type: CommunicationEventType.MESSAGE_ERROR
        })
      );
    });

    test('should validate message format', async () => {
      const service = communicationManager.registerPlugin('plugin1');
      communicationManager.registerPlugin('plugin2');

      await expect(service.sendMessage('plugin2', {
        // Missing type
        data: {}
      } as any)).rejects.toThrow('Invalid message format');
    });
  });

  describe('System Messages', () => {
    test('should handle system messages', async () => {
      const service = communicationManager.registerPlugin('test-plugin');
      const handler = jest.fn();
      
      service.onMessage('system:shutdown', handler);

      await communicationManager.sendSystemMessage({
        type: 'system:shutdown',
        data: { reason: 'maintenance' }
      });

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'system:shutdown',
          data: { reason: 'maintenance' }
        }),
        'system'
      );
    });

    test('should broadcast system messages to all plugins', async () => {
      const handlers = [jest.fn(), jest.fn(), jest.fn()];
      
      ['plugin1', 'plugin2', 'plugin3'].forEach((id, index) => {
        const service = communicationManager.registerPlugin(id);
        service.onMessage('system:update', handlers[index]);
      });

      await communicationManager.sendSystemMessage({
        type: 'system:update',
        data: { version: '1.2.0' }
      });

      handlers.forEach(handler => {
        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('Message Filtering and Routing', () => {
    test('should filter messages by pattern', async () => {
      const service = communicationManager.registerPlugin('test-plugin');
      const handlers = {
        user: jest.fn(),
        system: jest.fn(),
        other: jest.fn()
      };

      service.onMessage(/^user:/, handlers.user);
      service.onMessage(/^system:/, handlers.system);
      service.onMessage('other', handlers.other);

      const sender = communicationManager.registerPlugin('sender');
      await sender.sendMessage('test-plugin', { type: 'user:login', data: {} });
      await sender.sendMessage('test-plugin', { type: 'system:update', data: {} });
      await sender.sendMessage('test-plugin', { type: 'other', data: {} });

      expect(handlers.user).toHaveBeenCalledTimes(1);
      expect(handlers.system).toHaveBeenCalledTimes(1);
      expect(handlers.other).toHaveBeenCalledTimes(1);
    });
  });

  describe('Chrome Runtime Integration', () => {
    test('should forward messages to chrome runtime', async () => {
      const service = communicationManager.registerPlugin('test-plugin');
      
      await service.sendToExtension({
        type: 'extension-message',
        data: { action: 'test' }
      });

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'plugin-message',
        source: 'test-plugin',
        message: {
          type: 'extension-message',
          data: { action: 'test' }
        }
      });
    });

    test('should receive messages from chrome runtime', () => {
      const service = communicationManager.registerPlugin('test-plugin');
      const handler = jest.fn();
      
      service.onExtensionMessage('background-event', handler);

      // Simulate chrome runtime message
      const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      listener(
        {
          type: 'background-event',
          data: { status: 'ready' }
        },
        { id: mockChrome.runtime.id },
        jest.fn()
      );

      expect(handler).toHaveBeenCalledWith({
        type: 'background-event',
        data: { status: 'ready' }
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all plugins on shutdown', () => {
      communicationManager.registerPlugin('plugin1');
      communicationManager.registerPlugin('plugin2');
      communicationManager.registerPlugin('plugin3');

      communicationManager.shutdown();

      // Should not be able to send messages after shutdown
      expect(() => {
        communicationManager.registerPlugin('plugin1');
      }).not.toThrow(); // Can re-register after shutdown
    });
  });
});