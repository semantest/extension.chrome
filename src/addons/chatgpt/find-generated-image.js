// Simple script to find generated images
console.log('🔍 Finding generated images...');

// Function to find all images and log their details
window.findGeneratedImages = function() {
  const allImages = document.querySelectorAll('img');
  console.log(`Found ${allImages.length} total images`);
  
  const generatedImages = [];
  
  allImages.forEach((img, index) => {
    // Skip small images (likely icons/avatars)
    if (img.width < 100 && img.height < 100 && img.width > 0) {
      return;
    }
    
    // Log all sizeable images
    const info = {
      index: index,
      src: img.src,
      alt: img.alt || '',
      title: img.title || '',
      width: img.width,
      height: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      className: img.className || '',
      inMessage: !!img.closest('[data-testid="conversation-turn"]'),
      parent: img.parentElement?.className || ''
    };
    
    // Check if it looks like a generated image
    if (info.inMessage && (info.width > 200 || info.naturalWidth > 200)) {
      generatedImages.push(info);
      console.log('🎯 Potential generated image:', info);
    }
  });
  
  console.log(`\n📊 Summary: Found ${generatedImages.length} potential generated images`);
  
  // Also check the last few messages
  const messages = document.querySelectorAll('[data-testid="conversation-turn"]');
  const lastMessages = Array.from(messages).slice(-3);
  
  console.log('\n💬 Checking last 3 messages:');
  lastMessages.forEach((msg, i) => {
    const images = msg.querySelectorAll('img');
    console.log(`Message ${messages.length - 2 + i}: ${images.length} images`);
    images.forEach(img => {
      if (img.width > 100 || img.naturalWidth > 100) {
        console.log('  - Image URL:', img.src);
      }
    });
  });
  
  return generatedImages;
};

// Auto-run once
setTimeout(() => {
  console.log('🔍 Auto-checking for images...');
  window.findGeneratedImages();
}, 2000);

console.log('✅ Image finder ready. Run: window.findGeneratedImages()');