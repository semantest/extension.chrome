/**
 * WebSocket Manager - Handles WebSocket connections for the extension
 * Extracted from service-worker.js for better separation of concerns
 */

class WebSocketManager {
  constructor(messageLogger) {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.messageLogger = messageLogger;
    this.isConnected = false;
    this.eventHandlers = new Map();
  }

  /**
   * Register an event handler for a specific event type
   */
  registerHandler(eventType, handler) {
    this.eventHandlers.set(eventType, handler);
  }

  /**
   * Connect to the WebSocket server
   */
  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected');
      return Promise.resolve();
    }

    console.log(`Connecting to ${this.serverUrl}...`);
    
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          
          // Send registration
          this.send({
            type: 'semantest/extension/registered',
            data: {
              extensionId: chrome.runtime.id,
              version: chrome.runtime.getManifest().version
            }
          });
          
          // Subscribe to events
          this.subscribe(['semantest/custom/image/download/requested']);
          
          resolve();
        };

        this.ws.onmessage = async (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('📨 WebSocket message:', message);
            
            // Log message
            if (this.messageLogger) {
              this.messageLogger.addMessage(message, 'incoming');
            }
            
            // Handle nested format
            if (message.type === 'event' && message.payload) {
              const eventType = message.payload.type;
              const eventPayload = message.payload.payload;
              
              // Call registered handler if exists
              const handler = this.eventHandlers.get(eventType);
              if (handler) {
                await handler(eventPayload);
              }
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          this.isConnected = false;
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('WebSocket disconnected');
          this.isConnected = false;
          this.ws = null;
          
          // Auto-reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * this.reconnectAttempts;
            console.log(`Reconnecting in ${delay}ms...`);
            setTimeout(() => this.connect(), delay);
          }
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        this.isConnected = false;
        reject(error);
      }
    });
  }

  /**
   * Subscribe to specific event types
   */
  subscribe(eventTypes) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe - WebSocket not connected');
      return;
    }

    const subscribeMessage = {
      id: `sub-${Date.now()}`,
      type: 'subscribe',
      timestamp: Date.now(),
      payload: { eventTypes }
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    console.log('📬 Subscribed to events:', eventTypes);
  }

  /**
   * Send a message through the WebSocket
   */
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = {
        id: `msg-${Date.now()}`,
        type: 'event',
        timestamp: Date.now(),
        payload: {
          type: data.type,
          payload: data.data || data
        }
      };
      
      this.ws.send(JSON.stringify(message));
      
      if (this.messageLogger) {
        this.messageLogger.addMessage(message, 'outgoing');
      }
      
      return true;
    }
    
    console.warn('Cannot send message - WebSocket not connected');
    return false;
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }

  /**
   * Get the current connection status
   */
  getStatus() {
    return {
      connected: this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export for use in service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WebSocketManager;
}