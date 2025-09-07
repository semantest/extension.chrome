/**
 * SEMANTEST Content Script - CEO PRIORITY VERSION
 * Handles image generation requests from server
 */

console.log('🚨 SEMANTEST CEO Priority - Content Script Loaded on', window.location.hostname);

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
  return state;
}

// Send prompt to ChatGPT
async function sendPromptToChatGPT(prompt, correlationId) {
  console.log('🚀 CEO PRIORITY: Sending prompt to ChatGPT');
  console.log('   Prompt:', prompt);
  console.log('   Correlation:', correlationId);

  // Wait for idle state
  let attempts = 0;
  while (!detectChatGPTState().isIdle && attempts < 30) {
    console.log('⏳ Waiting for ChatGPT to be idle...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    attempts++;
  }

  if (!detectChatGPTState().isIdle) {
    console.error('❌ ChatGPT not idle after 30 seconds');
    return;
  }

  // Find the input field
  const textarea = document.querySelector('div[contenteditable="true"]');
  if (!textarea) {
    console.error('❌ Could not find ChatGPT input field');
    return;
  }

  // Type the prompt
  textarea.focus();
  textarea.textContent = prompt;
  
  // Trigger input event
  const inputEvent = new Event('input', { bubbles: true });
  textarea.dispatchEvent(inputEvent);

  // Small delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Find and click send button
  const sendButton = document.querySelector('button[data-testid="send-button"]');
  if (sendButton && !sendButton.disabled) {
    console.log('📤 Clicking send button...');
    sendButton.click();
    
    // Monitor for response
    monitorForImageResponse(correlationId);
  } else {
    console.error('❌ Send button not found or disabled');
  }
}

// Monitor ChatGPT response for generated image
async function monitorForImageResponse(correlationId) {
  console.log('👀 Monitoring for image in response...');
  
  let attempts = 0;
  const checkInterval = setInterval(() => {
    // Look for image in the last message
    const messages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const lastMessage = messages[messages.length - 1];
    
    if (lastMessage) {
      // Check for image
      const images = lastMessage.querySelectorAll('img');
      if (images.length > 0) {
        const imageUrl = images[0].src;
        console.log('🎉 IMAGE FOUND!', imageUrl);
        
        // Send to background
        chrome.runtime.sendMessage({
          type: 'ImageGeneratedEvent',
          payload: {
            imageUrl,
            correlationId,
            timestamp: Date.now()
          }
        });
        
        clearInterval(checkInterval);
        return;
      }
    }
    
    attempts++;
    if (attempts > 60) { // 60 seconds timeout
      console.error('❌ Timeout waiting for image');
      clearInterval(checkInterval);
    }
  }, 1000);
}

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 CEO PRIORITY Message received:', message);
  
  if (message.type === 'SEND_PROMPT') {
    const { prompt, correlationId } = message.payload;
    sendPromptToChatGPT(prompt, correlationId);
    sendResponse({ received: true });
  }
  
  if (message.type === 'GET_STATE') {
    sendResponse(detectChatGPTState());
  }
  
  return true;
});

// Send state updates
function sendStateToBackground() {
  const state = detectChatGPTState();
  
  chrome.runtime.sendMessage({
    type: 'ChatGPTStateEvent',
    payload: state
  }, (response) => {
    if (response?.received) {
      console.log('✅ State sent to background');
    }
  });
}

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

// Initial connection
setTimeout(() => {
  sendStateToBackground();
  console.log('🚨 CEO PRIORITY - SEMANTEST ready for image generation!');
}, 2000);