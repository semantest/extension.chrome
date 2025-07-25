// Browser extension background script using Semantest SDK
// Handles communication with Semantest server via SDK client

import { SemantestClient, ClientOptions } from '@semantest/client';
import { BaseEvent, EventMetadata } from '@semantest/core';

// Configuration
const DEFAULT_SERVER_URL = 'ws://localhost:8080';
const EXTENSION_ID = chrome.runtime.id;

// Global client instance
let client: SemantestClient | null = null;

// Connection status for UI
let connectionStatus = {
  connected: false,
  connecting: false,
  serverUrl: DEFAULT_SERVER_URL,
  lastMessage: 'None',
  lastError: '',
  autoReconnect: true
};

// Initialize client with browser-specific metadata
function initializeClient(serverUrl: string = DEFAULT_SERVER_URL): void {
  if (client) {
    client.disconnect();
  }

  const options: ClientOptions = {
    url: serverUrl,
    reconnect: connectionStatus.autoReconnect,
    reconnectInterval: 2000,
    reconnectMaxAttempts: 10,
    timeout: 30000,
    defaultMetadata: {
      source: 'browser-extension',
      browser: {
        name: 'Chrome',
        version: navigator.userAgent.match(/Chrome\/([0-9.]+)/)?.[1] || 'unknown',
        platform: navigator.platform,
        userAgent: navigator.userAgent
      },
      custom: {
        extensionId: EXTENSION_ID,
        extensionVersion: chrome.runtime.getManifest().version
      }
    }
  };

  client = new SemantestClient(options);

  // Set up event handlers
  setupEventHandlers();

  // Connect to server
  connectionStatus.connecting = true;
  connectionStatus.serverUrl = serverUrl;
  updateConnectionStatus();

  client.connect().catch(error => {
    console.error('Failed to connect:', error);
    connectionStatus.lastError = error.message;
    updateConnectionStatus();
  });
}

// Set up SDK event handlers
function setupEventHandlers(): void {
  if (!client) return;

  // Connection events
  (client as any).on('connected', () => {
    console.log('✅ Connected to Semantest server');
    connectionStatus.connected = true;
    connectionStatus.connecting = false;
    connectionStatus.lastError = '';
    updateConnectionStatus();

    // Register extension capabilities
    client!.send('extension.ready', {
      extensionId: EXTENSION_ID,
      version: chrome.runtime.getManifest().version,
      capabilities: ['automation', 'monitoring', 'testing']
    });
  });

  (client as any).on('disconnected', () => {
    console.log('❌ Disconnected from server');
    connectionStatus.connected = false;
    connectionStatus.connecting = false;
    updateConnectionStatus();
  });

  (client as any).on('error', (error: Error) => {
    console.error('WebSocket error:', error);
    connectionStatus.lastError = error.message;
    updateConnectionStatus();
  });

  // Subscribe to test events
  client.subscribe('test.*', handleTestEvent);
  
  // Subscribe to browser automation events
  client.subscribe('browser.*', handleBrowserEvent);
  
  // Subscribe to system events
  client.subscribe('system.*', handleSystemEvent);
}

// Handle test-related events
function handleTestEvent(event: BaseEvent): void {
  console.log('Test event:', event.type, event.payload);
  connectionStatus.lastMessage = `Test: ${event.type}`;
  updateConnectionStatus();

  // Forward to content scripts if needed
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      if (tab.id && tab.url?.includes('chatgpt.com')) {
        chrome.tabs.sendMessage(tab.id, {
          type: 'TEST_EVENT',
          event
        });
      }
    });
  });
}

// Handle browser automation events
function handleBrowserEvent(event: BaseEvent): void {
  console.log('Browser event:', event.type, event.payload);
  connectionStatus.lastMessage = `Browser: ${event.type}`;
  updateConnectionStatus();

  switch (event.type) {
    case 'browser.navigate':
      handleNavigate(event.payload as any);
      break;
    case 'browser.click':
      handleClick(event.payload as any);
      break;
    case 'browser.input':
      handleInput(event.payload as any);
      break;
    case 'browser.screenshot':
      handleScreenshot(event.payload as any);
      break;
  }
}

// Handle system events
function handleSystemEvent(event: BaseEvent): void {
  console.log('System event:', event.type, event.payload);
  
  if (event.type === 'system.ping') {
    // Respond to ping
    client?.send('system.pong', {
      timestamp: Date.now(),
      extensionId: EXTENSION_ID
    });
  }
}

// Browser automation handlers
async function handleNavigate(payload: { url: string; tabId?: number }): Promise<void> {
  try {
    if (payload.tabId) {
      await chrome.tabs.update(payload.tabId, { url: payload.url });
    } else {
      await chrome.tabs.create({ url: payload.url });
    }
    
    client?.send('browser.navigated', {
      url: payload.url,
      success: true
    });
  } catch (error) {
    client?.send('browser.error', {
      action: 'navigate',
      error: error instanceof Error ? error.message : 'Navigation failed'
    });
  }
}

async function handleClick(payload: { tabId: number; selector: string }): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: payload.tabId },
      func: (selector: string) => {
        const element = document.querySelector(selector);
        if (element instanceof HTMLElement) {
          element.click();
          return true;
        }
        throw new Error(`Element not found: ${selector}`);
      },
      args: [payload.selector]
    });
    
    client?.send('browser.clicked', {
      selector: payload.selector,
      success: true
    });
  } catch (error) {
    client?.send('browser.error', {
      action: 'click',
      error: error instanceof Error ? error.message : 'Click failed'
    });
  }
}

async function handleInput(payload: { tabId: number; selector: string; value: string }): Promise<void> {
  try {
    await chrome.scripting.executeScript({
      target: { tabId: payload.tabId },
      func: (selector: string, value: string) => {
        const element = document.querySelector(selector);
        if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
          element.value = value;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          return true;
        }
        throw new Error(`Input element not found: ${selector}`);
      },
      args: [payload.selector, payload.value]
    });
    
    client?.send('browser.inputted', {
      selector: payload.selector,
      value: payload.value,
      success: true
    });
  } catch (error) {
    client?.send('browser.error', {
      action: 'input',
      error: error instanceof Error ? error.message : 'Input failed'
    });
  }
}

async function handleScreenshot(payload: { tabId?: number }): Promise<void> {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab();
    
    client?.send('browser.screenshot', {
      dataUrl,
      timestamp: Date.now(),
      success: true
    });
  } catch (error) {
    client?.send('browser.error', {
      action: 'screenshot',
      error: error instanceof Error ? error.message : 'Screenshot failed'
    });
  }
}

// Update connection status for popup UI
function updateConnectionStatus(): void {
  chrome.storage.local.set({ connectionStatus });
}

// Message handler for extension communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received:', message.type, 'from:', sender.tab?.id || 'extension');

  switch (message.type) {
    case 'CONNECT':
      initializeClient(message.serverUrl || DEFAULT_SERVER_URL);
      sendResponse({ success: true });
      break;

    case 'DISCONNECT':
      client?.disconnect();
      client = null;
      connectionStatus.connected = false;
      connectionStatus.connecting = false;
      updateConnectionStatus();
      sendResponse({ success: true });
      break;

    case 'GET_STATUS':
      sendResponse({ status: connectionStatus });
      break;

    case 'SEND_EVENT':
      if (client?.isConnected()) {
        client.send(message.eventType, message.payload, message.metadata)
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
      } else {
        sendResponse({ success: false, error: 'Not connected' });
      }
      break;

    case 'REQUEST':
      if (client?.isConnected()) {
        client.request(message.method, message.payload)
          .then(response => sendResponse({ success: true, data: response }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
      } else {
        sendResponse({ success: false, error: 'Not connected' });
      }
      break;

    default:
      sendResponse({ success: false, error: 'Unknown message type' });
  }
});

// Initialize on extension load
initializeClient();

// Handle extension install/update
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed/updated:', details.reason);
  
  if (client?.isConnected()) {
    client.send('extension.installed', {
      reason: details.reason,
      previousVersion: details.previousVersion
    });
  }
});

// Cleanup on extension unload
if (chrome.runtime.onSuspend) {
  chrome.runtime.onSuspend.addListener(() => {
    client?.disconnect();
  });
}