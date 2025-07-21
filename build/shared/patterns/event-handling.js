/**
 * @fileoverview Shared event handling patterns for Semantest
 * @module shared/patterns/event-handling
 */
import { EventEmitter } from 'events';
/**
 * Type-safe event emitter with automatic cleanup
 */
export class TypedEventEmitter extends EventEmitter {
    constructor() {
        super(...arguments);
        this.cleanupHandlers = [];
    }
    emit(event, ...args) {
        return super.emit(event, ...args);
    }
    on(event, listener) {
        super.on(event, listener);
        this.cleanupHandlers.push(() => this.off(event, listener));
        return this;
    }
    once(event, listener) {
        super.once(event, listener);
        return this;
    }
    off(event, listener) {
        super.off(event, listener);
        return this;
    }
    cleanup() {
        this.cleanupHandlers.forEach(cleanup => cleanup());
        this.cleanupHandlers = [];
        this.removeAllListeners();
    }
}
/**
 * Event bus for cross-module communication
 */
export class EventBus {
    constructor() {
        this.emitter = new EventEmitter();
        this.subscriptions = new Map();
    }
    static getInstance() {
        if (!EventBus.instance) {
            EventBus.instance = new EventBus();
        }
        return EventBus.instance;
    }
    subscribe(event, handler) {
        if (!this.subscriptions.has(event)) {
            this.subscriptions.set(event, new Set());
        }
        this.subscriptions.get(event).add(handler);
        this.emitter.on(event, handler);
        // Return unsubscribe function
        return () => {
            this.subscriptions.get(event)?.delete(handler);
            this.emitter.off(event, handler);
        };
    }
    publish(event, data) {
        this.emitter.emit(event, data);
    }
    clear() {
        this.emitter.removeAllListeners();
        this.subscriptions.clear();
    }
}
export class MessageRouter {
    constructor() {
        this.handlers = new Map();
    }
    register(action, handler) {
        this.handlers.set(action, handler);
    }
    async route(request, sender) {
        const handler = this.handlers.get(request.action);
        if (!handler) {
            throw new Error(`No handler registered for action: ${request.action}`);
        }
        return handler.handle(request, sender);
    }
    listen() {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
