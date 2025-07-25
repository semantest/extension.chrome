// ChatGPT Button Clicker - Tests server→extension→ChatGPT flow
console.log('🔘 ChatGPT Button Clicker loaded');

async function clickChatGPTButton(buttonType = 'regenerate') {
  console.log('🎯 Looking for button to click:', buttonType);
  
  try {
    // First check ChatGPT state if detector is available
    if (window.chatGPTStateDetector) {
      const status = window.chatGPTStateDetector.getStatusReport();
      console.log('📊 ChatGPT State:', status.summary);
      
      // Handle different states
      if (status.state.isUnresponsive) {
        console.log('🔄 Page is unresponsive, reloading...');
        window.location.reload();
        return { 
          success: false, 
          error: 'Page was unresponsive, triggered reload',
          state: status.state
        };
      }
      
      if (status.state.isGenerating || status.state.isResponding) {
        return { 
          success: false, 
          error: 'ChatGPT is currently generating a response',
          state: status.state,
          recommendations: status.recommendations
        };
      }
      
      if (status.state.isImageGenerating) {
        return { 
          success: false, 
          error: 'ChatGPT is currently generating an image',
          state: status.state,
          recommendations: ['Wait for image generation to complete']
        };
      }
      
      if (status.state.isError) {
        return { 
          success: false, 
          error: 'ChatGPT has an error: ' + (status.state.details.error || 'Unknown'),
          state: status.state,
          recommendations: status.recommendations
        };
      }
    }
    let button = null;
    
    // Different button selectors based on type
    switch (buttonType) {
      case 'regenerate':
        // Look for regenerate button (appears after a response)
        button = document.querySelector('button[data-testid="regenerate-button"]') ||
                document.querySelector('button[aria-label*="Regenerate"]') ||
                document.querySelector('button:has(svg path[d*="M3.478"])') || // Refresh icon
                Array.from(document.querySelectorAll('button')).find(btn => 
                  btn.textContent?.includes('Regenerate')
                );
        break;
        
      case 'continue':
        // Look for continue button
        button = document.querySelector('button[data-testid="continue-button"]') ||
                document.querySelector('button[aria-label*="Continue"]') ||
                Array.from(document.querySelectorAll('button')).find(btn => 
                  btn.textContent?.includes('Continue')
                );
        break;
        
      case 'stop':
        // Look for stop generating button
        button = document.querySelector('button[aria-label*="Stop"]') ||
                document.querySelector('button:has(svg rect)') || // Stop icon usually has rect
                Array.from(document.querySelectorAll('button')).find(btn => 
                  btn.textContent?.includes('Stop')
                );
        break;
        
      case 'new-chat':
        // Look for new chat button
        button = document.querySelector('a[href="/"]') ||
                document.querySelector('button[aria-label="New chat"]') ||
                document.querySelector('nav button:first-child');
        break;
        
      case 'any':
        // Find any clickable button in the chat area
        const chatArea = document.querySelector('main');
        if (chatArea) {
          const buttons = chatArea.querySelectorAll('button:not([disabled])');
          console.log(`Found ${buttons.length} enabled buttons in chat area`);
          
          // Log all buttons for debugging
          buttons.forEach((btn, index) => {
            console.log(`Button ${index}:`, {
              text: btn.textContent?.trim(),
              ariaLabel: btn.getAttribute('aria-label'),
              className: btn.className,
              hasIcon: !!btn.querySelector('svg')
            });
          });
          
          // Try to find a good candidate (skip upload/attachment buttons)
          button = Array.from(buttons).find(btn => {
            const label = btn.getAttribute('aria-label')?.toLowerCase() || '';
            const text = btn.textContent?.toLowerCase() || '';
            const isVisible = btn.offsetWidth > 0;
            const isNotUpload = !label.includes('upload') && 
                               !label.includes('attach') &&
                               !label.includes('file') &&
                               !text.includes('upload');
            
            console.log(`Checking button: "${text}" (aria: "${label}") - visible: ${isVisible}, notUpload: ${isNotUpload}`);
            
            return isNotUpload && isVisible;
          });
          
          console.log('Selected button:', button ? 'Found' : 'Not found');
        }
        break;
    }
    
    if (button) {
      console.log('✅ Found button:', {
        type: buttonType,
        text: button.textContent?.trim(),
        ariaLabel: button.getAttribute('aria-label'),
        element: button
      });
      
      // Click the button
      button.click();
      
      // Also dispatch click event for good measure
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      button.dispatchEvent(clickEvent);
      
      return { 
        success: true, 
        message: `Successfully clicked ${buttonType} button`,
        buttonInfo: {
          text: button.textContent?.trim(),
          ariaLabel: button.getAttribute('aria-label')
        }
      };
    } else {
      console.log('❌ No button found for type:', buttonType);
      
      // Log page state for debugging
      console.log('Page state:', {
        url: window.location.href,
        hasMessages: !!document.querySelector('[data-message-author-role]'),
        isGenerating: !!document.querySelector('.result-streaming')
      });
      
      return { 
        success: false, 
        error: `No ${buttonType} button found`,
        availableButtons: Array.from(document.querySelectorAll('button')).map(btn => ({
          text: btn.textContent?.trim(),
          ariaLabel: btn.getAttribute('aria-label'),
          disabled: btn.disabled
        }))
      };
    }
    
  } catch (error) {
    console.error('❌ Error clicking button:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages
// Note: chrome.runtime not available in MAIN world
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   console.log('🔘 Button clicker received message:', request);
//   
//   if (request.action === 'CLICK_CHATGPT_BUTTON') {
//     const buttonType = request.buttonType || 'any';
//     clickChatGPTButton(buttonType)
//       .then(result => {
//         console.log('✅ Click result:', result);
//         sendResponse(result);
//       })
//       .catch(error => {
//         console.error('❌ Click error:', error);
//         sendResponse({ success: false, error: error.message });
//       });
//     return true; // Keep channel open
//   }
//   
//   // Don't respond to other messages - let other scripts handle them
//   return false;
// });

// Export for console testing
window.clickChatGPTButton = clickChatGPTButton;

console.log('🔘 ChatGPT Button Clicker ready - use window.clickChatGPTButton() to test');