# Content Script API Documentation

## ChatGPT DOM Interaction Methods

This document provides detailed API documentation for all content script methods that interact with ChatGPT's DOM elements. These methods handle DOM manipulation, event handling, and data extraction from the ChatGPT interface.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [DOM Selectors](#dom-selectors)
3. [Chat Interface Methods](#chat-interface-methods)
4. [Message Handling Methods](#message-handling-methods)
5. [Input Control Methods](#input-control-methods)
6. [Button Injection Methods](#button-injection-methods)
7. [Data Extraction Methods](#data-extraction-methods)
8. [Event Handling Methods](#event-handling-methods)
9. [Utility Methods](#utility-methods)
10. [Error Handling](#error-handling)

---

## 🌐 Overview

The content script runs in the context of ChatGPT web pages and provides methods to interact with the DOM. All methods are designed to be resilient to ChatGPT UI changes.

### Initialization

```javascript
// content-script.js
class ChatGPTContentScript {
  constructor() {
    this.selectors = new DOMSelectors();
    this.observer = new MutationObserver(this.handleMutations.bind(this));
    this.initialize();
  }

  async initialize() {
    await this.waitForChatGPTLoad();
    this.injectExtensionUI();
    this.attachEventListeners();
    this.startObserving();
  }
}
```

---

## 🎯 DOM Selectors

### Current ChatGPT Selectors (v1.0)

```javascript
const DOMSelectors = {
  // Main containers
  CHAT_CONTAINER: 'main > div > div > div > div',
  CONVERSATION_LIST: 'nav > div > div',
  MESSAGE_LIST: 'div[class*="react-scroll-to-bottom"]',
  
  // Input elements
  TEXTAREA: 'textarea[data-id="root"]',
  SEND_BUTTON: 'button[data-testid="send-button"]',
  STOP_BUTTON: 'button[aria-label="Stop generating"]',
  
  // Messages
  USER_MESSAGE: 'div[data-testid*="user-message"]',
  ASSISTANT_MESSAGE: 'div[data-testid*="assistant-message"]',
  MESSAGE_CONTENT: '.markdown.prose',
  
  // UI elements
  NEW_CHAT_BUTTON: 'a[href="/"]',
  MODEL_SELECTOR: 'button[id*="headlessui-menu-button"]',
  REGENERATE_BUTTON: 'button:has(svg path[d*="M3.478"])',
  
  // Code blocks
  CODE_BLOCK: 'pre > div > div',
  COPY_CODE_BUTTON: 'button[aria-label="Copy code"]',
  
  // Images
  MESSAGE_IMAGE: 'img[src*="dalle"], img[alt*="Generated"]'
};
```

### Selector Update Strategy

```javascript
class SelectorManager {
  constructor() {
    this.selectors = { ...DOMSelectors };
    this.fallbacks = new Map();
  }

  /**
   * Get selector with fallback support
   * @param {string} key - Selector key
   * @returns {string} CSS selector
   */
  getSelector(key) {
    const primary = this.selectors[key];
    if (document.querySelector(primary)) {
      return primary;
    }
    
    // Try fallback selectors
    const fallback = this.fallbacks.get(key);
    if (fallback && document.querySelector(fallback)) {
      console.warn(`Using fallback selector for ${key}`);
      return fallback;
    }
    
    throw new Error(`No valid selector found for ${key}`);
  }

  /**
   * Register fallback selector
   * @param {string} key - Selector key
   * @param {string} fallbackSelector - Fallback CSS selector
   */
  registerFallback(key, fallbackSelector) {
    this.fallbacks.set(key, fallbackSelector);
  }
}
```

---

## 💬 Chat Interface Methods

### waitForChatGPTLoad()

Waits for ChatGPT interface to be fully loaded and ready.

```javascript
/**
 * Wait for ChatGPT to fully load
 * @param {number} timeout - Maximum wait time in milliseconds
 * @returns {Promise<boolean>} - True if loaded successfully
 */
async waitForChatGPTLoad(timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkInterval = setInterval(() => {
      const textarea = document.querySelector(this.selectors.TEXTAREA);
      const messageList = document.querySelector(this.selectors.MESSAGE_LIST);
      
      if (textarea && messageList) {
        clearInterval(checkInterval);
        resolve(true);
      }
      
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        resolve(false);
      }
    }, 100);
  });
}
```

### injectExtensionUI()

Injects extension UI elements into ChatGPT interface.

```javascript
/**
 * Inject extension UI elements
 */
injectExtensionUI() {
  // Inject toolbar
  this.injectToolbar();
  
  // Inject project selector
  this.injectProjectSelector();
  
  // Inject quick action buttons
  this.injectQuickActions();
  
  // Inject custom styles
  this.injectStyles();
}

/**
 * Inject extension toolbar
 */
injectToolbar() {
  const toolbar = document.createElement('div');
  toolbar.className = 'chatgpt-extension-toolbar';
  toolbar.innerHTML = `
    <div class="toolbar-container">
      <button id="ext-project-btn" title="Current Project">
        <svg>...</svg>
        <span>No Project</span>
      </button>
      <button id="ext-instructions-btn" title="Instructions">
        <svg>...</svg>
      </button>
      <button id="ext-download-btn" title="Download Images">
        <svg>...</svg>
      </button>
    </div>
  `;
  
  const chatContainer = document.querySelector(this.selectors.CHAT_CONTAINER);
  if (chatContainer) {
    chatContainer.insertBefore(toolbar, chatContainer.firstChild);
  }
}
```

### getCurrentChatId()

Gets the current chat ID from the URL or DOM.

```javascript
/**
 * Get current chat ID
 * @returns {string|null} Chat ID or null if on new chat
 */
getCurrentChatId() {
  // Try to get from URL
  const urlMatch = window.location.pathname.match(/\/c\/([a-f0-9-]+)/);
  if (urlMatch) {
    return urlMatch[1];
  }
  
  // Check if it's a new chat
  if (window.location.pathname === '/') {
    return 'new-chat';
  }
  
  return null;
}
```

---

## 📨 Message Handling Methods

### getAllMessages()

Retrieves all messages in the current conversation.

```javascript
/**
 * Get all messages in current conversation
 * @returns {Array<Object>} Array of message objects
 */
getAllMessages() {
  const messages = [];
  const messageElements = document.querySelectorAll(
    `${this.selectors.USER_MESSAGE}, ${this.selectors.ASSISTANT_MESSAGE}`
  );
  
  messageElements.forEach((element, index) => {
    const isUser = element.matches(this.selectors.USER_MESSAGE);
    const content = this.extractMessageContent(element);
    const timestamp = this.getMessageTimestamp(element);
    
    messages.push({
      id: `msg-${index}`,
      role: isUser ? 'user' : 'assistant',
      content: content,
      timestamp: timestamp,
      element: element
    });
  });
  
  return messages;
}

/**
 * Extract message content including text and code blocks
 * @param {HTMLElement} messageElement - Message DOM element
 * @returns {Object} Message content object
 */
extractMessageContent(messageElement) {
  const content = {
    text: '',
    codeBlocks: [],
    images: []
  };
  
  // Extract text content
  const textElement = messageElement.querySelector(this.selectors.MESSAGE_CONTENT);
  if (textElement) {
    content.text = textElement.innerText;
  }
  
  // Extract code blocks
  const codeBlocks = messageElement.querySelectorAll('pre');
  codeBlocks.forEach((block, index) => {
    const language = block.querySelector('span')?.innerText || 'text';
    const code = block.querySelector('code')?.innerText || '';
    
    content.codeBlocks.push({
      id: `code-${index}`,
      language: language,
      code: code
    });
  });
  
  // Extract images
  const images = messageElement.querySelectorAll('img');
  images.forEach((img, index) => {
    content.images.push({
      id: `img-${index}`,
      src: img.src,
      alt: img.alt,
      width: img.naturalWidth,
      height: img.naturalHeight
    });
  });
  
  return content;
}
```

### observeNewMessages()

Sets up observer for new messages in the conversation.

```javascript
/**
 * Observe new messages
 * @param {Function} callback - Callback for new messages
 */
observeNewMessages(callback) {
  const messageList = document.querySelector(this.selectors.MESSAGE_LIST);
  if (!messageList) return;
  
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isUserMessage = node.matches?.(this.selectors.USER_MESSAGE);
          const isAssistantMessage = node.matches?.(this.selectors.ASSISTANT_MESSAGE);
          
          if (isUserMessage || isAssistantMessage) {
            const message = {
              role: isUserMessage ? 'user' : 'assistant',
              content: this.extractMessageContent(node),
              element: node,
              timestamp: new Date().toISOString()
            };
            
            callback(message);
          }
        }
      });
    });
  });
  
  observer.observe(messageList, {
    childList: true,
    subtree: true
  });
  
  return observer;
}
```

### addMessageButtons()

Adds custom buttons to each message.

```javascript
/**
 * Add custom buttons to messages
 * @param {HTMLElement} messageElement - Message DOM element
 */
addMessageButtons(messageElement) {
  // Check if buttons already added
  if (messageElement.querySelector('.extension-message-buttons')) return;
  
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'extension-message-buttons';
  buttonContainer.innerHTML = `
    <button class="ext-copy-btn" title="Copy to clipboard">
      <svg>...</svg>
    </button>
    <button class="ext-bookmark-btn" title="Bookmark">
      <svg>...</svg>
    </button>
    <button class="ext-download-btn" title="Download">
      <svg>...</svg>
    </button>
  `;
  
  // Find appropriate location to insert buttons
  const messageContent = messageElement.querySelector('.flex.flex-col');
  if (messageContent) {
    messageContent.appendChild(buttonContainer);
  }
  
  // Attach event listeners
  this.attachMessageButtonListeners(buttonContainer, messageElement);
}
```

---

## ⌨️ Input Control Methods

### getTextarea()

Gets the main textarea element.

```javascript
/**
 * Get ChatGPT textarea element
 * @returns {HTMLTextAreaElement|null} Textarea element
 */
getTextarea() {
  return document.querySelector(this.selectors.TEXTAREA);
}
```

### setInputValue()

Sets the value of the textarea and triggers necessary events.

```javascript
/**
 * Set textarea value and trigger input events
 * @param {string} text - Text to set
 */
setInputValue(text) {
  const textarea = this.getTextarea();
  if (!textarea) return;
  
  // Set value
  textarea.value = text;
  
  // Trigger React's onChange
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  ).set;
  
  nativeInputValueSetter.call(textarea, text);
  
  // Dispatch input event
  const inputEvent = new Event('input', { bubbles: true });
  textarea.dispatchEvent(inputEvent);
  
  // Adjust height if needed
  this.adjustTextareaHeight(textarea);
}

/**
 * Adjust textarea height based on content
 * @param {HTMLTextAreaElement} textarea - Textarea element
 */
adjustTextareaHeight(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
}
```

### sendMessage()

Sends a message by setting input and clicking send button.

```javascript
/**
 * Send a message
 * @param {string} message - Message to send
 * @returns {Promise<boolean>} Success status
 */
async sendMessage(message) {
  try {
    // Set message
    this.setInputValue(message);
    
    // Wait a bit for UI to update
    await this.wait(100);
    
    // Find and click send button
    const sendButton = document.querySelector(this.selectors.SEND_BUTTON);
    if (!sendButton || sendButton.disabled) {
      throw new Error('Send button not available');
    }
    
    sendButton.click();
    return true;
  } catch (error) {
    console.error('Failed to send message:', error);
    return false;
  }
}
```

### insertTextAtCursor()

Inserts text at the current cursor position.

```javascript
/**
 * Insert text at cursor position
 * @param {string} text - Text to insert
 */
insertTextAtCursor(text) {
  const textarea = this.getTextarea();
  if (!textarea) return;
  
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const currentValue = textarea.value;
  
  const newValue = 
    currentValue.substring(0, start) + 
    text + 
    currentValue.substring(end);
  
  this.setInputValue(newValue);
  
  // Restore cursor position
  textarea.selectionStart = start + text.length;
  textarea.selectionEnd = start + text.length;
  textarea.focus();
}
```

---

## 🔘 Button Injection Methods

### injectQuickActionButtons()

Injects quick action buttons near the input area.

```javascript
/**
 * Inject quick action buttons
 */
injectQuickActionButtons() {
  const quickActions = document.createElement('div');
  quickActions.className = 'extension-quick-actions';
  quickActions.innerHTML = `
    <button class="quick-action" data-action="clear" title="Clear chat (Ctrl+L)">
      <svg>...</svg>
    </button>
    <button class="quick-action" data-action="template" title="Insert template">
      <svg>...</svg>
    </button>
    <button class="quick-action" data-action="voice" title="Voice input">
      <svg>...</svg>
    </button>
    <button class="quick-action" data-action="image" title="Attach image">
      <svg>...</svg>
    </button>
  `;
  
  // Find input container
  const inputContainer = this.getTextarea()?.parentElement?.parentElement;
  if (inputContainer) {
    inputContainer.insertBefore(quickActions, inputContainer.firstChild);
  }
  
  // Attach listeners
  quickActions.addEventListener('click', this.handleQuickAction.bind(this));
}

/**
 * Handle quick action button clicks
 * @param {Event} event - Click event
 */
handleQuickAction(event) {
  const button = event.target.closest('.quick-action');
  if (!button) return;
  
  const action = button.dataset.action;
  
  switch (action) {
    case 'clear':
      this.clearChat();
      break;
    case 'template':
      this.showTemplateMenu();
      break;
    case 'voice':
      this.startVoiceInput();
      break;
    case 'image':
      this.showImageUploader();
      break;
  }
}
```

### replaceRegenerateButton()

Enhances the regenerate button with additional options.

```javascript
/**
 * Replace regenerate button with enhanced version
 */
replaceRegenerateButton() {
  const regenerateButton = document.querySelector(this.selectors.REGENERATE_BUTTON);
  if (!regenerateButton || regenerateButton.dataset.enhanced) return;
  
  // Mark as enhanced
  regenerateButton.dataset.enhanced = 'true';
  
  // Add dropdown arrow
  const dropdownArrow = document.createElement('span');
  dropdownArrow.className = 'dropdown-arrow';
  dropdownArrow.innerHTML = '▼';
  regenerateButton.appendChild(dropdownArrow);
  
  // Create dropdown menu
  const dropdown = document.createElement('div');
  dropdown.className = 'regenerate-dropdown hidden';
  dropdown.innerHTML = `
    <button data-action="regenerate-default">Regenerate response</button>
    <button data-action="regenerate-shorter">Make shorter</button>
    <button data-action="regenerate-longer">Make longer</button>
    <button data-action="regenerate-simpler">Simplify</button>
    <button data-action="regenerate-detailed">More detailed</button>
  `;
  
  regenerateButton.parentElement.appendChild(dropdown);
  
  // Handle clicks
  dropdownArrow.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('hidden');
  });
}
```

---

## 📊 Data Extraction Methods

### extractConversation()

Extracts the entire conversation as structured data.

```javascript
/**
 * Extract entire conversation
 * @returns {Object} Conversation object
 */
extractConversation() {
  const messages = this.getAllMessages();
  const metadata = this.getConversationMetadata();
  
  return {
    id: this.getCurrentChatId(),
    title: this.getConversationTitle(),
    messages: messages,
    metadata: metadata,
    extractedAt: new Date().toISOString()
  };
}

/**
 * Get conversation metadata
 * @returns {Object} Metadata object
 */
getConversationMetadata() {
  return {
    model: this.getCurrentModel(),
    messageCount: this.getAllMessages().length,
    createdAt: this.getConversationCreatedTime(),
    lastMessageAt: this.getLastMessageTime(),
    url: window.location.href
  };
}
```

### extractImages()

Extracts all images from the conversation.

```javascript
/**
 * Extract all images from conversation
 * @returns {Array<Object>} Array of image objects
 */
extractImages() {
  const images = [];
  const imageElements = document.querySelectorAll(this.selectors.MESSAGE_IMAGE);
  
  imageElements.forEach((img, index) => {
    const messageElement = img.closest(
      `${this.selectors.USER_MESSAGE}, ${this.selectors.ASSISTANT_MESSAGE}`
    );
    
    const imageData = {
      id: `img-${index}`,
      src: img.src,
      alt: img.alt || '',
      width: img.naturalWidth,
      height: img.naturalHeight,
      prompt: this.getImagePrompt(messageElement),
      messageRole: messageElement?.matches(this.selectors.USER_MESSAGE) ? 'user' : 'assistant',
      timestamp: this.getMessageTimestamp(messageElement)
    };
    
    images.push(imageData);
  });
  
  return images;
}

/**
 * Get prompt that generated the image
 * @param {HTMLElement} messageElement - Message containing image
 * @returns {string} Image prompt
 */
getImagePrompt(messageElement) {
  if (!messageElement) return '';
  
  // Look for previous user message
  let prevElement = messageElement.previousElementSibling;
  while (prevElement) {
    if (prevElement.matches(this.selectors.USER_MESSAGE)) {
      const textContent = prevElement.querySelector(this.selectors.MESSAGE_CONTENT);
      return textContent?.innerText || '';
    }
    prevElement = prevElement.previousElementSibling;
  }
  
  return '';
}
```

### exportToMarkdown()

Exports conversation to Markdown format.

```javascript
/**
 * Export conversation to Markdown
 * @returns {string} Markdown formatted conversation
 */
exportToMarkdown() {
  const conversation = this.extractConversation();
  let markdown = `# ${conversation.title || 'ChatGPT Conversation'}\n\n`;
  markdown += `**Date**: ${new Date().toLocaleDateString()}\n`;
  markdown += `**Model**: ${conversation.metadata.model}\n\n`;
  markdown += '---\n\n';
  
  conversation.messages.forEach((message) => {
    markdown += `## ${message.role === 'user' ? '👤 User' : '🤖 Assistant'}\n\n`;
    markdown += `${message.content.text}\n\n`;
    
    // Add code blocks
    message.content.codeBlocks.forEach((block) => {
      markdown += `\`\`\`${block.language}\n${block.code}\n\`\`\`\n\n`;
    });
    
    // Note images
    message.content.images.forEach((img, index) => {
      markdown += `![Image ${index + 1}](${img.src})\n\n`;
    });
  });
  
  return markdown;
}
```

---

## 🎧 Event Handling Methods

### attachEventListeners()

Attaches all necessary event listeners.

```javascript
/**
 * Attach all event listeners
 */
attachEventListeners() {
  // Keyboard shortcuts
  document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  
  // Message observations
  this.observeNewMessages(this.handleNewMessage.bind(this));
  
  // Input monitoring
  const textarea = this.getTextarea();
  if (textarea) {
    textarea.addEventListener('keydown', this.handleTextareaKeydown.bind(this));
    textarea.addEventListener('paste', this.handlePaste.bind(this));
  }
  
  // Click delegation
  document.addEventListener('click', this.handleGlobalClick.bind(this), true);
  
  // Page visibility
  document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 */
handleKeyboardShortcuts(event) {
  // Ctrl/Cmd + Shift + P: Open project selector
  if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key === 'P') {
    event.preventDefault();
    this.openProjectSelector();
  }
  
  // Ctrl/Cmd + I: Insert instruction
  if ((event.ctrlKey || event.metaKey) && event.key === 'i') {
    event.preventDefault();
    this.showInstructionDialog();
  }
  
  // Ctrl/Cmd + D: Download images
  if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    this.downloadAllImages();
  }
}
```

### handleTextareaKeydown()

Handles textarea-specific keyboard events.

```javascript
/**
 * Handle textarea keydown events
 * @param {KeyboardEvent} event - Keyboard event
 */
handleTextareaKeydown(event) {
  // Tab completion
  if (event.key === 'Tab' && !event.shiftKey) {
    const hasCompletion = this.tryTabCompletion();
    if (hasCompletion) {
      event.preventDefault();
    }
  }
  
  // Template shortcuts (e.g., /template)
  if (event.key === 'Enter' && !event.shiftKey) {
    const textarea = event.target;
    const value = textarea.value;
    
    if (value.startsWith('/')) {
      const command = value.substring(1).toLowerCase();
      if (this.handleSlashCommand(command)) {
        event.preventDefault();
      }
    }
  }
}

/**
 * Handle slash commands
 * @param {string} command - Command without slash
 * @returns {boolean} Whether command was handled
 */
handleSlashCommand(command) {
  const commands = {
    'clear': () => this.clearChat(),
    'help': () => this.showHelp(),
    'template': () => this.showTemplateMenu(),
    'project': () => this.openProjectSelector(),
    'settings': () => this.openSettings()
  };
  
  const handler = commands[command];
  if (handler) {
    handler();
    this.setInputValue(''); // Clear command
    return true;
  }
  
  return false;
}
```

---

## 🛠️ Utility Methods

### wait()

Simple promise-based wait utility.

```javascript
/**
 * Wait for specified milliseconds
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise} Promise that resolves after timeout
 */
wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

### scrollToBottom()

Scrolls the conversation to the bottom.

```javascript
/**
 * Scroll conversation to bottom
 */
scrollToBottom() {
  const messageList = document.querySelector(this.selectors.MESSAGE_LIST);
  if (messageList) {
    const scrollContainer = messageList.querySelector('[class*="react-scroll-to-bottom"]');
    if (scrollContainer) {
      scrollContainer.scrollTop = scrollContainer.scrollHeight;
    }
  }
}
```

### highlightElement()

Temporarily highlights an element.

```javascript
/**
 * Highlight element temporarily
 * @param {HTMLElement} element - Element to highlight
 * @param {number} duration - Highlight duration in ms
 */
highlightElement(element, duration = 2000) {
  const originalStyle = element.style.cssText;
  element.style.cssText += `
    background-color: yellow !important;
    transition: background-color 0.3s ease;
  `;
  
  setTimeout(() => {
    element.style.cssText = originalStyle;
  }, duration);
}
```

### copyToClipboard()

Copies text to clipboard with fallback.

```javascript
/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
async copyToClipboard(text) {
  try {
    // Try modern clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    
    // Fallback to older method
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-999999px';
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      return true;
    } finally {
      document.body.removeChild(textarea);
    }
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
```

---

## ❌ Error Handling

### Safe DOM Operations

```javascript
/**
 * Safely query selector with error handling
 * @param {string} selector - CSS selector
 * @param {HTMLElement} parent - Parent element
 * @returns {HTMLElement|null} Found element or null
 */
safeQuerySelector(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return null;
  }
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - Operation to retry
 * @param {number} maxRetries - Maximum retry attempts
 * @returns {Promise<any>} Operation result
 */
async retryOperation(operation, maxRetries = 3) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const delay = Math.pow(2, i) * 1000; // Exponential backoff
      await this.wait(delay);
    }
  }
  
  throw lastError;
}
```

### Error Recovery

```javascript
/**
 * Handle DOM structure changes
 */
handleDOMStructureChange() {
  console.warn('ChatGPT DOM structure changed, reinitializing...');
  
  // Update selectors
  this.updateSelectors();
  
  // Reinject UI elements
  this.reinjectUI();
  
  // Reattach listeners
  this.reattachListeners();
  
  // Notify background script
  chrome.runtime.sendMessage({
    type: 'DOM_STRUCTURE_CHANGED',
    timestamp: new Date().toISOString()
  });
}

/**
 * Graceful degradation for missing features
 */
enableGracefulDegradation() {
  // Check for missing features
  const features = {
    textarea: !!this.getTextarea(),
    messages: !!document.querySelector(this.selectors.MESSAGE_LIST),
    buttons: !!document.querySelector(this.selectors.SEND_BUTTON)
  };
  
  // Disable features that depend on missing elements
  Object.entries(features).forEach(([feature, available]) => {
    if (!available) {
      console.warn(`Feature unavailable: ${feature}`);
      this.disableFeature(feature);
    }
  });
}
```

---

## 📝 Usage Examples

### Complete Implementation Example

```javascript
// content-script.js
(async function() {
  'use strict';
  
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }
  
  async function initialize() {
    try {
      const contentScript = new ChatGPTContentScript();
      
      // Wait for ChatGPT to load
      const loaded = await contentScript.waitForChatGPTLoad();
      if (!loaded) {
        throw new Error('ChatGPT failed to load');
      }
      
      // Set up message observer
      contentScript.observeNewMessages((message) => {
        console.log('New message:', message);
        
        // Add custom buttons to new messages
        contentScript.addMessageButtons(message.element);
        
        // Check for images
        if (message.content.images.length > 0) {
          contentScript.processImages(message.content.images);
        }
      });
      
      // Listen for extension messages
      chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        switch (request.action) {
          case 'SEND_MESSAGE':
            contentScript.sendMessage(request.message)
              .then(success => sendResponse({ success }));
            return true;
            
          case 'EXPORT_CONVERSATION':
            const markdown = contentScript.exportToMarkdown();
            sendResponse({ markdown });
            break;
            
          case 'EXTRACT_IMAGES':
            const images = contentScript.extractImages();
            sendResponse({ images });
            break;
        }
      });
      
      console.log('ChatGPT Extension initialized successfully');
      
    } catch (error) {
      console.error('Failed to initialize extension:', error);
    }
  }
})();
```

---

## 🔄 Version History

- **v1.0.0** (2025-01-19): Initial API documentation
- **v1.1.0** (Planned): Support for ChatGPT UI v2
- **v1.2.0** (Planned): Enhanced error recovery

---

**Note**: This documentation is maintained alongside ChatGPT UI updates. Always check for the latest version to ensure compatibility.