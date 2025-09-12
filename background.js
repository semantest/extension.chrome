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
      // Forward the entire event to content script
      console.log('📤 SEMANTEST: Forwarding event to content scripts');
      
      // Find ChatGPT tabs
      const tabs = await chrome.tabs.query({ 
        url: ['https://chatgpt.com/*', 'https://chat.openai.com/*'] 
      });
      
      if (tabs.length > 0) {
        // Send to all ChatGPT tabs
        for (const tab of tabs) {
          try {
            // First try to send message
            await chrome.tabs.sendMessage(tab.id, event);
            console.log('✅ SEMANTEST: Sent to tab', tab.id);
          } catch (error) {
            console.error('❌ SEMANTEST: Error sending to tab', tab.id, error);
            
            // If content script not loaded, inject it
            console.log('🔧 SEMANTEST: Injecting content script into tab', tab.id);
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content-script.js']
              });
              
              // Wait a bit for script to initialize
              await new Promise(resolve => setTimeout(resolve, 500));
              
              // Try sending again
              await chrome.tabs.sendMessage(tab.id, event);
              console.log('✅ SEMANTEST: Sent to tab after injection', tab.id);
            } catch (injectError) {
              console.error('❌ SEMANTEST: Failed to inject script', injectError);
            }
          }
        }
      } else {
        console.log('❌ SEMANTEST: No ChatGPT tabs found');
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

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 SEMANTEST: Message received:', request.type);
  
  switch(request.type) {
    case 'GET_WS_STATUS':
      sendResponse({ connected: wsHandler.isConnected });
      break;
      
    case 'CONNECT_WEBSOCKET':
      wsHandler.connect();
      sendResponse({ status: 'connecting' });
      break;
      
    case 'SEND_PROMPT':
      if (request.prompt) {
        wsHandler.handleEvent({
          type: 'ImageGenerationRequestedEvent',
          prompt: request.prompt
        });
        sendResponse({ status: 'sent' });
      }
      break;
      
    case 'CHATGPT_STATE_CHANGE':
      console.log('State change:', request.state);
      if (wsHandler.isConnected) {
        wsHandler.send({
          type: 'STATE_CHANGE',
          state: request.state,
          tabId: sender.tab?.id
        });
      }
      break;
  }
  
  return true; // Keep channel open for async response
});

// Keep service worker alive
setInterval(() => {
  console.log('💓 SEMANTEST: Alive');
}, 20000);

console.log('✅ SEMANTEST Background Script Ready');
