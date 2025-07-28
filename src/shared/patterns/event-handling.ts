/**
 * @fileoverview Shared event handling patterns for Semantest
 * @module shared/patterns/event-handling
 */

import { EventEmitter } from 'events';

/**
 * Type-safe event emitter with automatic cleanup
 */
export class TypedEventEmitter<TEvents extends Record<string, any>> extends EventEmitter {
  private cleanupHandlers: (() => void)[] = [];

  emit<K extends keyof TEvents & string>(
    event: K,
    ...args: TEvents[K] extends (...args: infer P) => any ? P : [TEvents[K]]
  ): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof TEvents & string>(
    event: K,
    listener: TEvents[K] extends (...args: infer P) => any ? (...args: P) => void : (arg: TEvents[K]) => void
  ): this {
    super.on(event, listener as any);
    this.cleanupHandlers.push(() => this.off(event, listener as any));
    return this;
  }

  once<K extends keyof TEvents & string>(
    event: K,
    listener: TEvents[K] extends (...args: infer P) => any ? (...args: P) => void : (arg: TEvents[K]) => void
  ): this {
    super.once(event, listener as any);
    return this;
  }

  off<K extends keyof TEvents & string>(
    event: K,
    listener: TEvents[K] extends (...args: infer P) => any ? (...args: P) => void : (arg: TEvents[K]) => void
  ): this {
    super.off(event, listener as any);
    return this;
  }

  cleanup(): void {
    this.cleanupHandlers.forEach(cleanup => cleanup());
    this.cleanupHandlers = [];
    this.removeAllListeners();
  }
}

/**
 * Event bus for cross-module communication
 */
export class EventBus {
  private static instance: EventBus;
  private emitter = new EventEmitter();
  private subscriptions = new Map<string, Set<Function>>();

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  subscribe(event: string, handler: Function): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }
    
    this.subscriptions.get(event)!.add(handler);
    this.emitter.on(event, handler as any);

    // Return unsubscribe function
    return () => {
      this.subscriptions.get(event)?.delete(handler);
      this.emitter.off(event, handler as any);
    };
  }

  publish(event: string, data?: any): void {
    this.emitter.emit(event, data);
  }

  clear(): void {
    this.emitter.removeAllListeners();
    this.subscriptions.clear();
  }
}

/**
 * Chrome runtime message handler pattern
 */
export interface MessageHandler<TRequest = any, TResponse = any> {
  handle(request: TRequest, sender: chrome.runtime.MessageSender): Promise<TResponse> | TResponse;
}

export class MessageRouter {
  private handlers = new Map<string, MessageHandler>();

  register(action: string, handler: MessageHandler): void {
    this.handlers.set(action, handler);
  }

  async route(
    request: any,
    sender: chrome.runtime.MessageSender
  ): Promise<any> {
    const handler = this.handlers.get(request.action);
    if (!handler) {
      throw new Error(`No handler registered for action: ${request.action}`);
    }
    return handler.handle(request, sender);
  }

  listen(): void {
    chrome.runtime.onMessage.addListener((request: any, sender: chrome.runtime.MessageSender, sendResponse: (response?: any) => void) => {
      this.route(request, sender)
        .then(sendResponse)
        .catch(error => {
          console.error('Message handling error:', error);
          sendResponse({ error: error.message });
        });
      return true; // Keep channel open for async response
    });
  }
}