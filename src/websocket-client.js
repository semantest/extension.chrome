// WebSocket client for server communication
console.log('🔌 WebSocket Client initializing...');

class WebSocketClient {
  constructor() {
    this.ws = null;
    this.reconnectInterval = 5000;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.serverUrl = 'ws://localhost:8080';
    this.isConnected = false;
  }

  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('✅ WebSocket already connected');
      return;
    }

    console.log(`🔌 Connecting to WebSocket server at ${this.serverUrl}...`);
    
    try {
      this.ws = new WebSocket(this.serverUrl);
      
      this.ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send connection acknowledgment
        this.send({
          type: 'CONNECTION_ESTABLISHED',
          source: 'chrome-extension',
          timestamp: Date.now()
        });
      };
      
      this.ws.onmessage = (event) => {
        console.log('📨 WebSocket message received:', event.data);
        
        try {
          const data = JSON.parse(event.data);
          this.handleServerMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnected = false;
      };
      
      this.ws.onclose = () => {
        console.log('🔌 WebSocket disconnected');
        this.isConnected = false;
        this.scheduleReconnect();
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      this.scheduleReconnect();
    }
  }
  
  handleServerMessage(data) {
    console.log('🎨 Processing server message:', data);
    
    // Handle different message types
    if (data.type === 'ImageRequestReceived' || data.action === 'ImageRequestReceived') {
      console.log('🖼️ Image generation request received from server');
      
      // Forward to service worker
      chrome.runtime.sendMessage({
        action: 'ImageRequestReceived',
        data: {
          prompt: data.prompt || data.message || 'Generate an image',
          requestId: data.requestId,
          timestamp: data.timestamp || Date.now()
        }
      }, response => {
        console.log('Response from service worker:', response);
        
        // Send acknowledgment back to server
        this.send({
          type: 'IMAGE_REQUEST_ACKNOWLEDGED',
          requestId: data.requestId,
          success: response?.success || false,
          error: response?.error,
          timestamp: Date.now()
        });
      });
    }
    
    // Handle ping/pong for keepalive
    if (data.type === 'PING') {
      this.send({ type: 'PONG', timestamp: Date.now() });
    }
  }
  
  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const message = typeof data === 'string' ? data : JSON.stringify(data);
      console.log('📤 Sending to server:', message);
      this.ws.send(message);
    } else {
      console.error('❌ WebSocket not connected, cannot send:', data);
    }
  }
  
  scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    console.log(`🔄 Scheduling reconnect attempt ${this.reconnectAttempts} in ${this.reconnectInterval}ms`);
    
    setTimeout(() => {
      this.connect();
    }, this.reconnectInterval);
  }
  
  disconnect() {
    if (this.ws) {
      console.log('👋 Closing WebSocket connection');
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
  
  getStatus() {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts,
      readyState: this.ws ? this.ws.readyState : null
    };
  }
}

// Create global instance
window.websocketClient = new WebSocketClient();

// Auto-connect on load
window.websocketClient.connect();

console.log('✅ WebSocket Client ready');