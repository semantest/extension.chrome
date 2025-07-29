// ChatGPT Image Generator - Clicks "Create image" tool before sending prompt
console.log('🎨 ChatGPT Image Generator loaded');

async function generateImage(promptText) {
  console.log('🖼️ Starting image generation with prompt:', promptText);
  
  // Send immediate acknowledgment
  if (window.semantestBridge && window.semantestBridge.sendToExtension) {
    window.semantestBridge.sendToExtension({
      type: 'addon:response',
      status: 'started',
      message: 'Image generation process started'
    });
  }
  
  try {
    // Skip tool selection - just use prompt prefix
    console.log('📝 Using prompt prefix for image generation');
    return await enterImagePrompt(promptText);
    
  } catch (error) {
    console.error('❌ Error generating image:', error);
    return { success: false, error: error.message };
  }
}

// Separate function to handle entering the prompt once in image mode
async function enterImagePrompt(promptText) {
  try {
    
    // Find the image prompt input field
    console.log('🔍 Looking for image prompt input...');
    
    // The image tool might open a modal or change the input area
    const imageInputSelectors = [
      // Specific image prompt inputs
      'textarea[placeholder*="image" i]',
      'input[placeholder*="image" i]',
      '[contenteditable="true"][placeholder*="image" i]',
      // DALL-E specific
      'textarea[placeholder*="dall" i]',
      'input[placeholder*="dall" i]',
      // Generic prompt that might have changed context
      '#prompt-textarea',
      'textarea[data-testid="prompt-textarea"]',
      '[contenteditable="true"].ProseMirror',
      // Modal inputs
      '[role="dialog"] textarea',
      '[role="dialog"] [contenteditable="true"]'
    ];
    
    let imageInput = null;
    for (const selector of imageInputSelectors) {
      imageInput = document.querySelector(selector);
      if (imageInput && imageInput.offsetParent) {
        console.log('✅ Found image input:', selector);
        break;
      }
    }
    
    if (!imageInput) {
      console.log('⚠️ No specific image input found, using main prompt area');
      imageInput = document.querySelector('#prompt-textarea') ||
                  document.querySelector('[contenteditable="true"]');
    }
    
    if (!imageInput) {
      throw new Error('Could not find input field for image prompt');
    }
    
    // Step 3: Enter the prompt
    console.log('📝 Entering image prompt...');
    
    // Always prefix the prompt to ensure image generation
    const finalPrompt = `Create an image: ${promptText}`;
    console.log('📝 Using image generation prompt');
    
    // Focus and clear the input
    imageInput.focus();
    imageInput.click();
    
    if (imageInput.tagName === 'TEXTAREA' || imageInput.tagName === 'INPUT') {
      imageInput.value = finalPrompt;
      imageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // ContentEditable
      imageInput.innerHTML = '';
      const paragraph = document.createElement('p');
      paragraph.textContent = finalPrompt;
      imageInput.appendChild(paragraph);
      
      imageInput.dispatchEvent(new InputEvent('input', { 
        bubbles: true, 
        cancelable: true,
        data: promptText 
      }));
    }
    
    // Wait a moment for UI to update
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 4: Find and click the generate/send button
    console.log('🔍 Looking for generate button...');
    
    const generateButtonSelectors = [
      // Specific generate buttons
      'button:has-text("Generate")',
      'button:has-text("Create")',
      'button[aria-label*="Generate" i]',
      'button[aria-label*="Create" i]',
      // Send buttons in modal or changed context
      '[role="dialog"] button[type="submit"]',
      '[role="dialog"] button:not([disabled]):last-of-type',
      // Generic send button
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      // Any submit button near the input
      'button[type="submit"]:not([disabled])'
    ];
    
    let generateButton = null;
    
    // Look for button near the input first (but skip upload, tool, and MICROPHONE buttons)
    const inputContainer = imageInput.closest('form') || imageInput.parentElement?.parentElement;
    if (inputContainer) {
      const nearbyButtons = inputContainer.querySelectorAll('button:not([disabled])');
      let micButton = null;
      
      for (const btn of nearbyButtons) {
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        const title = btn.getAttribute('title')?.toLowerCase() || '';
        const btnId = btn.id?.toLowerCase() || '';
        
        // CRITICAL: Detect microphone button
        const hasMicIcon = btn.querySelector('svg path[d*="M12 2"]') || // Common mic path
                          btn.querySelector('svg path[d*="microphone"]') ||
                          ariaLabel.includes('microphone') ||
                          ariaLabel.includes('voice') ||
                          ariaLabel.includes('dictate') || // NEW: ChatGPT calls it "Dictate button"
                          title.includes('microphone') ||
                          title.includes('dictate');
        
        if (hasMicIcon) {
          console.log('🎤 DETECTED MICROPHONE BUTTON - SKIP!', {
            id: btn.id,
            ariaLabel: ariaLabel,
            title: title
          });
          micButton = btn;
          continue;
        }
        
        // Skip unwanted buttons
        if (btn.id === 'upload-file-btn' || 
            btn.id === 'system-hint-button' ||
            ariaLabel.includes('file') ||
            ariaLabel.includes('upload') ||
            ariaLabel.includes('attach') ||
            ariaLabel.includes('choose tool') ||
            btnId.includes('hint')) {
          console.log('🚫 Skipping button:', btn.id, ariaLabel);
          continue;
        }
        
        // Look for send/submit button specifically
        if (!btn.disabled && btn.offsetParent && 
            (btn.type === 'submit' || 
             ariaLabel.includes('send') ||
             btn.querySelector('svg'))) {
          generateButton = btn;
          console.log('✅ Found send button near input:', {
            id: btn.id,
            type: btn.type,
            ariaLabel: btn.getAttribute('aria-label'),
            hasSvg: btn.querySelector('svg') !== null,
            notMicrophone: btn !== micButton
          });
          break;
        }
      }
    }
    
    // If not found, try selectors
    if (!generateButton) {
      for (const selector of generateButtonSelectors) {
        try {
          if (selector.includes(':has-text')) {
            const text = selector.match(/:has-text\("(.+?)"\)/)?.[1];
            if (text) {
              const buttons = document.querySelectorAll('button');
              for (const btn of buttons) {
                if (btn.textContent?.includes(text) && !btn.disabled && btn.offsetParent) {
                  generateButton = btn;
                  break;
                }
              }
            }
          } else {
            generateButton = document.querySelector(selector);
          }
          
          if (generateButton && !generateButton.disabled && generateButton.offsetParent) {
            break;
          }
        } catch (e) {
          // Continue
        }
      }
    }
    
    if (!generateButton) {
      console.log('❌ No generate button found');
      
      // Debug: Show all buttons found
      const allFormButtons = inputContainer ? inputContainer.querySelectorAll('button') : [];
      console.log('Available buttons in form:', allFormButtons.length);
      allFormButtons.forEach((btn, idx) => {
        console.log(`Button ${idx}:`, {
          id: btn.id,
          ariaLabel: btn.getAttribute('aria-label'),
          disabled: btn.disabled,
          visible: btn.offsetParent !== null,
          type: btn.type,
          className: btn.className
        });
      });
      
      // Try to find the send button by looking for the last non-upload/non-tool/non-microphone button
      const formButtons = Array.from(allFormButtons).filter(btn => {
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        const title = btn.getAttribute('title')?.toLowerCase() || '';
        
        // CRITICAL: Detect and exclude microphone button
        const hasMicIcon = btn.querySelector('svg path[d*="M12 2"]') || // Common mic path
                          btn.querySelector('svg path[d*="microphone"]') ||
                          ariaLabel.includes('microphone') ||
                          ariaLabel.includes('voice') ||
                          ariaLabel.includes('dictate') || // NEW: ChatGPT calls it "Dictate button"
                          title.includes('microphone') ||
                          title.includes('dictate');
        
        if (hasMicIcon) {
          console.log('🎤 Filtering out microphone button:', btn.id, ariaLabel);
          return false;
        }
        
        return btn.id !== 'upload-file-btn' && 
               btn.id !== 'system-hint-button' &&
               !ariaLabel.includes('file') &&
               !ariaLabel.includes('choose tool') &&
               !btn.disabled &&
               btn.offsetParent !== null;
      });
      
      console.log(`Found ${formButtons.length} potential send buttons after filtering`);
      
      // Look for the actual send button (usually has an SVG arrow)
      const sendButton = formButtons.find(btn => 
        btn.querySelector('svg path[d*="M"]') || // Arrow path
        btn.getAttribute('aria-label')?.toLowerCase().includes('send')
      );
      
      if (sendButton) {
        generateButton = sendButton;
        console.log('✅ Found send button by SVG/aria:', sendButton);
      } else if (formButtons.length > 0) {
        // Fallback to last button
        generateButton = formButtons[formButtons.length - 1];
        console.log('✅ Found send button by position:', generateButton);
      } else {
        console.log('⚠️ Falling back to Enter key...');
        
        const enterEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          bubbles: true,
          cancelable: true
        });
        imageInput.dispatchEvent(enterEvent);
        
        return { 
          success: true, 
          message: 'Image prompt sent via Enter key',
          method: 'keyboard'
        };
      }
    }
    
    // Click the generate button
    console.log('🖱️ Clicking generate button...');
    generateButton.click();
    
    // Start monitoring for the new image
    console.log('👀 Starting image monitoring for auto-download...');
    if (window.chatGPTImageDownloader) {
      // Stop any existing monitoring
      window.chatGPTImageDownloader.stopImageMonitoring();
      // Start fresh monitoring (will automatically ignore existing images)
      window.chatGPTImageDownloader.startImageMonitoring();
    }
    
    return { 
      success: true, 
      message: 'Image generation started successfully',
      method: 'button_click'
    };
    
  } catch (error) {
    console.error('❌ Error entering image prompt:', error);
    return { success: false, error: error.message };
  }
}

// Export for use
window.chatGPTImageGenerator = { generateImage };

// Listen for messages from extension
// Note: chrome.runtime not available in MAIN world
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   if (request.action === 'GENERATE_IMAGE') {
//     generateImage(request.prompt)
//       .then(result => sendResponse(result))
//       .catch(error => sendResponse({ success: false, error: error.message }));
//     return true; // Keep channel open for async response
//   }
// });

console.log('🎨 Image Generator ready - use window.chatGPTImageGenerator.generateImage("prompt") to test');