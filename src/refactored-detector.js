/**
 * 🔄 REFACTOR PHASE - Clean, maintainable ChatGPT detector
 * TDD Cycle: Red 🔴 → Green ✅ → Refactor 🔄
 */

class ChatGPTIdleDetector {
  constructor() {
    this.state = 'unknown';
    this.observer = null;
    this.stateListeners = [];
    this.config = {
      debounceMs: 100,
      initDelayMs: 500,
      retryDelayMs: 1000
    };
    this.debounceTimer = null;
  }

  // Selectors configuration for maintainability
  static SELECTORS = {
    inputs: [
      'div[contenteditable="true"]',
      'textarea#prompt-textarea',
      '[role="textbox"]',
      'div.ProseMirror'
    ],
    sendButtons: [
      'button[data-testid="send-button"]',
      'button[data-testid="fruitjuice-send-button"]',
      'button[aria-label*="Send"]'
    ],
    busyIndicators: [
      '.animate-spin',
      '[class*="spinner"]',
      '.result-streaming',
      '.streaming',
      '[data-state="pending"]',
      '[data-state="loading"]',
      '[data-state="generating"]'
    ]
  };

  /**
   * Initialize the detector
   */
  init() {
    console.log('🔄 REFACTORED: Initializing ChatGPT Idle Detector');
    
    this.createVisualIndicator();
    this.setupObserver();
    
    // Initial state check with retry
    setTimeout(() => {
      this.checkState();
      setTimeout(() => this.checkState(), this.config.retryDelayMs);
    }, this.config.initDelayMs);
    
    return true;
  }

  /**
   * Create visual state indicator
   */
  createVisualIndicator() {
    if (document.getElementById('semantest-indicator')) return;
    
    const indicator = document.createElement('div');
    indicator.id = 'semantest-indicator';
    indicator.style.cssText = this.getIndicatorStyles();
    indicator.textContent = '❓ INITIALIZING';
    document.body.appendChild(indicator);
  }

  /**
   * Get indicator styles
   */
  getIndicatorStyles() {
    return `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #6b7280;
      color: white;
      font-weight: bold;
      font-size: 14px;
      font-family: system-ui, -apple-system, sans-serif;
      border-radius: 8px;
      z-index: 99999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      transition: all 0.3s ease;
    `;
  }

  /**
   * Setup MutationObserver
   */
  setupObserver() {
    this.observer = new MutationObserver(() => {
      this.debouncedCheckState();
    });
    
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
      attributeOldValue: true
    });
  }

  /**
   * Debounced state check to avoid excessive checks
   */
  debouncedCheckState() {
    clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      requestAnimationFrame(() => this.checkState());
    }, this.config.debounceMs);
  }

  /**
   * Find first matching element from selectors
   */
  findElement(selectors) {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  }

  /**
   * Check if any busy indicators are present
   */
  hasBusyIndicators() {
    // Check standard indicators
    for (const selector of ChatGPTIdleDetector.SELECTORS.busyIndicators) {
      if (document.querySelector(selector)) return true;
    }
    
    // Check for generating message indicator
    const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
    const lastMessage = assistantMessages[assistantMessages.length - 1];
    if (lastMessage?.textContent?.includes('●')) return true;
    
    return false;
  }

  /**
   * Check if input is interactive
   */
  isInputInteractive(input) {
    if (!input) return false;
    
    return (
      input.contentEditable === 'true' ||
      (!input.disabled && input.getAttribute('aria-disabled') !== 'true')
    );
  }

  /**
   * Check if button is interactive
   */
  isButtonInteractive(button) {
    if (!button) return false;
    
    return (
      !button.disabled &&
      button.getAttribute('aria-disabled') !== 'true'
    );
  }

  /**
   * Determine current state
   */
  determineState() {
    // Check for busy indicators first (highest priority)
    if (this.hasBusyIndicators()) {
      return 'busy';
    }
    
    // Find UI elements
    const input = this.findElement(ChatGPTIdleDetector.SELECTORS.inputs);
    const sendButton = this.findElement(ChatGPTIdleDetector.SELECTORS.sendButtons);
    
    // Both elements must exist and be interactive for idle state
    if (input && sendButton) {
      const canInteract = 
        this.isInputInteractive(input) && 
        this.isButtonInteractive(sendButton);
      
      return canInteract ? 'idle' : 'busy';
    }
    
    // Partial elements indicate loading
    if (input || sendButton) {
      return 'busy';
    }
    
    // No elements found
    return 'unknown';
  }

  /**
   * Check and update state
   */
  checkState() {
    const oldState = this.state;
    const newState = this.determineState();
    
    if (oldState !== newState) {
      this.state = newState;
      this.onStateChange(oldState, newState);
    }
    
    return this.state;
  }

  /**
   * Handle state change
   */
  onStateChange(oldState, newState) {
    console.log(`🔄 State Change: ${oldState} → ${newState}`);
    
    this.updateIndicator();
    this.notifyListeners(oldState, newState);
    
    // Dispatch custom event
    window.dispatchEvent(new CustomEvent('semantest-state-change', {
      detail: {
        oldState,
        newState,
        timestamp: new Date().toISOString()
      }
    }));
  }

  /**
   * Update visual indicator
   */
  updateIndicator() {
    const indicator = document.getElementById('semantest-indicator');
    if (!indicator) return;
    
    const states = {
      idle: {
        background: '#10b981',
        text: '✅ IDLE'
      },
      busy: {
        background: '#f59e0b',
        text: '⏳ BUSY'
      },
      unknown: {
        background: '#6b7280',
        text: '❓ UNKNOWN'
      }
    };
    
    const stateConfig = states[this.state] || states.unknown;
    indicator.style.background = stateConfig.background;
    indicator.textContent = stateConfig.text;
  }

  /**
   * Add state change listener
   */
  addStateListener(callback) {
    this.stateListeners.push(callback);
  }

  /**
   * Notify all listeners of state change
   */
  notifyListeners(oldState, newState) {
    this.stateListeners.forEach(listener => {
      try {
        listener(oldState, newState);
      } catch (error) {
        console.error('State listener error:', error);
      }
    });
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Cleanup detector
   */
  destroy() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    
    clearTimeout(this.debounceTimer);
    
    const indicator = document.getElementById('semantest-indicator');
    if (indicator) {
      indicator.remove();
    }
    
    this.stateListeners = [];
  }
}

// Auto-initialize on ChatGPT
if (typeof window !== 'undefined' && window.location.hostname.includes('chat')) {
  window.semantestDetector = new ChatGPTIdleDetector();
  window.semantestDetector.init();
  console.log('✅ TDD Complete: Red 🔴 → Green ✅ → Refactor 🔄');
}