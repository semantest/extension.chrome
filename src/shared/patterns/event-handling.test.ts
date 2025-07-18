/**
 * @fileoverview Tests for event handling patterns
 */

import { TypedEventEmitter, EventBus, MessageRouter, MessageHandler } from './event-handling';

// Define test event types
interface TestEvents {
  test: (data: string) => void;
  error: (error: Error) => void;
  data: { id: number; name: string };
}

describe('Event Handling Patterns', () => {
  describe('TypedEventEmitter', () => {
    let emitter: TypedEventEmitter<TestEvents>;

    beforeEach(() => {
      emitter = new TypedEventEmitter<TestEvents>();
    });

    afterEach(() => {
      emitter.cleanup();
    });

    it('should emit and receive typed events', () => {
      const handler = jest.fn();
      emitter.on('test', handler);
      
      emitter.emit('test', 'hello');
      
      expect(handler).toHaveBeenCalledWith('hello');
    });

    it('should handle once listeners', () => {
      const handler = jest.fn();
      emitter.once('test', handler);
      
      emitter.emit('test', 'first');
      emitter.emit('test', 'second');
      
      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith('first');
    });

    it('should remove listeners', () => {
      const handler = jest.fn();
      emitter.on('test', handler);
      emitter.off('test', handler);
      
      emitter.emit('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });

    it('should cleanup all listeners', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      emitter.on('test', handler1);
      emitter.on('error', handler2);
      emitter.cleanup();
      
      emitter.emit('test', 'data');
      emitter.emit('error', new Error());
      
      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it('should handle complex event data', () => {
      const handler = jest.fn();
      emitter.on('data', handler);
      
      const data = { id: 1, name: 'test' };
      emitter.emit('data', data);
      
      expect(handler).toHaveBeenCalledWith(data);
    });
  });

  describe('EventBus', () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = EventBus.getInstance();
      eventBus.clear();
    });

    it('should be singleton', () => {
      const bus1 = EventBus.getInstance();
      const bus2 = EventBus.getInstance();
      expect(bus1).toBe(bus2);
    });

    it('should subscribe and publish events', () => {
      const handler = jest.fn();
      const unsubscribe = eventBus.subscribe('test', handler);
      
      eventBus.publish('test', { data: 'hello' });
      
      expect(handler).toHaveBeenCalledWith({ data: 'hello' });
      
      unsubscribe();
      eventBus.publish('test', { data: 'world' });
      
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple subscribers', () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();
      
      eventBus.subscribe('test', handler1);
      eventBus.subscribe('test', handler2);
      
      eventBus.publish('test', 'data');
      
      expect(handler1).toHaveBeenCalledWith('data');
      expect(handler2).toHaveBeenCalledWith('data');
    });

    it('should clear all subscriptions', () => {
      const handler = jest.fn();
      eventBus.subscribe('test', handler);
      
      eventBus.clear();
      eventBus.publish('test', 'data');
      
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('MessageRouter', () => {
    let router: MessageRouter;

    beforeEach(() => {
      router = new MessageRouter();
    });

    it('should route messages to handlers', async () => {
      const handler: MessageHandler = {
        handle: jest.fn().mockResolvedValue({ success: true })
      };
      
      router.register('test', handler);
      
      const result = await router.route(
        { action: 'test', data: 'hello' },
        {} as chrome.runtime.MessageSender
      );
      
      expect(handler.handle).toHaveBeenCalledWith(
        { action: 'test', data: 'hello' },
        {}
      );
      expect(result).toEqual({ success: true });
    });

    it('should throw error for unregistered action', async () => {
      await expect(
        router.route({ action: 'unknown' }, {} as chrome.runtime.MessageSender)
      ).rejects.toThrow('No handler registered for action: unknown');
    });

    it('should handle synchronous handlers', async () => {
      const handler: MessageHandler = {
        handle: jest.fn().mockReturnValue({ sync: true })
      };
      
      router.register('sync', handler);
      
      const result = await router.route(
        { action: 'sync' },
        {} as chrome.runtime.MessageSender
      );
      
      expect(result).toEqual({ sync: true });
    });

    it('should setup chrome message listener', () => {
      const addListener = chrome.runtime.onMessage.addListener as jest.Mock;
      router.listen();
      
      expect(addListener).toHaveBeenCalled();
      
      // Test the listener
      const listener = addListener.mock.calls[0][0];
      const sendResponse = jest.fn();
      
      const handler: MessageHandler = {
        handle: jest.fn().mockResolvedValue({ handled: true })
      };
      
      router.register('test', handler);
      
      const result = listener(
        { action: 'test' },
        {} as chrome.runtime.MessageSender,
        sendResponse
      );
      
      expect(result).toBe(true); // Keep channel open
      
      // Wait for async handling
      setTimeout(() => {
        expect(sendResponse).toHaveBeenCalledWith({ handled: true });
      }, 0);
    });
  });
});