// ChatGPT Image Downloader - Downloads generated images automatically
console.log('📥 ChatGPT Image Downloader loaded');

// Monitor for generated images
let imageObserver = null;
let downloadedImages = new Set(); // Track downloaded images to avoid duplicates

function startImageMonitoring() {
  console.log('👀 Starting image monitoring...');
  
  // Create observer to watch for new images
  imageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if it's an image or contains images
          checkForImages(node);
        }
      }
    }
  });
  
  // Start observing the entire document
  imageObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  // Also check existing images
  checkForImages(document.body);
}

function checkForImages(element) {
  // Direct image elements
  if (element.tagName === 'IMG' && isGeneratedImage(element)) {
    handleGeneratedImage(element);
  }
  
  // Images inside the element
  const images = element.querySelectorAll?.('img');
  if (images) {
    images.forEach(img => {
      if (isGeneratedImage(img)) {
        handleGeneratedImage(img);
      }
    });
  }
}

function isGeneratedImage(img) {
  // Check if this is a DALL-E generated image
  const src = img.src || '';
  
  // DALL-E images typically have these characteristics
  if (src.includes('dalle') || 
      src.includes('openai') ||
      src.includes('chatgpt') ||
      src.includes('blob:')) {
    
    // Check if it's in the main chat area (not an avatar or icon)
    const isInChat = img.closest('[data-testid="conversation-turn"]') || 
                     img.closest('.group') ||
                     img.closest('[class*="message"]');
    
    // Check minimum size (generated images are usually larger)
    const minSize = 200;
    if (isInChat && img.naturalWidth >= minSize && img.naturalHeight >= minSize) {
      return true;
    }
  }
  
  return false;
}

async function handleGeneratedImage(img) {
  const src = img.src;
  
  // Skip if already downloaded
  if (downloadedImages.has(src)) {
    console.log('⏭️ Image already downloaded:', src.substring(0, 50) + '...');
    return;
  }
  
  console.log('🖼️ Found generated image:', src.substring(0, 50) + '...');
  
  // Mark as downloaded to prevent duplicates
  downloadedImages.add(src);
  
  try {
    // Download the image
    const result = await downloadImage(img);
    
    if (result.success) {
      console.log('✅ Image downloaded successfully:', result.filename);
      
      // Send response back through the bridge
      if (window.semantestBridge) {
        window.semantestBridge.sendToExtension({
          type: 'addon:response',
          success: true,
          result: {
            downloaded: true,
            filename: result.filename,
            path: result.path,
            size: result.size
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ Failed to download image:', error);
    
    // Send error response
    if (window.semantestBridge) {
      window.semantestBridge.sendToExtension({
        type: 'addon:response',
        success: false,
        error: error.message
      });
    }
  }
}

async function downloadImage(img) {
  try {
    const src = img.src;
    
    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `chatgpt-image-${timestamp}.png`;
    
    // For blob URLs, we need to fetch the blob
    if (src.startsWith('blob:')) {
      const response = await fetch(src);
      const blob = await response.blob();
      
      // Create download link
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // Clean up
      setTimeout(() => URL.revokeObjectURL(a.href), 100);
      
      return {
        success: true,
        filename: filename,
        path: `~/Downloads/${filename}`, // Approximate path
        size: blob.size
      };
    } else {
      // For regular URLs, use direct download
      const a = document.createElement('a');
      a.href = src;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      return {
        success: true,
        filename: filename,
        path: `~/Downloads/${filename}`, // Approximate path
        size: 0 // Unknown for direct URLs
      };
    }
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

// Auto-start monitoring when loaded
startImageMonitoring();

// Export functions
window.chatGPTImageDownloader = {
  startImageMonitoring,
  downloadImage,
  checkForImages
};

console.log('📥 Image Downloader ready - monitoring for generated images');