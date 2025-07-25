// Direct test script for sending prompts to ChatGPT
console.log('🧪 Test direct send script loaded');

// Function to send a prompt directly
async function sendPromptDirect(promptText) {
  console.log('📝 Attempting to send prompt:', promptText);
  
  // Find the textarea
  const textarea = document.querySelector('textarea[placeholder*="Message"]') || 
                  document.querySelector('#prompt-textarea') ||
                  document.querySelector('textarea');
  
  if (!textarea) {
    console.error('❌ No textarea found');
    return { success: false, error: 'Textarea not found' };
  }
  
  console.log('✅ Found textarea:', textarea);
  
  // Set the value - handle both textarea and contenteditable
  textarea.focus();
  
  if (textarea.contentEditable === 'true') {
    // For contenteditable divs (like ChatGPT uses)
    textarea.innerHTML = promptText;
    textarea.textContent = promptText;
    
    // Trigger input event for contenteditable
    const inputEvent = new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      data: promptText
    });
    textarea.dispatchEvent(inputEvent);
  } else {
    // For regular textareas
    textarea.value = promptText;
    const inputEvent = new Event('input', { bubbles: true });
    textarea.dispatchEvent(inputEvent);
  }
  
  console.log('✅ Set textarea value');
  
  // Wait a bit
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Debug: log all buttons in the form
  const form = textarea.closest('form');
  const allButtons = form ? form.querySelectorAll('button') : [];
  console.log('🔍 All buttons in form:', Array.from(allButtons).map(btn => ({
    id: btn.id,
    className: btn.className,
    ariaLabel: btn.getAttribute('aria-label'),
    disabled: btn.disabled,
    type: btn.type,
    hasSvg: !!btn.querySelector('svg')
  })));
  
  // Find the send button - be more specific to avoid upload button
  // Usually it's the last button in the form without upload in its attributes
  const sendButton = document.querySelector('button[data-testid="send-button"]') ||
                    document.querySelector('button[aria-label="Send message"]') ||
                    document.querySelector('button[aria-label="Send prompt"]') ||
                    Array.from(allButtons).reverse().find(btn => 
                      !btn.id?.includes('upload') && 
                      !btn.getAttribute('aria-label')?.toLowerCase().includes('upload') &&
                      !btn.getAttribute('aria-label')?.toLowerCase().includes('file') &&
                      !btn.disabled &&
                      btn.type !== 'button' // Send button usually has no type or type="submit"
                    );
  
  if (sendButton) {
    console.log('✅ Found send button:', sendButton);
    sendButton.click();
    return { success: true, message: 'Prompt sent via button click' };
  } else {
    console.log('⚠️ No send button found, trying Enter key');
    
    // Try Enter key
    const keyEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true
    });
    textarea.dispatchEvent(keyEvent);
    
    return { success: true, message: 'Prompt sent via Enter key' };
  }
}

// Listen for test messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🧪 Test script received message:', request);
  
  if (request.action === 'TEST_SEND_PROMPT') {
    sendPromptDirect(request.prompt || 'Test prompt from direct script')
      .then(result => {
        console.log('✅ Test send result:', result);
        sendResponse(result);
      })
      .catch(error => {
        console.error('❌ Test send error:', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // Keep channel open
  }
});

// Auto-test after 2 seconds if window.testAutoSend is set
setTimeout(() => {
  if (window.testAutoSend) {
    sendPromptDirect('Auto test: Hello ChatGPT!');
  }
}, 2000);

console.log('🧪 Test script ready');