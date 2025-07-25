// WebSocket Listener - See what the server is actually broadcasting
const WebSocket = require('ws');

const WEBSOCKET_URL = 'ws://localhost:8080';

console.log('🎧 WebSocket Listener - Monitoring Server Messages');
console.log('=================================================\n');

const ws = new WebSocket(WEBSOCKET_URL);

ws.on('open', () => {
  console.log('✅ Connected to server');
  console.log('📡 Listening for messages...\n');
});

ws.on('message', (data) => {
  console.log('📨 Received message:');
  try {
    const message = JSON.parse(data.toString());
    console.log(JSON.stringify(message, null, 2));
    
    // Check message type
    if (message.payload?.type === 'semantest/custom/image/request/received') {
      console.log('\n🎯 IMAGE REQUEST DETECTED!');
      console.log('Prompt:', message.payload.payload?.prompt);
    }
  } catch (e) {
    console.log('Raw:', data.toString());
  }
  console.log('---\n');
});

ws.on('error', (error) => {
  console.error('❌ Error:', error.message);
});

ws.on('close', () => {
  console.log('🔌 Connection closed');
});

console.log('Keep this running and run test-server-to-extension.js in another terminal');
console.log('This will show if the server is actually broadcasting messages\n');