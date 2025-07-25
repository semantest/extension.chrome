// Direct test of extension's WebSocket message handling
// Run this in the service worker console

console.log('🧪 Direct WebSocket Message Test');
console.log('================================\n');

// Check WebSocket status
if (self.wsHandler) {
  console.log('✅ WebSocket handler found');
  console.log('Connection status:', self.wsHandler.ws?.readyState === 1 ? 'OPEN' : 'NOT CONNECTED');
  
  if (self.wsHandler.ws?.readyState !== 1) {
    console.log('❌ WebSocket not connected. Trying to connect...');
    self.wsHandler.connect();
    console.log('⏳ Wait a moment and run this test again');
  } else {
    console.log('\n📤 Simulating incoming WebSocket message...');
    
    // Create a fake WebSocket message event
    const testMessage = {
      id: `msg-${Date.now()}-test`,
      type: 'event',  // lowercase as per Carol's fix
      timestamp: Date.now(),
      payload: {
        id: `evt-${Date.now()}-test`,
        type: 'semantest/custom/image/request/received',
        timestamp: Date.now(),
        payload: {
          prompt: 'Direct test: A cyberpunk cat in neon city',
          requestId: `direct-test-${Date.now()}`,
          metadata: {
            source: 'direct-test',
            style: 'cyberpunk'
          }
        }
      }
    };
    
    console.log('Message structure:', JSON.stringify(testMessage, null, 2));
    
    // Directly call the message handler
    const fakeEvent = {
      data: JSON.stringify(testMessage)
    };
    
    console.log('\n🎯 Calling onmessage handler directly...');
    if (self.wsHandler.ws.onmessage) {
      self.wsHandler.ws.onmessage(fakeEvent);
      console.log('✅ Message handler called');
    } else {
      console.log('❌ No onmessage handler found');
    }
  }
} else {
  console.log('❌ WebSocket handler not found');
  console.log('Make sure the extension loaded properly');
}