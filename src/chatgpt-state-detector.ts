/**
 * @fileoverview ChatGPT idle/busy state detection using MutationObserver
 * @author Wences
 * @description Robust state detection for ChatGPT interface to determine when it's ready to receive messages
 */

/**
 * Enum representing the possible states of ChatGPT interface
 */
export enum ChatGPTState {
  IDLE = 'idle',      // Ready to receive input
  BUSY = 'busy',      // Processing or generating response
  UNKNOWN = 'unknown' // Initial or error state
}

/**
 * Type for state change callback function
 */
export type StateChangeCallback = (newState: ChatGPTState, oldState: ChatGPTState) => void;

/**
 * Configuration options for the state detector
 */
export interface StateDetectorConfig {
  textareaSelectors?: string[];
  sendButtonSelectors?: string[];
  spinnerSelectors?: string[];
  spinnerClasses?: string[];
  debounceDelay?: number;
}

/**
 * Default configuration for ChatGPT state detection
 */
const DEFAULT_CONFIG: Required<StateDetectorConfig> = {
  textareaSelectors: [
    'textarea[data-id="root"]',
    '#prompt-textarea',
    'textarea[placeholder*="Send a message"]',
    'textarea[placeholder*="Message ChatGPT"]'
  ],
  sendButtonSelectors: [
    'button[data-testid="send-button"]',
    'button[aria-label="Send message"]',
    'button[aria-label="Send prompt"]',
    'button svg[class*="submit"]'
  ],
  spinnerSelectors: [
    '.spinner-container',
    '.result-streaming',
    '[data-testid="loading-spinner"]',
    'div[class*="animate-spin"]',
    'svg[class*="animate-spin"]',
    '.text-2xl:has(.animate-pulse)',
    'div[class*="loading"]'
  ],
  spinnerClasses: [
    'animate-spin',
    'spinner',
    'loading',
    'result-streaming',
    'animate-pulse'
  ],
  debounceDelay: 50
};

/**
 * Main class for detecting ChatGPT idle/busy state
 */
export class ChatGPTStateDetector {
  private document: Document;
  private observer: MutationObserver | null = null;
  private currentState: ChatGPTState = ChatGPTState.UNKNOWN;
  private stateChangeCallback?: StateChangeCallback;
  private config: Required<StateDetectorConfig>;
  private debounceTimer: NodeJS.Timeout | null = null;
  private idleWaiters: Array<{ resolve: () => void; reject: (error: Error) => void }> = [];

  constructor(
    document: Document = window.document,
    stateChangeCallback?: StateChangeCallback,
    config: StateDetectorConfig = {}
  ) {
    this.document = document;
    this.stateChangeCallback = stateChangeCallback;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the MutationObserver and start monitoring
   */
  public initialize(): void {
    if (this.observer) {
      this.observer.disconnect();
    }

    // Create MutationObserver with callback
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Start observing document.body for changes
    this.observer.observe(this.document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['disabled', 'style', 'class', 'readonly', 'aria-disabled']
    });

    // Perform initial state check
    this.checkState();
  }

  /**
   * Handle mutations detected by the observer
   */
  private handleMutations(mutations: MutationRecord[]): void {
    // Debounce rapid mutations
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.checkState();
    }, this.config.debounceDelay);
  }

  /**
   * Check the current state of ChatGPT interface
   */
  private checkState(): void {
    const oldState = this.currentState;
    const newState = this.determineState();

    if (newState !== oldState) {
      this.currentState = newState;
      
      // Trigger callback if provided
      if (this.stateChangeCallback) {
        this.stateChangeCallback(newState, oldState);
      }

      // Resolve any waiting promises if state is now idle
      if (newState === ChatGPTState.IDLE) {
        this.resolveIdleWaiters();
      }
    }
  }

  /**
   * Determine the current state based on DOM elements
   */
  private determineState(): ChatGPTState {
    // Priority 1: Check for visible spinners (strongest indicator of busy state)
    if (this.hasVisibleSpinner()) {
      return ChatGPTState.BUSY;
    }

    // Priority 2: Check for streaming response indicators
    if (this.hasStreamingResponse()) {
      return ChatGPTState.BUSY;
    }

    // Priority 3: Check textarea state
    const textareaState = this.getTextareaState();
    if (textareaState === ChatGPTState.BUSY) {
      return ChatGPTState.BUSY;
    }

    // Priority 4: Check send button state
    const sendButtonState = this.getSendButtonState();
    if (sendButtonState === ChatGPTState.BUSY) {
      return ChatGPTState.BUSY;
    }

    // If we have clear idle indicators, return idle
    if (textareaState === ChatGPTState.IDLE || sendButtonState === ChatGPTState.IDLE) {
      return ChatGPTState.IDLE;
    }

    // Default to unknown if we can't determine state
    return ChatGPTState.UNKNOWN;
  }

  /**
   * Check if there are visible spinners on the page
   */
  private hasVisibleSpinner(): boolean {
    // Check by selectors
    for (const selector of this.config.spinnerSelectors) {
      const elements = this.document.querySelectorAll(selector);
      for (const element of elements) {
        if (this.isElementVisible(element as HTMLElement)) {
          return true;
        }
      }
    }

    // Check by classes
    for (const className of this.config.spinnerClasses) {
      const elements = this.document.getElementsByClassName(className);
      for (const element of elements) {
        if (this.isElementVisible(element as HTMLElement)) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Check if there are streaming response indicators
   */
  private hasStreamingResponse(): boolean {
    // Check for result-streaming class
    const streamingElements = this.document.querySelectorAll('.result-streaming');
    if (streamingElements.length > 0) {
      return true;
    }

    // Check for "Stop generating" button (indicates active generation)
    const stopButton = this.document.querySelector('button[aria-label*="Stop"]');
    if (stopButton && this.isElementVisible(stopButton as HTMLElement)) {
      return true;
    }

    return false;
  }

  /**
   * Get the state based on textarea element
   */
  private getTextareaState(): ChatGPTState {
    for (const selector of this.config.textareaSelectors) {
      const textarea = this.document.querySelector(selector) as HTMLTextAreaElement;
      if (textarea) {
        // Check if textarea is disabled or readonly
        if (textarea.disabled || textarea.readOnly) {
          return ChatGPTState.BUSY;
        }
        
        // Check aria-disabled attribute
        if (textarea.getAttribute('aria-disabled') === 'true') {
          return ChatGPTState.BUSY;
        }

        // If textarea is enabled and visible, we're likely idle
        if (this.isElementVisible(textarea)) {
          return ChatGPTState.IDLE;
        }
      }
    }

    return ChatGPTState.UNKNOWN;
  }

  /**
   * Get the state based on send button element
   */
  private getSendButtonState(): ChatGPTState {
    for (const selector of this.config.sendButtonSelectors) {
      const button = this.document.querySelector(selector) as HTMLButtonElement;
      if (button) {
        // Check if button is disabled
        if (button.disabled) {
          return ChatGPTState.BUSY;
        }

        // Check aria-disabled attribute
        if (button.getAttribute('aria-disabled') === 'true') {
          return ChatGPTState.BUSY;
        }

        // If button is enabled and visible, we're likely idle
        if (this.isElementVisible(button)) {
          return ChatGPTState.IDLE;
        }
      }
    }

    // Also check for parent elements of SVG icons within buttons
    const svgButtons = this.document.querySelectorAll('button svg[class*="submit"]');
    for (const svg of svgButtons) {
      const button = svg.closest('button') as HTMLButtonElement;
      if (button && !button.disabled && this.isElementVisible(button)) {
        return ChatGPTState.IDLE;
      }
    }

    return ChatGPTState.UNKNOWN;
  }

  /**
   * Check if an element is visible
   */
  private isElementVisible(element: HTMLElement): boolean {
    if (!element) return false;

    // Check inline styles first (works in tests)
    const display = element.style.display;
    
    // If display is explicitly set to 'none', element is hidden
    if (display === 'none') return false;
    
    // If display is set to any visible value, element is visible
    if (display && display !== 'none') return true;
    
    // Check other visibility properties
    if (element.style.visibility === 'hidden') return false;
    if (element.style.opacity === '0') return false;
    
    // Check computed styles if window is available
    if (typeof window !== 'undefined' && window.getComputedStyle) {
      const style = window.getComputedStyle(element);
      if (style.display === 'none') return false;
      if (style.visibility === 'hidden') return false;
      if (style.opacity === '0') return false;
    }

    // Check if element has dimensions if getBoundingClientRect is available
    if (element.getBoundingClientRect) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
    }

    // Default to visible if no explicit hide conditions are met
    return true;
  }

  /**
   * Get the current state
   */
  public getState(): ChatGPTState {
    return this.currentState;
  }

  /**
   * Wait for the interface to become idle
   */
  public async waitForIdle(timeoutMs: number = 30000): Promise<void> {
    // If already idle, resolve immediately
    if (this.currentState === ChatGPTState.IDLE) {
      return Promise.resolve();
    }

    // Create promise that resolves when idle
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject };
      this.idleWaiters.push(waiter);

      // Set timeout
      const timeoutId = setTimeout(() => {
        const index = this.idleWaiters.indexOf(waiter);
        if (index > -1) {
          this.idleWaiters.splice(index, 1);
          reject(new Error('Timeout waiting for idle state'));
        }
      }, timeoutMs);

      // Store timeout ID for cleanup
      (waiter as any).timeoutId = timeoutId;
    });
  }

  /**
   * Resolve all waiting promises when idle state is reached
   */
  private resolveIdleWaiters(): void {
    const waiters = [...this.idleWaiters];
    this.idleWaiters = [];

    for (const waiter of waiters) {
      // Clear timeout if exists
      if ((waiter as any).timeoutId) {
        clearTimeout((waiter as any).timeoutId);
      }
      waiter.resolve();
    }
  }

  /**
   * Clean up and disconnect the observer
   */
  public destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Reject any waiting promises
    const error = new Error('State detector destroyed');
    for (const waiter of this.idleWaiters) {
      waiter.reject(error);
    }
    this.idleWaiters = [];
  }

  /**
   * Force a state check (useful for manual triggers)
   */
  public forceCheck(): void {
    this.checkState();
  }

  /**
   * Update configuration dynamically
   */
  public updateConfig(config: StateDetectorConfig): void {
    this.config = { ...this.config, ...config };
    this.forceCheck();
  }
}