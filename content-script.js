// Semantest Content Script for ChatGPT
// Handles message passing and image generation automation

(function() {
  console.log('🚀 Semantest Content Script loaded on ChatGPT');
  
  // Keep track of processed images to avoid duplicates - GLOBAL to persist
  const processedImages = new Set();
  
  // Pre-populate with existing images on page load to avoid downloading old ones
  function scanExistingImages() {
    const existingImages = document.querySelectorAll('img[src*="dalle"], img[alt*="generated"], img[src*="oaiusercontent"]');
    existingImages.forEach(img => {
      if (img.src) {
        processedImages.add(img.src);
      }
    });
    console.log(`📸 Found ${processedImages.size} existing images on page load`);
  }
  
  // Scan existing images after a short delay to let page load
  setTimeout(scanExistingImages, 2000);
  
  // Tell background script we're ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    source: 'chatgpt-content',
    url: window.location.href
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Received message from background:', request);
    console.log('Message type:', request.type);
    console.log('Message payload:', request.payload);
    
    if (request.type === 'ImageGenerationRequestedEvent' || 
        request.eventType === 'ImageGenerationRequested' ||
        request.type === 'PromptRequestedEvent') {
      console.log('🎯 Processing request');
      handleImageGenerationRequest(request.payload || request);
      sendResponse({ status: 'processing' });
    } else if (request.action === 'CHECK_STATUS') {
      console.log('✅ Status check');
      sendResponse({ status: 'ready', url: window.location.href });
    } else {
      console.log('⚠️ Unknown message type:', request.type);
    }
    
    return true; // Keep message channel open for async response
  });
  
  // Handle image generation request
  function handleImageGenerationRequest(payload) {
    console.log('🎨 Processing image generation request:', payload);
    
    const prompt = payload.prompt;
    if (!prompt) {
      console.error('No prompt provided');
      return;
    }
    
    // Find the textarea - try multiple selectors
    const textareaSelectors = [
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send a message"]',
      '#prompt-textarea',
      'textarea[data-id="root"]',
      'div[contenteditable="true"]',
      'textarea'
    ];
    
    let textarea = null;
    for (const selector of textareaSelectors) {
      textarea = document.querySelector(selector);
      if (textarea) {
        console.log('✅ Found textarea with selector:', selector);
        break;
      }
    }
    
    if (!textarea) {
      console.error('❌ Could not find ChatGPT textarea');
      console.log('Available textareas:', document.querySelectorAll('textarea'));
      console.log('Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
      reportStatus('error', 'Textarea not found');
      return;
    }
    
    // Clear any existing text and type the new prompt
    console.log('📝 Typing prompt:', prompt);
    textarea.focus();
    
    // Handle both textarea and contenteditable
    const isContentEditable = textarea.contentEditable === 'true';
    
    if (isContentEditable) {
      // For contenteditable divs
      textarea.innerHTML = '';
      textarea.textContent = prompt;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(sendMessage, 500);
    } else {
      // For regular textareas
      textarea.value = '';
      
      // Type character by character for more natural behavior
      let index = 0;
      const typeChar = () => {
        if (index < prompt.length) {
          textarea.value += prompt[index];
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
          index++;
          setTimeout(typeChar, 10); // Type quickly but naturally
        } else {
          // After typing is complete, send the message
          setTimeout(sendMessage, 500);
        }
      };
      
      typeChar();
    }
    
    function sendMessage() {
      // Find and click the send button
      const sendButton = document.querySelector('button[data-testid="send-button"]') ||
                        document.querySelector('button[aria-label*="Send"]') ||
                        Array.from(document.querySelectorAll('button')).find(btn => {
                          const svg = btn.querySelector('svg');
                          return svg && !btn.disabled && btn.offsetParent !== null;
                        });
      
      if (sendButton && !sendButton.disabled) {
        console.log('🚀 Clicking send button');
        sendButton.click();
        
        reportStatus('sent', 'Prompt submitted to ChatGPT', payload.correlationId);
        
        // Monitor for generated images
        setTimeout(() => monitorForImages(payload), 2000);
      } else {
        console.error('Could not find active send button');
        reportStatus('error', 'Send button not found or disabled');
      }
    }
  }
  
  // Monitor for generated images
  function monitorForImages(payload) {
    console.log('👀 Monitoring for NEW generated images...');
    
    let foundNewImages = false;
    let checkCount = 0;
    const maxChecks = 120; // 2 minutes with 1 second intervals
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Look for image elements
      const images = document.querySelectorAll('img[src*="dalle"], img[alt*="generated"], img[src*="oaiusercontent"]');
      
      // Filter to only new images we haven't processed
      const newImages = Array.from(images).filter(img => {
        return img.src && !processedImages.has(img.src);
      });
      
      if (newImages.length > 0) {
        foundNewImages = true;
        console.log('✅ Found ' + newImages.length + ' NEW generated image(s)');
        
        // Process only the new images
        newImages.forEach((img, index) => {
          const imageUrl = img.src;
          
          // Mark as processed
          processedImages.add(imageUrl);
          
          console.log('New Image ' + (index + 1) + ': ' + imageUrl);
          
          // Report image found
          reportStatus('image_found', imageUrl, payload.correlationId);
          
          // Trigger download if requested - only for the FIRST new image
          if (index === 0 && payload.outputPath) {
            // Combine folder and filename for Chrome downloads API
            const downloadPath = payload.downloadFolder ? 
              `${payload.downloadFolder}/${payload.outputPath}`.replace(/\/+/g, '/') : 
              payload.outputPath;
            
            console.log('📥 Downloading new image to:', downloadPath);
            chrome.runtime.sendMessage({
              action: 'DOWNLOAD_IMAGE',
              url: imageUrl,
              filename: downloadPath,
              folder: payload.downloadFolder
            });
          }
        });
        
        // Stop monitoring after finding new images
        clearInterval(checkInterval);
      } else if (checkCount >= maxChecks) {
        // Timeout reached
        clearInterval(checkInterval);
        if (!foundNewImages) {
          console.log('⏱️ Stopped monitoring for images (timeout)');
          reportStatus('timeout', 'No new images found within timeout period', payload.correlationId);
        }
      }
    }, 1000);
  }
  
  // Report status back to background script
  function reportStatus(status, message, correlationId) {
    chrome.runtime.sendMessage({
      type: 'STATUS_UPDATE',
      status: status,
      message: message,
      correlationId: correlationId,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('✅ Semantest content script initialized');
})();