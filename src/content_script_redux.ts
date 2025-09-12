/**
 * Content Script with Redux Integration
 * Event-driven content script with Redux state management
 */

import { store } from './store';
import { createDOMMonitor } from './services/domMonitor';
import * as EventActions from './store/events/eventActions';

// Initialize DOM Monitor
const domMonitor = createDOMMonitor(store);

// Store reference for debugging
(window as any).reduxStore = store;
(window as any).domMonitor = domMonitor;

// Initialize extension
function initialize() {
  console.log('🚀 Initializing Redux-powered content script');
  
  // Dispatch initialization event
  store.dispatch(EventActions.extensionInitialized('2.0.0'));
  
  // Start DOM monitoring
  domMonitor.start();
  
  // Connect to WebSocket
  store.dispatch({ type: 'WEBSOCKET_CONNECT' });
  
  // Set up message listener for background script
  setupMessageListener();
  
  // Subscribe to state changes
  subscribeToStateChanges();
  
  console.log('✅ Content script initialized with Redux');
}

/**
 * Set up Chrome runtime message listener
 */
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Content script received message:', message);
    
    // Convert Chrome messages to Redux events
    switch (message.action) {
      case 'submit_prompt':
        store.dispatch(EventActions.promptSubmitted(
          message.prompt,
          message.correlationId || generateCorrelationId()
        ));
        sendResponse({ success: true });
        break;
        
      case 'generate_image':
        store.dispatch(EventActions.imageGenerationRequested(
          message.prompt,
          message.correlationId || generateCorrelationId()
        ));
        sendResponse({ success: true });
        break;
        
      case 'get_state':
        sendResponse({ 
          success: true, 
          state: store.getState() 
        });
        break;
        
      case 'check_status':
        const state = store.getState();
        sendResponse({
          success: true,
          isConnected: state.connection.isConnected,
          tabReady: state.chatGPTTab.isReady,
          queueLength: state.queue.items.length
        });
        break;
        
      default:
        // Handle unknown actions
        console.log('Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep channel open for async response
  });
}

/**
 * Subscribe to Redux state changes
 */
function subscribeToStateChanges() {
  let previousState = store.getState();
  
  store.subscribe(() => {
    const currentState = store.getState();
    
    // Check for connection status changes
    if (previousState.connection.isConnected !== currentState.connection.isConnected) {
      handleConnectionChange(currentState.connection.isConnected);
    }
    
    // Check for tab state changes
    if (previousState.chatGPTTab.isReady !== currentState.chatGPTTab.isReady) {
      handleTabStateChange(currentState.chatGPTTab.isReady);
    }
    
    // Check for queue changes
    if (previousState.queue.items.length !== currentState.queue.items.length) {
      handleQueueChange(currentState.queue);
    }
    
    // Check for completed generations
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
  console.log(`🔌 WebSocket connection ${isConnected ? 'established' : 'lost'}`);
  
  // Update UI indicators
  updateConnectionIndicator(isConnected);
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'CONNECTION_STATUS_CHANGED',
    isConnected
  });
}

/**
 * Handle tab state changes
 */
function handleTabStateChange(isReady: boolean) {
  console.log(`📑 Tab state: ${isReady ? 'ready' : 'busy'}`);
  
  // If tab is ready and we have queued items, process them
  if (isReady) {
    const state = store.getState();
    if (state.queue.items.length > 0 && !state.queue.isProcessing) {
      processQueue();
    }
  }
}

/**
 * Handle queue changes
 */
function handleQueueChange(queueState: any) {
  console.log(`📋 Queue updated: ${queueState.items.length} items`);
  
  // Update badge or indicator
  updateQueueIndicator(queueState.items.length);
  
  // Start processing if not already processing
  if (queueState.items.length > 0 && !queueState.isProcessing) {
    const tabState = store.getState().chatGPTTab;
    if (tabState.isReady) {
      processQueue();
    }
  }
}

/**
 * Handle completed generation
 */
function handleGenerationCompleted(generation: any) {
  console.log('✅ Generation completed:', generation);
  
  // Notify user
  if (generation.type === 'image' && generation.result?.imageUrl) {
    showImageNotification(generation.result.imageUrl);
  } else if (generation.type === 'prompt' && generation.result?.response) {
    console.log('Response received:', generation.result.response);
  }
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'GENERATION_COMPLETED',
    generation
  });
}

/**
 * Process queued items
 */
function processQueue() {
  const state = store.getState();
  const nextItem = state.queue.items.find(item => item.status === 'pending');
  
  if (!nextItem) {
    console.log('No pending items in queue');
    return;
  }
  
  console.log('Processing queue item:', nextItem);
  store.dispatch(EventActions.queueProcessingStarted());
  store.dispatch(EventActions.promptProcessing(nextItem.correlationId));
  
  // Find textarea and submit prompt
  const textarea = document.querySelector('textarea[placeholder*="Send a message"]') as HTMLTextAreaElement;
  const button = document.querySelector('button[data-testid="send-button"]') as HTMLButtonElement;
  
  if (textarea && button) {
    // Set the prompt
    textarea.value = nextItem.prompt;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Click submit button
    setTimeout(() => {
      button.click();
      console.log('Prompt submitted:', nextItem.prompt);
    }, 100);
  } else {
    console.error('Could not find textarea or button');
    store.dispatch(EventActions.promptFailed(
      nextItem.correlationId,
      'Could not find input elements'
    ));
  }
}

/**
 * Update connection indicator in UI
 */
function updateConnectionIndicator(isConnected: boolean) {
  // This could update a visual indicator in the page
  const indicator = document.getElementById('websocket-indicator');
  if (indicator) {
    indicator.className = isConnected ? 'connected' : 'disconnected';
    indicator.title = isConnected ? 'WebSocket connected' : 'WebSocket disconnected';
  }
}

/**
 * Update queue indicator in UI
 */
function updateQueueIndicator(count: number) {
  // This could update a badge or counter in the page
  const badge = document.getElementById('queue-badge');
  if (badge) {
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

/**
 * Show image notification
 */
function showImageNotification(imageUrl: string) {
  // Create a notification or modal to show the generated image
  console.log('Image ready:', imageUrl);
  
  // You could create a floating notification here
  const notification = document.createElement('div');
  notification.className = 'image-notification';
  notification.innerHTML = `
    <div class="notification-content">
      <h3>Image Generated!</h3>
      <img src="${imageUrl}" alt="Generated image" />
      <button onclick="this.parentElement.parentElement.remove()">Close</button>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}

// Clean up on unload
window.addEventListener('unload', () => {
  console.log('Content script unloading, cleaning up...');
  domMonitor.stop();
  store.dispatch({ type: 'WEBSOCKET_DISCONNECT' });
});