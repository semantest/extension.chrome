/**
 * Semantest Extension Service Worker - Dynamic Addon Loading
 * Phase 1: Load addons from REST server
 */

console.log('🚀 Semantest Service Worker (Dynamic) starting...');

// Import dynamic addon manager
importScripts('../core/addon-manager-dynamic.js');
importScripts('../core/message-bus.js');

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
    
    this.ws = new WebSocket(this.serverUrl);
    
    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      extensionState.wsConnected = true;
      this.reconnectAttempts = 0;
      
      chrome.action.setBadgeText({ text: '' });
      chrome.action.setBadgeBackgroundColor({ color: '#00AA00' });
    };
    
    this.ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📨 WebSocket message:', message);
        
        messageLogger.addMessage(message, 'incoming');
        
        await this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('Failed to process WebSocket message:', error);
      }
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      extensionState.wsConnected = false;
    };
    
    this.ws.onclose = () => {
      console.log('WebSocket disconnected');
      extensionState.wsConnected = false;
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`Reconnecting in ${this.reconnectDelay}ms... (attempt ${this.reconnectAttempts})`);
        setTimeout(() => this.connect(), this.reconnectDelay);
        this.reconnectDelay *= 2;
      }
    };
  }

  async handleWebSocketMessage(message) {
    const { type, payload } = message;
    
    if (type === 'semantest/custom/image/download/requested') {
      await this.handleImageDownloadRequest(payload);
    }
  }

  async handleImageDownloadRequest(payload) {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      console.error('No active tab found');
      return;
    }
    
    // Forward to active tab's addon
    await dynamicAddonManager.sendToAddon(tab.id, {
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
      success: true,
      connected: extensionState.wsConnected,
      serverUrl: this.serverUrl,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Create WebSocket handler instance
const wsHandler = new WebSocketHandler();

// Installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);
  
  // Initialize dynamic addon manager
  try {
    await dynamicAddonManager.initialize();
    console.log('✅ Dynamic addon manager initialized');
  } catch (error) {
    console.error('Failed to initialize addon manager:', error);
  }
  
  // Start WebSocket connection
  wsHandler.connect();
});

// Startup handler
chrome.runtime.onStartup.addListener(async () => {
  console.log('Extension started');
  
  // Initialize dynamic addon manager
  try {
    await dynamicAddonManager.initialize();
    console.log('✅ Dynamic addon manager initialized on startup');
  } catch (error) {
    console.error('Failed to initialize addon manager:', error);
  }
  
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
          
        case 'SEND_MESSAGE':
          wsHandler.send(request.data);
          response = { success: true };
          break;
          
        case 'REFRESH_ADDONS':
          const addons = await dynamicAddonManager.refreshRemoteAddons();
          response = { success: true, addons };
          break;
          
        case 'GET_ADDONS':
          response = {
            success: true,
            addons: dynamicAddonManager.getAllAddons()
          };
          break;
          
        case 'addon:response':
          // Forward addon responses to WebSocket
          wsHandler.send({
            type: 'addon:response',
            data: request
          });
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
  
  return true; // Keep message channel open for async response
});

// Context menu handler
chrome.contextMenus.create({
  id: 'semantest-send-to-chatgpt',
  title: 'Send to ChatGPT',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'semantest-send-to-chatgpt' && info.selectionText) {
    // Forward to active addon
    dynamicAddonManager.sendToAddon(tab.id, {
      type: 'context-menu:send-text',
      text: info.selectionText
    });
  }
});

// Keep service worker alive
self.addEventListener('activate', event => {
  console.log('Service worker activated');
  event.waitUntil(clients.claim());
});

// Initialize on first load
(async () => {
  try {
    await dynamicAddonManager.initialize();
    console.log('✅ Dynamic addon manager initialized on load');
  } catch (error) {
    console.error('Failed to initialize addon manager:', error);
  }
  
  // Start WebSocket connection
  wsHandler.connect();
})();

console.log('✅ Semantest Service Worker (Dynamic) ready');