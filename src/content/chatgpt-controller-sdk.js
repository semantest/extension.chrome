// ChatGPT controller using Semantest SDK event system
// Handles ChatGPT page automation with SDK integration

(function() {
  'use strict';

  console.log('🚀 ChatGPT Controller (SDK Version) initialized');

  // Controller state
  let isInitialized = false;
  let currentConversationId = null;
  let currentMessageId = null;

  // Initialize controller
  function initialize() {
    if (isInitialized) return;
    
    isInitialized = true;
    setupEventListeners();
    observePageChanges();
    
    // Notify background script
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'chatgpt.ready',
      payload: {
        url: window.location.href,
        timestamp: Date.now()
      }
    });
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.type);

    switch (message.type) {
      case 'TEST_EVENT':
        handleTestEvent(message.event);
        sendResponse({ success: true });
        break;
        
      case 'EXECUTE_ACTION':
        executeAction(message.action, message.params)
          .then(result => sendResponse({ success: true, result }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
        
      default:
        sendResponse({ success: false, error: 'Unknown message type' });
    }
  });

  // Handle test events from SDK
  function handleTestEvent(event) {
    console.log('Test event received:', event);
    
    // Handle different test event types
    switch (event.type) {
      case 'test.input':
        simulateInput(event.payload.text);
        break;
      case 'test.submit':
        submitMessage();
        break;
      case 'test.clear':
        clearConversation();
        break;
    }
  }

  // Execute automation actions
  async function executeAction(action, params) {
    switch (action) {
      case 'INPUT_TEXT':
        return await inputText(params.text);
        
      case 'SUBMIT_MESSAGE':
        return await submitMessage();
        
      case 'CLEAR_CONVERSATION':
        return await clearConversation();
        
      case 'GET_CONVERSATION':
        return await getConversation();
        
      case 'TAKE_SCREENSHOT':
        return await takeScreenshot();
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // Input text into the chat input
  async function inputText(text) {
    const textarea = document.querySelector('textarea[data-id="prompt-textarea"]');
    if (!textarea) {
      throw new Error('Chat input not found');
    }
    
    // Clear existing text
    textarea.value = '';
    
    // Simulate typing
    for (const char of text) {
      textarea.value += char;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      await sleep(10); // Small delay for realistic typing
    }
    
    // Send event
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'chatgpt.input',
      payload: {
        text,
        timestamp: Date.now()
      }
    });
    
    return { success: true, text };
  }

  // Submit the current message
  async function submitMessage() {
    const button = document.querySelector('button[data-testid="send-button"]');
    if (!button) {
      throw new Error('Send button not found');
    }
    
    button.click();
    
    // Send event
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'chatgpt.submit',
      payload: {
        timestamp: Date.now()
      }
    });
    
    return { success: true };
  }

  // Clear the conversation
  async function clearConversation() {
    // Implementation depends on ChatGPT UI
    // This is a placeholder
    console.log('Clear conversation requested');
    
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'chatgpt.clear',
      payload: {
        timestamp: Date.now()
      }
    });
    
    return { success: true };
  }

  // Get current conversation content
  async function getConversation() {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach((el, index) => {
      const role = el.getAttribute('data-message-author-role');
      const content = el.querySelector('.markdown')?.textContent || '';
      
      messages.push({
        index,
        role,
        content: content.trim(),
        timestamp: Date.now()
      });
    });
    
    // Send event with conversation data
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'chatgpt.conversation',
      payload: {
        messages,
        conversationId: currentConversationId,
        timestamp: Date.now()
      }
    });
    
    return { messages, conversationId: currentConversationId };
  }

  // Simulate input for testing
  function simulateInput(text) {
    const textarea = document.querySelector('textarea[data-id="prompt-textarea"]');
    if (textarea) {
      textarea.value = text;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }

  // Set up DOM event listeners
  function setupEventListeners() {
    // Listen for form submissions
    document.addEventListener('submit', (e) => {
      if (e.target.matches('form')) {
        chrome.runtime.sendMessage({
          type: 'SEND_EVENT',
          eventType: 'chatgpt.form_submit',
          payload: {
            timestamp: Date.now()
          }
        });
      }
    });
    
    // Listen for input changes
    document.addEventListener('input', debounce((e) => {
      if (e.target.matches('textarea[data-id="prompt-textarea"]')) {
        chrome.runtime.sendMessage({
          type: 'SEND_EVENT',
          eventType: 'chatgpt.typing',
          payload: {
            length: e.target.value.length,
            timestamp: Date.now()
          }
        });
      }
    }, 500));
  }

  // Observe page changes
  function observePageChanges() {
    const observer = new MutationObserver((mutations) => {
      // Check for new messages
      for (const mutation of mutations) {
        if (mutation.type === 'childList') {
          const addedNodes = Array.from(mutation.addedNodes);
          const hasNewMessage = addedNodes.some(node => 
            node.nodeType === 1 && node.matches?.('[data-message-author-role]')
          );
          
          if (hasNewMessage) {
            chrome.runtime.sendMessage({
              type: 'SEND_EVENT',
              eventType: 'chatgpt.new_message',
              payload: {
                timestamp: Date.now()
              }
            });
          }
        }
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // Utility functions
  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
})();