/**
 * SEMANTEST Content Script for ChatGPT
 * Monitors state and handles automation
 */

console.log('🚀 SEMANTEST Content Script Loaded on', window.location.hostname);

// Initialize idle detector
class ChatGPTMonitor {
  constructor() {
    this.state = 'unknown';
    this.observer = null;
    this.init();
  }

  init() {
    console.log('🔍 SEMANTEST: Initializing ChatGPT monitor');
    
    // Create visual indicator
    const indicator = document.createElement('div');
    indicator.id = 'semantest-status';
    indicator.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 10px 15px;
      background: #10b981;
      color: white;
      font-weight: bold;
      font-size: 12px;
      border-radius: 8px;
      z-index: 99999;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    `;
    indicator.textContent = '🎯 SEMANTEST Active';
    document.body.appendChild(indicator);
    
    // Setup observer
    this.observer = new MutationObserver(() => this.checkState());
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
    
    this.checkState();
  }

  checkState() {
    const oldState = this.state;
    
    // Find elements
    const input = document.querySelector('div[contenteditable="true"], textarea#prompt-textarea');
    const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
    const spinner = document.querySelector('.animate-spin, [class*="spinner"]');
    
    // Determine state
    if (spinner) {
      this.state = 'busy';
    } else if (input && sendButton && !sendButton.disabled) {
      this.state = 'idle';
    } else {
      this.state = 'busy';
    }
    
    if (oldState !== this.state) {
      console.log(`💡 SEMANTEST: State changed: ${oldState} → ${this.state}`);
      
      // Update indicator
      const indicator = document.getElementById('semantest-status');
      if (indicator) {
        indicator.textContent = this.state === 'idle' ? '✅ IDLE' : '⏳ BUSY';
        indicator.style.background = this.state === 'idle' ? '#10b981' : '#f59e0b';
      }
      
      // Notify background script
      chrome.runtime.sendMessage({
        type: 'CHATGPT_STATE_CHANGE',
        state: this.state,
        url: window.location.href
      });
    }
  }
}

// Initialize monitor
const monitor = new ChatGPTMonitor();

// Listen for messages from background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 SEMANTEST: Received message:', request);
  
  if (request.type === 'GET_STATE') {
    sendResponse({ state: monitor.state });
  }
  
  return true;
});

console.log('✅ SEMANTEST: Content script ready for automation!');
