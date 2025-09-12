// Semantest Content Script for Google text2image and Gemini
// Handles message passing and image generation automation

(function() {
  const isGemini = window.location.hostname.includes('gemini.google.com');
  console.log(isGemini ? '✨ Semantest Content Script loaded on Google Gemini' : '🎨 Semantest Content Script loaded on Google text2image');
  
  // Keep track of processed images to avoid duplicates
  const processedImages = new Set();
  
  // Pre-populate with existing images on page load
  function scanExistingImages() {
    const existingImages = document.querySelectorAll('img[src*="googleusercontent"], img[src*="gstatic"], canvas');
    existingImages.forEach(img => {
      if (img.src) {
        processedImages.add(img.src);
      }
    });
    console.log(`📸 Found ${processedImages.size} existing images on page load`);
  }
  
  // Scan after delay
  setTimeout(scanExistingImages, 2000);
  
  // Tell background script we're ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    source: 'google-text2image-content',
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
      
      console.log('🎯 Processing image generation request');
      
      // Send immediate response
      sendResponse({ status: 'processing', acknowledged: true });
      
      // Handle the request asynchronously
      setTimeout(() => {
        handleImageGenerationRequest(request.payload || request);
      }, 100);
      
      return false; // Don't keep channel open
      
    } else if (request.action === 'CHECK_STATUS') {
      console.log('✅ Status check');
      sendResponse({ status: 'ready', url: window.location.href });
      return false;
      
    } else {
      console.log('⚠️ Unknown message type:', request.type);
      sendResponse({ status: 'unknown', type: request.type });
      return false;
    }
  });
  
  // Handle image generation request
  function handleImageGenerationRequest(payload) {
    console.log('🎨 Processing image generation request:', payload);
    
    const prompt = payload.prompt;
    if (!prompt) {
      console.error('No prompt provided');
      reportStatus('error', 'No prompt provided', payload.correlationId);
      return;
    }
    
    // Find the input field - Different selectors for Gemini vs other Google services
    const inputSelectors = isGemini ? [
      // Gemini-specific selectors
      'div[contenteditable="true"][aria-label*="message"]',
      'div[contenteditable="true"][aria-label*="Message"]',
      'div[contenteditable="true"][role="textbox"]',
      'div.ql-editor',
      'div[contenteditable="true"]',
      'textarea[placeholder*="Enter a prompt"]',
      'textarea'
    ] : [
      // Other Google text2image services
      'input[type="text"][placeholder*="Describe"]',
      'input[type="text"][placeholder*="prompt"]',
      'input[type="text"][placeholder*="image"]',
      'textarea[placeholder*="Describe"]',
      'textarea[placeholder*="prompt"]',
      'input[aria-label*="prompt"]',
      'input[aria-label*="describe"]',
      'div[contenteditable="true"]',
      'input[type="text"]',
      'textarea'
    ];
    
    let inputField = null;
    for (const selector of inputSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if it's visible and editable
        if (element.offsetParent !== null && !element.disabled) {
          inputField = element;
          console.log('✅ Found input field with selector:', selector);
          break;
        }
      }
      if (inputField) break;
    }
    
    if (!inputField) {
      console.error('❌ Could not find text2image input field');
      console.log('Available inputs:', document.querySelectorAll('input'));
      console.log('Available textareas:', document.querySelectorAll('textarea'));
      reportStatus('error', 'Input field not found', payload.correlationId);
      return;
    }
    
    // Clear and type the new prompt
    console.log('📝 Typing prompt:', prompt);
    inputField.focus();
    
    // Handle different input types
    if (inputField.tagName === 'TEXTAREA' || inputField.tagName === 'INPUT') {
      inputField.value = '';
      
      // Type character by character
      let index = 0;
      const typeChar = () => {
        if (index < prompt.length) {
          inputField.value += prompt[index];
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
          index++;
          setTimeout(typeChar, 10);
        } else {
          // After typing, trigger additional events
          inputField.dispatchEvent(new Event('change', { bubbles: true }));
          inputField.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
          setTimeout(submitPrompt, 500);
        }
      };
      
      typeChar();
    } else if (inputField.contentEditable === 'true') {
      // For contenteditable divs
      inputField.innerHTML = '';
      inputField.textContent = prompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(submitPrompt, 500);
    }
    
    function submitPrompt() {
      // Find and click the generate/submit button - Different for Gemini
      const buttonSelectors = isGemini ? [
        // Gemini-specific button selectors
        'button[aria-label*="Send message"]',
        'button[aria-label*="send message"]',
        'button[aria-label*="Send"]',
        'button[data-test-id*="send"]',
        'button svg path[d*="M2"]', // Send icon path
        'button:has(svg)',
        'button[type="submit"]'
      ] : [
        // Other Google services
        'button[aria-label*="Generate"]',
        'button[aria-label*="generate"]',
        'button[aria-label*="Create"]',
        'button[aria-label*="create"]',
        'button[aria-label*="Submit"]',
        'button[aria-label*="submit"]',
        'button:has(svg)',
        'button[type="submit"]',
        'button'
      ];
      
      let submitButton = null;
      for (const selector of buttonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          // Check if button is visible, not disabled, and likely a submit button
          if (button.offsetParent !== null && !button.disabled) {
            const buttonText = button.textContent?.toLowerCase() || '';
            const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
            
            if (buttonText.includes('generate') || 
                buttonText.includes('create') || 
                buttonText.includes('submit') ||
                buttonText.includes('go') ||
                ariaLabel.includes('generate') ||
                ariaLabel.includes('create') ||
                ariaLabel.includes('submit')) {
              submitButton = button;
              console.log('✅ Found submit button:', selector);
              break;
            }
          }
        }
        if (submitButton) break;
      }
      
      // If no button found, try pressing Enter on the input field
      if (!submitButton) {
        console.log('⌨️ No button found, trying Enter key');
        inputField.dispatchEvent(new KeyboardEvent('keypress', { 
          key: 'Enter', 
          code: 'Enter',
          keyCode: 13,
          bubbles: true 
        }));
        inputField.dispatchEvent(new KeyboardEvent('keydown', { 
          key: 'Enter',
          code: 'Enter', 
          keyCode: 13,
          bubbles: true 
        }));
        
        reportStatus('sent', 'Prompt submitted via Enter key', payload.correlationId);
      } else {
        console.log('🚀 Clicking submit button');
        submitButton.click();
        reportStatus('sent', 'Prompt submitted to Google text2image', payload.correlationId);
      }
      
      // Monitor for generated images
      setTimeout(() => monitorForImages(payload), 2000);
    }
  }
  
  // Monitor for generated images
  function monitorForImages(payload) {
    console.log('👀 Monitoring for NEW generated images...');
    
    let foundNewImages = false;
    let checkCount = 0;
    const maxChecks = 120; // 2 minutes
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Look for image elements - Different for Gemini
      const imageSelectors = isGemini ? [
        // Gemini-specific image selectors
        'img[src*="googleusercontent.com"]',
        'img[src*="gstatic.com"]',
        'img[alt*="Generated image"]',
        'img[alt*="generated"]',
        'div[data-test-id*="image"] img',
        'div[role="img"] img',
        'canvas',
        'img'
      ] : [
        // Other Google services
        'img[src*="googleusercontent"]',
        'img[src*="gstatic"]',
        'canvas',
        'div[style*="background-image"]',
        'img[alt*="generated"]',
        'img[alt*="Generated"]',
        'img'
      ];
      
      let images = [];
      for (const selector of imageSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          // For canvas elements, convert to data URL
          Array.from(elements).forEach(elem => {
            if (elem.tagName === 'CANVAS') {
              try {
                const dataUrl = elem.toDataURL('image/png');
                elem.src = dataUrl; // Add src property for processing
              } catch (e) {
                console.log('Could not convert canvas:', e);
              }
            } else if (elem.style?.backgroundImage) {
              // Extract URL from background-image
              const match = elem.style.backgroundImage.match(/url\(["']?(.+?)["']?\)/);
              if (match) {
                elem.src = match[1];
              }
            }
          });
          images = images.concat(Array.from(elements));
        }
      }
      
      // Filter to only new images
      const newImages = images.filter(img => {
        return img.src && 
               !processedImages.has(img.src) && 
               !img.src.includes('data:image/svg') && // Skip SVG icons
               (img.naturalWidth > 100 || img.width > 100); // Skip small icons
      });
      
      if (newImages.length > 0) {
        foundNewImages = true;
        console.log('✅ Found ' + newImages.length + ' NEW generated image(s)');
        
        // Process new images
        newImages.forEach((img, index) => {
          const imageUrl = img.src;
          
          // Mark as processed
          processedImages.add(imageUrl);
          
          console.log('New Image ' + (index + 1) + ':', imageUrl.substring(0, 100));
          
          // Report image found
          reportStatus('image_found', imageUrl, payload.correlationId);
          
          // Download first new image if requested
          if (index === 0 && payload.outputPath) {
            const downloadPath = payload.downloadFolder ? 
              `${payload.downloadFolder}/${payload.outputPath}`.replace(/\/+/g, '/') : 
              payload.outputPath;
            
            console.log('📥 Downloading new image to:', downloadPath);
            
            // For data URLs, we need to handle differently
            if (imageUrl.startsWith('data:')) {
              // Convert data URL to blob and download
              fetch(imageUrl)
                .then(res => res.blob())
                .then(blob => {
                  const blobUrl = URL.createObjectURL(blob);
                  chrome.runtime.sendMessage({
                    action: 'DOWNLOAD_IMAGE',
                    url: blobUrl,
                    filename: downloadPath,
                    folder: payload.downloadFolder
                  });
                });
            } else {
              chrome.runtime.sendMessage({
                action: 'DOWNLOAD_IMAGE',
                url: imageUrl,
                filename: downloadPath,
                folder: payload.downloadFolder
              });
            }
          }
        });
        
        // Stop monitoring after finding new images
        clearInterval(checkInterval);
      } else if (checkCount >= maxChecks) {
        clearInterval(checkInterval);
        if (!foundNewImages) {
          console.log('⏱️ Stopped monitoring (timeout)');
          reportStatus('timeout', 'No new images found within timeout', payload.correlationId);
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
  
  console.log('✅ Semantest Google text2image content script initialized');
})();