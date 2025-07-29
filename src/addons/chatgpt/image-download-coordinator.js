// Coordinates image download with generation state
console.log('🎯 Image Download Coordinator loaded');

let pendingImageDownload = null;

// Listen for state changes
if (window.chatGPTStateDetector) {
  let previousState = null;
  
  window.chatGPTStateDetector.stateChangeCallbacks.push((newState) => {
    console.log('🎯 Coordinator: State changed', { 
      wasGenerating: previousState?.isImageGenerating, 
      isGenerating: newState.isImageGenerating,
      isIdle: newState.isIdle 
    });
    
    // If we just finished generating an image (was generating, now not)
    if (previousState?.isImageGenerating && !newState.isImageGenerating) {
      console.log('✅ Image generation completed! Triggering download...');
      console.log('State details:', {
        isIdle: newState.isIdle,
        isResponding: newState.isResponding,
        canSendMessage: newState.canSendMessage
      });
      
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
    
    // Update previous state for next comparison
    previousState = newState;
  });
  
  console.log('✅ Coordinator registered with state detector');
} else {
  console.error('❌ State detector not available!');
}

console.log('🎯 Coordinator ready - will download images after generation completes');