/**
 * ChatGPT Addon Entry Point
 * Initializes ChatGPT-specific functionality when loaded
 */

console.log('🚀 ChatGPT Addon initializing...');

// Initialize addon
async function initializeChatGPTAddon() {
  console.log('📦 ChatGPT Addon: Setting up event listeners...');
  
  // Listen for messages from extension via custom event
  window.addEventListener('semantest-message', async (event) => {
    const message = event.detail;
    console.log('📨 ChatGPT Addon received message:', message);
    
    if (message.type === 'websocket:message' && message.payload) {
      const eventType = message.payload.type;
      const eventPayload = message.payload.payload;
      
      if (eventType === 'semantest/custom/image/download/requested') {
        console.log('🎨 ChatGPT Addon: Received image download request:', eventPayload);
        
        // Extract the prompt and metadata
        const prompt = eventPayload?.prompt || eventPayload?.message || 'Generate an image';
        const requestId = eventPayload?.metadata?.requestId || eventPayload?.id;
        const useQueue = eventPayload?.queue !== false; // Default to using queue
        
        // Check if we should use the queue system
        if (useQueue && window.imageGenerationQueue) {
          console.log('📋 Adding request to queue');
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
            console.log('🎨 Using direct image generation...');
            const result = await window.chatGPTImageGenerator.generateImage(prompt);
            console.log('✅ ChatGPT Addon: Image generation started successfully');
            
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
      console.log('📊 ChatGPT state changed:', state);
      
      // Log important state changes
      if (state.isImageGenerating) {
        console.log('🎨 Image generation in progress...');
      }
      if (state.isError) {
        console.error('❌ ChatGPT error detected:', state.details.error);
      }
    });
  }
  
  console.log('✅ ChatGPT Addon: Initialization complete');
  
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
  console.log('🎯 Initializing image download coordinator...');
  
  if (!window.chatGPTStateDetector) {
    console.log('⏳ State detector not ready for coordinator, retrying...');
    setTimeout(initializeImageCoordinator, 500);
    return;
  }
  
  console.log('✅ Setting up image download coordinator');
  
  let previousState = null;
  
  window.chatGPTStateDetector.stateChangeCallbacks.push((newState) => {
    console.log('🎯 Coordinator: State changed', { 
      previousState: previousState,
      wasGenerating: previousState?.isImageGenerating, 
      isGenerating: newState.isImageGenerating,
      isIdle: newState.isIdle 
    });
    
    // If we just finished generating an image (was generating, now not)
    if (previousState?.isImageGenerating && !newState.isImageGenerating) {
      console.log('✅ Image generation completed! Triggering download...');
      
      setTimeout(() => {
        if (window.chatGPTImageDownloader?.forceDownloadLastImage) {
          console.log('🎯 Coordinator: Force downloading last image');
          window.chatGPTImageDownloader.forceDownloadLastImage();
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
        console.log('🔍 Found DALL-E images in idle state, checking if they need download...');
        setTimeout(() => {
          if (window.chatGPTImageDownloader?.forceDownloadLastImage) {
            window.chatGPTImageDownloader.forceDownloadLastImage();
          }
        }, 1000);
      }
    }
    
    previousState = newState;
  });
  
  console.log('✅ Image download coordinator ready');
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