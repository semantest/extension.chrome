// Debug script to log ALL images found in ChatGPT
console.log('🔍 Image Debug Script loaded');

function debugAllImages() {
  console.log('=== DEBUGGING ALL IMAGES ===');
  const allImages = document.querySelectorAll('img');
  console.log(`Found ${allImages.length} total images`);
  
  allImages.forEach((img, index) => {
    if (img.src && !img.src.includes('avatar') && !img.src.includes('icon')) {
      console.log(`Image ${index}:`, {
        src: img.src,
        alt: img.alt,
        title: img.title,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        className: img.className,
        parentElement: img.parentElement?.tagName,
        inMessage: !!img.closest('[data-testid="conversation-turn"]'),
        messageIndex: Array.from(document.querySelectorAll('[data-testid="conversation-turn"]')).indexOf(img.closest('[data-testid="conversation-turn"]'))
      });
    }
  });
  
  // Also check for images in specific containers
  console.log('\n=== CHECKING MESSAGE CONTAINERS ===');
  const messages = document.querySelectorAll('[data-testid="conversation-turn"]');
  messages.forEach((msg, idx) => {
    const images = msg.querySelectorAll('img');
    if (images.length > 0) {
      console.log(`Message ${idx} has ${images.length} images:`);
      images.forEach(img => {
        if (img.src && !img.src.includes('avatar')) {
          console.log('  -', img.src.substring(0, 100) + '...');
        }
      });
    }
  });
}

// Run debug immediately
debugAllImages();

// Also expose for manual calling
window.debugAllImages = debugAllImages;

// Monitor for new images
const observer = new MutationObserver((mutations) => {
  let foundNewImage = false;
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.tagName === 'IMG' || node.querySelector?.('img')) {
          foundNewImage = true;
        }
      }
    });
  });
  
  if (foundNewImage) {
    console.log('🆕 New image detected! Running debug...');
    setTimeout(debugAllImages, 1000); // Wait for image to load
  }
});

observer.observe(document.body, {
  childList: true,
  subtree: true
});

console.log('🔍 Image debugger ready. Call window.debugAllImages() to manually debug.');