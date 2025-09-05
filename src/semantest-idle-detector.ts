/**
 * @fileoverview SEMANTEST Idle Detector for ChatGPT
 * @author Wences
 * @description PRIMARY BOTTLENECK - Reliable ChatGPT state detection for SEMANTEST
 */

export interface ChatGPTState {
  state: 'idle' | 'busy' | 'unknown';
  canSendMessage: boolean;
  domain: string;
  timestamp?: string;
  details?: {
    textarea?: boolean;
    sendButton?: boolean;
    spinner?: boolean;
    streaming?: boolean;
  };
}

export class SemantestIdleDetector {
  private domain = 'chatgpt.com';
  private observer: MutationObserver | null = null;
  private currentState: ChatGPTState = {
    state: 'unknown',
    canSendMessage: false,
    domain: this.domain
  };
  private stateChangeCallbacks: ((state: ChatGPTState) => void)[] = [];
  
  /**
   * Initialize the detector and start monitoring
   */
  initialize(): void {
    // Set up MutationObserver
    this.observer = new MutationObserver(() => {
      this.detectChatGPTState();
    });
    
    // Start observing
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class', 'data-message-streaming']
    });
    
    // Initial state check
    this.detectChatGPTState();
    
    console.log('✅ SEMANTEST Idle Detector initialized');
  }
  
  /**
   * Core detection logic - THE CRITICAL FUNCTION
   */
  detectChatGPTState(): ChatGPTState {
    const oldState = this.currentState.state;
    
    // Find all critical indicators
    const indicators = {
      textarea: document.querySelector('div[contenteditable="true"], textarea') as HTMLElement,
      sendButton: document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]') as HTMLButtonElement,
      spinner: document.querySelector('[class*="spinner"], .animate-spin, [class*="loading"]') as HTMLElement,
      streaming: document.querySelector('[data-message-streaming="true"], .result-streaming') as HTMLElement
    };
    
    // Check each indicator's state
    const details = {
      textarea: !!(indicators.textarea && !indicators.textarea.hasAttribute('disabled') && !indicators.textarea.getAttribute('aria-disabled')),
      sendButton: !!(indicators.sendButton && !indicators.sendButton.disabled && !indicators.sendButton.hasAttribute('disabled')),
      spinner: !!(indicators.spinner && this.isElementVisible(indicators.spinner)),
      streaming: !!(indicators.streaming)
    };
    
    // CRITICAL LOGIC: Determine if ChatGPT is idle
    const isIdle = !!(
      details.textarea &&      // Textarea is enabled
      details.sendButton &&    // Send button is enabled
      !details.spinner &&      // No spinner visible
      !details.streaming       // Not streaming response
    );
    
    // Update state
    this.currentState = {
      state: isIdle ? 'idle' : 'busy',
      canSendMessage: isIdle,
      domain: this.domain,
      timestamp: new Date().toISOString(),
      details
    };
    
    // Log state changes
    if (oldState !== this.currentState.state) {
      console.log(`🔄 SEMANTEST State Changed: ${oldState} → ${this.currentState.state}`);
      console.log('📊 Details:', details);
      
      // Notify callbacks
      this.notifyStateChange();
    }
    
    return this.currentState;
  }
  
  /**
   * Check if an element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    if (!element) return false;
    
    // Check inline styles
    if (element.style.display === 'none') return false;
    if (element.style.visibility === 'hidden') return false;
    
    // Check computed styles if available
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
    }
    
    return true;
  }
  
  /**
   * Get current state
   */
  getState(): ChatGPTState {
    return this.currentState;
  }
  
  /**
   * Check if ChatGPT is idle (convenience method)
   */
  isIdle(): boolean {
    return this.currentState.state === 'idle' && this.currentState.canSendMessage;
  }
  
  /**
   * Wait for idle state
   */
  async waitForIdle(timeout = 30000): Promise<void> {
    const start = Date.now();
    
    while (!this.isIdle() && Date.now() - start < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
      this.detectChatGPTState();
    }
    
    if (!this.isIdle()) {
      throw new Error('Timeout waiting for ChatGPT to become idle');
    }
  }
  
  /**
   * Register state change callback
   */
  onStateChange(callback: (state: ChatGPTState) => void): void {
    this.stateChangeCallbacks.push(callback);
  }
  
  /**
   * Notify all callbacks of state change
   */
  private notifyStateChange(): void {
    this.stateChangeCallbacks.forEach(callback => {
      try {
        callback(this.currentState);
      } catch (error) {
        console.error('Error in state change callback:', error);
      }
    });
    
    // Send SEMANTEST event
    this.sendSemantestEvent();
  }
  
  /**
   * Send state event to SEMANTEST system
   */
  private sendSemantestEvent(): void {
    const event = {
      type: 'ChatGPTStateEvent',
      payload: this.currentState
    };
    
    // Dispatch custom event for extension to catch
    window.dispatchEvent(new CustomEvent('semantest-state', {
      detail: event
    }));
    
    // Log for debugging
    console.log('📤 SEMANTEST State Event:', event);
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.stateChangeCallbacks = [];
    console.log('🧹 SEMANTEST Idle Detector destroyed');
  }
}

// Export for browser usage
if (typeof window !== 'undefined') {
  (window as any).SemantestIdleDetector = SemantestIdleDetector;
}