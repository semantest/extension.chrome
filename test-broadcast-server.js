// Simple WebSocket broadcast server for testing
// This server will broadcast any message it receives to all connected clients

const WebSocket = require('ws');
const http = require('http');

const PORT = 8081; // Different port to avoid conflict

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store all connected clients
const clients = new Set();

console.log(`🚀 Test Broadcast Server starting on port ${PORT}...`);

wss.on('connection', (ws) => {
  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  clients.add(ws);
  
  console.log(`✅ Client connected: ${clientId} (Total clients: ${clients.size})`);
  
  // Send connection confirmation
  ws.send(JSON.stringify({
    id: `msg-${Date.now()}`,
    type: 'event',
    timestamp: Date.now(),
    payload: {
      id: `evt-${Date.now()}`,
      type: 'system.connected',
      timestamp: Date.now(),
      payload: {
        clientId: clientId,
        message: 'Connected to test broadcast server'
      }
    }
  }));
  
  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`📨 Received from ${clientId}:`, message.payload?.type || message.type);
      
      // Broadcast to all OTHER clients (not the sender)
      let broadcastCount = 0;
      clients.forEach(client => {
        if (client !== ws && client.readyState === WebSocket.OPEN) {
          client.send(data.toString());
          broadcastCount++;
        }
      });
      
      console.log(`📡 Broadcasted to ${broadcastCount} other clients`);
      
      // If it's an image request, log it specially
      if (message.payload?.type === 'semantest/custom/image/request/received') {
        console.log(`🎨 IMAGE REQUEST: "${message.payload.payload?.prompt}"`);
      }
      
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });
  
  // Handle client disconnect
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`👋 Client disconnected: ${clientId} (Total clients: ${clients.size})`);
  });
  
  ws.on('error', (error) => {
    console.error(`❌ Client error ${clientId}:`, error.message);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Test Broadcast Server running on ws://localhost:${PORT}`);
  console.log('📡 This server will broadcast all messages to all connected clients');
  console.log('\nTo test:');
  console.log('1. Update extension to connect to ws://localhost:8081');
  console.log('2. Run the test script with PORT=8081');
  console.log('3. The server will broadcast messages between clients\n');
});