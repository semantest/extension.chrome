// Coordinates image download with generation state
console.log('🎯 Image Download Coordinator loaded');

let pendingImageDownload = null;

// Listen for state changes
if (window.chatGPTStateDetector) {
  window.chatGPTStateDetector.onStateChange((newState, oldState) => {
    console.log('🎯 Coordinator: State changed', { 
      wasGenerating: oldState?.isImageGenerating, 
      isGenerating: newState.isImageGenerating,
      isIdle: newState.isIdle 
    });
    
    // If we just finished generating an image (was generating, now idle)
    if (oldState?.isImageGenerating && !newState.isImageGenerating && newState.isIdle) {
      console.log('✅ Image generation completed! Checking for new images...');
      
      // Give it a moment for the DOM to update
      setTimeout(() => {
        // Find and download any new DALL-E images
        const images = document.querySelectorAll('img');
        images.forEach(img => {
          if (window.chatGPTImageDownloader && 
              window.chatGPTImageDownloader.checkForImages) {
            window.chatGPTImageDownloader.checkForImages(img);
          }
        });
      }, 500);
    }
  });
}

console.log('🎯 Coordinator ready - will download images after generation completes');