// ChatGPT Image Downloader - Downloads generated images automatically
console.log('📥 ChatGPT Image Downloader loaded');

// Monitor for generated images
let imageObserver = null;
let downloadedImages = new Set(); // Track downloaded images to avoid duplicates
let monitoringActive = false;
let checkInterval = null;
let monitoringStartTime = null; // Track when monitoring started
let initialImages = new Set(); // Track images that existed before monitoring
let expectingImage = false; // Flag to indicate we're expecting a new image

function startImageMonitoring() {
  if (monitoringActive) {
    console.log('🔄 Image monitoring already active');
    return;
  }
  
  console.log('👀 Starting enhanced image monitoring...');
  monitoringActive = true;
  monitoringStartTime = Date.now();
  expectingImage = true; // We're expecting a new image
  
  // Clear any previous state
  downloadedImages.clear();
  initialImages.clear();
  
  // Capture all existing images to ignore them
  const existingImages = document.querySelectorAll('img');
  console.log(`📊 Found ${existingImages.length} existing images`);
  existingImages.forEach(img => {
    if (img.src) {
      initialImages.add(img.src);
      // Only log DALL-E type images
      if (img.src.includes('openai') || img.src.includes('dalle') || img.src.includes('blob:')) {
        console.log('📌 Marking existing DALL-E image:', img.src.substring(0, 50) + '...');
      }
    }
  });
  
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
  let lastMessageCount = document.querySelectorAll('[data-testid="conversation-turn"]').length;
  
  checkInterval = setInterval(() => {
    // Check if we're still expecting an image
    if (!expectingImage) {
      console.log('⏸️ Not expecting image anymore, skipping check');
      return;
    }
    
    // Check state detector if available
    if (window.chatGPTStateDetector) {
      const state = window.chatGPTStateDetector.getState();
      if (state.isImageGenerating) {
        console.log('🎨 Image is still generating...');
        return; // Wait for it to complete
      }
    }
    
    // Only check if there are new messages
    const currentMessages = document.querySelectorAll('[data-testid="conversation-turn"]');
    const currentMessageCount = currentMessages.length;
    
    if (currentMessageCount > lastMessageCount) {
      console.log('🔍 New message detected! Checking for images...');
      
      // Only check the NEW messages
      for (let i = lastMessageCount; i < currentMessageCount; i++) {
        checkForImages(currentMessages[i]);
      }
      
      lastMessageCount = currentMessageCount;
    }
  }, 2000); // Check every 2 seconds
  
  // DON'T check existing images immediately - wait for NEW ones only
  // checkForImages(document.body);
  
  // Stop monitoring after 3 minutes to accommodate slow image generation
  // This should match or exceed the CLI timeout (currently 120s)
  setTimeout(() => {
    stopImageMonitoring();
    console.log('⏱️ Stopped monitoring after 3 minutes (timeout)');
  }, 180000); // 3 minutes
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
  
  // Skip if this is an old image (existed before monitoring)
  if (initialImages.has(src)) {
    return false;
  }
  
  // DALL-E images typically have these characteristics
  const isDalleUrl = src.includes('dalle') || 
                     src.includes('openai') ||
                     src.includes('chatgpt') ||
                     src.includes('oaidalleapiprodscus.blob.core.windows.net') || // Azure blob storage
                     src.includes('blob:') || // Local blob URLs
                     src.includes('cdn.openai.com') || // CDN images
                     src.includes('images.openai.com'); // New image service
  
  if (!isDalleUrl) {
    return false;
  }
  
  // Check if it's in the main chat area (not an avatar or icon)
  const isInChat = img.closest('[data-testid="conversation-turn"]') || 
                   img.closest('.group') ||
                   img.closest('[class*="message"]') ||
                   img.closest('[class*="result"]') ||
                   img.closest('div[class*="markdown"]');
  
  // Additional check: is this in a recent message (not from scrolled history)?
  const messageContainer = img.closest('[data-testid="conversation-turn"]');
  if (messageContainer) {
    // Check if this is one of the last few messages (not from scrolled history)
    const allMessages = document.querySelectorAll('[data-testid="conversation-turn"]');
    const messageIndex = Array.from(allMessages).indexOf(messageContainer);
    const isRecent = messageIndex >= allMessages.length - 3; // One of last 3 messages
    
    if (!isRecent) {
      console.log('🚫 Ignoring image from old message (index:', messageIndex, 'of', allMessages.length, ')');
      return false;
    }
  }
  
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
  
  // Skip if this image existed before monitoring started
  if (initialImages.has(src)) {
    console.log('⏭️ Skipping pre-existing image:', src.substring(0, 50) + '...');
    return;
  }
  
  console.log('🖼️ Found NEW generated image:', src.substring(0, 50) + '...');
  
  // Wait for image to fully load if needed
  if (!img.complete) {
    console.log('⏳ Waiting for image to load...');
    await new Promise((resolve) => {
      img.onload = resolve;
      img.onerror = resolve; // Continue even if error
      setTimeout(resolve, 5000); // Timeout after 5 seconds
    });
  }
  
  // Mark as downloaded to prevent duplicates
  downloadedImages.add(src);
  
  try {
    // Download the image
    const result = await downloadImage(img);
    
    if (result.success) {
      console.log('✅ Image downloaded successfully:', result.filename);
      
      // Send response back through the bridge
      if (window.semantestBridge && window.semantestBridge.sendToExtension) {
        try {
          window.semantestBridge.sendToExtension({
            type: 'addon:response',
            success: true,
            result: {
              downloaded: true,
              filename: result.filename,
              path: result.path,
              size: result.size,
              timestamp: Date.now()
            }
          });
        } catch (err) {
          console.warn('⚠️ Could not send response to extension:', err.message);
          // Continue anyway - download still succeeded
        }
      }
      
      // Also stop monitoring after successful download
      console.log('✅ Download complete, stopping monitoring...');
      expectingImage = false; // Reset flag
      stopImageMonitoring();
    }
  } catch (error) {
    console.error('❌ Failed to download image:', error);
    
    // Send error response
    if (window.semantestBridge && window.semantestBridge.sendToExtension) {
      try {
        window.semantestBridge.sendToExtension({
          type: 'addon:response',
          success: false,
          error: error.message
        });
      } catch (err) {
        console.warn('⚠️ Could not send error to extension:', err.message);
      }
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

// DON'T auto-start monitoring - wait for explicit request
// startImageMonitoring();

// Export functions
window.chatGPTImageDownloader = {
  startImageMonitoring,
  stopImageMonitoring,
  downloadImage,
  checkForImages,
  clearDownloadedImages: () => {
    downloadedImages.clear();
    console.log('🧹 Cleared downloaded images cache');
  }
};

console.log('📥 Image Downloader ready - waiting for image generation request');