// ChatGPT Image Downloader - Downloads generated images automatically
// Image Downloader loaded

// Monitor for generated images
let imageObserver = null;
let downloadedImages = new Set(); // Track downloaded images to avoid duplicates
let monitoringActive = false;
let monitoringStartTime = null; // Track when monitoring started
let initialImages = new Set(); // Track images that existed before monitoring
let expectingImage = false; // Flag to indicate we're expecting a new image
let initialCaptureComplete = false; // Flag to ensure initial capture is done
let initialMessageCount = 0; // Track message count when monitoring started
let pendingFilename = null; // Store custom filename from event payload

function startImageMonitoring() {
  if (monitoringActive) {
    // Already monitoring
    return;
  }
  
  console.log('👀 Starting image monitoring...');
  monitoringActive = true;
  monitoringStartTime = Date.now();
  expectingImage = true; // We're expecting a new image
  
  // Clear any previous state
  downloadedImages.clear();
  initialImages.clear();
  initialCaptureComplete = false;
  
  // Mark as ready immediately - we're looking for NEW images only
  initialMessageCount = document.querySelectorAll('[data-testid="conversation-turn"]').length;
  initialCaptureComplete = true;
  // Monitoring started
  
  // Method 1: MutationObserver for DOM changes
  // IMPORTANT: Don't start observing until initial capture is complete
  imageObserver = new MutationObserver((mutations) => {
    // Skip all mutations until initial capture is done
    if (!initialCaptureComplete) {
      return;
    }
    
    for (const mutation of mutations) {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if it's an image or contains images
          if (node.tagName === 'IMG' || (node.querySelectorAll && node.querySelectorAll('img').length > 0)) {
            checkForImages(node);
          }
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
  
  // Start observing immediately since we're ready
  imageObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src']
  });
  // MutationObserver active
  
  // Disable periodic check - rely on MutationObserver and coordinator
  // The periodic check was causing old images to download
  
  // DON'T check existing images immediately - wait for NEW ones only
  // checkForImages(document.body);
  
  // Stop monitoring after 3 minutes to accommodate slow image generation
  // This should match or exceed the CLI timeout (currently 120s)
  setTimeout(() => {
    stopImageMonitoring();
    // Timeout after 3 minutes
  }, 180000); // 3 minutes
}

function stopImageMonitoring() {
  if (imageObserver) {
    imageObserver.disconnect();
    imageObserver = null;
  }
  monitoringActive = false;
  expectingImage = false;
  initialCaptureComplete = false;
  // Monitoring stopped
}

function checkForImages(element) {
  // Don't check until initial capture is complete
  if (!initialCaptureComplete) {
    return;
  }
  
  // Direct image elements
  if (element.tagName === 'IMG') {
    if (isGeneratedImage(element)) {
      handleGeneratedImage(element);
    }
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


// Flag to control whether automatic detection is active
let allowAutomaticDetection = false;

function isGeneratedImage(img) {
  // Check if this is a DALL-E generated image
  const src = img.src || '';
  
  // Skip if no source or if it's a data URL (base64)
  if (!src || src.startsWith('data:')) {
    return false;
  }
  
  // Skip if already downloaded
  if (downloadedImages.has(src)) {
    return false;
  }
  
  // DALL-E images typically have these characteristics
  const isDalleUrl = src.includes('dalle') || 
                     src.includes('openai') ||
                     src.includes('chatgpt') ||
                     src.includes('oaidalleapiprodscus.blob.core.windows.net') || // Azure blob storage
                     src.includes('blob:') || // Local blob URLs
                     src.includes('cdn.openai.com') || // CDN images
                     src.includes('images.openai.com') || // New image service
                     src.includes('oaiusercontent.com') || // NEW: DALL-E 3 URLs!
                     src.includes('sdmntpr'); // NEW: DALL-E 3 pattern
  
  if (!isDalleUrl) {
    return false;
  }
  
  // Check if it's in the main chat area (not an avatar or icon)
  const isInChat = img.closest('[data-testid="conversation-turn"]') || 
                   img.closest('.group') ||
                   img.closest('[class*="message"]') ||
                   img.closest('[class*="result"]') ||
                   img.closest('div[class*="markdown"]');
  
  if (!isInChat) {
    return false;
  }
  
  // IMPORTANT: Only detect images if automatic detection is enabled
  // This prevents downloading intermediate images
  if (!allowAutomaticDetection) {
    return false;
  }
  
  // Basic size check to avoid tiny images
  const minSize = 100;
  if (img.naturalWidth === 0 || img.naturalHeight === 0) {
    return false; // Image not loaded yet
  }
  
  const sizeOk = img.naturalWidth >= minSize && img.naturalHeight >= minSize;
  
  // If image has reasonable size, it's ready
  if (sizeOk) {
    // Detected complete generated image
    return true;
  }
  
  return false;
}

async function handleGeneratedImage(img) {
  const src = img.src;
  
  // Skip if already downloaded
  if (downloadedImages.has(src)) {
    return;
  }
  
  console.log('🖼️ Downloading image...');
  
  // Wait for image to fully load if needed
  if (!img.complete) {
    // Waiting for image to load
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
      console.log('✅ Downloaded:', result.filename);
      
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
      
      // Don't stop monitoring immediately - there might be more images or updates
      // Continue monitoring for more images
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
    
    // Use custom filename if provided, otherwise generate with timestamp
    let filename;
    if (pendingFilename) {
      filename = pendingFilename;
      // Clear the pending filename after use
      pendingFilename = null;
    } else {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      filename = `chatgpt-image-${timestamp}.png`;
    }
    
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
      // For regular URLs, we need to fetch and convert to blob first
      // Direct download doesn't work for cross-origin URLs
      // Fetching image from URL
      
      try {
        const response = await fetch(src);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status}`);
        }
        
        const blob = await response.blob();
        
        // Now download the blob
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.style.display = 'none';
        a.target = '_blank'; // Extra safety
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
      } catch (error) {
        console.error('❌ Failed to fetch image:', error);
        throw new Error(`Download failed: ${error.message}`);
      }
    }
  } catch (error) {
    throw new Error(`Download failed: ${error.message}`);
  }
}

// DON'T auto-start monitoring - wait for explicit request
// startImageMonitoring();

// Debug function to manually check all images
function debugCheckAllImages() {
  console.log('🔍 DEBUG: Checking all images on page...');
  const allImages = document.querySelectorAll('img');
  console.log(`Found ${allImages.length} total images`);
  
  let dalleImages = 0;
  allImages.forEach((img, index) => {
    const src = img.src || '';
    if (src.includes('oaiusercontent') || src.includes('dalle') || src.includes('openai')) {
      dalleImages++;
      console.log(`🎯 DALL-E Image ${dalleImages}:`, {
        index,
        src: src.substring(0, 100),
        width: img.width,
        height: img.height,
        alt: img.alt,
        complete: img.complete,
        inMessage: !!img.closest('[data-testid="conversation-turn"]'),
        parent: img.parentElement?.className
      });
      
      // Try to check this image
      console.log('🔍 Running isGeneratedImage check...');
      const result = isGeneratedImage(img);
      console.log('Result:', result);
      
      if (result) {
        console.log('✅ Would download this image!');
      }
    }
  });
  
  console.log(`\n📊 Summary: ${dalleImages} potential DALL-E images found`);
}

// Force download the last DALL-E image (called by coordinator when generation completes)
async function forceDownloadLastImage() {
  console.log('🔧 Downloading completed image...');
  
  // Temporarily enable automatic detection
  allowAutomaticDetection = true;
  
  // Find all DALL-E images
  const allImages = Array.from(document.querySelectorAll('img'));
  const dalleImages = allImages.filter(img => 
    img.src && (img.src.includes('oaiusercontent') || img.src.includes('dalle') || img.src.includes('openai'))
  );
  
  if (dalleImages.length === 0) {
    console.log('❌ No DALL-E images found');
    allowAutomaticDetection = false;
    return;
  }
  
  // Get the last one (most recent)
  const lastImage = dalleImages[dalleImages.length - 1];
  console.log('📸 Found completed image:', lastImage.src.substring(0, 80) + '...');
  
  // Download it
  try {
    await handleGeneratedImage(lastImage);
    console.log('✅ Download triggered!');
  } catch (error) {
    console.error('❌ Download failed:', error);
  } finally {
    // Disable automatic detection again
    allowAutomaticDetection = false;
  }
}

// Export functions
window.chatGPTImageDownloader = {
  startImageMonitoring,
  stopImageMonitoring,
  downloadImage,
  checkForImages,
  clearDownloadedImages: () => {
    downloadedImages.clear();
    // Cleared downloaded images cache
  },
  debugCheckAllImages,
  forceDownloadLastImage, // NEW: Force download for testing
  // Expose pendingFilename for external setting
  get pendingFilename() { return pendingFilename; },
  set pendingFilename(value) { 
    pendingFilename = value;
    console.log(`📝 Custom filename set: ${value}`);
  },
  isGeneratedImage, // Export for debugging
  handleGeneratedImage // Export for debugging
};

// Image Downloader ready