/**
 * Core WebSocket Handler
 * Domain-agnostic WebSocket connection management
 * Handles connection, reconnection, and message routing
 */

console.log('🔌 Core WebSocket Handler initializing...');

class CoreWebSocketHandler {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.messageHandlers = new Map();
    this.eventSubscriptions = new Set();
  }

  /**
   * Connect to WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('⚠️ WebSocket already connected or connecting');
      return;
    }

    if (this.isConnecting) {
      console.log('⚠️ Connection already in progress');
      return;
    }

    this.isConnecting = true;
    console.log(`🔌 Connecting to WebSocket server at ${this.serverUrl}...`);

    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Log connection to message logger
        if (window.messageLogger) {
          window.messageLogger.addMessage({
            type: 'websocket.connected',
            payload: { serverUrl: this.serverUrl }
          }, 'system');
        }
        
        // Send registration message
        this.send({
          type: 'extension.registered',
          data: {
            extensionId: chrome.runtime.id,
            version: chrome.runtime.getManifest().version,
            capabilities: ['message-logging', 'domain-addons']
          }
        });
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', message);
          
          // Log all messages
          if (window.messageLogger) {
            window.messageLogger.addMessage(message, 'incoming');
          }
          
          // Route message to registered handlers
          this.routeMessage(message);
          
        } catch (error) {
          console.error('❌ Error processing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        
        if (window.messageLogger) {
          window.messageLogger.addMessage({
            type: 'websocket.error',
            payload: { error: error.message || 'Unknown error' }
          }, 'system');
        }
      };

      this.ws.onclose = () => {
        console.log('🔌 WebSocket connection closed');
        this.isConnecting = false;
        this.ws = null;
        
        if (window.messageLogger) {
          window.messageLogger.addMessage({
            type: 'websocket.disconnected',
            payload: { reason: 'Connection closed' }
          }, 'system');
        }
        
        // Attempt reconnection
        this.attemptReconnect();
      };

    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  /**
   * Send a message through WebSocket
   * @param {Object} message - Message to send
   */
  send(message) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('❌ WebSocket is not connected');
      return false;
    }

    try {
      // Ensure message has required fields
      const fullMessage = {
        id: message.id || `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: message.type,
        timestamp: message.timestamp || Date.now(),
        ...message
      };

      this.ws.send(JSON.stringify(fullMessage));
      console.log('📤 Sent WebSocket message:', fullMessage);
      
      // Log outgoing messages
      if (window.messageLogger) {
        window.messageLogger.addMessage(fullMessage, 'outgoing');
      }
      
      return true;
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      return false;
    }
  }

  /**
   * Register a message handler for specific message types
   * @param {string} messageType - Type of message to handle
   * @param {Function} handler - Handler function
   */
  registerHandler(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }
    this.messageHandlers.get(messageType).add(handler);
    console.log(`✅ Registered handler for message type: ${messageType}`);
  }

  /**
   * Unregister a message handler
   * @param {string} messageType - Type of message
   * @param {Function} handler - Handler function to remove
   */
  unregisterHandler(messageType, handler) {
    if (this.messageHandlers.has(messageType)) {
      this.messageHandlers.get(messageType).delete(handler);
    }
  }

  /**
   * Route message to appropriate handlers
   * @param {Object} message - Message to route
   */
  routeMessage(message) {
    // Handle nested event structure
    let messageType = message.type;
    let payload = message.payload || message;
    
    if (message.type === 'event' && message.payload && message.payload.type) {
      messageType = message.payload.type;
      payload = message.payload.payload || message.payload;
    }

    // Call registered handlers for this message type
    if (this.messageHandlers.has(messageType)) {
      this.messageHandlers.get(messageType).forEach(handler => {
        try {
          handler(payload, message);
        } catch (error) {
          console.error(`Error in handler for ${messageType}:`, error);
        }
      });
    }

    // Call wildcard handlers
    if (this.messageHandlers.has('*')) {
      this.messageHandlers.get('*').forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in wildcard handler:', error);
        }
      });
    }
  }

  /**
   * Subscribe to specific event types
   * @param {Array<string>} eventTypes - Event types to subscribe to
   */
  subscribe(eventTypes) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('⚠️ Cannot subscribe - WebSocket not connected');
      return;
    }

    const subscribeMessage = {
      id: `sub-${Date.now()}`,
      type: 'subscribe',
      timestamp: Date.now(),
      payload: {
        eventTypes: eventTypes
      }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('📬 Subscribed to events:', eventTypes);
    
    // Track subscriptions
    eventTypes.forEach(type => this.eventSubscriptions.add(type));
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Attempt to reconnect after connection loss
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`⏳ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Get connection status
   * @returns {Object} Connection status
   */
  getStatus() {
    return {
      connected: this.ws && this.ws.readyState === WebSocket.OPEN,
      connecting: this.isConnecting,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create singleton instance
const coreWebSocketHandler = new CoreWebSocketHandler();

// Auto-connect when loaded
coreWebSocketHandler.connect();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = coreWebSocketHandler;
} else {
  window.coreWebSocketHandler = coreWebSocketHandler;
}