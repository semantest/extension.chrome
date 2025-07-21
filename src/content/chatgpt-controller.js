// ChatGPT Controller - Content Script for Chrome Extension
// Handles programmatic interaction with ChatGPT interface

class ChatGPTController {
  constructor() {
    this.isInitialized = false;
    this.waitTimeout = 10000; // 10 seconds default timeout
    
    // Initialize error telemetry
    this.initTelemetry();
    
    // Selectors for ChatGPT UI elements
    this.selectors = {
      // Project Management
      sidebar: 'nav[aria-label="Chat history"]',
      newProjectButton: 'button:has-text("New Project"), button[aria-label*="project"], [data-testid="new-project-button"]',
      projectNameInput: 'input[placeholder*="project name"], input[name="project-name"], [data-testid="project-name-input"]',
      createProjectButton: 'button:has-text("Create"), button[type="submit"]:has-text("Create")',
      projectsList: '[role="navigation"] [role="list"]',
      
      // Chat Interface
      newChatButton: 'a[href="/"], button[aria-label="New chat"], nav button:first-child, button:has-text("New chat")',
      chatInput: 'textarea[placeholder*="Message"], textarea[data-id="root"], #prompt-textarea, div[contenteditable="true"][data-id="root"]',
      sendButton: 'button[data-testid="send-button"], button[aria-label="Send message"], form button:last-child:not(:disabled), button[aria-label*="Send"], button:has([data-testid="send-button"])',
      
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

  async initTelemetry() {
    try {
      // Load error reporter
      if (!window.errorReporter) {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('src/telemetry/error-reporter.js');
        document.head.appendChild(script);
        
        // Wait for it to load
        await new Promise(resolve => {
          script.onload = resolve;
          setTimeout(resolve, 1000); // fallback timeout
        });
      }
      
      // Set up feature usage tracking
      this.reportFeatureUsage = (feature, success, metadata) => {
        if (window.errorReporter) {
          window.errorReporter.reportFeatureUsage(feature, success, metadata);
        }
      };
      
      // Set up error reporting
      this.reportError = (error, context) => {
        if (window.errorReporter) {
          window.errorReporter.reportError(error, context);
        }
      };
      
    } catch (error) {
      // Silent fail - don't break extension if telemetry fails
    }
  }

  async init() {
    try {
      await this.waitForChatGPTLoad();
      this.isInitialized = true;
      this.setupMessageListener();
      this.sendMessage({ type: 'CONTROLLER_READY' });
    } catch (error) {
      this.sendMessage({ type: 'CONTROLLER_ERROR', error: error.message });
    }
  }

  async waitForChatGPTLoad() {
    await this.waitForSelector(this.selectors.chatInput, 15000);
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      
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
              
            case 'DETECT_AND_DOWNLOAD_IMAGES':
              result = await this.detectAndDownloadImages(request.data || {});
              break;
              
            case 'REQUEST_DALLE_IMAGE':
              result = await this.requestDALLEImage(
                request.data.prompt,
                request.data.options || {}
              );
              break;
              
            default:
              result = { success: false, error: 'Unknown action' };
          }
          
          sendResponse(result);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      return true; // Keep message channel open for async response
    });
  }

  // 1. Create New Project
  async createProject(projectName) {
    try {
      this.reportFeatureUsage('create_project', true, { projectName: 'redacted' });
      
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
      
      return { success: true, projectName };
      
    } catch (error) {
      this.reportError(error, { feature: 'create_project', projectName: 'redacted' });
      this.reportFeatureUsage('create_project', false, { error: error.message });
      return { success: false, error: error.message };
    }
  }

  // 2. Set Custom Instructions
  async setCustomInstructions(aboutUser, aboutModel) {
    try {
      
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
      
      return { success: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 3. Create New Chat
  async createNewChat() {
    try {
      
      // Find new chat button
      const newChatBtn = await this.findElement(this.selectors.newChatButton);
      if (!newChatBtn) {
        throw new Error('New chat button not found');
      }
      
      await this.clickElement(newChatBtn);
      await this.delay(1000);
      
      // Wait for chat input to be ready
      await this.waitForSelector(this.selectors.chatInput);
      
      return { success: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 4. Send Prompt
  async sendPrompt(text) {
    try {
      
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
      
      return { success: true, prompt: text };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 5. Image Detection and Download
  async detectAndDownloadImages(options = {}) {
    try {
      
      // Find all images in the chat
      const images = await this.findAllImages();
      if (images.length === 0) {
        return { success: false, error: 'No images found' };
      }
      
      
      // Download images
      const downloadResults = [];
      for (let i = 0; i < images.length; i++) {
        const result = await this.downloadImage(images[i], i, options);
        downloadResults.push(result);
      }
      
      return {
        success: true,
        count: downloadResults.filter(r => r.success).length,
        total: images.length,
        downloads: downloadResults
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findAllImages() {
    // DALL-E images are typically in message containers with specific structure
    const imageSelectors = [
      'img[src*="oaidalleapiprodscus.blob.core.windows.net"]', // DALL-E API images
      'img[src*="dalle"]', // Other DALL-E images
      'img[src*="openai"]', // OpenAI hosted images
      'div[data-message-author-role="assistant"] img', // Images in assistant messages
      '.group img[alt*="Image"]', // Images with alt text
      '.markdown img', // Images in markdown content
      'img[alt*="Generated"]', // Generated images
      'img[src*="blob:"]' // Blob URLs from ChatGPT
    ];
    
    const images = [];
    const foundUrls = new Set();
    
    for (const selector of imageSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const img of elements) {
        if (img.src && !foundUrls.has(img.src)) {
          foundUrls.add(img.src);
          images.push({
            element: img,
            url: img.src,
            alt: img.alt || '',
            parent: img.closest('[data-message-author-role]'),
            timestamp: this.extractImageTimestamp(img)
          });
        }
      }
    }
    
    return images;
  }

  extractImageTimestamp(imgElement) {
    // Try to extract timestamp from parent message
    const messageContainer = imgElement.closest('.group');
    if (messageContainer) {
      // Look for time element or data attribute
      const timeElement = messageContainer.querySelector('time');
      if (timeElement) {
        return timeElement.getAttribute('datetime') || timeElement.textContent;
      }
    }
    return new Date().toISOString();
  }

  async downloadImage(imageData, index, options = {}) {
    try {
      const { element, url, alt, timestamp } = imageData;
      
      // Generate filename
      const filename = this.generateImageFilename(imageData, index, options);
      
      // Method 1: Try native download button if available
      const downloadButton = await this.findImageDownloadButton(element);
      if (downloadButton) {
        await this.clickElement(downloadButton);
        return { success: true, method: 'native', filename, url };
      }
      
      // Method 2: Use Chrome download API via background script
      const downloadResult = await this.downloadViaBackground(url, filename);
      if (downloadResult.success) {
        return { success: true, method: 'background', filename, url };
      }
      
      // Method 3: Fallback to link click
      await this.downloadViaLink(url, filename);
      return { success: true, method: 'link', filename, url };
      
    } catch (error) {
      return { success: false, error: error.message, url: imageData.url };
    }
  }

  generateImageFilename(imageData, index, options = {}) {
    const prefix = options.prefix || 'dalle';
    const timestamp = new Date(imageData.timestamp).toISOString().replace(/[:.]/g, '-');
    
    // Extract prompt context if available
    let promptHint = '';
    if (imageData.parent) {
      const previousMessage = imageData.parent.previousElementSibling;
      if (previousMessage && previousMessage.querySelector('[data-message-author-role="user"]')) {
        const userText = previousMessage.textContent.trim();
        // Get first few words as hint
        promptHint = userText.split(' ').slice(0, 3).join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
      }
    }
    
    // Build filename
    const parts = [prefix];
    if (promptHint) parts.push(promptHint);
    parts.push(timestamp);
    parts.push(`img-${index + 1}`);
    
    return `${parts.join('_')}.png`;
  }

  async findImageDownloadButton(imgElement) {
    // Look for download button near the image
    const container = imgElement.closest('.group') || imgElement.parentElement;
    const selectors = [
      'button[aria-label*="Download"]',
      'button svg path[d*="M3 12.5v3.75"]', // Download icon path
      'button:has(svg path[d*="download"])',
      '.flex button' // Generic button in flex container
    ];
    
    for (const selector of selectors) {
      const button = container.querySelector(selector);
      if (button) {
        return button;
      }
    }
    
    return null;
  }

  async downloadViaBackground(url, filename) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({
        action: 'DOWNLOAD_IMAGE',
        data: { url, filename }
      }, (response) => {
        resolve(response || { success: false });
      });
    });
  }

  async downloadViaLink(url, filename) {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    
    // Clean up
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
  }

  // 6. Request DALL-E Image Generation
  async requestDALLEImage(prompt, options = {}) {
    try {
      
      // Ensure we're using a model that supports DALL-E
      const modelCheck = await this.ensureDALLEModel();
      if (!modelCheck.success) {
        return modelCheck;
      }
      
      // Send the image generation prompt
      const result = await this.sendPrompt(prompt);
      if (!result.success) {
        return result;
      }
      
      // Wait for image to appear
      const imageAppeared = await this.waitForImageGeneration(30000);
      
      if (!imageAppeared) {
        return { success: false, error: 'Image generation timeout' };
      }
      
      // Auto-download if requested
      if (options.autoDownload) {
        await this.delay(1000); // Let image fully load
        const downloadResult = await this.detectAndDownloadImages({
          prefix: options.filenamePrefix || 'dalle-generated'
        });
        return { 
          success: true, 
          imageGenerated: true, 
          downloadResult 
        };
      }
      
      return { success: true, imageGenerated: true };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async ensureDALLEModel() {
    // Check if current model supports DALL-E
    // This is a simplified check - adjust based on actual UI
    const modelSelector = document.querySelector('button[aria-haspopup="menu"]');
    if (modelSelector && modelSelector.textContent.includes('4')) {
      return { success: true };
    }
    
    // Try to switch to GPT-4 (which typically has DALL-E)
    // Implementation would go here
    
    return { success: true }; // Assume it's available for now
  }

  async waitForImageGeneration(timeout = 30000) {
    const startTime = Date.now();
    let lastImageCount = document.querySelectorAll('img').length;
    
    while (Date.now() - startTime < timeout) {
      await this.delay(1000);
      
      const currentImageCount = document.querySelectorAll('img').length;
      if (currentImageCount > lastImageCount) {
        // New image appeared
        return true;
      }
      
      // Also check for DALL-E specific indicators
      const dalleImages = document.querySelectorAll('img[src*="dalle"], img[src*="oaidalleapiprodscus"]');
      if (dalleImages.length > 0) {
        return true;
      }
    }
    
    return false;
  }

  // Helper: Wait for response
  async waitForResponse() {
    try {
      // Wait for streaming indicator to appear
      await this.waitForSelector(this.selectors.streamingIndicator, 5000);
      
      // Optionally wait for streaming to complete
      await this.waitForStreamingComplete();
      
    } catch (error) {
    }
  }

  async waitForStreamingComplete(timeout = 30000) {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      const streamingElement = document.querySelector(this.selectors.streamingIndicator);
      if (!streamingElement) {
        return true;
      }
      await this.delay(500);
    }
    
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
    element.textContent = '';
    
    // For textarea, also clear innerHTML
    if (element.tagName === 'TEXTAREA') {
      element.innerHTML = '';
    }
    
    // Set new value
    element.value = value;
    element.textContent = value;
    
    // Dispatch input events for React
    const inputEvent = new Event('input', { bubbles: true, cancelable: true });
    element.dispatchEvent(inputEvent);
    
    const changeEvent = new Event('change', { bubbles: true, cancelable: true });
    element.dispatchEvent(changeEvent);
    
    // Trigger React's synthetic events
    if (element._valueTracker) {
      element._valueTracker.setValue('');
    }
    
    // Force React to recognize the change
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    )?.set || Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, 'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
    }
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

