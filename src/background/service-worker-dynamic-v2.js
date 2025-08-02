/**
 * Semantest Extension Service Worker - Dynamic Loading V2
 * Improved handling of tab reloads and addon injection
 */

console.log('🚀 Semantest Service Worker (Dynamic V2) starting...');

// Global state
const extensionState = {
  isActive: true,
  errors: [],
  wsConnected: false,
  messages: [],
  injectedTabs: new Map() // Map of tabId -> injection timestamp
};

// Clean up injection tracking periodically
setInterval(() => {
  const now = Date.now();
  for (const [tabId, timestamp] of extensionState.injectedTabs.entries()) {
    // Remove entries older than 5 minutes
    if (now - timestamp > 5 * 60 * 1000) {
      extensionState.injectedTabs.delete(tabId);
    }
  }
}, 60000); // Every minute

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
    console.log('🔍 Processing WebSocket message:', message.type);
    
    // Handle nested message structure from server
    if (message.type === 'event' && message.payload) {
      const eventType = message.payload.type;
      const eventPayload = message.payload.payload;
      
      console.log('🔍 Event type:', eventType);
      
      if (eventType === 'semantest/custom/image/download/requested') {
        console.log('🎯 Image download request detected!');
        await this.handleImageDownloadRequest(eventPayload);
      }
    }
    
    // Also handle direct message format (for backwards compatibility)
    if (message.type === 'semantest/custom/image/download/requested') {
      await this.handleImageDownloadRequest(message.payload);
    }
  }

  async handleImageDownloadRequest(payload) {
    console.log('📤 Handling image download request:', payload);
    
    // Get all ChatGPT tabs
    const tabs = await chrome.tabs.query({ 
      url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] 
    });
    
    console.log(`📋 Found ${tabs.length} ChatGPT tabs`);
    
    if (tabs.length === 0) {
      console.error('❌ No ChatGPT tabs found');
      return;
    }
    
    // Use the first active ChatGPT tab, or the first one if none are active
    let targetTab = tabs.find(tab => tab.active) || tabs[0];
    
    console.log(`📨 Sending image request to tab ${targetTab.id} (${targetTab.url})`);
    
    // First try a ping to verify bridge is ready
    let bridgeReady = false;
    try {
      const pingResponse = await chrome.tabs.sendMessage(targetTab.id, { type: 'ping' });
      if (pingResponse && pingResponse.bridge === 'active') {
        bridgeReady = true;
        console.log('✅ Bridge verified active');
      }
    } catch (pingError) {
      console.log('⚠️ Bridge not ready, will inject addon');
    }
    
    // If bridge not ready, inject addon first
    if (!bridgeReady) {
      console.log('💉 Injecting addon before sending message...');
      await loadAddonDynamically(targetTab.id, targetTab.url, true);
      // Wait a bit for injection to complete
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Send message to tab
    try {
      await chrome.tabs.sendMessage(targetTab.id, {
        type: 'websocket:message',
        payload: {
          type: 'semantest/custom/image/download/requested',
          payload: payload
        }
      });
      console.log('✅ Message sent to tab');
    } catch (error) {
      console.error('Failed to send message to tab:', error);
      // Try to re-inject the addon
      console.log('Attempting to re-inject addon...');
      await loadAddonDynamically(targetTab.id, targetTab.url, true);
      
      // Retry sending the message after a longer delay
      setTimeout(async () => {
        try {
          // First verify the tab still exists
          const tab = await chrome.tabs.get(targetTab.id).catch(() => null);
          if (!tab) {
            console.error('Tab no longer exists');
            return;
          }
          
          await chrome.tabs.sendMessage(targetTab.id, {
            type: 'websocket:message',
            payload: {
              type: 'semantest/custom/image/download/requested',
              payload: payload
            }
          });
          console.log('✅ Message sent after re-injection');
        } catch (error) {
          console.error('Failed to send message after re-injection:', error);
          // One more attempt with ping first
          try {
            await chrome.tabs.sendMessage(targetTab.id, { type: 'ping' });
            console.log('✅ Ping successful, bridge is ready');
            
            await chrome.tabs.sendMessage(targetTab.id, {
              type: 'websocket:message',
              payload: {
                type: 'semantest/custom/image/download/requested',
                payload: payload
              }
            });
            console.log('✅ Message sent after ping verification');
          } catch (pingError) {
            console.error('Bridge still not ready after re-injection:', pingError);
          }
        }
      }, 3000); // Wait 3 seconds for injection to complete
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
async function loadAddonDynamically(tabId, url, force = false) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Check if this is a ChatGPT domain
    if (!hostname.includes('chat.openai.com') && !hostname.includes('chatgpt.com')) {
      return;
    }
    
    // Check if we've recently injected into this tab (unless forced)
    if (!force) {
      const lastInjection = extensionState.injectedTabs.get(tabId);
      if (lastInjection && Date.now() - lastInjection < 30000) { // 30 seconds
        console.log(`✅ Addon recently injected into tab ${tabId}`);
        return;
      }
    }
    
    console.log(`💉 Loading addon dynamically for tab ${tabId} (force: ${force})`);
    
    // First, check if addon is already injected
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          return window.chatGPTAddonInjected === true;
        },
        world: 'MAIN'
      });
      
      if (results && results[0] && results[0].result === true && !force) {
        console.log(`✅ Addon already injected in tab ${tabId}`);
        extensionState.injectedTabs.set(tabId, Date.now());
        return;
      }
    } catch (error) {
      console.log('Could not check injection status:', error);
    }
    
    // Try to load from REST server
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
      
      // Check if bridge is already injected
      try {
        const bridgeCheck = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            return window.__semantestBridgeInjected === true;
          },
          world: 'ISOLATED'
        });
        
        if (!bridgeCheck || !bridgeCheck[0] || !bridgeCheck[0].result) {
          // Inject bridge first (ISOLATED world for chrome.runtime access)
          await chrome.scripting.executeScript({
            target: { tabId },
            func: () => {
              window.__semantestBridgeInjected = true;
            },
            world: 'ISOLATED'
          });
          
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['src/content/chatgpt-bridge.js'],
            world: 'ISOLATED'
          });
        }
      } catch (error) {
        console.log('Bridge check failed, injecting anyway:', error);
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/chatgpt-bridge.js'],
          world: 'ISOLATED'
        });
      }
      
      // Wait a bit for bridge to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Inject addon files individually to avoid CSP issues
      // ChatGPT's CSP blocks all forms of dynamic code execution (eval, Function, etc)
      // So we need to inject files directly
      
      console.log('💉 Injecting addon files individually...');
      
      // First mark as injected
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          window.chatGPTAddonInjected = true;
        },
        world: 'MAIN'
      });
      
      // Inject bridge helper for MAIN world (if not already injected)
      try {
        const bridgeHelperCheck = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.semantestBridge && window.semantestBridge._initialized,
          world: 'MAIN'
        });
        
        if (!bridgeHelperCheck[0]?.result) {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: ['src/content/bridge-helper.js'],
            world: 'MAIN'
          });
        } else {
          console.log('✅ Bridge helper already initialized, skipping');
        }
      } catch (e) {
        // If check fails, inject anyway
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/bridge-helper.js'],
          world: 'MAIN'
        });
      }
      
      // List of addon files to inject in order
      const addonFiles = [
        'src/addons/chatgpt/state-detector.js',
        'src/addons/chatgpt/controller.js',
        'src/addons/chatgpt/button-clicker.js',
        'src/addons/chatgpt/direct-send.js',
        'src/addons/chatgpt/image-generator.js',
        'src/addons/chatgpt/image-downloader.js',
        'src/addons/chatgpt/queue-manager.js',
        'src/addons/chatgpt/debug-listener.js',
        'src/addons/chatgpt/index.js'
      ];
      
      // Inject each file
      for (const file of addonFiles) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId },
            files: [file],
            world: 'MAIN'
          });
          console.log(`✅ Injected ${file}`);
        } catch (error) {
          console.error(`Failed to inject ${file}:`, error);
        }
      }
      
      // Mark tab as injected with timestamp
      extensionState.injectedTabs.set(tabId, Date.now());
      console.log(`✅ Addon loaded successfully for tab ${tabId}`);
      
      // Verify the bridge is working by sending a ping
      setTimeout(async () => {
        try {
          const pingResponse = await chrome.tabs.sendMessage(tabId, { type: 'ping' });
          console.log('✅ Bridge verified working:', pingResponse);
        } catch (e) {
          console.error('❌ Bridge not responding:', e);
          console.log('Bridge may not be properly connected');
        }
      }, 500);
      
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
      files: ['src/content/chatgpt-bridge.js'],
      world: 'ISOLATED'
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
    
    extensionState.injectedTabs.set(tabId, Date.now());
    console.log('✅ Local addon injected as fallback');
  } catch (error) {
    console.error('Failed to inject local addon:', error);
  }
}

// Tab update listener - inject on navigation changes too
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Inject on both loading and complete states for better reliability
  if ((changeInfo.status === 'loading' || changeInfo.status === 'complete') && tab.url) {
    const urlObj = new URL(tab.url);
    if (urlObj.hostname.includes('chat.openai.com') || urlObj.hostname.includes('chatgpt.com')) {
      // Clear injection tracking on navigation
      if (changeInfo.status === 'loading' && changeInfo.url) {
        extensionState.injectedTabs.delete(tabId);
      }
      // Inject addon
      await loadAddonDynamically(tabId, tab.url);
    }
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
          
        case 'GET_ACTIVE_ADDON':
          // Check for active addons
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tabs.length > 0 && extensionState.injectedTabs.has(tabs[0].id)) {
            response = { 
              success: true, 
              addon: 'ChatGPT',
              tabId: tabs[0].id
            };
          } else {
            response = { success: true, addon: null };
          }
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
  
  // Remove duplicate context menu
  chrome.contextMenus.removeAll(() => {
    // Create context menu
    chrome.contextMenus.create({
      id: 'semantest-send-to-chatgpt',
      title: 'Send to ChatGPT',
      contexts: ['selection']
    });
  });
  
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

// Context menu handler
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

console.log('✅ Semantest Service Worker (Dynamic V2) ready');