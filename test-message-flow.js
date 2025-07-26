// Debug script to test the message flow from WebSocket to ChatGPT page
console.log('🔍 Testing message flow...');

// Check if we're in a ChatGPT tab
if (window.location.hostname.includes('chat.openai.com') || window.location.hostname.includes('chatgpt.com')) {
  console.log('✅ Running in ChatGPT tab');
  
  // Check for bridge
  console.log('🌉 Bridge status:', {
    semantestBridge: typeof window.semantestBridge !== 'undefined',
    eventListeners: window.getEventListeners ? window.getEventListeners(window) : 'Cannot check'
  });
  
  // Check for image generator
  console.log('🎨 Image generator status:', {
    chatGPTImageGenerator: typeof window.chatGPTImageGenerator !== 'undefined',
    generateImage: typeof window.chatGPTImageGenerator?.generateImage === 'function'
  });
  
  // Check for addon
  console.log('📦 Addon status:', {
    chatgptAddon: typeof window.chatgptAddon !== 'undefined',
    initialized: window.chatgptAddon?.version
  });
  
  // Listen for messages
  console.log('👂 Setting up message listener...');
  window.addEventListener('semantest-message', (event) => {
    console.log('📨 Received semantest-message:', event.detail);
  });
  
  // Test sending a message
  console.log('🚀 Simulating an image request message...');
  window.dispatchEvent(new CustomEvent('semantest-message', {
    detail: {
      type: 'websocket:message',
      payload: {
        type: 'semantest/custom/image/request/received',
        payload: {
          prompt: 'TEST: A beautiful sunset over mountains',
          requestId: 'test-' + Date.now()
        }
      }
    }
  }));
  
} else {
  console.log('❌ Not running in a ChatGPT tab');
}

// Export test function
window.testMessageFlow = function() {
  console.log('🧪 Running comprehensive message flow test...');
  
  // 1. Check all components
  const status = {
    url: window.location.href,
    bridge: !!window.semantestBridge,
    imageGenerator: !!window.chatGPTImageGenerator,
    addon: !!window.chatgptAddon,
    listeners: []
  };
  
  // 2. Test direct image generation
  if (window.chatGPTImageGenerator) {
    console.log('🎨 Testing direct image generation...');
    window.chatGPTImageGenerator.generateImage('TEST: Direct call to generate image')
      .then(result => console.log('✅ Direct generation result:', result))
      .catch(error => console.error('❌ Direct generation error:', error));
  }
  
  return status;
};

console.log('🔍 Test script ready. Use window.testMessageFlow() to run comprehensive test.');