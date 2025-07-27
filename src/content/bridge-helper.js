// Bridge helper for MAIN world scripts to communicate
window.semantestBridge = {
  sendToExtension: function(message) {
    window.dispatchEvent(new CustomEvent('semantest-response', {
      detail: message
    }));
  }
};

console.log('🌉 MAIN world bridge helper ready');