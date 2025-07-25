/**
 * Semantest Extension Service Worker
 * Modular architecture with core components and addon system
 */

// Import core components
importScripts(
  '../core/message-bus.js',
  '../core/message-logger.js',
  '../core/addon-manager.js',
  '../core/websocket-client.js'
);

class SemantestServiceWorker {
  constructor() {
    this.extensionState = {
      isActive: true,
      errors: []
    };
    
    this.init();
  }

  async init() {
    console.log('🚀 Initializing Semantest Extension...');
    
    // Initialize core components
    await this.initializeCore();
    
    // Set up event listeners
    this.setupInstallationHandlers();
    this.setupMessageHandlers();
    
    // Initialize WebSocket connection
    this.initWebSocket();
    
    console.log('✅ Semantest Extension initialized');
  }

  async initializeCore() {
    // Initialize addon manager
    if (window.addonManager) {
      await window.addonManager.initialize();
      console.log('✅ Addon Manager initialized');
    }
    
    // Set up core message bus handlers
    if (window.messageBus) {
      // Handle WebSocket messages
      window.messageBus.on('websocket:message', (data) => {
        console.log('📨 WebSocket message received:', data);
        
        // Forward to appropriate addon based on message type
        if (data.type === 'semantest/custom/image/request/received') {
          // Forward to all active addons
          chrome.tabs.query({}, async (tabs) => {
            for (const tab of tabs) {
              const addon = window.addonManager.getActiveAddon(tab.id);
              if (addon && addon.websocket_events.includes(data.type)) {
                await window.addonManager.sendToAddon(tab.id, {
                  type: 'websocket:message',
                  payload: data
                });
              }
            }
          });
        }
      });
      
      // Handle addon lifecycle events
      window.messageBus.on('addon:*', (event, data) => {
        console.log(`🔌 Addon event: ${event}`, data);
      });
    }
  }

  setupInstallationHandlers() {
    chrome.runtime.onInstalled.addListener((details) => {
      console.log('📦 Extension installed:', details);
      
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    chrome.runtime.onStartup.addListener(() => {
      console.log('🔄 Extension started');
    });
  }

  async handleFirstInstall() {
    console.log('🎉 First installation detected');
    
    // Set default settings
    await chrome.storage.sync.set({
      enableNotifications: true,
      enableTelemetry: false,
      installTime: Date.now()
    });
  }

  async handleUpdate(previousVersion) {
    console.log(`📈 Updated from version ${previousVersion}`);
  }

  setupMessageHandlers() {
    // Handle messages from content scripts and popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Message received:', request.action || request.type);
      
      // Handle async responses
      (async () => {
        try {
          let response;
          
          switch (request.action || request.type) {
            case 'GET_MESSAGES':
              response = await this.getMessages(request.filter, request.limit);
              break;
              
            case 'CLEAR_MESSAGES':
              window.messageLogger?.clear();
              response = { success: true };
              break;
              
            case 'GET_ADDONS':
              response = {
                success: true,
                addons: window.addonManager?.getAllAddons() || []
              };
              break;
              
            case 'GET_ACTIVE_ADDON':
              const addon = window.addonManager?.getActiveAddon(sender.tab?.id);
              response = { success: true, addon };
              break;
              
            case 'WEBSOCKET_STATUS':
              response = self.websocketClient?.getStatus() || {
                connected: false,
                serverUrl: 'ws://localhost:3004',
                reconnectAttempts: 0
              };
              break;
              
            case 'WEBSOCKET_CONNECT':
              self.websocketClient?.connect();
              response = { success: true };
              break;
              
            case 'WEBSOCKET_DISCONNECT':
              self.websocketClient?.disconnect();
              response = { success: true };
              break;
              
            // Forward to message bus
            default:
              if (request.type && window.messageBus) {
                window.messageBus.emit(request.type, request.data || request.payload);
                response = { success: true };
              } else {
                response = { success: false, error: 'Unknown action' };
              }
          }
          
          sendResponse(response);
        } catch (error) {
          console.error('Error handling message:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      return true; // Keep message channel open
    });

    // Handle popup connection
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        this.setupPopupConnection(port);
      }
    });
  }

  setupPopupConnection(port) {
    console.log('🔌 Popup connected');
    
    // Set up message listener for popup updates
    if (window.messageLogger) {
      const updateListener = (event, data) => {
        port.postMessage({
          type: 'message-update',
          event,
          data
        });
      };
      
      window.messageLogger.addListener(updateListener);
      
      // Clean up on disconnect
      port.onDisconnect.addListener(() => {
        window.messageLogger.removeListener(updateListener);
        console.log('🔌 Popup disconnected');
      });
    }
    
    // Handle popup messages
    port.onMessage.addListener(async (message) => {
      try {
        let response;
        
        switch (message.action) {
          case 'GET_MESSAGES':
            response = await this.getMessages(message.filter, message.limit);
            break;
            
          case 'GET_STATS':
            response = {
              success: true,
              stats: window.messageLogger?.getStats() || {}
            };
            break;
            
          default:
            response = { success: false, error: 'Unknown popup action' };
        }
        
        port.postMessage(response);
      } catch (error) {
        port.postMessage({ success: false, error: error.message });
      }
    });
  }

  async getMessages(filter, limit) {
    if (!window.messageLogger) {
      return { success: false, error: 'Message logger not available' };
    }
    
    const messages = await window.messageLogger.getMessages(filter, limit);
    return { success: true, messages };
  }

  initWebSocket() {
    console.log('🔌 Initializing WebSocket connection...');
    
    if (self.websocketClient) {
      console.log('✅ WebSocket client available');
      
      // Auto-connect
      self.websocketClient.connect();
      
      // WebSocket messages are automatically forwarded to message bus
      // by the websocket client implementation
    } else {
      console.error('❌ WebSocket client not available');
    }
  }

  handleError(error, context = '') {
    console.error(`Error in ${context}:`, error);
    
    this.extensionState.errors.push({
      error: error.message || error,
      context,
      timestamp: Date.now()
    });
  }
}

// Initialize service worker
const serviceWorker = new SemantestServiceWorker();

// Make it globally available
self.semantestWorker = serviceWorker;

// Keep service worker alive
self.addEventListener('activate', event => {
  console.log('Service worker activated');
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', event => {
  // Keep service worker alive by handling fetch events
  // This is required for Manifest V3
});