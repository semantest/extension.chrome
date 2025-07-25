// EMERGENCY FIX: Microphone button issue
console.log('🚨 Emergency fix for microphone button issue loaded');

window.emergencyImageTest = async function(prompt = "A robot painting") {
  console.log('🚨 EMERGENCY IMAGE TEST - Avoiding microphone button');
  
  try {
    // Find the input
    const input = document.querySelector('#prompt-textarea');
    if (!input) {
      console.error('❌ No input found');
      return;
    }
    
    // Enter the prompt
    console.log('💬 Entering prompt...');
    input.focus();
    input.click();
    
    if (input.tagName === 'TEXTAREA') {
      input.value = prompt;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      input.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = prompt;
      input.appendChild(p);
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: prompt }));
    }
    
    await new Promise(r => setTimeout(r, 500));
    
    // CRITICAL: Find ONLY the send button, NOT microphone
    console.log('🔍 Finding send button (NOT microphone)...');
    
    // Get the form
    const form = input.closest('form');
    if (!form) {
      console.error('❌ No form found');
      return;
    }
    
    // Find all buttons and log them
    const allButtons = form.querySelectorAll('button');
    console.log(`\n🔍 Found ${allButtons.length} buttons in form:`);
    
    let micButton = null;
    let sendButton = null;
    
    allButtons.forEach((btn, idx) => {
      const ariaLabel = btn.getAttribute('aria-label') || '';
      const title = btn.getAttribute('title') || '';
      const hasMicIcon = btn.querySelector('svg path[d*="M12 2"]') || // Common mic path
                         btn.querySelector('svg path[d*="microphone"]') ||
                         ariaLabel.toLowerCase().includes('microphone') ||
                         ariaLabel.toLowerCase().includes('voice') ||
                         title.toLowerCase().includes('microphone');
      
      console.log(`Button ${idx}:`, {
        id: btn.id,
        ariaLabel: ariaLabel,
        title: title,
        hasMicIcon: hasMicIcon,
        disabled: btn.disabled,
        type: btn.type
      });
      
      if (hasMicIcon) {
        console.log('🎤 This is the MICROPHONE button - SKIP!');
        micButton = btn;
      } else if (!btn.disabled && 
                 btn.id !== 'system-hint-button' &&
                 btn.id !== 'upload-file-btn' &&
                 !ariaLabel.includes('tool') &&
                 btn.querySelector('svg')) {
        // Potential send button
        sendButton = btn;
      }
    });
    
    if (!sendButton) {
      console.log('❌ No send button found!');
      console.log('🔍 Looking for button with send/arrow icon...');
      
      // Try to find by position - send is usually last
      const enabledButtons = Array.from(allButtons).filter(btn => 
        !btn.disabled && 
        btn.offsetParent &&
        btn !== micButton &&
        btn.id !== 'system-hint-button' &&
        btn.id !== 'upload-file-btn'
      );
      
      console.log(`Found ${enabledButtons.length} enabled non-mic buttons`);
      
      if (enabledButtons.length > 0) {
        // Send button is typically the last one
        sendButton = enabledButtons[enabledButtons.length - 1];
        console.log('📍 Using last button as send:', sendButton);
      }
    }
    
    if (sendButton === micButton) {
      console.error('🚨 CRITICAL: About to click microphone! Aborting!');
      return { success: false, error: 'Would click microphone button' };
    }
    
    if (sendButton) {
      console.log('✅ Found send button (NOT microphone)');
      console.log('🖱️ Clicking send button...');
      sendButton.click();
      return { success: true, message: 'Clicked send (not mic)' };
    } else {
      console.log('⌨️ No send button, trying Enter key...');
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      });
      input.dispatchEvent(enterEvent);
      return { success: true, message: 'Used Enter key' };
    }
    
  } catch (error) {
    console.error('❌ Emergency test error:', error);
    return { success: false, error: error.message };
  }
};

console.log('🚨 Use window.emergencyImageTest("prompt") to avoid microphone!');