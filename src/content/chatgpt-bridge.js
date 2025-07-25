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
  
  // Forward to service worker
  chrome.runtime.sendMessage(event.detail).catch(err => {
    console.error('Failed to send to service worker:', err);
  });
});

// Inject a helper script into MAIN world
const script = document.createElement('script');
script.textContent = `
  // Helper for MAIN world scripts to communicate
  window.semantestBridge = {
    sendToExtension: function(message) {
      window.dispatchEvent(new CustomEvent('semantest-response', {
        detail: message
      }));
    }
  };
  console.log('🌉 MAIN world bridge helper ready');
`;
document.head.appendChild(script);
script.remove();