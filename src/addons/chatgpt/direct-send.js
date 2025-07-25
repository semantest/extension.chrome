// Direct ChatGPT prompt sender - works with contenteditable
console.log('💬 ChatGPT Direct Send loaded');

async function sendChatGPTPrompt(promptText) {
  console.log('📤 Sending prompt:', promptText);
  
  try {
    // Check ChatGPT state first
    if (window.chatGPTStateDetector) {
      const status = window.chatGPTStateDetector.getStatusReport();
      console.log('📊 Current ChatGPT state:', status.summary);
      
      if (status.state.isGenerating || status.state.isImageGenerating) {
        console.log('⚠️ ChatGPT is busy generating');
        return { 
          success: false, 
          error: `Cannot send prompt: ${status.summary}`,
          state: status.state,
          recommendations: status.recommendations
        };
      }
      
      if (status.state.isError) {
        console.log('⚠️ ChatGPT has an error');
        return { 
          success: false, 
          error: 'ChatGPT has an error: ' + (status.state.details.error || 'Unknown'),
          state: status.state
        };
      }
      
      if (!status.state.canSendMessage) {
        console.log('⚠️ Cannot send message in current state');
        return { 
          success: false, 
          error: 'ChatGPT is not ready to receive messages',
          state: status.state
        };
      }
    }
    
    // ChatGPT uses ProseMirror editor (contenteditable div)
    const editor = document.querySelector('#prompt-textarea') ||
                  document.querySelector('[contenteditable="true"].ProseMirror') ||
                  document.querySelector('[contenteditable="true"]');
    
    if (!editor) {
      throw new Error('No input field found');
    }
    
    console.log('📝 Found editor:', editor);
    
    // Focus the editor
    editor.focus();
    editor.click();
    
    // Clear existing content first
    editor.innerHTML = '';
    
    // Create a paragraph with the text
    const paragraph = document.createElement('p');
    paragraph.textContent = promptText;
    editor.appendChild(paragraph);
    
    // Trigger input event to update the UI and enable send button
    const inputEvent = new InputEvent('input', { 
      bubbles: true, 
      cancelable: true,
      inputType: 'insertParagraph',
      data: promptText 
    });
    editor.dispatchEvent(inputEvent);
    
    // Also dispatch a keyup event to ensure UI updates
    const keyupEvent = new KeyboardEvent('keyup', {
      bubbles: true,
      cancelable: true,
      key: 'a',
      code: 'KeyA'
    });
    editor.dispatchEvent(keyupEvent);
    
    // Focus again to ensure cursor is active
    editor.focus();
    
    // Wait for UI to update and send button to become enabled
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Find send button - try multiple selectors
    console.log('🔍 Looking for send button...');
    
    // Get the form containing the editor
    const form = editor.closest('form');
    if (!form) {
      console.log('⚠️ No form found');
    }
    
    // Try different button selectors - avoid upload button
    let sendButton = null;
    
    // Method 1: Look for button with specific attributes (excluding upload)
    sendButton = document.querySelector('button[data-testid="send-button"]') ||
                document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
                document.querySelector('button[aria-label="Send message"]') ||
                document.querySelector('button[aria-label="Send prompt"]');
    
    // Method 2: Find the send button by its position and attributes
    if (!sendButton) {
      const form = editor.closest('form');
      if (form) {
        // Look for buttons in the form
        const buttons = form.querySelectorAll('button');
        for (const btn of buttons) {
          // Skip upload button
          if (btn.id === 'upload-file-btn' || 
              btn.getAttribute('aria-label')?.includes('upload') ||
              btn.getAttribute('aria-label')?.includes('file')) {
            continue;
          }
          
          // Look for send button characteristics
          if (btn.type === 'submit' || 
              (!btn.disabled && btn.querySelector('svg'))) {
            sendButton = btn;
            break;
          }
        }
      }
    }
    
    // Method 3: Find button with arrow/send icon SVG (last resort)
    if (!sendButton) {
      const buttons = document.querySelectorAll('button');
      for (const btn of buttons) {
        // Skip disabled buttons and upload button
        if (btn.disabled || 
            btn.id === 'upload-file-btn' ||
            btn.getAttribute('aria-label')?.includes('upload') ||
            btn.getAttribute('aria-label')?.includes('file')) {
          continue;
        }
        
        // Check if it has an SVG (likely the send icon)
        const svg = btn.querySelector('svg');
        if (svg && btn.offsetParent !== null) {  // Also check if visible
          // Check if it's in the same form as the editor
          if (btn.closest('form') === form) {
            sendButton = btn;
            break;
          }
        }
      }
    }
    
    // Method 3: Get the last enabled button in the form
    if (!sendButton && form) {
      const formButtons = form.querySelectorAll('button:not([disabled])');
      if (formButtons.length > 0) {
        sendButton = formButtons[formButtons.length - 1];
      }
    }
    
    if (sendButton) {
      console.log('✅ Found send button:', sendButton);
      console.log('Button details:', {
        className: sendButton.className,
        disabled: sendButton.disabled,
        ariaLabel: sendButton.getAttribute('aria-label'),
        testId: sendButton.getAttribute('data-testid'),
        hasText: sendButton.textContent
      });
      
      // Check if button is actually clickable
      if (sendButton.disabled) {
        console.log('⚠️ Send button is disabled');
        return { success: false, error: 'Send button is disabled - ChatGPT may be busy' };
      }
      
      // Click the button
      sendButton.click();
      
      // Also try dispatching click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      sendButton.dispatchEvent(clickEvent);
      
      // Verify the prompt was actually sent by checking if input cleared
      setTimeout(() => {
        const checkEditor = document.querySelector('#prompt-textarea');
        if (checkEditor && checkEditor.textContent.trim() === '') {
          console.log('✅ Prompt was sent (input cleared)');
        } else {
          console.log('⚠️ Input not cleared - send may have failed');
        }
      }, 500);
      
      return { success: true, message: 'Prompt sent successfully' };
    } else {
      console.log('❌ No send button found, trying Enter key...');
      
      // Debug: Show all buttons in the form
      if (form) {
        const allButtons = form.querySelectorAll('button');
        console.log(`Found ${allButtons.length} buttons in form:`);
        allButtons.forEach((btn, index) => {
          console.log(`Button ${index}:`, {
            text: btn.textContent?.trim(),
            ariaLabel: btn.getAttribute('aria-label'),
            testId: btn.getAttribute('data-testid'),
            disabled: btn.disabled,
            className: btn.className
          });
        });
      }
      
      // Fallback: Try Enter key
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: true
      });
      editor.dispatchEvent(enterEvent);
      
      return { success: true, message: 'Prompt sent via Enter key' };
    }
    
  } catch (error) {
    console.error('❌ Error sending prompt:', error);
    return { success: false, error: error.message };
  }
}

// Listen for messages
// Note: chrome.runtime not available in MAIN world
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   console.log('💬 Direct send received message:', request);
//   
//   if (request.action === 'SEND_CHATGPT_PROMPT') {
//     sendChatGPTPrompt(request.prompt)
//       .then(result => {
//         console.log('✅ Send result:', result);
//         sendResponse(result);
//       })
//       .catch(error => {
//         console.error('❌ Send error:', error);
//         sendResponse({ success: false, error: error.message });
//       });
//     return true; // Keep channel open
//   }
//   
//   // Don't respond to other messages
//   return false;
// });

// Export for console testing
window.sendChatGPTPrompt = sendChatGPTPrompt;

console.log('💬 ChatGPT Direct Send ready - use window.sendChatGPTPrompt("your prompt") to test');