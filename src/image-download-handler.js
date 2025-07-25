// Image Download Handler for ChatGPT Extension
// Monitors for generated images and sends download requests

console.log('📥 Image Download Handler initializing...');

class ImageDownloadHandler {
  constructor() {
    this.wsHandler = null;
    this.observing = false;
    this.processedImages = new Set(); // Track images we've already requested
    this.currentPrompt = null;
    this.targetFolder = '/home/user/images'; // Default folder
  }

  init() {
    // Get WebSocket handler reference
    if (typeof self !== 'undefined' && self.wsHandler) {
      this.wsHandler = self.wsHandler;
      console.log('✅ WebSocket handler available for download requests');
    }
    
    // Start observing for images
    this.startObserving();
  }

  setCurrentPrompt(prompt) {
    this.currentPrompt = prompt;
    console.log('📝 Current prompt set:', prompt);
  }

  setTargetFolder(folder) {
    this.targetFolder = folder;
    console.log('📁 Target folder set:', folder);
  }

  startObserving() {
    if (this.observing) return;
    
    console.log('👀 Starting image observation...');
    
    // Create observer for new images
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'IMG' && this.isGeneratedImage(node)) {
            this.handleNewImage(node);
          } else if (node.querySelectorAll) {
            // Check child nodes
            const images = node.querySelectorAll('img');
            images.forEach(img => {
              if (this.isGeneratedImage(img)) {
                this.handleNewImage(img);
              }
            });
          }
        });
      });
    });

    // Start observing
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    this.observing = true;
    console.log('✅ Image observation started');
  }

  isGeneratedImage(img) {
    // Check if this is a DALL-E generated image
    const src = img.src || '';
    
    // ChatGPT generated images typically have these patterns
    if (src.includes('dalle') || 
        src.includes('openai') ||
        src.includes('blob:') ||
        img.closest('[data-message-author-role="tool"]')) {
      
      // Additional check: is it new?
      if (!this.processedImages.has(src)) {
        return true;
      }
    }
    
    return false;
  }

  handleNewImage(img) {
    const src = img.src;
    this.processedImages.add(src);
    
    console.log('🎨 New generated image detected:', src);
    
    // Get image context
    const messageContainer = img.closest('[data-message-author-role]');
    const prompt = this.extractPromptFromContext(messageContainer) || this.currentPrompt;
    
    // Generate filename from prompt
    const filename = this.generateFilename(prompt);
    
    // Send download request
    this.sendDownloadRequest({
      imageUrl: src,
      prompt: prompt || 'generated-image',
      targetFolder: this.targetFolder,
      filename: filename
    });
  }

  extractPromptFromContext(container) {
    if (!container) return null;
    
    // Try to find the user message before this tool message
    let userMessage = container;
    while (userMessage && userMessage.previousElementSibling) {
      userMessage = userMessage.previousElementSibling;
      if (userMessage.getAttribute('data-message-author-role') === 'user') {
        const textContent = userMessage.textContent || '';
        // Extract the actual prompt (remove any UI elements)
        return textContent.trim();
      }
    }
    
    return null;
  }

  generateFilename(prompt) {
    if (!prompt) return `image-${Date.now()}.png`;
    
    // Clean prompt for filename
    const cleaned = prompt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .substring(0, 50); // Limit length
    
    return `${cleaned}-${Date.now()}.png`;
  }

  sendDownloadRequest(data) {
    console.log('📤 Sending download request:', data);
    
    // Send via WebSocket if available
    if (this.wsHandler && this.wsHandler.ws?.readyState === 1) {
      const message = {
        id: `msg-${Date.now()}-download`,
        type: 'event',
        timestamp: Date.now(),
        payload: {
          id: `evt-${Date.now()}-download`,
          type: 'imageDownloadRequested',
          timestamp: Date.now(),
          payload: {
            prompt: data.prompt,
            targetFolder: data.targetFolder,
            filename: data.filename,
            imageUrl: data.imageUrl,
            metadata: {
              source: 'chatgpt-extension',
              timestamp: Date.now()
            }
          }
        }
      };
      
      this.wsHandler.ws.send(JSON.stringify(message));
      console.log('✅ Download request sent via WebSocket');
      
    } else {
      console.warn('⚠️ WebSocket not available, using fallback');
      
      // Fallback: send via chrome runtime message
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'IMAGE_DOWNLOAD_REQUESTED',
          data: data
        });
      }
    }
  }

  // Method to manually trigger download for current visible images
  downloadVisibleImages() {
    console.log('📥 Checking for visible images to download...');
    
    const images = document.querySelectorAll('img');
    let foundCount = 0;
    
    images.forEach(img => {
      if (this.isGeneratedImage(img)) {
        // Reset processed state to allow re-download
        this.processedImages.delete(img.src);
        this.handleNewImage(img);
        foundCount++;
      }
    });
    
    console.log(`Found ${foundCount} images to download`);
    return foundCount;
  }
}

// Create and initialize handler
const imageDownloadHandler = new ImageDownloadHandler();
imageDownloadHandler.init();

// Make it available globally
if (typeof window !== 'undefined') {
  window.imageDownloadHandler = imageDownloadHandler;
}

// Export for service worker
if (typeof self !== 'undefined') {
  self.imageDownloadHandler = imageDownloadHandler;
}

console.log('📥 Image Download Handler ready');