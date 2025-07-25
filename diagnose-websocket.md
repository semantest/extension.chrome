# WebSocket Diagnostics Guide

## Current Status
- ✅ Server is running at ws://localhost:8080
- ✅ Server accepts connections
- ✅ Message format is correct (lowercase 'event')
- ❓ Extension not acknowledging messages

## Troubleshooting Steps

### 1. Check Extension Service Worker Console
1. Open Chrome DevTools for the extension
2. Go to chrome://extensions
3. Find Semantest extension
4. Click "Inspect views: service worker"
5. Look for these messages:
   - "🔌 WebSocket Handler initializing..."
   - "✅ WebSocket connected successfully"
   - "📨 Received WebSocket message:"

### 2. Check if WebSocket Handler Loaded
In the service worker console, type:
```javascript
// Check if WebSocket handler exists
self.wsHandler

// Check WebSocket status
self.wsHandler?.ws?.readyState
// Should be 1 (OPEN) if connected
```

### 3. Manually Test Message Handling
In the service worker console, try:
```javascript
// Simulate receiving an image request
if (self.wsHandler) {
  self.wsHandler.handleImageRequest({
    id: 'test-123',
    type: 'event',
    payload: {
      type: 'semantest/custom/image/request/received',
      payload: {
        prompt: 'Test prompt from console',
        requestId: 'console-test-' + Date.now()
      }
    }
  }, {
    prompt: 'Test prompt from console',
    requestId: 'console-test-' + Date.now()
  });
}
```

### 4. Check Chrome Runtime Messages
See if the extension can receive Chrome messages:
```javascript
// In ChatGPT tab console
chrome.runtime.sendMessage({
  action: 'PING'
}, response => {
  console.log('Extension response:', response);
});
```

## Possible Issues

### Issue 1: WebSocket Not Connecting
If `self.wsHandler` is undefined:
- The websocket-handler.js might not be loading
- Check for "Failed to load WebSocket handler" error

### Issue 2: Messages Not Being Processed
If WebSocket is connected but messages aren't processed:
- The message handler might not be triggering
- Check the onmessage handler in websocket-handler.js

### Issue 3: Chrome Runtime Communication
If the extension can't forward to ChatGPT:
- Service worker might be inactive
- Try reloading the extension

## Quick Fix Attempts

1. **Reload Extension**
   - chrome://extensions → Reload

2. **Check ChatGPT Tab**
   - Make sure a ChatGPT tab is open
   - Try "Test Direct Send" button (you said this works)

3. **Restart Chrome**
   - Sometimes helps with service worker issues

## Expected Flow
1. Server sends: `semantest/custom/image/request/received`
2. Extension websocket-handler.js receives it
3. Handler forwards to service worker via chrome.runtime.sendMessage
4. Service worker sends prompt to ChatGPT
5. Extension sends acknowledgment back to server