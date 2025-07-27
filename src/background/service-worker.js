/**
 * Semantest Extension Service Worker
 * Simplified version for Chrome Extension Manifest V3
 */

console.log('🚀 Semantest Service Worker starting...');

// Global state
const extensionState = {
  isActive: true,
  errors: [],
  wsConnected: false,
  messages: []
};

// Simple message storage (in-memory for service worker)
const messageLogger = {
  messages: [],
  maxMessages: 100,
  
  addMessage(message, direction = 'incoming') {
    const entry = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      direction,
      type: message.type || 'unknown',
      payload: message.payload || message,
      raw: JSON.stringify(message)
    };
    
    this.messages.push(entry);
    if (this.messages.length > this.maxMessages) {
      this.messages = this.messages.slice(-this.maxMessages);
    }
    
    // Notify popup if connected
    chrome.runtime.sendMessage({
      type: 'message-update',
      event: 'message-added',
      data: entry
    }).catch(() => {
      // Ignore if no listeners
    });
    
    return entry;
  },
  
  getMessages(filter = {}, limit = 50) {
    let filtered = [...this.messages];
    
    if (filter.type) {
      filtered = filtered.filter(msg => msg.type.includes(filter.type));
    }
    
    if (filter.direction) {
      filtered = filtered.filter(msg => msg.direction === filter.direction);
    }
    
    return filtered.slice(-limit);
  },
  
  clear() {
    this.messages = [];
    chrome.runtime.sendMessage({
      type: 'message-update',
      event: 'messages-cleared'
    }).catch(() => {});
  },
  
  getStats() {
    return {
      total: this.messages.length,
      incoming: this.messages.filter(m => m.direction === 'incoming').length,
      outgoing: this.messages.filter(m => m.direction === 'outgoing').length,
      byType: this.messages.reduce((acc, msg) => {
        acc[msg.type] = (acc[msg.type] || 0) + 1;
        return acc;
      }, {})
    };
  }
};

// WebSocket handler
class WebSocketHandler {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      console.log('WebSocket already connected');
      return;
    }

    console.log(`Connecting to ${this.serverUrl}...`);
    
    try {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.onopen = () => {
        console.log('✅ WebSocket connected');
        extensionState.wsConnected = true;
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
        this.ws.send(JSON.stringify({
          id: `sub-${Date.now()}`,
          type: 'subscribe',
          timestamp: Date.now(),
          payload: {
            eventTypes: ['semantest/custom/image/download/requested']
          }
        }));
      };

      this.ws.onmessage = async (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message:', message);
          
          // Log message
          messageLogger.addMessage(message, 'incoming');
          
          // Handle nested format
          if (message.type === 'event' && message.payload) {
            const eventType = message.payload.type;
            const eventPayload = message.payload.payload;
            
            if (eventType === 'semantest/custom/image/download/requested') {
              await this.handleImageDownloadRequest(eventPayload);
            }
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        extensionState.wsConnected = false;
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        extensionState.wsConnected = false;
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
      extensionState.wsConnected = false;
    }
  }

  async handleImageDownloadRequest(payload) {
    console.log('🎨 Handling image download request:', payload);
    
    // Find ChatGPT tabs
    const tabs = await chrome.tabs.query({
      url: ['*://chat.openai.com/*', '*://chatgpt.com/*']
    });
    
    if (tabs.length === 0) {
      console.error('No ChatGPT tabs found');
      return;
    }
    
    const tab = tabs[0];
    console.log(`Found ChatGPT tab: ${tab.id}`);
    
    // Send message to tab with retry
    const sendToTab = async (tabId, message, retries = 3) => {
      for (let i = 0; i < retries; i++) {
        try {
          await chrome.tabs.sendMessage(tabId, message);
          console.log('✅ Message sent to tab successfully');
          return;
        } catch (error) {
          console.warn(`Attempt ${i + 1} failed:`, error.message);
          if (i < retries - 1) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try to inject content script if not already injected
            try {
              await chrome.scripting.executeScript({
                target: { tabId },
                files: ['src/content/chatgpt-bridge.js']
              });
              console.log('Injected bridge script');
            } catch (e) {
              // Script might already be injected
            }
          } else {
            console.error('Failed to send to tab after retries:', error);
          }
        }
      }
    };
    
    await sendToTab(tab.id, {
      type: 'websocket:message',
      payload: {
        type: 'semantest/custom/image/download/requested',
        payload: payload
      }
    });
  }

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
      messageLogger.addMessage(message, 'outgoing');
    }
  }

  disconnect() {
    if (this.ws) {
      this.reconnectAttempts = this.maxReconnectAttempts;
      this.ws.close();
      this.ws = null;
    }
  }

  getStatus() {
    return {
      connected: this.ws && this.ws.readyState === WebSocket.OPEN,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create WebSocket instance
const wsHandler = new WebSocketHandler();

// Installation handlers
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed:', details);
  
  if (details.reason === 'install') {
    chrome.storage.sync.set({
      enableNotifications: true,
      installTime: Date.now()
    });
  }
  
  // Start WebSocket connection
  wsHandler.connect();
});

// Startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  wsHandler.connect();
});

// Message handlers
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request.action || request.type);
  
  (async () => {
    try {
      let response;
      
      switch (request.action || request.type) {
        case 'GET_MESSAGES':
          response = {
            success: true,
            messages: messageLogger.getMessages(request.filter, request.limit)
          };
          break;
          
        case 'CLEAR_MESSAGES':
          messageLogger.clear();
          response = { success: true };
          break;
          
        case 'GET_STATS':
          response = {
            success: true,
            stats: messageLogger.getStats()
          };
          break;
          
        case 'WEBSOCKET_STATUS':
          response = wsHandler.getStatus();
          break;
          
        case 'WEBSOCKET_CONNECT':
          wsHandler.connect();
          response = { success: true };
          break;
          
        case 'WEBSOCKET_DISCONNECT':
          wsHandler.disconnect();
          response = { success: true };
          break;
          
        case 'GET_ACTIVE_ADDON':
          // Get the active tab if not sent from a tab
          let checkUrl = sender.tab?.url;
          
          if (!checkUrl) {
            // Get the active tab
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tabs.length > 0) {
              checkUrl = tabs[0].url;
            }
          }
          
          if (checkUrl) {
            const url = new URL(checkUrl);
            if (url.hostname.includes('chat.openai.com') || url.hostname.includes('chatgpt.com')) {
              response = {
                success: true,
                addon: {
                  addon_id: 'chatgpt_addon',
                  name: 'ChatGPT Integration'
                }
              };
            } else {
              response = { success: true, addon: null };
            }
          } else {
            response = { success: true, addon: null };
          }
          break;
          
        case 'addon:response':
          // Handle response from addon (image generation result)
          console.log('📨 Received addon response:', request);
          
          // Forward the response back to WebSocket
          if (wsHandler && wsHandler.ws && wsHandler.ws.readyState === WebSocket.OPEN) {
            // Check if this is a download completion
            if (request.result && request.result.downloaded) {
              wsHandler.send({
                type: 'semantest/custom/image/downloaded',
                data: {
                  success: true,
                  path: request.result.path || request.result.filename,
                  filename: request.result.filename,
                  size: request.result.size,
                  timestamp: request.result.timestamp
                }
              });
            } else {
              // Generic response
              wsHandler.send({
                type: 'semantest/custom/image/response',
                data: {
                  success: request.success,
                  result: request.result,
                  error: request.error
                }
              });
            }
          }
          
          response = { success: true };
          break;
          
        default:
          response = { success: false, error: 'Unknown action' };
      }
      
      sendResponse(response);
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ success: false, error: error.message });
    }
  })();
  
  return true;
});

// Popup connection handler
chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'popup') {
    console.log('Popup connected');
    
    // Send current messages
    port.postMessage({
      type: 'messages-loaded',
      messages: messageLogger.getMessages()
    });
    
    port.onMessage.addListener(async (message) => {
      let response;
      
      switch (message.action) {
        case 'GET_MESSAGES':
          response = {
            success: true,
            messages: messageLogger.getMessages(message.filter, message.limit)
          };
          break;
          
        case 'GET_STATS':
          response = {
            success: true,
            stats: messageLogger.getStats()
          };
          break;
          
        default:
          response = { success: false, error: 'Unknown action' };
      }
      
      port.postMessage(response);
    });
  }
});

// Tab update handler - inject addon when ChatGPT loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const url = new URL(tab.url);
    
    if (url.hostname.includes('chat.openai.com') || url.hostname.includes('chatgpt.com')) {
      console.log('ChatGPT tab loaded, injecting addon...');
      
      try {
        // First inject the bridge as a content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/chatgpt-bridge.js']
        });
        
        // Then inject addon files into MAIN world
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [
            'src/addons/chatgpt/state-detector.js',
            'src/addons/chatgpt/controller.js',
            'src/addons/chatgpt/button-clicker.js',
            'src/addons/chatgpt/direct-send.js',
            'src/addons/chatgpt/image-generator.js',
            'src/addons/chatgpt/image-downloader.js',
            'src/addons/chatgpt/debug-tools.js',
            'src/addons/chatgpt/test-slash-command.js',
            'src/addons/chatgpt/tools-menu-helper.js',
            'src/addons/chatgpt/simple-test.js',
            'src/addons/chatgpt/emergency-fix.js',
            'src/addons/chatgpt/index.js'
          ],
          world: 'MAIN'
        });
        
        console.log('✅ ChatGPT addon and bridge injected');
      } catch (error) {
        console.error('Failed to inject addon:', error);
      }
    }
  }
});

// Keep service worker alive
self.addEventListener('activate', event => {
  console.log('Service worker activated');
  event.waitUntil(clients.claim());
});

// Start WebSocket connection
wsHandler.connect();

console.log('✅ Semantest Service Worker ready');