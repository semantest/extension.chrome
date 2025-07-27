// ChatGPT Image Downloader - Downloads generated images automatically
console.log('📥 ChatGPT Image Downloader loaded');

// Monitor for generated images
let imageObserver = null;
let downloadedImages = new Set(); // Track downloaded images to avoid duplicates
let monitoringActive = false;
let checkInterval = null;

function startImageMonitoring() {
  if (monitoringActive) {
    console.log('🔄 Image monitoring already active');
    return;
  }
  
  console.log('👀 Starting enhanced image monitoring...');
  monitoringActive = true;
  
  // Method 1: MutationObserver for DOM changes
  imageObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if it's an image or contains images
          checkForImages(node);
        }
      }
      
      // Also check if existing images changed src
      if (mutation.type === 'attributes' && mutation.attributeName === 'src') {
        if (mutation.target.tagName === 'IMG') {
          checkForImages(mutation.target);
        }
      }
    }
  });
  
  // Start observing with more options
  imageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
  
  // Method 2: Periodic check for images (backup method)
  // This catches images that might be loaded dynamically without DOM changes
  checkInterval = setInterval(() => {
    console.log('🔍 Periodic image check...');
    checkForImages(document.body);
  }, 2000); // Check every 2 seconds
  
  // Also check existing images immediately
  checkForImages(document.body);
  
  // Stop monitoring after 2 minutes to avoid resource usage
  setTimeout(() => {
    stopImageMonitoring();
    console.log('⏱️ Stopped monitoring after 2 minutes');
  }, 120000);
}

function stopImageMonitoring() {
  if (imageObserver) {
    imageObserver.disconnect();
    imageObserver = null;
  }
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
  monitoringActive = false;
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
  
  // Skip if no source or if it's a data URL (base64)
  if (!src || src.startsWith('data:')) {
    return false;
  }
  
  // DALL-E images typically have these characteristics
  const isDalleUrl = src.includes('dalle') || 
                     src.includes('openai') ||
                     src.includes('chatgpt') ||
                     src.includes('oaidalleapiprodscus.blob.core.windows.net') || // Azure blob storage
                     src.includes('blob:'); // Local blob URLs
  
  if (!isDalleUrl) {
    return false;
  }
  
  // Check if it's in the main chat area (not an avatar or icon)
  const isInChat = img.closest('[data-testid="conversation-turn"]') || 
                   img.closest('.group') ||
                   img.closest('[class*="message"]') ||
                   img.closest('[class*="result"]') ||
                   img.closest('div[class*="markdown"]');
  
  // Check minimum size (generated images are usually larger)
  // Note: naturalWidth/Height might be 0 if image is still loading
  const minSize = 100; // Lowered threshold
  const sizeOk = (img.naturalWidth >= minSize && img.naturalHeight >= minSize) ||
                 (img.width >= minSize && img.height >= minSize) ||
                 img.naturalWidth === 0; // Still loading
  
  // Additional checks for generated images
  const hasAlt = img.alt && (img.alt.includes('Generated') || img.alt.includes('DALL'));
  const hasTitle = img.title && (img.title.includes('Generated') || img.title.includes('DALL'));
  
  // If it passes basic checks and is in chat area
  if (isInChat && (sizeOk || hasAlt || hasTitle)) {
    console.log('🎯 Detected generated image:', {
      src: src.substring(0, 50) + '...',
      width: img.naturalWidth || img.width,
      height: img.naturalHeight || img.height,
      alt: img.alt,
      inChat: isInChat
    });
    return true;
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