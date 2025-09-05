/**
 * ChatGPT Idle State Detector
 * Monitors ChatGPT interface for idle/ready state
 * @author Wences - Frontend Architect
 */

export class IdleDetector {
  private observer: MutationObserver | null = null;
  private isIdle: boolean = true;
  private lastActivity: number = Date.now();
  private idleTimeout: number = 5000; // 5 seconds
  private callbacks: Set<(idle: boolean) => void> = new Set();

  /**
   * Start monitoring for idle state
   */
  start(): void {
    // Monitor for typing indicators
    this.observer = new MutationObserver((mutations) => {
      this.checkIdleState();
    });

    // Observe the main conversation area
    const targetNode = document.querySelector('main[role="main"]');
    if (targetNode) {
      this.observer.observe(targetNode, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'data-message-author-role']
      });
    }

    // Periodic idle check
    setInterval(() => this.checkIdleState(), 1000);

    console.log('🔍 Idle detector started');
  }

  /**
   * Check current idle state
   */
  private checkIdleState(): void {
    const indicators = {
      // Check for typing indicator
      typingIndicator: document.querySelector('.typing-indicator') !== null,
      
      // Check if send button is disabled (ChatGPT is processing)
      sendButtonDisabled: (() => {
        const button = document.querySelector('button[data-testid="send-button"]');
        return button ? button.hasAttribute('disabled') : false;
      })(),
      
      // Check for streaming response
      streamingResponse: document.querySelector('[data-message-streaming="true"]') !== null,
      
      // Check for loading spinner
      loadingSpinner: document.querySelector('[class*="spinner"], [class*="loading"]') !== null
    };

    // ChatGPT is idle if none of the busy indicators are present
    const currentlyIdle = !Object.values(indicators).some(indicator => indicator);

    if (currentlyIdle !== this.isIdle) {
      this.isIdle = currentlyIdle;
      this.lastActivity = Date.now();
      this.notifyStateChange(currentlyIdle);
      
      console.log(`💡 ChatGPT is now ${currentlyIdle ? 'IDLE ✅' : 'BUSY 🔄'}`);
      console.log('Indicators:', indicators);
    }
  }

  /**
   * Register callback for idle state changes
   */
  onStateChange(callback: (idle: boolean) => void): void {
    this.callbacks.add(callback);
  }

  /**
   * Notify all callbacks of state change
   */
  private notifyStateChange(idle: boolean): void {
    this.callbacks.forEach(callback => {
      try {
        callback(idle);
      } catch (error) {
        console.error('Error in idle state callback:', error);
      }
    });
  }

  /**
   * Get current idle state
   */
  getState(): { idle: boolean; lastActivity: number } {
    return {
      idle: this.isIdle,
      lastActivity: this.lastActivity
    };
  }

  /**
   * Wait for ChatGPT to become idle
   */
  async waitForIdle(timeout: number = 30000): Promise<boolean> {
    const startTime = Date.now();
    
    return new Promise<boolean>((resolve) => {
      if (this.isIdle) {
        resolve(true);
        return;
      }

      const checkInterval = setInterval(() => {
        if (this.isIdle) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.callbacks.clear();
    console.log('🛑 Idle detector stopped');
  }
}

// Export singleton instance
export const idleDetector = new IdleDetector();