/**
 * ChatGPT Addon Entry Point
 * Initializes ChatGPT-specific functionality when loaded
 */

// ChatGPT Addon initializing

// Initialize addon
async function initializeChatGPTAddon() {
  // Setting up event listeners
  
  // Listen for messages from extension via custom event
  window.addEventListener('semantest-message', async (event) => {
    const message = event.detail;
    // Received WebSocket message
    
    if (message.type === 'websocket:message' && message.payload) {
      const eventType = message.payload.type;
      const eventPayload = message.payload.payload;
      
      if (eventType === 'semantest/custom/image/download/requested') {
        // Received image download request
        
        // Extract the prompt and metadata
        const prompt = eventPayload?.prompt || eventPayload?.message || 'Generate an image';
        const requestId = eventPayload?.metadata?.requestId || eventPayload?.id;
        const useQueue = eventPayload?.queue !== false; // Default to using queue
        
        // Check if we should use the queue system
        if (useQueue && window.imageGenerationQueue) {
          // Adding request to queue
          window.imageGenerationQueue.add({
            id: requestId,
            prompt: prompt,
            metadata: eventPayload.metadata || {}
          });
          
          // Send immediate acknowledgment
          if (window.semantestBridge) {
            window.semantestBridge.sendToExtension({
              type: 'addon:response',
              success: true,
              queued: true,
              requestId: requestId,
              message: 'Request added to queue'
            });
          }
        } else if (window.chatGPTImageGenerator) {
          // Direct generation without queue (legacy mode)
          try {
            // Using direct image generation
            
            // Set custom filename if provided
            if (eventPayload?.metadata?.filename && window.chatGPTImageDownloader) {
              console.log('📝 Setting custom filename:', eventPayload.metadata.filename);
              window.chatGPTImageDownloader.pendingFilename = eventPayload.metadata.filename;
            }
            
            const result = await window.chatGPTImageGenerator.generateImage(prompt);
            // Image generation started successfully
            
            // Send response back via bridge
            if (window.semantestBridge) {
              window.semantestBridge.sendToExtension({
                type: 'addon:response',
                success: true,
                result
              });
            }
          } catch (error) {
            console.error('❌ ChatGPT Addon: Failed to generate image:', error);
            
            // Send error response back
            if (window.semantestBridge) {
              window.semantestBridge.sendToExtension({
                type: 'addon:response',
                success: false,
                error: error.message
              });
            }
          }
        } else {
          console.error('❌ ChatGPT Image Generator not available');
        }
      }
    }
  });
  
  // Monitor ChatGPT state changes
  if (window.chatGPTStateDetector) {
    window.chatGPTStateDetector.stateChangeCallbacks.push((state) => {
      // ChatGPT state changed
      
      // Log important state changes
      if (state.isImageGenerating) {
        console.log('🎨 Image generation in progress...');
      }
      if (state.isError) {
        console.error('❌ ChatGPT error detected:', state.details.error);
      }
    });
  }
  
  // ChatGPT Addon initialization complete
  
  // Notify that addon is ready via bridge
  if (window.semantestBridge) {
    window.semantestBridge.sendToExtension({
      type: 'addon:ready',
      addon: 'chatgpt',
      capabilities: [
        'state-detection',
        'direct-send',
        'image-generation'
      ]
    });
  }
}

// Initialize coordinator inline since script loading isn't working
const initializeImageCoordinator = () => {
  // Initializing image download coordinator
  
  if (!window.chatGPTStateDetector) {
    // State detector not ready, retrying...
    setTimeout(initializeImageCoordinator, 500);
    return;
  }
  
  // Setting up image download coordinator
  
  let previousState = null;
  
  let lastDownloadTime = 0;
  
  window.chatGPTStateDetector.stateChangeCallbacks.push((newState) => {
    // Coordinator: State changed
    
    // If we just finished generating an image (was generating, now not)
    if (previousState?.isImageGenerating && !newState.isImageGenerating) {
      // Image generation completed, checking if download needed
      
      // Prevent duplicate downloads within 5 seconds
      const now = Date.now();
      if (now - lastDownloadTime < 5000) {
        // Skipping download - already downloaded recently
        previousState = newState;
        return;
      }
      
      setTimeout(() => {
        if (window.chatGPTImageDownloader?.forceDownloadLastImage) {
          // Coordinator: Force downloading last image
          window.chatGPTImageDownloader.forceDownloadLastImage();
          lastDownloadTime = Date.now();
        }
      }, 1000);
    }
    
    // Alternative: If we see idle state with DALL-E images, download them
    if (!previousState?.isImageGenerating && newState.isIdle) {
      const allImages = Array.from(document.querySelectorAll('img'));
      const dalleImages = allImages.filter(img => 
        img.src && (img.src.includes('oaiusercontent') || img.src.includes('dalle'))
      );
      
      if (dalleImages.length > 0) {
        // Only check if we recently finished generating (within last 10 seconds)
        const timeSinceLastDownload = Date.now() - lastDownloadTime;
        if (timeSinceLastDownload < 10000) {
          // Found DALL-E images in idle state, checking if they need download
          setTimeout(() => {
            if (window.chatGPTImageDownloader?.forceDownloadLastImage) {
              window.chatGPTImageDownloader.forceDownloadLastImage();
            }
          }, 1000);
        }
      }
    }
    
    previousState = newState;
  });
  
  // Image download coordinator ready
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeChatGPTAddon();
    initializeImageCoordinator();
  });
} else {
  initializeChatGPTAddon();
  initializeImageCoordinator();
}

// Export for debugging
window.chatgptAddon = {
  initialize: initializeChatGPTAddon,
  version: '1.0.0'
};