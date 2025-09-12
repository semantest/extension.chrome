/**
 * Background Service Worker with Redux Integration
 * Event-driven WebSocket management for SEMANTEST Chrome Extension
 */

import { store } from './store';
import * as EventActions from './store/events/eventActions';

// Store reference for debugging
(globalThis as any).reduxStore = store;

// Initialize extension
function initialize() {
  console.log('🚀 SEMANTEST Background Service Worker Starting');
  
  // Dispatch initialization event
  store.dispatch(EventActions.extensionInitialized('2.0.0'));
  
  // Connect to WebSocket through Redux middleware
  store.dispatch({ type: 'WEBSOCKET_CONNECT' });
  
  // Subscribe to state changes
  subscribeToStateChanges();
  
  // Set up Chrome listeners
  setupChromeListeners();
  
  console.log('✅ SEMANTEST Background Service Worker Ready');
}

/**
 * Subscribe to Redux state changes
 */
function subscribeToStateChanges() {
  let previousState = store.getState();
  
  store.subscribe(() => {
    const currentState = store.getState();
    
    // Handle connection state changes
    if (previousState.connection.isConnected !== currentState.connection.isConnected) {
      handleConnectionChange(currentState.connection.isConnected);
    }
    
    // Handle ChatGPT tab state changes
    if (previousState.chatGPTTab.state !== currentState.chatGPTTab.state) {
      handleTabStateChange(currentState.chatGPTTab);
    }
    
    // Handle queue changes
    if (previousState.queue.items.length !== currentState.queue.items.length) {
      handleQueueChange(currentState.queue);
    }
    
    // Handle completed generations
    if (previousState.currentGeneration.status !== currentState.currentGeneration.status &&
        currentState.currentGeneration.status === 'completed') {
      handleGenerationCompleted(currentState.currentGeneration);
    }
    
    previousState = currentState;
  });
}

/**
 * Handle WebSocket connection changes
 */
function handleConnectionChange(isConnected: boolean) {
  console.log(`🔌 WebSocket ${isConnected ? 'connected' : 'disconnected'}`);
  
  // Update extension badge
  updateBadge(isConnected);
  
  // Notify all tabs about connection status
  broadcastToTabs({
    type: 'CONNECTION_STATUS',
    connected: isConnected
  });
}

/**
 * Handle ChatGPT tab state changes
 */
function handleTabStateChange(tabState: any) {
  console.log(`📑 ChatGPT tab state: ${tabState.state}`);
  
  // If tab is ready and we have queued items, process them
  if (tabState.state === 'ready') {
    const queueState = store.getState().queue;
    if (queueState.items.length > 0 && !queueState.isProcessing) {
      processNextInQueue();
    }
  }
}

/**
 * Handle queue changes
 */
function handleQueueChange(queueState: any) {
  console.log(`📋 Queue updated: ${queueState.items.length} items`);
  
  // Update badge with queue count
  if (queueState.items.length > 0) {
    chrome.action.setBadgeText({ text: queueState.items.length.toString() });
    chrome.action.setBadgeBackgroundColor({ color: '#FF6B6B' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

/**
 * Handle completed generation
 */
function handleGenerationCompleted(generation: any) {
  console.log('✅ Generation completed:', generation);
  
  // Show notification
  if (generation.type === 'image' && generation.result?.imageUrl) {
    chrome.notifications.create({
      type: 'image',
      iconUrl: '/assets/icon128.png',
      title: 'Image Generated!',
      message: 'Your AI image has been generated successfully',
      imageUrl: generation.result.imageUrl
    });
  }
  
  // Broadcast to tabs
  broadcastToTabs({
    type: 'GENERATION_COMPLETED',
    generation
  });
}

/**
 * Process next item in queue
 */
async function processNextInQueue() {
  const state = store.getState();
  const nextItem = state.queue.items.find((item: any) => item.status === 'pending');
  
  if (!nextItem) {
    console.log('No pending items in queue');
    return;
  }
  
  console.log('Processing queue item:', nextItem);
  store.dispatch(EventActions.queueProcessingStarted());
  
  // Find or create ChatGPT tab
  const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
  
  if (tabs.length > 0) {
    // Use existing tab
    const tab = tabs[0];
    await chrome.tabs.update(tab.id!, { active: true });
    await injectPromptInTab(tab.id!, nextItem);
  } else {
    // Create new tab
    const newTab = await chrome.tabs.create({ url: 'https://chatgpt.com' });
    
    // Wait for tab to load
    chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
      if (tabId === newTab.id && info.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        // Give ChatGPT time to initialize
        setTimeout(() => {
          injectPromptInTab(newTab.id!, nextItem);
        }, 3000);
      }
    });
  }
}

/**
 * Inject prompt into ChatGPT tab
 */
async function injectPromptInTab(tabId: number, queueItem: any) {
  console.log('✍️ Injecting prompt in tab', tabId);
  
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (prompt: string, correlationId: string) => {
        // This runs in the context of the ChatGPT page
        const checkAndType = () => {
          const textarea = document.querySelector('textarea[placeholder*="Send a message"]') as HTMLTextAreaElement;
          const button = document.querySelector('button[data-testid="send-button"]') as HTMLButtonElement;
          
          if (!textarea || !button) {
            setTimeout(checkAndType, 500);
            return;
          }
          
          // Set the prompt
          textarea.value = prompt;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          
          // Click submit button
          setTimeout(() => {
            if (!button.disabled) {
              button.click();
              console.log('Prompt submitted:', prompt);
              
              // Notify extension that prompt was submitted
              chrome.runtime.sendMessage({
                type: 'PROMPT_SUBMITTED',
                correlationId,
                prompt
              });
            }
          }, 500);
        };
        
        checkAndType();
      },
      args: [queueItem.prompt, queueItem.correlationId]
    });
    
    // Update queue item status
    store.dispatch(EventActions.promptProcessing(queueItem.correlationId));
    
  } catch (error) {
    console.error('Failed to inject prompt:', error);
    store.dispatch(EventActions.promptFailed(
      queueItem.correlationId,
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}

/**
 * Set up Chrome runtime listeners
 */
function setupChromeListeners() {
  // Handle messages from content scripts and popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Background received message:', message);
    
    switch (message.type) {
      case 'GENERATE_IMAGE':
        const imageId = generateCorrelationId('img');
        store.dispatch(EventActions.imageGenerationRequested(
          message.prompt || '',
          imageId
        ));
        sendResponse({ success: true, correlationId: imageId });
        break;
        
      case 'SUBMIT_PROMPT':
        const promptId = generateCorrelationId('prompt');
        store.dispatch(EventActions.promptSubmitted(
          message.prompt || '',
          promptId
        ));
        sendResponse({ success: true, correlationId: promptId });
        break;
        
      case 'PROMPT_SUBMITTED':
        // From content script after successful submission
        store.dispatch(EventActions.promptProcessing(message.correlationId));
        break;
        
      case 'GET_STATE':
        sendResponse({
          success: true,
          state: store.getState()
        });
        break;
        
      case 'GET_WS_STATUS':
        const state = store.getState();
        sendResponse({
          connected: state.connection.isConnected
        });
        break;
        
      case 'CONNECT_WEBSOCKET':
        store.dispatch({ type: 'WEBSOCKET_CONNECT' });
        sendResponse({ status: 'connecting' });
        break;
        
      case 'CHATGPT_STATE_CHANGE':
        // From content script monitoring ChatGPT
        store.dispatch(EventActions.tabStateChanged(
          sender.tab?.id || 0,
          message.state
        ));
        break;
        
      default:
        console.log('Unknown message type:', message.type);
        sendResponse({ success: false, error: 'Unknown message type' });
    }
    
    return true; // Keep channel open for async response
  });
  
  // Handle tab events
  chrome.tabs.onRemoved.addListener((tabId) => {
    const state = store.getState();
    if (state.chatGPTTab.tabId === tabId) {
      store.dispatch(EventActions.chatGPTTabClosed(tabId));
    }
  });
  
  // Handle extension installation
  chrome.runtime.onInstalled.addListener(() => {
    console.log('🚀 SEMANTEST Extension installed');
    store.dispatch(EventActions.extensionInstalled());
  });
  
  // Handle extension startup
  chrome.runtime.onStartup.addListener(() => {
    console.log('🚀 SEMANTEST Extension starting up');
    initialize();
  });
}

/**
 * Update extension badge
 */
function updateBadge(isConnected: boolean) {
  if (isConnected) {
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    chrome.action.setBadgeText({ text: '✓' });
  } else {
    chrome.action.setBadgeBackgroundColor({ color: '#F44336' });
    chrome.action.setBadgeText({ text: '!' });
  }
}

/**
 * Broadcast message to all tabs
 */
function broadcastToTabs(message: any) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, message).catch(() => {
          // Tab might not have content script loaded
        });
      }
    });
  });
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Keep service worker alive
setInterval(() => {
  const state = store.getState();
  console.log('💓 SEMANTEST alive - Connected:', state.connection.isConnected);
}, 20000);

// Initialize when script loads
initialize();

// Export for debugging
export { store };