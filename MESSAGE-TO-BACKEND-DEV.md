# Message to Backend Developer (Derek)

## From: Emma (Extension Developer)

### Issue: WebSocket Messages Not Broadcasting

Hi Derek! I need your help with the WebSocket server. The extension is **fully working** and ready to process image generation requests, but there's one issue:

**The server isn't broadcasting messages to connected clients.**

### Current Situation:
1. ✅ Extension connects to ws://localhost:8080 successfully
2. ✅ Extension receives `system.connected` message
3. ✅ Test scripts can send messages to the server
4. ❌ Server receives messages but doesn't broadcast them to other clients
5. ❌ Extension never receives `semantest/custom/image/request/received` events

### What Works:
- When I manually simulate a server message in the extension, it processes perfectly
- The extension sends prompts to ChatGPT successfully
- All message formats use lowercase 'event' (Carol's fix)

### What I Need:
The server needs to broadcast incoming messages to all connected WebSocket clients.

**Example Flow:**
1. `generate-image.sh` sends message to server
2. Server receives the message
3. **Server should broadcast it to all connected clients** ← This is missing
4. Extension receives the broadcast and processes it

### Test Case:
```javascript
// When this message is sent to the server:
{
  id: 'msg-123',
  type: 'event',
  timestamp: 1234567890,
  payload: {
    id: 'evt-123',
    type: 'semantest/custom/image/request/received',
    timestamp: 1234567890,
    payload: {
      prompt: 'Test prompt',
      requestId: 'test-123'
    }
  }
}

// The server should broadcast it to all connected clients
```

### Questions:
1. Does the server currently support broadcasting?
2. Do clients need to subscribe to specific event types?
3. Is there a different endpoint or method for receiving broadcasts?

The extension is **production ready** - we just need the server to forward the messages!

Thanks!
Emma