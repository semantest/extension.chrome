/**
 * SEMANTEST Content Script for ChatGPT
 * Simple implementation for Phase 2 idle detection
 */

console.log('🚀 SEMANTEST Content Script Loaded on', window.location.hostname);

// Idle state detector
function detectChatGPTState() {
  const state = {
    domain: 'chatgpt.com',
    url: window.location.href,
    timestamp: Date.now()
  };

  // Find key elements
  const textarea = document.querySelector('div[contenteditable="true"]');
  const sendButton = document.querySelector('button[data-testid="send-button"]');
  const spinner = document.querySelector('[class*="spinner"], [class*="loading"]');
  const streaming = document.querySelector('[data-message-streaming="true"]');

  // Determine idle state
  state.isIdle = !!(
    textarea && 
    !textarea.hasAttribute('disabled') &&
    sendButton && 
    !sendButton.hasAttribute('disabled') &&
    !spinner &&
    !streaming
  );

  state.canSendMessage = state.isIdle;
  state.elements = {
    hasTextarea: !!textarea,
    hasSendButton: !!sendButton,
    hasSpinner: !!spinner,
    hasStreaming: !!streaming
  };

  return state;
}

// Send state to background
function sendStateToBackground() {
  const state = detectChatGPTState();
  
  chrome.runtime.sendMessage({
    type: 'ChatGPTStateEvent',
    payload: state
  }, (response) => {
    console.log('📤 State sent:', state.isIdle ? 'IDLE ✅' : 'BUSY 🔄');
  });
}

// Handle messages from background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message received:', message.type);
  
  switch (message.type) {
    case 'GET_STATE':
      const state = detectChatGPTState();
      sendResponse(state);
      break;
      
    case 'SEND_PROMPT':
      const { prompt } = message.payload;
      const textarea = document.querySelector('div[contenteditable="true"]');
      
      if (textarea) {
        // Set the prompt
        textarea.textContent = prompt;
        
        // Trigger input event
        const inputEvent = new Event('input', { bubbles: true });
        textarea.dispatchEvent(inputEvent);
        
        // Click send button
        setTimeout(() => {
          const sendButton = document.querySelector('button[data-testid="send-button"]');
          if (sendButton && !sendButton.hasAttribute('disabled')) {
            sendButton.click();
            console.log('✅ Prompt sent:', prompt);
          }
        }, 100);
        
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false, error: 'Textarea not found' });
      }
      break;
      
    default:
      sendResponse({ received: true });
  }
  
  return true; // Keep channel open for async response
});

// Monitor state changes
let lastState = null;
setInterval(() => {
  const currentState = detectChatGPTState();
  
  if (lastState === null || lastState.isIdle !== currentState.isIdle) {
    console.log(`💡 State changed: ${currentState.isIdle ? 'IDLE ✅' : 'BUSY 🔄'}`);
    sendStateToBackground();
    lastState = currentState;
  }
}, 1000);

// Initial state check
setTimeout(() => {
  sendStateToBackground();
  console.log('🎯 SEMANTEST ready for ChatGPT automation');
}, 2000);