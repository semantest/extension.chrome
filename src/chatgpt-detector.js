/**
 * SEMANTEST ChatGPT Idle/Busy Detector
 * PRIMARY BOTTLENECK SOLUTION - Detects when ChatGPT is ready
 */

class ChatGPTDetector {
  constructor() {
    this.state = 'unknown';
    this.observer = null;
    this.stateChangeCallbacks = [];
    
    // Selectors for ChatGPT elements
    this.selectors = {
      textarea: [
        'textarea',
        'div[contenteditable="true"]',
        'div[contenteditable="true"][data-id]',
        '#prompt-textarea'
      ],
      sendButton: [
        'button[data-testid="send-button"]',
        'button[aria-label*="Send"]',
        'button svg[class*="submit"]'
      ],
      spinner: [
        '.animate-spin',
        '[class*="spinner"]',
        '[class*="loading"]',
        '.result-streaming',
        '[data-message-streaming="true"]'
      ]
    };
  }

  /**
   * Initialize the detector and start monitoring
   */
  initialize() {
    console.log('🔍 ChatGPT Detector initializing...');
    
    // Set up MutationObserver
    this.observer = new MutationObserver(() => {
      this.checkState();
    });
    
    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class', 'style', 'data-message-streaming']
    });
    
    // Initial state check
    this.checkState();
    
    console.log('✅ ChatGPT Detector initialized');
    return this;
  }

  /**
   * Check current ChatGPT state
   */
  checkState() {
    const oldState = this.state;
    
    // Find elements
    const textarea = this.findElement(this.selectors.textarea);
    const sendButton = this.findElement(this.selectors.sendButton);
    const spinner = this.findElement(this.selectors.spinner);
    
    // Check textarea state
    const textareaEnabled = !!(
      textarea && 
      !textarea.disabled && 
      !textarea.hasAttribute('disabled') &&
      !textarea.getAttribute('aria-disabled')
    );
    
    // Check send button state
    const sendButtonEnabled = !!(
      sendButton && 
      !sendButton.disabled && 
      !sendButton.hasAttribute('disabled')
    );
    
    // Check for spinner/loading
    const isLoading = !!(spinner && this.isVisible(spinner));
    
    // Determine state
    if (isLoading) {
      this.state = 'busy';
    } else if (textareaEnabled && sendButtonEnabled) {
      this.state = 'idle';
    } else if (!textareaEnabled || !sendButtonEnabled) {
      this.state = 'busy';
    } else {
      this.state = 'idle'; // Default to idle if uncertain
    }
    
    // Log state changes
    if (oldState !== this.state) {
      console.log(`🔄 ChatGPT state changed: ${oldState} → ${this.state}`);
      this.onStateChange(this.state, oldState);
    }
    
    return this.state;
  }

  /**
   * Find element by multiple selectors
   */
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Check if element is visible
   */
  isVisible(element) {
    if (!element) return false;
    
    const style = window.getComputedStyle(element);
    return (
      style.display !== 'none' && 
      style.visibility !== 'hidden' &&
      style.opacity !== '0'
    );
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Check if ChatGPT is idle
   */
  isIdle() {
    return this.state === 'idle';
  }

  /**
   * Check if ChatGPT is busy
   */
  isBusy() {
    return this.state === 'busy';
  }

  /**
   * Wait for idle state
   */
  async waitForIdle(timeout = 30000) {
    const start = Date.now();
    
    return new Promise((resolve, reject) => {
      // Check immediately
      if (this.isIdle()) {
        resolve();
        return;
      }
      
      // Set up listener
      const checkInterval = setInterval(() => {
        this.checkState();
        
        if (this.isIdle()) {
          clearInterval(checkInterval);
          resolve();
        } else if (Date.now() - start > timeout) {
          clearInterval(checkInterval);
          reject(new Error('Timeout waiting for idle state'));
        }
      }, 100);
    });
  }

  /**
   * Register state change callback
   */
  onStateChange(newState, oldState) {
    // Notify all callbacks
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(newState, oldState);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
    
    // Send SEMANTEST event
    this.sendSemantestEvent(newState);
  }

  /**
   * Add state change listener
   */
  addStateChangeListener(callback) {
    this.stateChangeCallbacks.push(callback);
  }

  /**
   * Send SEMANTEST event
   */
  sendSemantestEvent(state) {
    const event = new CustomEvent('semantest-chatgpt-state', {
      detail: {
        type: 'ChatGPTStateEvent',
        payload: {
          domain: 'chatgpt.com',
          state: state,
          canSendMessage: state === 'idle',
          timestamp: new Date().toISOString()
        }
      }
    });
    
    window.dispatchEvent(event);
    console.log('📤 SEMANTEST state event sent:', state);
  }

  /**
   * Send message to ChatGPT when idle
   */
  async sendMessage(text) {
    // Wait for idle
    await this.waitForIdle();
    
    // Find textarea
    const textarea = this.findElement(this.selectors.textarea);
    if (!textarea) {
      throw new Error('Textarea not found');
    }
    
    // Type message
    textarea.focus();
    if (textarea.tagName === 'TEXTAREA') {
      textarea.value = text;
    } else {
      textarea.textContent = text;
    }
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Find and click send button
    const sendButton = this.findElement(this.selectors.sendButton);
    if (sendButton) {
      sendButton.click();
    } else {
      // Fallback to Enter key
      textarea.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      }));
    }
    
    console.log('✅ Message sent to ChatGPT');
  }

  /**
   * Clean up resources
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.stateChangeCallbacks = [];
    console.log('🧹 ChatGPT Detector destroyed');
  }
}

// Auto-initialize if on ChatGPT
if (window.location.hostname.includes('chatgpt.com') || 
    window.location.hostname.includes('chat.openai.com')) {
  
  // Create global instance
  window.chatgptDetector = new ChatGPTDetector();
  window.chatgptDetector.initialize();
  
  // Log initial state
  console.log('📊 ChatGPT initial state:', window.chatgptDetector.getState());
  
  // Example: Listen for state changes
  window.chatgptDetector.addStateChangeListener((newState, oldState) => {
    console.log(`ChatGPT state: ${oldState} → ${newState}`);
    
    // Send to extension background
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'chatgpt_state_changed',
        state: newState,
        canSendMessage: newState === 'idle'
      });
    }
  });
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatGPTDetector;
}