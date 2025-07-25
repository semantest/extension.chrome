// Test script that works with the broadcast server
const WebSocket = require('ws');

const WEBSOCKET_URL = process.env.WS_URL || 'ws://localhost:8081';
const TEST_PROMPT = 'Broadcast test: A steampunk cat inventor in her workshop';

console.log('🚀 Testing with Broadcast Server');
console.log('================================\n');
console.log(`📡 Using WebSocket URL: ${WEBSOCKET_URL}\n`);

async function sendImageRequest() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to ${WEBSOCKET_URL}...`);
    
    const ws = new WebSocket(WEBSOCKET_URL);
    
    ws.on('open', () => {
      console.log('✅ Connected to broadcast server!\n');
      
      // Wait a moment for connection to stabilize
      setTimeout(() => {
        console.log('📤 Sending ImageRequestReceived event...');
        
        // Create the message in the correct format
        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'event',  // lowercase per Carol's fix
          timestamp: Date.now(),
          payload: {
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'semantest/custom/image/request/received',
            timestamp: Date.now(),
            payload: {
              prompt: TEST_PROMPT,
              requestId: `broadcast-test-${Date.now()}`,
              metadata: {
                source: 'broadcast-test',
                style: 'steampunk'
              }
            }
          }
        };
        
        console.log('\nSending message...');
        ws.send(JSON.stringify(message));
        console.log('✅ Image request sent!\n');
        console.log('The broadcast server should now forward this to the extension.\n');
        
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('📨 Received message:');
      try {
        const message = JSON.parse(data.toString());
        console.log(JSON.stringify(message, null, 2));
        
        // Check if it's an acknowledgment
        if (message.payload?.type?.includes('acknowledged')) {
          console.log('\n🎉 Extension acknowledged the request!');
          setTimeout(() => {
            ws.close();
            resolve();
          }, 2000);
        }
      } catch (e) {
        console.log('Raw:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('\n🔌 Connection closed');
      resolve();
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('\n⏱️ Test completed (30s timeout)');
        ws.close();
      }
      resolve();
    }, 30000);
  });
}

// Instructions
console.log('📋 Setup Instructions:');
console.log('1. Start the broadcast server: node test-broadcast-server.js');
console.log('2. Update extension WebSocket URL to ws://localhost:8081');
console.log('3. Reload the extension');
console.log('4. Make sure ChatGPT tab is open');
console.log('5. Run this test\n');

console.log('🎯 Test prompt:');
console.log(`   "${TEST_PROMPT}"\n`);

console.log('Press Enter to start the test...');

// Wait for Enter key
process.stdin.once('data', () => {
  sendImageRequest()
    .then(() => {
      console.log('\n✅ Test completed!');
      console.log('Check ChatGPT to see if the image is being generated!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
});