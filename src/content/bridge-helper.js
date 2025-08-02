// Bridge helper for MAIN world scripts to communicate
// Wrap in IIFE to avoid redeclaration errors
(function() {
  // Check if already initialized
  if (window.semantestBridge && window.semantestBridge._initialized) {
    console.log('🌉 Bridge helper already initialized, skipping');
    return;
  }

  window.semantestBridge = {
    _initialized: true,
    sendToExtension: function(message) {
      window.dispatchEvent(new CustomEvent('semantest-response', {
        detail: message
      }));
    }
  };

  // Watch for messages from ISOLATED world via DOM
  const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'attributes' && 
        mutation.attributeName === 'data-message-ready' &&
        mutation.target.getAttribute('data-message-ready') === 'true') {
      
      // Extract message from element
      try {
        const message = JSON.parse(mutation.target.textContent);
        console.log('🌉 Bridge helper received message from ISOLATED world:', message);
        
        // Dispatch to addon
        window.dispatchEvent(new CustomEvent('semantest-message', {
          detail: message
        }));
        
        // Clean up the element
        mutation.target.remove();
      } catch (error) {
        console.error('Failed to parse message:', error);
      }
    }
  });
});

// Start observing
observer.observe(document.body, {
  childList: true,
  attributes: true,
  attributeFilter: ['data-message-ready'],
  subtree: true
});

  console.log('🌉 MAIN world bridge helper ready');
})();