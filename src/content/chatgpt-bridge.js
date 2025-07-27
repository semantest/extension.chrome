/**
 * ChatGPT Bridge Content Script
 * Handles communication between service worker and MAIN world scripts
 */

console.log('🌉 ChatGPT Bridge loaded');

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('🌉 Bridge received from service worker:', request);
  
  // Forward to MAIN world via custom event
  window.dispatchEvent(new CustomEvent('semantest-message', {
    detail: request
  }));
  
  // Send response back
  sendResponse({ received: true });
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
const script = document.createElement('script');
script.src = chrome.runtime.getURL('src/content/bridge-helper.js');
script.onload = () => {
  console.log('🌉 Bridge helper script loaded');
  script.remove();
};
document.head.appendChild(script);