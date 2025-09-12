/**
 * Enhanced Content Script with State Machine Integration
 * Event-driven content script with Redux state management and ChatGPT state machine
 */

import { store } from './store';
import { createDOMMonitor } from './services/domMonitor';
import { createChatGPTStateMachine } from './services/chatGPTStateMachine';
import * as EventActions from './store/events/eventActions';

// Initialize services
const domMonitor = createDOMMonitor(store);
const stateMachine = createChatGPTStateMachine(store);

// Store references for debugging
(window as any).reduxStore = store;
(window as any).domMonitor = domMonitor;
(window as any).stateMachine = stateMachine;

/**
 * Initialize the enhanced content script
 */
function initialize(): void {
  console.log('🚀 Initializing Enhanced Redux-powered content script with State Machine');
  
  // Dispatch initialization event
  store.dispatch(EventActions.extensionInitialized('3.0.0'));
  
  // Start DOM monitoring
  domMonitor.start();
  
  // Connect to WebSocket
  store.dispatch({ type: 'WEBSOCKET_CONNECT' });
  
  // Set up message listener for background script
  setupMessageListener();
  
  // Subscribe to state changes
  subscribeToStateChanges();
  
  // Set up state machine observers
  setupStateMachineObservers();
  
  console.log('✅ Enhanced content script initialized');
}

/**
 * Set up Chrome runtime message listener
 */
function setupMessageListener(): void {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('📨 Content script received message:', message);
    
    // Convert Chrome messages to state machine events
    switch (message.action) {
      case 'submit_prompt':
        const correlationId = message.correlationId || generateCorrelationId();
        // Use state machine for prompt submission
        stateMachine.startInteraction(message.prompt, correlationId);
        sendResponse({ success: true, correlationId });
        break;
        
      case 'generate_image':
        const imageCorrelationId = message.correlationId || generateCorrelationId();
        // Add image generation prefix to prompt
        const imagePrompt = `Generate an image: ${message.prompt}`;
        stateMachine.startInteraction(imagePrompt, imageCorrelationId);
        sendResponse({ success: true, correlationId: imageCorrelationId });
        break;
        
      case 'get_state':
        sendResponse({ 
          success: true, 
          reduxState: store.getState(),
          stateMachineState: stateMachine.getCurrentState(),
          stateMachineContext: stateMachine.getContext()
        });
        break;
        
      case 'check_status':
        const state = store.getState();
        sendResponse({
          success: true,
          isConnected: state.connection.isConnected,
          tabReady: state.chatGPTTab.isReady,
          queueLength: state.queue.items.length,
          stateMachine: stateMachine.getCurrentState()
        });
        break;
        
      case 'reset_state_machine':
        stateMachine.reset();
        sendResponse({ success: true });
        break;
        
      default:
        console.log('Unknown action:', message.action);
        sendResponse({ success: false, error: 'Unknown action' });
    }
    
    return true; // Keep channel open for async response
  });
}

/**
 * Subscribe to Redux state changes
 */
function subscribeToStateChanges(): void {
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
    
    // Check for errors
    if (previousState.currentGeneration.status !== currentState.currentGeneration.status &&
        currentState.currentGeneration.status === 'failed') {
      handleGenerationFailed(currentState.currentGeneration);
    }
    
    previousState = currentState;
  });
}

/**
 * Set up state machine observers
 */
function setupStateMachineObservers(): void {
  // Observer for READY state
  stateMachine.onStateEnter('READY', () => {
    console.log('📟 State Machine: READY - Can accept new prompts');
    processNextQueueItem();
  });
  
  // Observer for ERROR state
  stateMachine.onStateEnter('ERROR', () => {
    console.error('❌ State Machine: ERROR - Check context for details');
    const context = stateMachine.getContext();
    if (context.error) {
      store.dispatch(EventActions.stateMachineError(
        context.currentState,
        context.error.message
      ));
    }
  });
  
  // Observer for PROCESSING_RESPONSE state
  stateMachine.onStateEnter('PROCESSING_RESPONSE', () => {
    console.log('⚙️ State Machine: Processing response from ChatGPT');
  });
  
  // Observer for EXTRACTING_IMAGE state
  stateMachine.onStateEnter('EXTRACTING_IMAGE', () => {
    console.log('🖼️ State Machine: Extracting generated image');
  });
}

/**
 * Handle WebSocket connection changes
 */
function handleConnectionChange(isConnected: boolean): void {
  console.log(`🔌 WebSocket connection ${isConnected ? 'established' : 'lost'}`);
  
  // Update UI indicators
  updateConnectionIndicator(isConnected);
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'CONNECTION_STATUS_CHANGED',
    isConnected
  });
  
  // If connected and have pending items, process them
  if (isConnected) {
    processNextQueueItem();
  }
}

/**
 * Handle tab state changes
 */
function handleTabStateChange(isReady: boolean): void {
  console.log(`📑 Tab state: ${isReady ? 'ready' : 'busy'}`);
  
  // If tab is ready and state machine is idle, process queue
  if (isReady && stateMachine.getCurrentState() === 'IDLE') {
    processNextQueueItem();
  }
}

/**
 * Handle queue changes
 */
function handleQueueChange(queueState: any): void {
  console.log(`📋 Queue updated: ${queueState.items.length} items`);
  
  // Update badge or indicator
  updateQueueIndicator(queueState.items.length);
  
  // Process queue if state machine is ready
  if (queueState.items.length > 0 && !queueState.isProcessing) {
    if (stateMachine.getCurrentState() === 'READY' || stateMachine.getCurrentState() === 'IDLE') {
      processNextQueueItem();
    }
  }
}

/**
 * Process next item in queue
 */
function processNextQueueItem(): void {
  const state = store.getState();
  const nextItem = state.queue.items.find((item: any) => item.status === 'pending');
  
  if (!nextItem) {
    console.log('No pending items in queue');
    return;
  }
  
  // Check if state machine is available
  const currentState = stateMachine.getCurrentState();
  if (currentState !== 'IDLE' && currentState !== 'READY') {
    console.log(`State machine busy (${currentState}), waiting...`);
    return;
  }
  
  console.log('Processing queue item:', nextItem);
  store.dispatch(EventActions.queueProcessingStarted());
  
  // Start interaction via state machine
  stateMachine.startInteraction(nextItem.prompt, nextItem.correlationId);
}

/**
 * Handle completed generation
 */
function handleGenerationCompleted(generation: any): void {
  console.log('✅ Generation completed:', generation);
  
  // Remove from queue
  if (generation.correlationId) {
    store.dispatch(EventActions.queueItemRemoved(generation.correlationId));
  }
  
  // Notify user
  if (generation.type === 'image' && generation.result?.imageUrl) {
    showImageNotification(generation.result.imageUrl);
  } else if (generation.type === 'prompt' && generation.result?.response) {
    showResponseNotification(generation.result.response);
  }
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'GENERATION_COMPLETED',
    generation
  });
  
  // Process next item
  setTimeout(() => processNextQueueItem(), 1000);
}

/**
 * Handle failed generation
 */
function handleGenerationFailed(generation: any): void {
  console.error('❌ Generation failed:', generation);
  
  // Notify user
  showErrorNotification(generation.result?.error || 'Unknown error');
  
  // Send to background script
  chrome.runtime.sendMessage({
    type: 'GENERATION_FAILED',
    generation
  });
  
  // Reset state machine if needed
  if (stateMachine.getCurrentState() === 'ERROR') {
    setTimeout(() => {
      stateMachine.reset();
      processNextQueueItem();
    }, 3000);
  }
}

/**
 * Update connection indicator in UI
 */
function updateConnectionIndicator(isConnected: boolean): void {
  let indicator = document.getElementById('semantest-connection-indicator');
  
  if (!indicator) {
    // Create indicator if it doesn't exist
    indicator = document.createElement('div');
    indicator.id = 'semantest-connection-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      z-index: 10000;
      transition: background-color 0.3s;
    `;
    document.body.appendChild(indicator);
  }
  
  indicator.style.backgroundColor = isConnected ? '#10b981' : '#ef4444';
  indicator.title = isConnected ? 'WebSocket connected' : 'WebSocket disconnected';
}

/**
 * Update queue indicator in UI
 */
function updateQueueIndicator(count: number): void {
  let badge = document.getElementById('semantest-queue-badge');
  
  if (!badge && count > 0) {
    // Create badge if it doesn't exist and we have items
    badge = document.createElement('div');
    badge.id = 'semantest-queue-badge';
    badge.style.cssText = `
      position: fixed;
      top: 10px;
      right: 30px;
      background: #3b82f6;
      color: white;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      z-index: 10000;
    `;
    document.body.appendChild(badge);
  }
  
  if (badge) {
    badge.textContent = count.toString();
    badge.style.display = count > 0 ? 'block' : 'none';
  }
}

/**
 * Show image notification
 */
function showImageNotification(imageUrl: string): void {
  console.log('Image ready:', imageUrl);
  
  const notification = document.createElement('div');
  notification.className = 'semantest-image-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 16px;
    z-index: 10000;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #10b981;">✅ Image Generated!</div>
    <img src="${imageUrl}" alt="Generated image" style="width: 100%; border-radius: 4px;" />
    <button onclick="this.parentElement.remove()" style="
      margin-top: 8px;
      padding: 4px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    ">Close</button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 15 seconds
  setTimeout(() => {
    notification.remove();
  }, 15000);
}

/**
 * Show response notification
 */
function showResponseNotification(response: string): void {
  console.log('Response received:', response.substring(0, 100) + '...');
  
  const notification = document.createElement('div');
  notification.className = 'semantest-response-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 16px;
    z-index: 10000;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #10b981;">✅ Response Received</div>
    <div style="max-height: 200px; overflow-y: auto; color: #374151;">${response}</div>
    <button onclick="this.parentElement.remove()" style="
      margin-top: 8px;
      padding: 4px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    ">Close</button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 10 seconds
  setTimeout(() => {
    notification.remove();
  }, 10000);
}

/**
 * Show error notification
 */
function showErrorNotification(error: string): void {
  console.error('Error:', error);
  
  const notification = document.createElement('div');
  notification.className = 'semantest-error-notification';
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    max-width: 400px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    padding: 16px;
    z-index: 10000;
    border-left: 4px solid #ef4444;
  `;
  
  notification.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 8px; color: #ef4444;">❌ Error</div>
    <div style="color: #374151;">${error}</div>
    <button onclick="this.parentElement.remove()" style="
      margin-top: 8px;
      padding: 4px 12px;
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    ">Close</button>
  `;
  
  document.body.appendChild(notification);
  
  // Auto-remove after 8 seconds
  setTimeout(() => {
    notification.remove();
  }, 8000);
}

/**
 * Generate correlation ID
 */
function generateCorrelationId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Set up periodic health checks
 */
function setupHealthChecks(): void {
  setInterval(() => {
    const state = store.getState();
    const smState = stateMachine.getCurrentState();
    
    const health = {
      websocket: state.connection.isConnected,
      chatGPTTab: state.chatGPTTab.isReady,
      queueItems: state.queue.items.length,
      stateMachine: smState,
      timestamp: Date.now()
    };
    
    store.dispatch(EventActions.healthCheckPerformed(health));
    
    // Log health status
    console.log('🏥 Health Check:', health);
    
    // Check for stuck state machine
    if (smState === 'ERROR' || smState === 'RECOVERING') {
      const context = stateMachine.getContext();
      if (context.retryCount >= 3) {
        console.warn('State machine stuck, resetting...');
        stateMachine.reset();
      }
    }
  }, 30000); // Every 30 seconds
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setupHealthChecks();
  });
} else {
  initialize();
  setupHealthChecks();
}

// Clean up on unload
window.addEventListener('unload', () => {
  console.log('Content script unloading, cleaning up...');
  domMonitor.stop();
  stateMachine.destroy();
  store.dispatch({ type: 'WEBSOCKET_DISCONNECT' });
});

// Export for testing
export { stateMachine, domMonitor, store };