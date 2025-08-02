/**
 * Debug listener to track WebSocket messages
 */

console.log('🔍 Debug listener initializing...');

// Listen for all custom events
window.addEventListener('semantest-message', (event) => {
  console.log('🔍 semantest-message received:', event.detail);
  
  // Check if this is the image generation event
  if (event.detail?.type === 'websocket:message') {
    console.log('🔍 WebSocket message type:', event.detail.payload?.type);
    
    if (event.detail.payload?.type === 'semantest/custom/image/download/requested') {
      console.log('🎯 Image download request detected!');
      console.log('🎯 Prompt:', event.detail.payload.payload?.prompt);
      console.log('🎯 Metadata:', event.detail.payload.payload?.metadata);
    }
  }
});

// Also check if the addon components are loaded
setTimeout(() => {
  console.log('🔍 Addon components check:');
  console.log('  - imageGenerationQueue:', typeof window.imageGenerationQueue);
  console.log('  - chatGPTImageGenerator:', typeof window.chatGPTImageGenerator);
  console.log('  - semantestBridge:', typeof window.semantestBridge);
  console.log('  - chatGPTController:', typeof window.chatGPTController);
}, 1000);

console.log('🔍 Debug listener ready');