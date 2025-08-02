/**
 * Semantest Extension Service Worker - Fixed Dynamic Loading
 * Simplified version with proper error handling
 */

console.log('🚀 Semantest Service Worker (Fixed) starting...');

// Global state
const extensionState = {
  isActive: true,
  errors: [],
  wsConnected: false,
  messages: [],
  injectedTabs: new Set() // Track tabs where we've injected scripts
};

// Simple message storage
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
  },
  
  getStats() {
    return {
      total: this.messages.length,
      incoming: this.messages.filter(m => m.direction === 'incoming').length,
      outgoing: this.messages.filter(m => m.direction === 'outgoing').length
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
    
    // Send message to tab
    try {
      await chrome.tabs.sendMessage(tab.id, {
        type: 'websocket:message',
        payload: {
          type: 'semantest/custom/image/download/requested',
          payload: payload
        }
      });
    } catch (error) {
      console.error('Failed to send message to tab:', error);
    }
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

// Dynamic addon loading
async function loadAddonDynamically(tabId, url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check if this is a ChatGPT domain
    if (!hostname.includes('chat.openai.com') && !hostname.includes('chatgpt.com')) {
      return;
    }
    
    // Check if we've already injected into this tab
    if (extensionState.injectedTabs.has(tabId)) {
      console.log(`✅ Addon already injected into tab ${tabId}`);
      return;
    }
    
    console.log(`💉 Loading addon dynamically for tab ${tabId}`);
    
    // First, try to load from REST server
    try {
      const manifestResponse = await fetch('http://localhost:3003/api/addons/chatgpt/manifest');
      if (!manifestResponse.ok) {
        throw new Error(`Failed to fetch manifest: ${manifestResponse.status}`);
      }
      
      const manifest = await manifestResponse.json();
      console.log(`📋 Loaded manifest for ${manifest.addon_id}`);
      
      // Fetch the bundle
      const bundleResponse = await fetch('http://localhost:3003/api/addons/chatgpt/bundle');
      if (!bundleResponse.ok) {
        throw new Error(`Failed to fetch bundle: ${bundleResponse.status}`);
      }
      
      const bundle = await bundleResponse.text();
      console.log(`📦 Loaded bundle (${bundle.length} bytes)`);
      
      // Inject bridge first (ISOLATED world for chrome.runtime access)
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/chatgpt-bridge.js'],
        world: 'ISOLATED'
      });
      
      // Wait a bit for bridge to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Inject the bundled addon code
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (bundleCode) => {
          // Check if already injected
          if (window.chatGPTAddonInjected) {
            console.log('✅ ChatGPT addon already injected');
            return;
          }
          
          // Mark as injected
          window.chatGPTAddonInjected = true;
          
          // Create script element
          const script = document.createElement('script');
          script.textContent = bundleCode;
          script.id = 'chatgpt-addon-bundle';
          document.head.appendChild(script);
          script.remove();
          
          console.log('✅ ChatGPT addon injected dynamically');
        },
        args: [bundle],
        world: 'MAIN'
      });
      
      // Mark tab as injected
      extensionState.injectedTabs.add(tabId);
      console.log(`✅ Addon loaded successfully for tab ${tabId}`);
      
    } catch (error) {
      console.error('Failed to load addon dynamically:', error);
      console.log('📦 Falling back to local addon loading...');
      
      // Fallback to local addon injection
      await injectLocalAddon(tabId);
    }
    
  } catch (error) {
    console.error('Error in loadAddonDynamically:', error);
  }
}

// Fallback local addon injection
async function injectLocalAddon(tabId) {
  try {
    // Inject bridge
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/chatgpt-bridge.js']
    });
    
    // Inject addon files
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [
        'src/addons/chatgpt/state-detector.js',
        'src/addons/chatgpt/controller.js',
        'src/addons/chatgpt/button-clicker.js',
        'src/addons/chatgpt/direct-send.js',
        'src/addons/chatgpt/image-generator.js',
        'src/addons/chatgpt/image-downloader.js',
        'src/addons/chatgpt/queue-manager.js',
        'src/addons/chatgpt/index.js'
      ],
      world: 'MAIN'
    });
    
    extensionState.injectedTabs.add(tabId);
    console.log('✅ Local addon injected as fallback');
  } catch (error) {
    console.error('Failed to inject local addon:', error);
  }
}

// Tab update listener
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    await loadAddonDynamically(tabId, tab.url);
  }
});

// Tab removal listener
chrome.tabs.onRemoved.addListener((tabId) => {
  extensionState.injectedTabs.delete(tabId);
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

// Installation handler
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Extension installed:', details.reason);
  
  // Check existing tabs
  const tabs = await chrome.tabs.query({});
  for (const tab of tabs) {
    if (tab.url && (tab.url.includes('chat.openai.com') || tab.url.includes('chatgpt.com'))) {
      await loadAddonDynamically(tab.id, tab.url);
    }
  }
  
  // Start WebSocket connection
  wsHandler.connect();
});

// Startup handler
chrome.runtime.onStartup.addListener(() => {
  console.log('Extension started');
  wsHandler.connect();
});

// Context menu
chrome.contextMenus.create({
  id: 'semantest-send-to-chatgpt',
  title: 'Send to ChatGPT',
  contexts: ['selection']
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'semantest-send-to-chatgpt' && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
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

// Start WebSocket connection
wsHandler.connect();

console.log('✅ Semantest Service Worker (Fixed) ready');