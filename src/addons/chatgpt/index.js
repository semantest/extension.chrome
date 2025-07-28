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

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeChatGPTAddon);
} else {
  initializeChatGPTAddon();
}

// Export for debugging
window.chatgptAddon = {
  initialize: initializeChatGPTAddon,
  version: '1.0.0'
};