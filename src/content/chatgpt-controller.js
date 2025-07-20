// ChatGPT Controller - Content Script for Chrome Extension
// Handles programmatic interaction with ChatGPT interface

class ChatGPTController {
  constructor() {
    this.isInitialized = false;
    this.waitTimeout = 10000; // 10 seconds default timeout
    
    // Selectors for ChatGPT UI elements
    this.selectors = {
      // Project Management
      sidebar: 'nav[aria-label="Chat history"]',
      newProjectButton: 'button:has-text("New Project"), button[aria-label*="project"], [data-testid="new-project-button"]',
      projectNameInput: 'input[placeholder*="project name"], input[name="project-name"], [data-testid="project-name-input"]',
      createProjectButton: 'button:has-text("Create"), button[type="submit"]:has-text("Create")',
      projectsList: '[role="navigation"] [role="list"]',
      
      // Chat Interface
      newChatButton: 'a[href="/"], button[aria-label="New chat"], nav button:first-child',
      chatInput: 'textarea[placeholder*="Message"], textarea[data-id="root"], #prompt-textarea',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send message"], form button:last-child:not(:disabled)',
      
      // Settings & Custom Instructions
      profileButton: 'button[aria-label*="Profile"], button:has(img[alt*="User"])',
      settingsMenuItem: '[role="menuitem"]:has-text("Settings"), [role="menuitem"]:has-text("Custom instructions")',
      customInstructionsButton: 'button:has-text("Custom instructions"), [data-testid="custom-instructions"]',
      customInstructionsTextarea: 'textarea[placeholder*="custom instructions"], textarea[name="about-user-message"]',
      aboutModelTextarea: 'textarea[placeholder*="How would you like ChatGPT to respond"], textarea[name="about-model-message"]',
      saveButton: 'button:has-text("Save"), button[type="submit"]:has-text("Save")',
      
      // Chat Messages
      messagesContainer: 'main [role="presentation"], main .flex.flex-col',
      message: '[data-message-author-role]',
      assistantMessage: '[data-message-author-role="assistant"]',
      userMessage: '[data-message-author-role="user"]',
      streamingIndicator: '.result-streaming, [data-testid="streaming-indicator"]'
    };
    
    this.init();
  }

  async init() {
    console.log('[ChatGPT Controller] Initializing...');
    
    try {
      // Wait for ChatGPT to load
      await this.waitForChatGPTLoad();
      this.isInitialized = true;
      console.log('[ChatGPT Controller] Initialized successfully');
      
      // Set up message listener for commands from extension
      this.setupMessageListener();
      
      // Notify that controller is ready
      this.sendMessage({ type: 'CONTROLLER_READY' });
    } catch (error) {
      console.error('[ChatGPT Controller] Initialization failed:', error);
      this.sendMessage({ type: 'CONTROLLER_ERROR', error: error.message });
    }
  }

  async waitForChatGPTLoad() {
    // Wait for essential elements to be present
    await this.waitForSelector(this.selectors.chatInput, 15000);
    console.log('[ChatGPT Controller] ChatGPT interface loaded');
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[ChatGPT Controller] Received command:', request.action);
      
      // Handle async operations
      (async () => {
        try {
          let result;
          
          switch (request.action) {
            case 'CREATE_PROJECT':
              result = await this.createProject(request.data.name);
              break;
              
            case 'SET_CUSTOM_INSTRUCTIONS':
              result = await this.setCustomInstructions(
                request.data.aboutUser,
                request.data.aboutModel
              );
              break;
              
            case 'CREATE_NEW_CHAT':
              result = await this.createNewChat();
              break;
              
            case 'SEND_PROMPT':
              result = await this.sendPrompt(request.data.text);
              break;
              
            case 'GET_STATUS':
              result = this.getStatus();
              break;
              
            default:
              result = { success: false, error: 'Unknown action' };
          }
          
          sendResponse(result);
        } catch (error) {
          console.error('[ChatGPT Controller] Command error:', error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      return true; // Keep message channel open for async response
    });
  }

  // 1. Create New Project
  async createProject(projectName) {
    try {
      console.log('[ChatGPT Controller] Creating project:', projectName);
      
      // Look for new project button
      const newProjectBtn = await this.findElement(this.selectors.newProjectButton);
      if (!newProjectBtn) {
        throw new Error('New Project button not found');
      }
      
      // Click new project button
      await this.clickElement(newProjectBtn);
      await this.delay(500);
      
      // Wait for project name input
      const nameInput = await this.waitForSelector(this.selectors.projectNameInput);
      if (!nameInput) {
        throw new Error('Project name input not found');
      }
      
      // Enter project name
      await this.setInputValue(nameInput, projectName);
      await this.delay(300);
      
      // Find and click create button
      const createBtn = await this.findElement(this.selectors.createProjectButton);
      if (!createBtn) {
        throw new Error('Create project button not found');
      }
      
      await this.clickElement(createBtn);
      await this.delay(1000);
      
      console.log('[ChatGPT Controller] Project created successfully');
      return { success: true, projectName };
      
    } catch (error) {
      console.error('[ChatGPT Controller] Failed to create project:', error);
      return { success: false, error: error.message };
    }
  }

  // 2. Set Custom Instructions
  async setCustomInstructions(aboutUser, aboutModel) {
    try {
      console.log('[ChatGPT Controller] Setting custom instructions');
      
      // Open profile menu
      const profileBtn = await this.findElement(this.selectors.profileButton);
      if (!profileBtn) {
        throw new Error('Profile button not found');
      }
      
      await this.clickElement(profileBtn);
      await this.delay(500);
      
      // Click custom instructions or settings
      let customInstructionsItem = await this.findElement(this.selectors.customInstructionsButton);
      if (!customInstructionsItem) {
        // Try settings menu first
        const settingsItem = await this.findElement(this.selectors.settingsMenuItem);
        if (settingsItem) {
          await this.clickElement(settingsItem);
          await this.delay(500);
          customInstructionsItem = await this.findElement(this.selectors.customInstructionsButton);
        }
      }
      
      if (!customInstructionsItem) {
        throw new Error('Custom instructions option not found');
      }
      
      await this.clickElement(customInstructionsItem);
      await this.delay(1000);
      
      // Fill in custom instructions
      if (aboutUser) {
        const aboutUserInput = await this.waitForSelector(this.selectors.customInstructionsTextarea);
        if (aboutUserInput) {
          await this.setInputValue(aboutUserInput, aboutUser);
        }
      }
      
      if (aboutModel) {
        const aboutModelInput = await this.findElement(this.selectors.aboutModelTextarea);
        if (aboutModelInput) {
          await this.setInputValue(aboutModelInput, aboutModel);
        }
      }
      
      await this.delay(500);
      
      // Save instructions
      const saveBtn = await this.findElement(this.selectors.saveButton);
      if (!saveBtn) {
        throw new Error('Save button not found');
      }
      
      await this.clickElement(saveBtn);
      await this.delay(1000);
      
      console.log('[ChatGPT Controller] Custom instructions set successfully');
      return { success: true };
      
    } catch (error) {
      console.error('[ChatGPT Controller] Failed to set custom instructions:', error);
      return { success: false, error: error.message };
    }
  }

  // 3. Create New Chat
  async createNewChat() {
    try {
      console.log('[ChatGPT Controller] Creating new chat');
      
      // Find new chat button
      const newChatBtn = await this.findElement(this.selectors.newChatButton);
      if (!newChatBtn) {
        throw new Error('New chat button not found');
      }
      
      await this.clickElement(newChatBtn);
      await this.delay(1000);
      
      // Wait for chat input to be ready
      await this.waitForSelector(this.selectors.chatInput);
      
      console.log('[ChatGPT Controller] New chat created successfully');
      return { success: true };
      
    } catch (error) {
      console.error('[ChatGPT Controller] Failed to create new chat:', error);
      return { success: false, error: error.message };
    }
  }

  // 4. Send Prompt
  async sendPrompt(text) {
    try {
      console.log('[ChatGPT Controller] Sending prompt:', text.substring(0, 50) + '...');
      
      // Find chat input
      const chatInput = await this.waitForSelector(this.selectors.chatInput);
      if (!chatInput) {
        throw new Error('Chat input not found');
      }
      
      // Clear and set new text
      await this.setInputValue(chatInput, text);
      await this.delay(300);
      
      // Find send button
      const sendBtn = await this.waitForEnabledButton(this.selectors.sendButton);
      if (!sendBtn) {
        throw new Error('Send button not found or not enabled');
      }
      
      await this.clickElement(sendBtn);
      
      // Wait for response to start
      await this.waitForResponse();
      
      console.log('[ChatGPT Controller] Prompt sent successfully');
      return { success: true, prompt: text };
      
    } catch (error) {
      console.error('[ChatGPT Controller] Failed to send prompt:', error);
      return { success: false, error: error.message };
    }
  }

  // Helper: Wait for response
  async waitForResponse() {
    try {
      // Wait for streaming indicator to appear
      await this.waitForSelector(this.selectors.streamingIndicator, 5000);
      console.log('[ChatGPT Controller] Response started');
      
      // Optionally wait for streaming to complete
      await this.waitForStreamingComplete();
      
    } catch (error) {
      console.log('[ChatGPT Controller] Could not detect streaming indicator');
    }
  }

  async waitForStreamingComplete(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const streamingElement = document.querySelector(this.selectors.streamingIndicator);
      if (!streamingElement) {
        console.log('[ChatGPT Controller] Streaming complete');
        return true;
      }
      await this.delay(500);
    }
    
    console.log('[ChatGPT Controller] Streaming timeout reached');
    return false;
  }

  // Utility Methods
  async findElement(selector) {
    // Try multiple selector strategies
    let element = document.querySelector(selector);
    
    if (!element && selector.includes(':has-text')) {
      // Handle :has-text pseudo-selector
      const [baseSelector, text] = selector.split(':has-text');
      const textToFind = text.replace(/[()'"]/g, '');
      const elements = document.querySelectorAll(baseSelector.trim());
      
      element = Array.from(elements).find(el => 
        el.textContent.toLowerCase().includes(textToFind.toLowerCase())
      );
    }
    
    return element;
  }

  async waitForSelector(selector, timeout = null) {
    const timeoutMs = timeout || this.waitTimeout;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeoutMs) {
      const element = await this.findElement(selector);
      if (element) {
        return element;
      }
      await this.delay(100);
    }
    
    return null;
  }

  async waitForEnabledButton(selector, timeout = 5000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const button = await this.findElement(selector);
      if (button && !button.disabled) {
        return button;
      }
      await this.delay(100);
    }
    
    return null;
  }

  async clickElement(element) {
    if (!element) return;
    
    // Scroll into view if needed
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await this.delay(100);
    
    // Dispatch click event
    element.click();
  }

  async setInputValue(element, value) {
    if (!element) return;
    
    // Focus the element
    element.focus();
    await this.delay(100);
    
    // Clear existing value
    element.value = '';
    
    // Set new value
    element.value = value;
    
    // Dispatch input events for React
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    element.dispatchEvent(changeEvent);
    
    // For some inputs, we might need to dispatch a keyboard event
    const keyboardEvent = new KeyboardEvent('keydown', {
      bubbles: true,
      cancelable: true,
      key: 'Enter',
      code: 'Enter'
    });
    element.dispatchEvent(keyboardEvent);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  sendMessage(message) {
    window.postMessage({ source: 'CHATGPT_CONTROLLER', ...message }, '*');
  }

  getStatus() {
    return {
      success: true,
      initialized: this.isInitialized,
      url: window.location.href,
      chatInputPresent: !!document.querySelector(this.selectors.chatInput)
    };
  }
}

// Initialize controller when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.chatGPTController = new ChatGPTController();
  });
} else {
  window.chatGPTController = new ChatGPTController();
}

console.log('[ChatGPT Controller] Script loaded');