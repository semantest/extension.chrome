/**
 * Core Message Bus
 * Typed event communication system for core-addon and addon-addon messaging
 * Based on Aria's architectural design
 */

class MessageBus {
  constructor(namespace = '') {
    this.namespace = namespace;
    this.handlers = new Map();
    this.requestHandlers = new Map();
    this.pendingRequests = new Map();
  }

  /**
   * Emit a one-way event
   * @param {string} event - Event name
   * @param {*} data - Event data
   */
  emit(event, data) {
    const fullEvent = this.namespace ? `${this.namespace}:${event}` : event;
    console.log(`📤 [MessageBus] Emit: ${fullEvent}`, data);
    
    // Log to message logger
    if (window.messageLogger) {
      window.messageLogger.addMessage({
        type: fullEvent,
        payload: data,
        source: 'message-bus'
      }, 'internal');
    }
    
    // Call direct handlers
    this._callHandlers(fullEvent, data);
    
    // Handle wildcard subscriptions
    this._handleWildcards(fullEvent, data);
  }

  /**
   * Register an event handler
   * @param {string} event - Event name (supports wildcards)
   * @param {Function} handler - Handler function
   */
  on(event, handler) {
    const fullEvent = this.namespace ? `${this.namespace}:${event}` : event;
    
    if (!this.handlers.has(fullEvent)) {
      this.handlers.set(fullEvent, new Set());
    }
    
    this.handlers.get(fullEvent).add(handler);
    console.log(`👂 [MessageBus] Registered handler for: ${fullEvent}`);
  }

  /**
   * Unregister an event handler
   * @param {string} event - Event name
   * @param {Function} handler - Handler function
   */
  off(event, handler) {
    const fullEvent = this.namespace ? `${this.namespace}:${event}` : event;
    
    if (this.handlers.has(fullEvent)) {
      this.handlers.get(fullEvent).delete(handler);
    }
  }

  /**
   * Request-response pattern
   * @param {string} event - Event name
   * @param {*} data - Request data
   * @param {number} timeout - Timeout in ms (default: 5000)
   * @returns {Promise} Response promise
   */
  request(event, data, timeout = 5000) {
    const fullEvent = this.namespace ? `${this.namespace}:${event}` : event;
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        reject(new Error(`Request timeout: ${fullEvent}`));
      }, timeout);
      
      // Store pending request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeoutId
      });
      
      // Emit request event
      this.emit(`${event}:request`, {
        requestId,
        data
      });
      
      // Listen for response
      const responseHandler = (response) => {
        if (response.requestId === requestId) {
          clearTimeout(timeoutId);
          this.pendingRequests.delete(requestId);
          this.off(`${event}:response`, responseHandler);
          
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response.data);
          }
        }
      };
      
      this.on(`${event}:response`, responseHandler);
    });
  }

  /**
   * Register a request handler
   * @param {string} event - Event name
   * @param {Function} handler - Async handler function
   */
  handle(event, handler) {
    const fullEvent = this.namespace ? `${this.namespace}:${event}` : event;
    
    this.on(`${event}:request`, async (request) => {
      const { requestId, data } = request;
      
      try {
        const result = await handler(data);
        this.emit(`${event}:response`, {
          requestId,
          data: result
        });
      } catch (error) {
        this.emit(`${event}:response`, {
          requestId,
          error: error.message
        });
      }
    });
    
    console.log(`🤝 [MessageBus] Registered request handler for: ${fullEvent}`);
  }

  /**
   * Create a namespaced message bus
   * @param {string} prefix - Namespace prefix
   * @returns {MessageBus} Namespaced message bus
   */
  namespace(prefix) {
    const fullNamespace = this.namespace 
      ? `${this.namespace}:${prefix}` 
      : prefix;
    return new MessageBus(fullNamespace);
  }

  /**
   * Call handlers for an event
   * @private
   */
  _callHandlers(event, data) {
    if (this.handlers.has(event)) {
      this.handlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in handler for ${event}:`, error);
        }
      });
    }
  }

  /**
   * Handle wildcard subscriptions
   * @private
   */
  _handleWildcards(event, data) {
    // Handle exact wildcard (*)
    if (this.handlers.has('*')) {
      this.handlers.get('*').forEach(handler => {
        try {
          handler(event, data);
        } catch (error) {
          console.error('Error in wildcard handler:', error);
        }
      });
    }
    
    // Handle namespace wildcards (e.g., 'addon:chatgpt:*')
    const parts = event.split(':');
    for (let i = parts.length - 1; i > 0; i--) {
      const wildcardPattern = parts.slice(0, i).join(':') + ':*';
      if (this.handlers.has(wildcardPattern)) {
        this.handlers.get(wildcardPattern).forEach(handler => {
          try {
            handler(event, data);
          } catch (error) {
            console.error(`Error in wildcard handler for ${wildcardPattern}:`, error);
          }
        });
      }
    }
  }
}

// Create global message bus instance
const messageBus = new MessageBus();

// Core namespaced buses
const coreBus = messageBus.namespace('core');
const addonBus = messageBus.namespace('addon');

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MessageBus, messageBus, coreBus, addonBus };
} else {
  window.MessageBus = MessageBus;
  window.messageBus = messageBus;
  window.coreBus = coreBus;
  window.addonBus = addonBus;
}