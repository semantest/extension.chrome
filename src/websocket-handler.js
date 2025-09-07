/**
 * SEMANTEST WebSocket Handler
 * Connects to ws://localhost:8081 and handles events
 */

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

  /**
   * Connect to WebSocket server
   */
  connect() {
    console.log('🔌 SEMANTEST: Connecting to WebSocket server at', this.url);
    
    try {
      this.ws = new WebSocket(this.url);
      
      this.ws.onopen = () => {
        console.log('✅ SEMANTEST: WebSocket connected!');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Send connection event
        this.send({
          type: 'CONNECTION_ESTABLISHED',
          source: 'chrome-extension',
          timestamp: new Date().toISOString()
        });
        
        // Process any queued messages
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

  /**
   * Handle incoming events
   */
  handleEvent(event) {
    console.log('🎯 SEMANTEST: Handling event type:', event.type);
    
    switch (event.type) {
      case 'ImageGenerationRequestedEvent':
        this.handleImageGenerationRequest(event);
        break;
        
      case 'TextGenerationRequestedEvent':
        this.handleTextGenerationRequest(event);
        break;
        
      case 'CommandExecutionRequestedEvent':
        this.handleCommandExecutionRequest(event);
        break;
        
      case 'ping':
        this.send({ type: 'pong', timestamp: Date.now() });
        break;
        
      default:
        console.log('⚠️ SEMANTEST: Unknown event type:', event.type);
    }
  }

  /**
   * Handle ImageGenerationRequestedEvent
   */
  async handleImageGenerationRequest(event) {
    console.log('🎨 SEMANTEST: Processing image generation request:', event);
    
    const prompt = event.data?.prompt || event.prompt;
    if (!prompt) {
      console.error('❌ SEMANTEST: No prompt provided in event');
      return;
    }
    
    try {
      // Check if we're on ChatGPT
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const activeTab = tabs[0];
      
      if (!activeTab?.url?.includes('chatgpt.com')) {
        // Find or create ChatGPT tab
        const chatgptTabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
        
        if (chatgptTabs.length > 0) {
          // Switch to existing ChatGPT tab
          await chrome.tabs.update(chatgptTabs[0].id, { active: true });
          await this.typePromptInTab(chatgptTabs[0].id, prompt);
        } else {
          // Create new ChatGPT tab
          const newTab = await chrome.tabs.create({ url: 'https://chatgpt.com' });
          
          // Wait for tab to load
          chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === newTab.id && info.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              setTimeout(() => {
                this.typePromptInTab(newTab.id, prompt);
              }, 2000); // Give ChatGPT time to initialize
            }
          });
        }
      } else {
        // We're already on ChatGPT
        await this.typePromptInTab(activeTab.id, prompt);
      }
      
    } catch (error) {
      console.error('❌ SEMANTEST: Failed to handle image generation:', error);
      this.send({
        type: 'ERROR',
        error: error.message,
        originalEvent: event
      });
    }
  }

  /**
   * Type prompt into ChatGPT tab
   */
  async typePromptInTab(tabId, prompt) {
    console.log('✍️ SEMANTEST: Typing prompt in tab', tabId, ':', prompt);
    
    // Inject script to type prompt
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (promptText) => {
        console.log('💉 SEMANTEST: Injecting prompt:', promptText);
        
        // Wait for idle state
        const checkAndType = () => {
          // Find input element
          const textarea = document.querySelector('textarea#prompt-textarea');
          const contentEditable = document.querySelector('div[contenteditable="true"]');
          const input = contentEditable || textarea;
          
          if (!input) {
            console.log('⏳ SEMANTEST: Waiting for input element...');
            setTimeout(checkAndType, 500);
            return;
          }
          
          // Check if ChatGPT is idle
          const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
          const spinner = document.querySelector('.animate-spin, [class*="spinner"]');
          
          if (spinner || !sendButton || sendButton.disabled) {
            console.log('⏳ SEMANTEST: Waiting for idle state...');
            setTimeout(checkAndType, 1000);
            return;
          }
          
          // Clear existing text
          if (contentEditable) {
            contentEditable.innerHTML = '';
            contentEditable.focus();
            
            // Type the prompt
            const textNode = document.createTextNode(promptText);
            contentEditable.appendChild(textNode);
            
            // Trigger input event
            contentEditable.dispatchEvent(new Event('input', { bubbles: true }));
          } else if (textarea) {
            textarea.value = promptText;
            textarea.focus();
            textarea.dispatchEvent(new Event('input', { bubbles: true }));
          }
          
          // Send the message
          setTimeout(() => {
            if (sendButton && !sendButton.disabled) {
              console.log('📤 SEMANTEST: Sending prompt to ChatGPT');
              sendButton.click();
            } else {
              // Try Enter key as fallback
              const event = new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13,
                bubbles: true
              });
              (contentEditable || textarea).dispatchEvent(event);
            }
          }, 500);
        };
        
        checkAndType();
      },
      args: [prompt]
    });
    
    // Send confirmation
    this.send({
      type: 'PROMPT_TYPED',
      prompt: prompt,
      tabId: tabId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Handle text generation request
   */
  async handleTextGenerationRequest(event) {
    console.log('📝 SEMANTEST: Processing text generation request:', event);
    const prompt = event.data?.prompt || event.prompt;
    
    if (prompt) {
      await this.handleImageGenerationRequest(event); // Same process for text
    }
  }

  /**
   * Handle command execution request
   */
  handleCommandExecutionRequest(event) {
    console.log('⚡ SEMANTEST: Processing command execution:', event);
    // Implement command execution logic here
  }

  /**
   * Send message through WebSocket
   */
  send(data) {
    const message = JSON.stringify(data);
    
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(message);
      console.log('📤 SEMANTEST: Sent message:', data);
    } else {
      console.log('📦 SEMANTEST: Queuing message (not connected):', data);
      this.messageQueue.push(message);
    }
  }

  /**
   * Process queued messages
   */
  processQueue() {
    while (this.messageQueue.length > 0 && this.isConnected) {
      const message = this.messageQueue.shift();
      this.ws.send(message);
    }
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ SEMANTEST: Max reconnection attempts reached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`🔄 SEMANTEST: Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Disconnect WebSocket
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SemantestWebSocketHandler;
}