/**
 * ChatGPT Bridge Content Script
 * Handles communication between service worker and MAIN world scripts
 */

console.log('🌉 ChatGPT Bridge loaded');

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🌉 Bridge received from service worker:', request);
  
  // Handle ping messages for testing
  if (request.type === 'ping') {
    sendResponse({ success: true, message: 'pong', bridge: 'active' });
    return true;
  }
  
  // Forward to MAIN world via DOM element
  // Custom events don't cross the ISOLATED/MAIN boundary, so we use a different approach
  const messageElement = document.createElement('div');
  messageElement.id = 'semantest-message-' + Date.now();
  messageElement.style.display = 'none';
  messageElement.textContent = JSON.stringify(request);
  document.body.appendChild(messageElement);
  
  // Trigger event in MAIN world by modifying the element
  messageElement.setAttribute('data-message-ready', 'true');
  
  // Send response back
  sendResponse({ received: true, bridge: 'active' });
  return true;
});

// Listen for messages from MAIN world
window.addEventListener('semantest-response', (event) => {
  console.log('🌉 Bridge received from MAIN world:', event.detail);
  
  // Check if chrome.runtime is still valid
  try {
    if (chrome.runtime && chrome.runtime.id) {
      // Forward to service worker
      chrome.runtime.sendMessage(event.detail).catch(err => {
        console.error('Failed to send to service worker:', err);
        // If it's a context invalidated error, don't throw
        if (err.message && err.message.includes('Extension context invalidated')) {
          console.warn('⚠️ Extension context invalidated - this is expected if the extension was reloaded');
        }
      });
    } else {
      console.warn('⚠️ Extension context invalidated, cannot send message');
    }
  } catch (err) {
    // Catch any errors from accessing chrome.runtime
    console.warn('⚠️ Extension context error:', err.message);
  }
});

// Create a separate script file for the bridge helper
// Check if already injected
if (!document.getElementById('semantest-bridge-helper')) {
  const bridgeScript = document.createElement('script');
  bridgeScript.id = 'semantest-bridge-helper';
  bridgeScript.src = chrome.runtime.getURL('src/content/bridge-helper.js');
  bridgeScript.onload = () => {
    console.log('🌉 Bridge helper script loaded');
  };
  document.head.appendChild(bridgeScript);
}