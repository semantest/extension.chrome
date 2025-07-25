// WebSocket Handler for ChatGPT Extension
// Connects to local server and handles ImageRequestReceived events

console.log('🔌 WebSocket Handler initializing...');

class WebSocketHandler {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
    this.isConnecting = false;
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
        
        // Send registration message with correct format
        this.send({
          type: 'semantest/extension/registered',
          data: {
            extensionId: chrome.runtime.id,
            version: chrome.runtime.getManifest().version,
            capabilities: ['image-generation', 'chatgpt-automation']
          }
        });
        
        // Subscribe to image request events
        console.log('📬 Subscribing to image events...');
        const subscribeMessage = {
          id: `sub-${Date.now()}`,
          type: 'subscribe',
          timestamp: Date.now(),
          payload: {
            eventTypes: [
              'semantest/custom/image/request/received',
              'imageDownloadCompleted'
            ]
          }
        };
        
        // Send subscription directly (not wrapped in event format)
        this.ws.send(JSON.stringify(subscribeMessage));
        console.log('✅ Subscribed to image events');
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 Received WebSocket message:', message);

          // Handle messages with the correct nested format per QA's findings
          if (message.type === 'event' && message.payload) {
            const eventType = message.payload.type;
            const eventPayload = message.payload.payload;
            
            console.log(`🎯 Event type: ${eventType}`);
            
            // Handle different event types
            switch (eventType) {
              case 'semantest/custom/image/request/received':
                console.log('🖼️ ImageRequestReceived event detected!');
                await this.handleImageRequest(message, eventPayload);
                break;
                
              case 'semantest/custom/image/downloaded':
                console.log('✅ Image downloaded event received');
                await this.handleImageDownloaded(message, eventPayload);
                break;
                
              case 'imageDownloadCompleted':
                console.log('✅ Image download completed');
                await this.handleDownloadCompleted(message, eventPayload);
                break;
                
              default:
                console.log(`📦 Unknown event type: ${eventType}`);
            }
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        this.isConnecting = false;
      };

      this.ws.onclose = (event) => {
        console.log(`🔌 WebSocket disconnected (code: ${event.code})`);
        this.isConnecting = false;
        this.ws = null;

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

  async handleImageRequest(message, eventPayload) {
    try {
      console.log('🎯 Handling ImageRequestReceived event', eventPayload);
      
      // Extract prompt from the event payload
      const prompt = eventPayload?.prompt || 'Generate an image';
      const requestId = eventPayload?.requestId || message.id;
      
      // Get active ChatGPT tab
      const tabs = await chrome.tabs.query({
        url: ['*://chatgpt.com/*', '*://chat.openai.com/*'],
        active: true
      });

      if (tabs.length === 0) {
        // Try any ChatGPT tab, not just active
        const allChatGPTTabs = await chrome.tabs.query({
          url: ['*://chatgpt.com/*', '*://chat.openai.com/*']
        });

        if (allChatGPTTabs.length === 0) {
          console.error('❌ No ChatGPT tab found');
          this.sendResponse(requestId, 'error', 'No ChatGPT tab found');
          return;
        }

        // Use the first available ChatGPT tab
        tabs.push(allChatGPTTabs[0]);
      }

      const tab = tabs[0];
      console.log(`📍 Using ChatGPT tab: ${tab.title} (ID: ${tab.id})`);

      // In service worker context, directly call the handler
      if (typeof self !== 'undefined' && self.backgroundWorker) {
        console.log('📍 Directly calling backgroundWorker.handleImageRequest');
        self.backgroundWorker.handleImageRequest({
          prompt: prompt,
          requestId: requestId,
          metadata: eventPayload?.metadata || {},
          timestamp: Date.now()
        })
        .then(response => {
          console.log('✅ Image request processed successfully:', response);
          this.sendResponse(requestId, 'success', 'Image generation started', response);
        })
        .catch(error => {
          console.error('❌ Image request failed:', error);
          this.sendResponse(requestId, 'error', error.message);
        });
      } else {
        // Fallback: try chrome.runtime.sendMessage (for content script context)
        chrome.runtime.sendMessage({
          action: 'ImageRequestReceived',
          data: {
            prompt: prompt,
            requestId: requestId,
            metadata: eventPayload?.metadata || {},
            timestamp: Date.now()
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('❌ Error forwarding to service worker:', chrome.runtime.lastError);
            this.sendResponse(requestId, 'error', chrome.runtime.lastError.message);
          } else if (response?.success) {
            console.log('✅ Image request processed successfully:', response);
            this.sendResponse(requestId, 'success', 'Image generation started', response);
          } else {
            console.error('❌ Image request failed:', response?.error);
            this.sendResponse(requestId, 'error', response?.error || 'Unknown error', response);
          }
        });
      }

    } catch (error) {
      console.error('❌ Error handling image request:', error);
      this.sendResponse(message.id, 'error', error.message);
    }
  }

  async handleImageDownloaded(message, eventPayload) {
    console.log('📥 Image downloaded event received:', eventPayload);
    
    // Notify the extension that image generation is complete
    chrome.runtime.sendMessage({
      action: 'IMAGE_GENERATION_COMPLETE',
      data: {
        imageUrl: eventPayload?.imageUrl,
        prompt: eventPayload?.prompt,
        requestId: eventPayload?.requestId,
        timestamp: Date.now()
      }
    });
  }

  async handleDownloadCompleted(message, eventPayload) {
    console.log('✅ Download completed:', eventPayload);
    
    // Notify extension about completed download
    chrome.runtime.sendMessage({
      action: 'DOWNLOAD_COMPLETED',
      data: {
        filePath: eventPayload?.filePath,
        prompt: eventPayload?.prompt,
        requestId: eventPayload?.metadata?.requestId,
        success: eventPayload?.success !== false,
        error: eventPayload?.error,
        timestamp: Date.now()
      }
    });
    
    // Show notification if successful
    if (eventPayload?.success !== false && eventPayload?.filePath) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: '/assets/icon48.png',
        title: 'Image Downloaded',
        message: `Saved to: ${eventPayload.filePath}`
      });
    }
  }

  // Method to send download request
  sendDownloadRequest(prompt, targetFolder, filename = null, metadata = {}) {
    const requestId = `download-req-${Date.now()}`;
    
    const message = {
      id: requestId,
      type: 'imageDownloadRequested',
      timestamp: Date.now(),
      payload: {
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
    this.ws.send(JSON.stringify(message));
    
    return requestId;
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Format message according to QA's findings - must use lowercase 'event'
      const message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'event',  // MUST be lowercase per QA
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
    } else {
      console.error('❌ WebSocket not connected, cannot send message');
    }
  }

  sendResponse(messageId, status, message, data = {}) {
    this.send({
      type: 'semantest/custom/image/request/acknowledged',
      data: {
        correlationId: messageId,
        status: status,
        message: message,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
      this.ws.close();
      this.ws = null;
      console.log('🔌 WebSocket disconnected');
    }
  }
}

// Create and export handler instance
const wsHandler = new WebSocketHandler();

// Auto-connect on load
wsHandler.connect();

// Only add message listener if we're not in a service worker that already has one
if (typeof self === 'undefined' || !self.BackgroundServiceWorker) {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'WEBSOCKET_CONNECT') {
      wsHandler.connect();
      sendResponse({ success: true });
    } else if (request.action === 'WEBSOCKET_DISCONNECT') {
      wsHandler.disconnect();
      sendResponse({ success: true });
    } else if (request.action === 'WEBSOCKET_STATUS') {
      sendResponse({
        connected: wsHandler.ws && wsHandler.ws.readyState === WebSocket.OPEN,
        serverUrl: wsHandler.serverUrl,
        reconnectAttempts: wsHandler.reconnectAttempts
      });
    }
    return true;
  });
}

// Export for debugging - check if window exists (not in service worker)
if (typeof window !== 'undefined') {
  window.wsHandler = wsHandler;
} else if (typeof self !== 'undefined') {
  // In service worker context
  self.wsHandler = wsHandler;
}

console.log('🔌 WebSocket Handler ready');