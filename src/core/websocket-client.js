/**
 * Core WebSocket Client
 * Handles WebSocket communication with server
 * Integrates with MessageBus for event distribution
 */

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
    this.messageQueue = [];
  }

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
        
        // Emit connected event
        if (window.messageBus) {
          window.messageBus.emit('core:websocket:connected', {
            serverUrl: this.serverUrl,
            timestamp: Date.now()
          });
        }
        
        // Send registration message
        this.send({
          type: 'semantest/extension/registered',
          data: {
            extensionId: chrome.runtime.id,
            version: chrome.runtime.getManifest().version,
            capabilities: ['image-generation', 'chatgpt-automation', 'modular-addons']
          }
        });
        
        // Subscribe to events
        this.subscribe([
          'semantest/custom/image/request/received',
          'imageDownloadCompleted'
        ]);
        
        // Process queued messages
        this.processMessageQueue();
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', message);

          // Log to message logger
          if (window.messageLogger) {
            window.messageLogger.addMessage(message, 'incoming');
          }

          // Handle messages with nested format
          if (message.type === 'event' && message.payload) {
            const eventType = message.payload.type;
            const eventPayload = message.payload.payload;
            
            // Emit to message bus
            if (window.messageBus) {
              window.messageBus.emit(eventType, eventPayload);
              
              // Also emit generic websocket message event
              window.messageBus.emit('websocket:message', {
                type: eventType,
                payload: eventPayload,
                originalMessage: message
              });
            }
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
        
        // Emit error event
        if (window.messageBus) {
          window.messageBus.emit('core:websocket:error', {
            error: error.message || 'WebSocket error',
            timestamp: Date.now()
          });
        }
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected (code: ${event.code})`);
        this.isConnecting = false;
        this.ws = null;

        // Emit disconnected event
        if (window.messageBus) {
          window.messageBus.emit('core:websocket:disconnected', {
            code: event.code,
            reason: event.reason,
            timestamp: Date.now()
          });
        }

        // Auto-reconnect logic
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.reconnectAttempts++;
          const delay = this.reconnectDelay * this.reconnectAttempts;
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
          setTimeout(() => this.connect(), delay);
        } else {
          console.error('❌ Max reconnection attempts reached. Please check if server is running.');
        }
      };
    } catch (error) {
      console.error('❌ Failed to create WebSocket:', error);
      this.isConnecting = false;
    }
  }

  subscribe(eventTypes) {
    const subscribeMessage = {
      id: `sub-${Date.now()}`,
      type: 'subscribe',
      timestamp: Date.now(),
      payload: {
        eventTypes: eventTypes
      }
    };
    
    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('✅ Subscribed to events:', eventTypes);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Format message according to server requirements
      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'event',
        timestamp: Date.now(),
        payload: {
          id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: data.type || 'unknown',
          timestamp: Date.now(),
          payload: data.data || data
        }
      };
      
      this.ws.send(JSON.stringify(message));
      console.log('📤 Sent WebSocket message:', message);
      
      // Log to message logger
      if (window.messageLogger) {
        window.messageLogger.addMessage(message, 'outgoing');
      }
    } else {
      console.warn('⚠️ WebSocket not connected, queuing message');
      this.messageQueue.push(data);
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
      console.log('🔌 WebSocket disconnected');
    }
  }

  // Request-response pattern support
  async request(type, data, timeout = 5000) {
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return new Promise((resolve, reject) => {
      // Set timeout
      const timeoutId = setTimeout(() => {
        reject(new Error(`WebSocket request timeout: ${type}`));
      }, timeout);
      
      // Listen for response
      const responseHandler = (response) => {
        if (response.correlationId === requestId) {
          clearTimeout(timeoutId);
          window.messageBus.off(`${type}:response`, responseHandler);
          
          if (response.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      };
      
      if (window.messageBus) {
        window.messageBus.on(`${type}:response`, responseHandler);
      }
      
      // Send request
      this.send({
        type,
        data: {
          ...data,
          requestId
        }
      });
    });
  }

  // Download request helper
  sendDownloadRequest(prompt, targetFolder, filename = null, metadata = {}) {
    const requestId = `download-req-${Date.now()}`;
    
    const message = {
      type: 'imageDownloadRequested',
      data: {
        prompt: prompt,
        targetFolder: targetFolder,
        filename: filename,
        metadata: {
          requestId: requestId,
          priority: metadata.priority || 'normal',
          source: 'chrome-extension',
          ...metadata
        }
      }
    };
    
    console.log('📤 Sending download request:', message);
    this.send(message);
    
    return requestId;
  }

  getStatus() {
    return {
      connected: this.ws && this.ws.readyState === WebSocket.OPEN,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      queueLength: this.messageQueue.length
    };
  }
}

// Create singleton instance
const websocketClient = new WebSocketClient();

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = websocketClient;
} else {
  window.websocketClient = websocketClient;
  
  // Make available in service worker context
  if (typeof self !== 'undefined') {
    self.websocketClient = websocketClient;
  }
}