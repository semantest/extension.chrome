// ChatGPT State Detector - Detects various states of ChatGPT interface
console.log('🔍 ChatGPT State Detector loaded');

// Check if already defined to avoid duplicate declaration
if (typeof ChatGPTStateDetector === 'undefined') {

class ChatGPTStateDetector {
  constructor() {
    this.lastState = null;
    this.stateChangeCallbacks = [];
  }

  // Detect current ChatGPT state
  detectState() {
    const state = {
      isGenerating: false,
      isResponding: false,
      isIdle: false,
      isError: false,
      isUnresponsive: false,
      isImageGenerating: false,
      canSendMessage: false,
      details: {},
      debug: {} // Add debug info
    };

    // Check if ChatGPT is generating an image
    // Method 1: Look for tool-use messages (DALL-E is a tool)
    const toolMessages = document.querySelectorAll('[data-message-author-role="tool"]');
    const hasToolMessage = toolMessages.length > 0;
    
    // Method 2: Check if there's image-related content in the conversation
    const stopButtonForImage = document.querySelector('button[aria-label*="Stop"]');
    
    // Method 3: Look for the last assistant message mentioning image generation
    const lastAssistantMsg = document.querySelector('[data-message-author-role="assistant"]:last-child');
    const lastMsgText = lastAssistantMsg?.textContent || '';
    const mentionsImageGeneration = (
      lastMsgText.includes('create an image') ||
      lastMsgText.includes('generate an image') ||
      lastMsgText.includes('creating an image') ||
      lastMsgText.includes('generating an image') ||
      lastMsgText.includes('I\'ll create') ||
      lastMsgText.includes('I\'ll generate') ||
      lastMsgText.includes('Here\'s the image') ||
      lastMsgText.includes('Here is the image') ||
      lastMsgText.includes('comic') ||
      lastMsgText.includes('illustration') ||
      lastMsgText.includes('drawing')
    );
    
    // Also check the user's last message for image requests
    const lastUserMsg = document.querySelector('[data-message-author-role="user"]:last-child');
    const userRequestsImage = lastUserMsg?.textContent?.match(/image|picture|draw|illustrate|comic|visual|create|generate/i);
    
    // Method 4: Check for actual image elements in recent messages
    const recentImages = document.querySelectorAll('[data-message-id]:last-child img, [data-message-id]:nth-last-child(2) img');
    const hasRecentImages = recentImages.length > 0;
    
    // Method 5: Look for thinking/tool-use UI elements
    const thinkingElements = document.querySelectorAll('[class*="thinking"], [class*="tool-use"]');
    
    // Combine all methods - image generation is happening if:
    // 1. There's a tool message (DALL-E) OR
    // 2. User requested an image AND ChatGPT is generating OR
    // 3. Assistant mentions creating an image AND is still generating
    const imageGenerating = hasToolMessage || 
                          (userRequestsImage && state.isGenerating) ||
                          (stopButtonForImage && mentionsImageGeneration) ||
                          (mentionsImageGeneration && !hasRecentImages) || // Mentioned but no image yet
                          thinkingElements.length > 0;
    
    // Debug info
    state.debug.hasToolMessage = hasToolMessage;
    state.debug.mentionsImageGeneration = mentionsImageGeneration;
    state.debug.hasRecentImages = hasRecentImages;
    state.debug.toolMessageCount = toolMessages.length;
    
    if (imageGenerating) {
      state.isImageGenerating = true;
      state.details.imageGeneration = 'Image generation in progress';
    }

    // Check if ChatGPT is currently responding (typing animation or streaming)
    const streamingIndicators = [
      '.result-streaming',
      '.typing-animation',
      '[data-testid="typing-indicator"]',
      '.text-token-text-primary.animate-pulse', // Pulsing text during generation
      '[data-message-author-role="assistant"]:last-child .animate-pulse'
    ];
    
    const isStreaming = streamingIndicators.some(selector => 
      document.querySelector(selector) !== null
    );

    // Check for stop button (indicates active generation)
    const stopButton = document.querySelector('button[aria-label*="Stop"]') ||
                      document.querySelector('button[aria-label="Stop generating"]') ||
                      Array.from(document.querySelectorAll('button')).find(btn => {
                        const text = btn.textContent?.trim();
                        return text === 'Stop' || text === 'Stop generating';
                      });
    
    // Debug info
    state.debug.stopButtonFound = !!stopButton;
    state.debug.stopButtonVisible = stopButton ? stopButton.offsetParent !== null : false;
    
    // Also check if the last message is still being generated
    const lastMessage = document.querySelector('[data-message-author-role="assistant"]:last-child');
    const hasStreamingCursor = lastMessage?.querySelector('.cursor') || 
                              lastMessage?.querySelector('.animate-pulse');
    
    state.debug.hasStreamingCursor = !!hasStreamingCursor;
    state.debug.isStreaming = isStreaming;
    
    // Only mark as generating if stop button is actually visible
    if (stopButton && stopButton.offsetParent !== null) {
      state.isResponding = true;
      state.isGenerating = true;
      state.details.streaming = 'ChatGPT is generating a response';
      
      // Double-check if it's image generation by looking at context
      if (userRequestsImage || mentionsImageGeneration || hasToolMessage) {
        state.isImageGenerating = true;
        state.details.imageGeneration = 'Generating image based on context';
      }
    }

    // Check if there's an error message
    const errorSelectors = [
      '.error-message',
      '[data-testid="error-message"]',
      '.text-red-500:not([aria-label])', // Exclude icon elements
      'div[class*="error"]:not([class*="hidden"])'
    ];
    
    const errorElement = errorSelectors.map(sel => document.querySelector(sel))
                                      .find(el => {
                                        if (!el) return false;
                                        // Make sure it's visible and has actual error text
                                        const text = el.textContent?.trim();
                                        return el.offsetParent !== null && 
                                               text && 
                                               text.length > 0 &&
                                               !text.includes('ChatGPT'); // Exclude logo text
                                      });
    
    if (errorElement) {
      state.isError = true;
      state.details.error = errorElement.textContent?.trim() || 'Unknown error';
    }

    // Check for rate limit or network errors
    const rateLimitText = Array.from(document.querySelectorAll('div')).find(div => 
      div.textContent?.includes('Too many requests') ||
      div.textContent?.includes('rate limit') ||
      div.textContent?.includes('Network error')
    );
    
    if (rateLimitText) {
      state.isError = true;
      state.details.rateLimit = rateLimitText.textContent?.trim();
    }

    // Check if the send button is available and enabled
    const sendButton = document.querySelector('button[data-testid="send-button"]') ||
                      document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
                      document.querySelector('button[aria-label*="Send"]') ||
                      document.querySelector('textarea[placeholder*="Message"] ~ button') ||
                      document.querySelector('[data-testid="composer-send-button"]') ||
                      // More flexible: find button near the textarea
                      (() => {
                        const textarea = document.querySelector('textarea[placeholder*="Message"]');
                        if (textarea) {
                          const parent = textarea.closest('form') || textarea.parentElement?.parentElement;
                          return parent?.querySelector('button[type="submit"]') || 
                                 parent?.querySelector('button:not([disabled])');
                        }
                        return null;
                      })();
    
    const inputField = document.querySelector('#prompt-textarea') ||
                      document.querySelector('[data-testid="composer"]') ||
                      document.querySelector('textarea[placeholder*="Message"]') ||
                      document.querySelector('div[contenteditable="true"]');
    
    // More lenient check - if we have an input field, assume we can send
    if (inputField) {
      state.canSendMessage = true;
      state.debug.inputFieldFound = true;
      state.debug.sendButtonFound = !!sendButton;
    }

    // Check if page is responsive
    const lastInteraction = this.checkPageResponsiveness();
    if (!lastInteraction) {
      state.isUnresponsive = true;
      state.details.unresponsive = 'Page may be frozen or unresponsive';
    }

    // If nothing else is happening, it's idle
    if (!state.isGenerating && !state.isResponding && !state.isError && 
        !state.isUnresponsive && !state.isImageGenerating) {
      state.isIdle = true;
    }

    // Check for regenerate button (indicates previous response completed)
    const regenerateButton = document.querySelector('button[data-testid="regenerate-button"]') ||
                           document.querySelector('button[aria-label*="Regenerate"]');
    
    if (regenerateButton) {
      state.details.hasResponse = true;
      state.details.canRegenerate = !regenerateButton.disabled;
    }

    return state;
  }

  // Check if page is responsive by testing DOM interactions
  checkPageResponsiveness() {
    try {
      // Create a test element
      const testEl = document.createElement('div');
      testEl.id = 'responsiveness-test-' + Date.now();
      document.body.appendChild(testEl);
      
      // Try to find it
      const found = document.getElementById(testEl.id);
      
      // Clean up
      if (found) {
        found.remove();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Page responsiveness check failed:', error);
      return false;
    }
  }

  // Wait for ChatGPT to be ready to accept input
  async waitForReady(maxWaitTime = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const state = this.detectState();
      
      if (state.isIdle && state.canSendMessage) {
        return { ready: true, state };
      }
      
      if (state.isError) {
        return { ready: false, error: 'ChatGPT has an error', state };
      }
      
      if (state.isUnresponsive) {
        console.log('🔄 Page unresponsive, attempting reload...');
        window.location.reload();
        return { ready: false, error: 'Page was unresponsive, reloading', state };
      }
      
      // Wait before checking again
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    return { ready: false, error: 'Timeout waiting for ChatGPT to be ready', state: this.detectState() };
  }

  // Monitor state changes
  startMonitoring(callback) {
    if (callback) {
      this.stateChangeCallbacks.push(callback);
    }
    
    // Check state periodically
    setInterval(() => {
      const currentState = this.detectState();
      
      // Check if state changed
      if (JSON.stringify(currentState) !== JSON.stringify(this.lastState)) {
        console.log('📊 ChatGPT state changed:', currentState);
        this.lastState = currentState;
        
        // Notify callbacks
        this.stateChangeCallbacks.forEach(cb => cb(currentState));
      }
    }, 1000);
  }

  // Get detailed status report
  getStatusReport() {
    const state = this.detectState();
    const report = {
      timestamp: Date.now(),
      state: state,
      summary: this.getStateSummary(state),
      recommendations: this.getRecommendations(state)
    };
    
    return report;
  }

  // Get human-readable state summary
  getStateSummary(state) {
    if (state.isImageGenerating) return 'Generating image...';
    if (state.isResponding) return 'ChatGPT is typing...';
    if (state.isError) return `Error: ${state.details.error || 'Unknown error'}`;
    if (state.isUnresponsive) return 'Page is unresponsive';
    if (state.isIdle && state.canSendMessage) return 'Ready to send messages';
    if (state.isIdle && !state.canSendMessage) return 'Idle but cannot send messages';
    return 'Unknown state';
  }

  // Get recommendations based on state
  getRecommendations(state) {
    const recommendations = [];
    
    if (state.isUnresponsive) {
      recommendations.push('Reload the page');
    }
    
    if (state.isError) {
      if (state.details.rateLimit) {
        recommendations.push('Wait for rate limit to reset');
      } else {
        recommendations.push('Try refreshing the page');
        recommendations.push('Check your internet connection');
      }
    }
    
    if (state.isGenerating || state.isResponding) {
      recommendations.push('Wait for current operation to complete');
      if (state.details.streaming) {
        recommendations.push('You can click Stop if needed');
      }
    }
    
    if (state.isImageGenerating) {
      recommendations.push('Wait for image generation to complete');
    }
    
    return recommendations;
  }
}

// Create global instance
window.chatGPTStateDetector = new ChatGPTStateDetector();

// Add console helper
window.checkState = () => {
  const report = window.chatGPTStateDetector.getStatusReport();
  console.log('📊 ChatGPT State Report:');
  console.log('Summary:', report.summary);
  console.log('State:', report.state);
  console.log('Debug:', report.state.debug);
  console.log('Recommendations:', report.recommendations);
  return report;
};

console.log('💡 Use window.checkState() to check ChatGPT state');

// Listen for state check requests
// Note: chrome.runtime not available in MAIN world
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'CHECK_CHATGPT_STATE') {
//     const report = window.chatGPTStateDetector.getStatusReport();
//     sendResponse(report);
//     return true;
//   }
//   
//   if (request.action === 'WAIT_FOR_READY') {
//     window.chatGPTStateDetector.waitForReady(request.timeout || 30000)
//       .then(result => sendResponse(result))
//       .catch(error => sendResponse({ ready: false, error: error.message }));
//     return true;
//   }
// });

// Start monitoring
window.chatGPTStateDetector.startMonitoring((state) => {
  // Send state updates to extension
  try {
    chrome.runtime.sendMessage({
      type: 'CHATGPT_STATE_UPDATE',
      data: state
    }).catch((error) => {
      // Ignore errors if extension context is not available
      if (error.message && error.message.includes('Extension context invalidated')) {
        console.log('⚠️ Extension was reloaded. Please refresh this page to reconnect.');
      }
    });
  } catch (error) {
    // Handle synchronous errors
    if (error.message && error.message.includes('Extension context invalidated')) {
      console.log('⚠️ Extension was reloaded. Please refresh this page to reconnect.');
    }
  }
});

console.log('✅ ChatGPT State Detector ready');

} // End of if (typeof ChatGPTStateDetector === 'undefined')