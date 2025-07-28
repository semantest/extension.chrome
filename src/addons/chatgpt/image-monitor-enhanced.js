// Enhanced image monitoring with detailed logging
console.log('🔍 Enhanced Image Monitor loaded');

// Override checkForImages to add more logging
if (window.chatGPTImageDownloader) {
  const originalCheck = window.chatGPTImageDownloader.checkForImages;
  
  window.chatGPTImageDownloader.checkForImages = function(element) {
    console.log('🔍 Checking element for images:', {
      tagName: element.tagName,
      className: element.className,
      id: element.id,
      hasImages: element.querySelectorAll ? element.querySelectorAll('img').length : 0
    });
    
    // If it's an image, log its details
    if (element.tagName === 'IMG') {
      console.log('🖼️ Found IMG element:', {
        src: element.src,
        alt: element.alt,
        width: element.width,
        height: element.height,
        naturalWidth: element.naturalWidth,
        naturalHeight: element.naturalHeight,
        complete: element.complete,
        inMessage: !!element.closest('[data-testid="conversation-turn"]')
      });
    }
    
    // Call original
    return originalCheck.call(this, element);
  };
  
  // Also log when new messages appear
  const observer = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const isMessage = node.matches?.('[data-testid="conversation-turn"]') || 
                           node.querySelector?.('[data-testid="conversation-turn"]');
          if (isMessage) {
            console.log('💬 New message detected!', node);
            
            // Check for images in the new message
            const images = node.querySelectorAll('img');
            if (images.length > 0) {
              console.log('🖼️ Message contains', images.length, 'images:');
              images.forEach((img, i) => {
                console.log(`  Image ${i+1}:`, {
                  src: img.src,
                  alt: img.alt,
                  className: img.className
                });
              });
            }
          }
        }
      });
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

console.log('🔍 Enhanced monitoring active - watching for new messages and images');