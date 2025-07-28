// Fix for Extension Context Invalidated errors
console.log('🛡️ Context Fix loaded');

// Wrap all chrome.runtime calls
const safeChrome = {
  runtime: {
    sendMessage: function(message, callback) {
      try {
        if (chrome.runtime && chrome.runtime.id) {
          return chrome.runtime.sendMessage(message, callback);
        } else {
          console.warn('⚠️ Extension context invalidated, skipping message');
          if (callback) callback();
        }
      } catch (err) {
        console.warn('⚠️ Chrome runtime error:', err.message);
        if (callback) callback();
      }
    },
    
    onMessage: chrome.runtime ? chrome.runtime.onMessage : {
      addListener: () => console.warn('⚠️ Cannot add listener - extension context invalid')
    }
  }
};

// Override window.semantestBridge if it exists
if (window.semantestBridge) {
  const originalSend = window.semantestBridge.sendToExtension;
  
  window.semantestBridge.sendToExtension = function(data) {
    console.log('🛡️ Intercepting bridge message:', data.type);
    
    try {
      // Try original method
      if (originalSend) {
        return originalSend.call(this, data);
      }
    } catch (err) {
      console.warn('⚠️ Bridge error (handled):', err.message);
      // Continue anyway - don't break functionality
    }
    
    // Fallback: dispatch custom event
    try {
      window.dispatchEvent(new CustomEvent('semantest-response', {
        detail: data
      }));
    } catch (err) {
      console.warn('⚠️ Event dispatch error:', err.message);
    }
  };
}

console.log('🛡️ Context protection active');