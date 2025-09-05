/**
 * @fileoverview Integration of ChatGPT state detector with content script
 * @author Wences
 * @description Shows how to use the ChatGPT state detector in the extension
 */

import { ChatGPTStateDetector, ChatGPTState } from './chatgpt-state-detector';

/**
 * Global instance of the state detector
 */
let stateDetector: ChatGPTStateDetector | null = null;

/**
 * Initialize the ChatGPT state detector when on ChatGPT pages
 */
export function initializeChatGPTDetector(): void {
  // Only initialize on ChatGPT domains
  if (!isChatGPTPage()) {
    return;
  }

  console.log('🔍 Initializing ChatGPT state detector...');

  // Create state detector with callback
  stateDetector = new ChatGPTStateDetector(
    document,
    handleStateChange,
    {
      // Custom configuration if needed
      debounceDelay: 100 // Slightly longer debounce for production
    }
  );

  // Initialize the detector
  stateDetector.initialize();

  // Expose to window for debugging
  if (typeof window !== 'undefined') {
    (window as any).__chatgptStateDetector = stateDetector;
  }

  console.log('✅ ChatGPT state detector initialized');
}

/**
 * Handle state changes
 */
function handleStateChange(newState: ChatGPTState, oldState: ChatGPTState): void {
  console.log(`🔄 ChatGPT state changed: ${oldState} → ${newState}`);

  // Update extension badge or icon based on state
  chrome.runtime.sendMessage({
    type: 'chatgpt_state_change',
    newState,
    oldState,
    timestamp: new Date().toISOString()
  });

  // Handle specific state transitions
  switch (newState) {
    case ChatGPTState.IDLE:
      handleIdleState();
      break;
    case ChatGPTState.BUSY:
      handleBusyState();
      break;
    case ChatGPTState.UNKNOWN:
      handleUnknownState();
      break;
  }
}

/**
 * Handle idle state
 */
function handleIdleState(): void {
  // ChatGPT is ready to receive input
  console.log('✅ ChatGPT is idle and ready');
  
  // Enable any queued operations
  processQueuedMessages();
  
  // Update UI indicators
  updateUIIndicators('idle');
}

/**
 * Handle busy state
 */
function handleBusyState(): void {
  // ChatGPT is processing
  console.log('⏳ ChatGPT is busy processing');
  
  // Pause any automated operations
  pauseAutomation();
  
  // Update UI indicators
  updateUIIndicators('busy');
}

/**
 * Handle unknown state
 */
function handleUnknownState(): void {
  // State cannot be determined
  console.log('❓ ChatGPT state is unknown');
  
  // Attempt to re-detect after a delay
  setTimeout(() => {
    if (stateDetector) {
      stateDetector.forceCheck();
    }
  }, 1000);
}

/**
 * Check if current page is ChatGPT
 */
function isChatGPTPage(): boolean {
  const hostname = window.location.hostname;
  return hostname.includes('chat.openai.com') || 
         hostname.includes('chatgpt.com') ||
         hostname.includes('chat.openai');
}

/**
 * Send a message to ChatGPT (with state checking)
 */
export async function sendMessageToChatGPT(message: string): Promise<void> {
  if (!stateDetector) {
    throw new Error('ChatGPT state detector not initialized');
  }

  try {
    // Wait for ChatGPT to be idle (max 10 seconds)
    console.log('⏳ Waiting for ChatGPT to be idle...');
    await stateDetector.waitForIdle(10000);
    
    console.log('✅ ChatGPT is idle, sending message...');
    
    // Find the textarea
    const textarea = document.querySelector('textarea[data-id="root"]') as HTMLTextAreaElement;
    if (!textarea) {
      throw new Error('ChatGPT textarea not found');
    }

    // Set the message
    textarea.value = message;
    
    // Trigger input event to update React state
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
    
    // Small delay to ensure React processes the change
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find and click the send button
    const sendButton = findSendButton();
    if (!sendButton) {
      // Try pressing Enter as fallback
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      });
      textarea.dispatchEvent(enterEvent);
    } else {
      sendButton.click();
    }
    
    console.log('✅ Message sent successfully');
    
  } catch (error) {
    console.error('❌ Failed to send message:', error);
    throw error;
  }
}

/**
 * Find the send button on the page
 */
function findSendButton(): HTMLButtonElement | null {
  // Try multiple selectors
  const selectors = [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send prompt"]',
    'textarea[data-id="root"] ~ button'
  ];

  for (const selector of selectors) {
    const button = document.querySelector(selector) as HTMLButtonElement;
    if (button && !button.disabled) {
      return button;
    }
  }

  // Try finding button by looking for submit SVG icon
  const svgButtons = document.querySelectorAll('button svg');
  for (const svg of svgButtons) {
    const button = svg.closest('button') as HTMLButtonElement;
    if (button && !button.disabled) {
      // Check if this looks like a send button
      const svgPath = svg.querySelector('path');
      if (svgPath && svgPath.getAttribute('d')?.includes('M')) {
        return button;
      }
    }
  }

  return null;
}

/**
 * Queue for messages waiting to be sent
 */
const messageQueue: string[] = [];

/**
 * Process queued messages when ChatGPT becomes idle
 */
async function processQueuedMessages(): Promise<void> {
  while (messageQueue.length > 0) {
    const message = messageQueue.shift();
    if (message) {
      try {
        await sendMessageToChatGPT(message);
        // Wait a bit between messages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (error) {
        console.error('❌ Failed to send queued message:', error);
        // Re-queue the message
        messageQueue.unshift(message);
        break;
      }
    }
  }
}

/**
 * Queue a message to be sent when ChatGPT is ready
 */
export function queueMessage(message: string): void {
  messageQueue.push(message);
  console.log(`📋 Message queued (${messageQueue.length} in queue)`);
  
  // Try to process immediately if idle
  if (stateDetector?.getState() === ChatGPTState.IDLE) {
    processQueuedMessages();
  }
}

/**
 * Pause any automated operations
 */
function pauseAutomation(): void {
  // Implementation depends on your automation logic
  console.log('⏸️ Automation paused while ChatGPT is busy');
}

/**
 * Update UI indicators based on state
 */
function updateUIIndicators(state: 'idle' | 'busy' | 'unknown'): void {
  // Add visual indicator to the page
  let indicator = document.querySelector('#chatgpt-state-indicator') as HTMLDivElement;
  
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'chatgpt-state-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      z-index: 10000;
      transition: background-color 0.3s;
    `;
    document.body.appendChild(indicator);
  }

  // Update color based on state
  switch (state) {
    case 'idle':
      indicator.style.backgroundColor = '#4ade80'; // Green
      indicator.title = 'ChatGPT is ready';
      break;
    case 'busy':
      indicator.style.backgroundColor = '#f59e0b'; // Orange
      indicator.title = 'ChatGPT is processing';
      break;
    case 'unknown':
      indicator.style.backgroundColor = '#6b7280'; // Gray
      indicator.title = 'ChatGPT state unknown';
      break;
  }
}

/**
 * Clean up the detector
 */
export function cleanupChatGPTDetector(): void {
  if (stateDetector) {
    stateDetector.destroy();
    stateDetector = null;
    console.log('🧹 ChatGPT state detector cleaned up');
  }

  // Remove UI indicator
  const indicator = document.querySelector('#chatgpt-state-indicator');
  if (indicator) {
    indicator.remove();
  }
}

/**
 * Get the current detector instance (for testing/debugging)
 */
export function getDetectorInstance(): ChatGPTStateDetector | null {
  return stateDetector;
}

// Auto-initialize on DOMContentLoaded
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeChatGPTDetector);
  } else {
    // DOM already loaded
    initializeChatGPTDetector();
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', cleanupChatGPTDetector);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'send_to_chatgpt') {
    sendMessageToChatGPT(message.text)
      .then(() => sendResponse({ success: true }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  
  if (message.type === 'queue_message') {
    queueMessage(message.text);
    sendResponse({ success: true, queueLength: messageQueue.length });
  }
  
  if (message.type === 'get_chatgpt_state') {
    const state = stateDetector?.getState() || ChatGPTState.UNKNOWN;
    sendResponse({ state });
  }
  
  if (message.type === 'wait_for_idle') {
    if (stateDetector) {
      stateDetector.waitForIdle(message.timeout || 30000)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep channel open for async response
    } else {
      sendResponse({ success: false, error: 'Detector not initialized' });
    }
  }
});

// Export for use in other modules
export { ChatGPTState, ChatGPTStateDetector };