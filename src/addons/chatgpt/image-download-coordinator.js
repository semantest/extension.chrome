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
      console.log('✅ Image generation completed! Triggering download...');
      
      // Give it a moment for the DOM to update
      setTimeout(() => {
        // Force download the last DALL-E image
        if (window.chatGPTImageDownloader && 
            window.chatGPTImageDownloader.forceDownloadLastImage) {
          console.log('🎯 Coordinator: Force downloading last image');
          window.chatGPTImageDownloader.forceDownloadLastImage();
        } else {
          // Fallback: check all images
          const images = document.querySelectorAll('img');
          images.forEach(img => {
            if (img.src && img.src.includes('oaiusercontent')) {
              if (window.chatGPTImageDownloader && 
                  window.chatGPTImageDownloader.checkForImages) {
                window.chatGPTImageDownloader.checkForImages(img);
              }
            }
          });
        }
      }, 1000); // Give more time for image to fully load
    }
  });
}

console.log('🎯 Coordinator ready - will download images after generation completes');