// Quick WebSocket test to send image request
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3004');

ws.on('open', () => {
    console.log('✅ Connected to WebSocket server');
    
    // Send image request
    const message = {
        id: `msg-${Date.now()}`,
        type: 'event',
        timestamp: Date.now(),
        payload: {
            id: `evt-${Date.now()}`,
            type: 'semantest/custom/image/request/received',
            timestamp: Date.now(),
            payload: {
                prompt: 'A beautiful robot painting a sunset',
                requestId: `req-${Date.now()}`
            }
        }
    };
    
    console.log('📤 Sending:', JSON.stringify(message, null, 2));
    ws.send(JSON.stringify(message));
});

ws.on('message', (data) => {
    console.log('📥 Received:', data.toString());
});

ws.on('error', (err) => {
    console.error('❌ Error:', err);
});

ws.on('close', () => {
    console.log('🔌 Connection closed');
});

// Keep connection open for 5 seconds
setTimeout(() => {
    ws.close();
    process.exit(0);
}, 5000);