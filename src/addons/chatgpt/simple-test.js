// Simple test to verify everything is loaded
console.log('🧪 Simple Test Script Loaded');

// Check what's available
window.addEventListener('load', () => {
  console.log('🔍 Checking loaded components:');
  console.log('  - debugChatGPT:', typeof window.debugChatGPT);
  console.log('  - toolsMenuHelper:', typeof window.toolsMenuHelper);
  console.log('  - chatGPTImageGenerator:', typeof window.chatGPTImageGenerator);
  console.log('  - semantestBridge:', typeof window.semantestBridge);
  
  // If debug tools are available, run it
  if (typeof window.debugChatGPT === 'function') {
    console.log('✅ Debug tools available, running debug...');
    window.debugChatGPT();
  } else {
    console.log('❌ Debug tools not found');
  }
});

// Simple image test that avoids the system-hint button
window.simpleImageTest = async function(prompt = "A robot painting") {
  console.log('🎨 Starting simple image test...');
  
  try {
    // Find the input
    const input = document.querySelector('#prompt-textarea');
    if (!input) {
      console.error('❌ No input found');
      return;
    }
    
    // Check if in image mode
    const placeholder = input.getAttribute('placeholder');
    console.log('📝 Current placeholder:', placeholder);
    
    if (!placeholder?.toLowerCase().includes('image')) {
      console.log('⚠️ Not in image mode. Please enable "Create image" from Tools menu first.');
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
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 500));
    
    // Find the REAL send button
    console.log('🔍 Looking for send button...');
    
    // Get all buttons in the form
    const form = input.closest('form');
    const buttons = form ? form.querySelectorAll('button') : [];
    
    console.log(`Found ${buttons.length} buttons in form`);
    
    // Log each button for debugging
    buttons.forEach((btn, idx) => {
      console.log(`Button ${idx}:`, {
        id: btn.id,
        ariaLabel: btn.getAttribute('aria-label'),
        disabled: btn.disabled,
        hasSvg: btn.querySelector('svg') !== null,
        visible: btn.offsetParent !== null
      });
    });
    
    // Find the send button (usually the last button with an SVG that's not disabled)
    const sendButton = Array.from(buttons).reverse().find(btn => 
      btn.id !== 'system-hint-button' &&
      btn.id !== 'upload-file-btn' &&
      !btn.disabled &&
      btn.offsetParent &&
      btn.querySelector('svg')
    );
    
    if (sendButton) {
      console.log('✅ Found send button:', sendButton);
      console.log('🖱️ Clicking send...');
      sendButton.click();
      return { success: true, message: 'Image generation started' };
    } else {
      console.log('❌ Send button not found');
      console.log('💡 Try pressing Enter instead');
      
      const enterEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        bubbles: true
      });
      input.dispatchEvent(enterEvent);
      
      return { success: true, message: 'Sent with Enter key' };
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    return { success: false, error: error.message };
  }
};

console.log('💡 Use window.simpleImageTest("your prompt") to test');
console.log('💡 Make sure you\'re in image mode first!');