// ChatGPT Image Generator - Clicks "Create image" tool before sending prompt
console.log('🎨 ChatGPT Image Generator loaded');

async function generateImage(promptText) {
  console.log('🖼️ Starting image generation with prompt:', promptText);
  
  try {
    // Step 1: First check if we're already in image mode
    const currentPlaceholder = document.querySelector('#prompt-textarea')?.getAttribute('placeholder');
    if (currentPlaceholder?.toLowerCase().includes('image')) {
      console.log('✅ Already in image generation mode!');
      // Skip to entering the prompt
      return await enterImagePrompt(promptText);
    }
    
    // Step 2: Find and click the Tools menu button first
    console.log('🔍 Looking for Tools menu button...');
    
    // Find the tools menu button (the one you mentioned)
    const toolsMenuButton = document.querySelector('button[id^="radix-"][aria-haspopup="menu"]') ||
                           document.querySelector('button[aria-label="Tools"]') ||
                           document.querySelector('button[title="Tools"]');
    
    if (toolsMenuButton) {
      console.log('🔧 Found Tools menu button, clicking...');
      toolsMenuButton.click();
      
      // Wait for menu to appear
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Now look for "Create image" in the menu
      console.log('🔍 Looking for "Create image" in menu...');
      
      // Find menu items
      const menuItems = document.querySelectorAll('[role="menuitem"], [role="option"], button[class*="menu"], div[class*="menu"]');
      
      let createImageOption = null;
      for (const item of menuItems) {
        const text = item.textContent?.trim() || '';
        if (text.toLowerCase().includes('create image') || 
            text.toLowerCase().includes('dall')) {
          createImageOption = item;
          console.log('✅ Found "Create image" option:', text);
          break;
        }
      }
      
      if (createImageOption) {
        console.log('🖱️ Clicking "Create image" option...');
        createImageOption.click();
        
        // Wait for image mode to activate
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Now enter the prompt
        return await enterImagePrompt(promptText);
      } else {
        console.log('❌ Could not find "Create image" in menu');
        // Try the old approach as fallback
      }
    }
    
    // Fallback: Try to find "Create image" directly
    console.log('🔍 Fallback: Looking for "Create image" tool directly...');
    
    // Different selectors to find the image generation tool
    const imageToolSelectors = [
      // Look for buttons/divs with "Create image" text
      'button:has-text("Create image")',
      'div[role="button"]:has-text("Create image")',
      '[data-testid*="image"]',
      // Look for DALL-E related elements
      'button:has-text("DALL")',
      'div[role="button"]:has-text("DALL")',
      // Generic tool buttons that might contain image icon
      '[class*="tool"]:has-text("image")',
      '[class*="Tool"]:has-text("image")',
      // Look for image icon in tool palette
      'button[aria-label*="image" i]',
      'div[role="button"][aria-label*="image" i]'
    ];
    
    let imageToolButton = null;
    
    // Method 1: Try each selector
    for (const selector of imageToolSelectors) {
      try {
        // Use XPath for :has-text pseudo-selector
        if (selector.includes(':has-text')) {
          const text = selector.match(/:has-text\("(.+?)"\)/)?.[1];
          if (text) {
            const elements = document.evaluate(
              `//*[contains(text(), '${text}')]`,
              document,
              null,
              XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
              null
            );
            
            for (let i = 0; i < elements.snapshotLength; i++) {
              const elem = elements.snapshotItem(i);
              if (elem.tagName === 'BUTTON' || 
                  (elem.tagName === 'DIV' && elem.getAttribute('role') === 'button')) {
                imageToolButton = elem;
                break;
              }
            }
          }
        } else {
          imageToolButton = document.querySelector(selector);
        }
        
        if (imageToolButton) break;
      } catch (e) {
        // Continue to next selector
      }
    }
    
    // Method 2: Look for any button/div with image-related text
    if (!imageToolButton) {
      const allButtons = [...document.querySelectorAll('button'), 
                         ...document.querySelectorAll('div[role="button"]')];
      
      for (const btn of allButtons) {
        const text = btn.textContent?.toLowerCase() || '';
        const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
        
        if (text.includes('create image') || 
            text.includes('dall') || 
            text.includes('image') ||
            ariaLabel.includes('create image') ||
            ariaLabel.includes('image generation')) {
          
          // Make sure it's visible and not disabled
          if (btn.offsetParent && !btn.disabled) {
            imageToolButton = btn;
            console.log('✅ Found image tool button:', {
              text: btn.textContent?.trim(),
              ariaLabel: btn.getAttribute('aria-label'),
              className: btn.className
            });
            break;
          }
        }
      }
    }
    
    // Method 3: Look in the tools panel/grid
    if (!imageToolButton) {
      console.log('🔍 Searching in tools panel...');
      
      // Look for grid or panel containing tools
      const toolContainers = document.querySelectorAll('[class*="grid"], [class*="tools"], [class*="palette"]');
      
      for (const container of toolContainers) {
        const tools = container.querySelectorAll('button, div[role="button"]');
        
        for (const tool of tools) {
          // Check for image-related content
          const hasImageIcon = tool.querySelector('svg path[d*="picture" i]') || 
                              tool.querySelector('svg path[d*="image" i]') ||
                              tool.querySelector('[class*="image" i]');
          
          const hasImageText = tool.textContent?.toLowerCase().includes('image') ||
                              tool.getAttribute('aria-label')?.toLowerCase().includes('image');
          
          if ((hasImageIcon || hasImageText) && tool.offsetParent) {
            imageToolButton = tool;
            console.log('✅ Found image tool in panel:', tool);
            break;
          }
        }
        
        if (imageToolButton) break;
      }
    }
    
    if (!imageToolButton) {
      // Show all available tools for debugging
      console.log('❌ Could not find "Create image" tool');
      console.log('Available buttons/tools:');
      const allClickables = [...document.querySelectorAll('button'), 
                            ...document.querySelectorAll('div[role="button"]'),
                            ...document.querySelectorAll('[class*="tool"]'),
                            ...document.querySelectorAll('[class*="Tool"]')];
      
      const relevantButtons = [];
      allClickables.forEach((elem, idx) => {
        if (elem.offsetParent && elem.textContent?.trim()) {
          const text = elem.textContent.trim();
          console.log(`${idx}: "${text}" - ${elem.className}`);
          
          // Check if this might be a tool button we missed
          if (text.toLowerCase().includes('image') || 
              text.toLowerCase().includes('dall') ||
              text.toLowerCase().includes('create') ||
              elem.querySelector('svg')) {
            relevantButtons.push({elem, text, idx});
          }
        }
      });
      
      console.log('Potentially relevant buttons:', relevantButtons);
      
      throw new Error('Could not find "Create image" tool. Please click the Tools icon and enable "Create image" first.');
    } else {
      // Click the image tool
      console.log('🖱️ Clicking image tool...');
      imageToolButton.click();
      
      // Wait for the image interface to appear
      console.log('⏳ Waiting for image generation interface...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      return await enterImagePrompt(promptText);
    }
    
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
    
    // Focus and clear the input
    imageInput.focus();
    imageInput.click();
    
    if (imageInput.tagName === 'TEXTAREA' || imageInput.tagName === 'INPUT') {
      imageInput.value = promptText;
      imageInput.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // ContentEditable
      imageInput.innerHTML = '';
      const paragraph = document.createElement('p');
      paragraph.textContent = promptText;
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
    
    // Start monitoring for the generated image
    console.log('👀 Starting image monitoring for auto-download...');
    if (window.chatGPTImageDownloader) {
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