// Server connector using fetch for polling
console.log('🔌 Server Connector initializing...');

class ServerConnector {
  constructor() {
    this.serverUrl = 'http://localhost:8080';
    this.polling = false;
    this.pollInterval = 1000; // 1 second
    this.isConnected = false;
  }

  async startPolling() {
    if (this.polling) {
      console.log('✅ Already polling');
      return;
    }

    this.polling = true;
    console.log('🔄 Starting server polling...');
    
    while (this.polling) {
      try {
        await this.checkForMessages();
      } catch (error) {
        console.error('❌ Polling error:', error);
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, this.pollInterval));
    }
  }

  async checkForMessages() {
    try {
      // Check for pending messages from server
      const response = await fetch(`${this.serverUrl}/messages`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'chrome-extension'
        }
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const messages = await response.json();
      
      if (messages && messages.length > 0) {
        console.log('📨 Received messages from server:', messages);
        
        for (const message of messages) {
          await this.handleServerMessage(message);
        }
      }
      
      this.isConnected = true;
      
    } catch (error) {
      this.isConnected = false;
      console.error('Failed to poll server:', error);
    }
  }

  async handleServerMessage(message) {
    console.log('🎨 Processing server message:', message);
    
    // Handle image generation requests
    if (message.type === 'ImageRequestReceived' || message.action === 'generate-image') {
      console.log('🖼️ Image generation request received from server');
      
      // Forward to service worker
      chrome.runtime.sendMessage({
        action: 'ImageRequestReceived',
        data: {
          prompt: message.prompt || message.text || 'Generate an image',
          requestId: message.id || message.requestId,
          timestamp: message.timestamp || Date.now()
        }
      }, async response => {
        console.log('Response from service worker:', response);
        
        // Send acknowledgment back to server
        await this.sendAcknowledgment(message.id || message.requestId, response);
      });
    }
  }

  async sendAcknowledgment(requestId, response) {
    try {
      await fetch(`${this.serverUrl}/acknowledge`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestId: requestId,
          success: response?.success || false,
          error: response?.error,
          timestamp: Date.now()
        })
      });
    } catch (error) {
      console.error('Failed to send acknowledgment:', error);
    }
  }

  async sendMessage(data) {
    try {
      const response = await fetch(`${this.serverUrl}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to send message to server:', error);
      throw error;
    }
  }

  stopPolling() {
    console.log('🛑 Stopping server polling');
    this.polling = false;
  }

  getStatus() {
    return {
      connected: this.isConnected,
      serverUrl: this.serverUrl,
      polling: this.polling
    };
  }
}

// Export for service worker
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ServerConnector;
}