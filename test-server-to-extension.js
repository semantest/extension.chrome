// Test script to simulate server sending image request to extension
// This mimics what generate-image.sh would send

const WebSocket = require('ws');

const WEBSOCKET_URL = 'ws://localhost:8080';
const TEST_PROMPT = 'Generate an image of a futuristic cat playing piano in space, manga style';

console.log('🚀 Testing Server → Extension → ChatGPT Flow');
console.log('============================================\n');

async function sendImageRequest() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to ${WEBSOCKET_URL}...`);
    
    const ws = new WebSocket(WEBSOCKET_URL);
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server!\n');
      
      // Wait a moment for connection to stabilize
      setTimeout(() => {
        console.log('📤 Sending ImageRequestReceived event...');
        
        // Create the message in the exact format the server expects
        // Based on QA's findings from websocket-message-format-fix.md
        const message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: 'event',  // MUST be lowercase per Carol's fix
          timestamp: Date.now(),
          payload: {
            id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'semantest/custom/image/request/received',
            timestamp: Date.now(),
            payload: {
              prompt: TEST_PROMPT,
              requestId: `test-${Date.now()}`,
              metadata: {
                source: 'test-script',
                style: 'manga',
                test: true
              }
            }
          }
        };
        
        console.log('\nMessage structure:');
        console.log(JSON.stringify(message, null, 2));
        
        ws.send(JSON.stringify(message));
        console.log('\n✅ Image request sent!');
        console.log('\n📋 What should happen now:');
        console.log('1. Extension receives the WebSocket message');
        console.log('2. Extension sends prompt to ChatGPT');
        console.log('3. ChatGPT starts generating the image');
        console.log('4. Extension sends acknowledgment back\n');
        
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('📨 Received response from server:');
      try {
        const message = JSON.parse(data.toString());
        console.log(JSON.stringify(message, null, 2));
        
        // Check if it's an acknowledgment from the extension
        if (message.payload && message.payload.type === 'semantest/custom/image/request/acknowledged') {
          console.log('\n🎉 Extension acknowledged the image request!');
          console.log('   Status:', message.payload.payload.status);
          console.log('   Message:', message.payload.payload.message);
          
          // Success! Close the connection
          setTimeout(() => {
            ws.close();
            resolve();
          }, 2000);
        }
      } catch (e) {
        console.log('Raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('\n🔌 WebSocket connection closed');
    });
    
    // Timeout after 30 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        console.log('\n⏱️ Timeout - no acknowledgment received');
        console.log('Check if:');
        console.log('- Extension is loaded in Chrome');
        console.log('- ChatGPT tab is open');
        console.log('- Extension console for errors');
        ws.close();
      }
      resolve(); // Don't reject on timeout, just inform
    }, 30000);
  });
}

// Instructions
console.log('📋 Pre-test checklist:');
console.log('1. ✓ Backend server is running (confirmed)');
console.log('2. ? Extension is loaded in Chrome');
console.log('3. ? ChatGPT tab is open and logged in');
console.log('4. ? Extension service worker console is open\n');

console.log('🎯 Test prompt:');
console.log(`   "${TEST_PROMPT}"\n`);

console.log('Starting test in 3 seconds...\n');

setTimeout(() => {
  sendImageRequest()
    .then(() => {
      console.log('\n✅ Test completed!');
      console.log('\n💡 Check ChatGPT to see if the image is being generated!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Test failed:', error.message);
      process.exit(1);
    });
}, 3000);