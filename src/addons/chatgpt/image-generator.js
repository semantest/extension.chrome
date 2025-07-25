// ChatGPT Image Generator - Clicks "Create image" tool before sending prompt
console.log('🎨 ChatGPT Image Generator loaded');

async function generateImage(promptText) {
  console.log('🖼️ Starting image generation with prompt:', promptText);
  
  try {
    // Step 1: Find and click the "Create image" tool button
    console.log('🔍 Looking for "Create image" tool...');
    
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
      
      // Check if we're already in image mode
      const currentPromptPlaceholder = document.querySelector('#prompt-textarea')?.getAttribute('placeholder');
      if (currentPromptPlaceholder?.toLowerCase().includes('image')) {
        console.log('✅ Already in image generation mode!');
        // Skip clicking the tool and proceed directly to entering prompt
      } else {
        // Check if image generation is available via the tools menu
        const toolsButton = document.querySelector('button[aria-label="Main menu"]') ||
                           document.querySelector('button[aria-label="Tools"]') ||
                           document.querySelector('button[id="radix-:r4:"]');
        
        if (toolsButton) {
          console.log('⚠️ Image tool might be in the tools menu. User needs to enable "Create image" tool.');
          throw new Error('Could not find "Create image" tool. Please enable it from the tools menu (sparkle icon) and try again.');
        } else {
          throw new Error('Could not find "Create image" tool. Make sure you have access to DALL-E and the tool is enabled.');
        }
      }
    } else {
      // Click the image tool
      console.log('🖱️ Clicking image tool...');
      imageToolButton.click();
      
      // Also dispatch click event to be sure
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      imageToolButton.dispatchEvent(clickEvent);
      
      // Wait for the image interface to appear
      console.log('⏳ Waiting for image generation interface...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 2: Check if we successfully entered image mode
    const newPlaceholder = document.querySelector('#prompt-textarea')?.getAttribute('placeholder');
    if (imageToolButton && !newPlaceholder?.toLowerCase().includes('image')) {
      console.log('⚠️ Tool click might not have worked. Retrying...');
      
      // Try clicking again with focus
      imageToolButton.focus();
      imageToolButton.click();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Step 3: Find the image prompt input field
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
    
    // Look for button near the input first (but skip upload button)
    const inputContainer = imageInput.closest('form') || imageInput.parentElement?.parentElement;
    if (inputContainer) {
      const nearbyButtons = inputContainer.querySelectorAll('button:not([disabled])');
      for (const btn of nearbyButtons) {
        // Skip the upload/attachment button
        if (btn.id === 'upload-file-btn' || 
            btn.getAttribute('aria-label')?.toLowerCase().includes('file') ||
            btn.getAttribute('aria-label')?.toLowerCase().includes('upload') ||
            btn.getAttribute('aria-label')?.toLowerCase().includes('attach')) {
          continue;
        }
        
        if (!btn.disabled && btn.offsetParent) {
          generateButton = btn;
          console.log('✅ Found send button near input:', btn);
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
      
      // Try to find the send button by looking for the last non-upload button
      const formButtons = Array.from(allFormButtons).filter(btn => 
        btn.id !== 'upload-file-btn' && 
        !btn.getAttribute('aria-label')?.toLowerCase().includes('file') &&
        !btn.disabled &&
        btn.offsetParent !== null
      );
      
      if (formButtons.length > 0) {
        generateButton = formButtons[formButtons.length - 1];
        console.log('✅ Found send button by elimination:', generateButton);
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
    
    return { 
      success: true, 
      message: 'Image generation started successfully',
      method: 'button_click'
    };
    
  } catch (error) {
    console.error('❌ Error generating image:', error);
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