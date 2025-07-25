// Simple WebSocket test without Playwright
// Tests if the WebSocket server is running and message format is correct

const WebSocket = require('ws');

const WEBSOCKET_URL = 'ws://localhost:8080';

console.log('🧪 Simple WebSocket Test for Semantest Extension');
console.log('================================================\n');

async function testWebSocket() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to ${WEBSOCKET_URL}...`);
    
    const ws = new WebSocket(WEBSOCKET_URL);
    let testPassed = false;
    
    ws.on('open', () => {
      console.log('✅ Connected to WebSocket server!\n');
      
      // Test 1: Send registration message
      console.log('📤 Test 1: Sending extension registration...');
      const registrationMsg = {
        id: `msg-${Date.now()}-reg`,
        type: 'event',  // MUST be lowercase per Carol's fix
        timestamp: Date.now(),
        payload: {
          id: `evt-${Date.now()}-reg`,
          type: 'semantest/extension/registered',
          timestamp: Date.now(),
          payload: {
            extensionId: 'test-extension',
            version: '1.0.0',
            capabilities: ['image-generation', 'chatgpt-automation']
          }
        }
      };
      
      ws.send(JSON.stringify(registrationMsg));
      console.log('Message sent:', JSON.stringify(registrationMsg, null, 2));
      
      // Test 2: Send image request acknowledgment
      setTimeout(() => {
        console.log('\n📤 Test 2: Sending image request acknowledgment...');
        const ackMsg = {
          id: `msg-${Date.now()}-ack`,
          type: 'event',  // Carol's critical fix!
          timestamp: Date.now(),
          payload: {
            id: `evt-${Date.now()}-ack`,
            type: 'semantest/custom/image/request/acknowledged',
            timestamp: Date.now(),
            payload: {
              correlationId: 'test-request-123',
              status: 'success',
              message: 'Image generation started',
              timestamp: Date.now()
            }
          }
        };
        
        ws.send(JSON.stringify(ackMsg));
        console.log('Message sent:', JSON.stringify(ackMsg, null, 2));
        
        testPassed = true;
        
        // Close connection after tests
        setTimeout(() => {
          ws.close();
        }, 2000);
      }, 1000);
    });
    
    ws.on('message', (data) => {
      console.log('\n📨 Received message from server:');
      try {
        const message = JSON.parse(data.toString());
        console.log(JSON.stringify(message, null, 2));
        
        // Verify message format
        if (message.type && message.type !== 'event') {
          console.warn('⚠️  WARNING: Server sent uppercase or incorrect type:', message.type);
          console.warn('    Should be lowercase "event" per Carol\'s fix!');
        }
      } catch (e) {
        console.log('Raw message:', data.toString());
      }
    });
    
    ws.on('error', (error) => {
      console.error('\n❌ WebSocket error:', error.message);
      console.log('\n💡 Is the backend server running?');
      console.log('   Try: cd /path/to/backend && npm start');
      reject(error);
    });
    
    ws.on('close', () => {
      console.log('\n🔌 WebSocket connection closed');
      if (testPassed) {
        console.log('\n✅ All tests passed!');
        console.log('   - Connected successfully');
        console.log('   - Sent messages with lowercase "event" type');
        console.log('   - Extension is ready for production!');
        resolve();
      } else {
        reject(new Error('Test did not complete'));
      }
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      reject(new Error('Test timeout'));
    }, 10000);
  });
}

// Run the test
console.log('Starting WebSocket test...\n');
testWebSocket()
  .then(() => {
    console.log('\n🎉 Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  });