/**
 * SEMANTEST Background Script
 * Manages WebSocket connection and event handling
 */

console.log('🚀 SEMANTEST Background Script Started');

// WebSocket handler implementation
class SemantestWebSocketHandler {
  constructor() {
    this.ws = null;
    this.url = 'ws://localhost:8081';
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000;
    this.isConnected = false;
    this.messageQueue = [];
  }

  connect() {
    console.log('🔌 SEMANTEST: Connecting to WebSocket server at', this.url);
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('✅ SEMANTEST: WebSocket connected!');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        this.send({
          type: 'CONNECTION_ESTABLISHED',
          source: 'chrome-extension',
          timestamp: new Date().toISOString()
        });
        
        this.processQueue();
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 SEMANTEST: Received event:', data);
          this.handleEvent(data);
        } catch (error) {
          console.error('❌ SEMANTEST: Failed to parse message:', error);
        }
      };
      
      this.ws.onerror = (error) => {
        console.error('❌ SEMANTEST: WebSocket error:', error);
      };
      
      this.ws.onclose = () => {
        console.log('🔌 SEMANTEST: WebSocket disconnected');
        this.isConnected = false;
        this.attemptReconnect();
      };
      
    } catch (error) {
      console.error('❌ SEMANTEST: Failed to create WebSocket:', error);
      this.attemptReconnect();
    }
  }

  async handleEvent(event) {
    console.log('🎯 SEMANTEST: Handling event type:', event.type);
    
    if (event.type === 'ImageGenerationRequestedEvent') {
      const prompt = event.data?.prompt || event.prompt;
      if (!prompt) {
        console.error('❌ SEMANTEST: No prompt provided');
        return;
      }
      
      // Find or create ChatGPT tab
      const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
      
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        await this.typePromptInTab(tabs[0].id, prompt);
      } else {
        const newTab = await chrome.tabs.create({ url: 'https://chatgpt.com' });
        
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
          if (tabId === newTab.id && info.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            setTimeout(() => {
              this.typePromptInTab(newTab.id, prompt);
            }, 3000);
          }
        }.bind(this));
      }
    }
  }

  async typePromptInTab(tabId, prompt) {
    console.log('✍️ SEMANTEST: Typing prompt in tab', tabId);
    
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (promptText) => {
        const checkAndType = () => {
          const textarea = document.querySelector('textarea#prompt-textarea');
          const contentEditable = document.querySelector('div[contenteditable="true"]');
          const input = contentEditable || textarea;
          
          if (!input) {
            setTimeout(checkAndType, 500);
            return;
          }
          
          // Type prompt
          if (contentEditable) {
            contentEditable.innerHTML = '';
            contentEditable.focus();
            contentEditable.appendChild(document.createTextNode(promptText));
            contentEditable.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (textarea) {
            textarea.value = promptText;
            textarea.focus();
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Send message
          setTimeout(() => {
            const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
            if (sendButton && !sendButton.disabled) {
              sendButton.click();
            }
          }, 500);
        };
        
        checkAndType();
      },
      args: [prompt]
    });
    
    this.send({
      type: 'PROMPT_TYPED',
      prompt: prompt,
      tabId: tabId
    });
  }

  send(data) {
    const message = JSON.stringify(data);
    
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      console.log('📤 SEMANTEST: Sent:', data);
    } else {
      this.messageQueue.push(message);
    }
  }

  processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      this.ws.send(this.messageQueue.shift());
    }
  }

  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    setTimeout(() => this.connect(), delay);
  }
}

// Initialize WebSocket
const wsHandler = new SemantestWebSocketHandler();
wsHandler.connect();

// Keep service worker alive
setInterval(() => {
  console.log('💓 SEMANTEST: Alive');
}, 20000);

console.log('✅ SEMANTEST Background Script Ready');
