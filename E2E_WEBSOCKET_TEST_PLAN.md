# End-to-End WebSocket Test Plan

## Status
- ✅ WebSocket server running on port 3004
- ✅ Chrome extension microphone fix applied
- ✅ Test tools available
- 🔄 Ready for E2E testing

## Test Components

### 1. WebSocket Server (Port 3004)
- Running at: `ws://localhost:3004`
- Status: ✅ Active
- Process: Node.js server listening

### 2. Chrome Extension
- Fixed: Microphone button detection
- Ready: Image generation with explicit tool activation
- Popup: Shows connection status and message logs

### 3. Test Tools
- Browser test: `test-websocket-browser.html`
- CLI test: `./generate-image.sh`
- Direct extension test: `window.chatGPTImageGenerator.generateImage("prompt")`

## Test Flow

### Step 1: Verify Server Connection
1. Open `test-websocket-browser.html` in browser
2. Should auto-connect to `ws://localhost:3004`
3. Status should show "Connected"

### Step 2: Test Message Flow
1. In test page, enter prompt: "A robot painting a sunset"
2. Click "Send Image Request"
3. Check log for sent message with event type: `semantest/custom/image/request/received`

### Step 3: Extension Integration
1. Reload Chrome extension
2. Open popup - check WebSocket status
3. Navigate to ChatGPT tab
4. Open console and run:
   ```javascript
   window.chatGPTImageGenerator.generateImage("A robot painting")
   ```

### Step 4: End-to-End Test
1. Use CLI command:
   ```bash
   ./generate-image.sh "A beautiful landscape"
   ```
2. Monitor:
   - Terminal output
   - Extension popup messages
   - ChatGPT interface actions

## Expected Results

### Success Criteria
1. ✅ WebSocket connects successfully
2. ✅ Messages flow: CLI → Server → Extension
3. ✅ Extension receives image request event
4. ✅ ChatGPT "Create image" tool activated
5. ✅ Prompt entered without clicking microphone
6. ✅ Image generation initiated

### Message Format
```json
{
  "id": "msg-123",
  "type": "event",
  "timestamp": 1234567890,
  "payload": {
    "type": "semantest/custom/image/request/received",
    "payload": {
      "prompt": "test prompt",
      "requestId": "req-123"
    }
  }
}
```

## Troubleshooting

### If WebSocket Won't Connect
- Check server: `lsof -i :3004`
- Restart server: `cd nodejs.server && npm run dev`
- Check firewall/proxy settings

### If Extension Not Receiving
- Check popup connection status
- Reload extension
- Check service worker logs

### If ChatGPT Not Responding
- Ensure "Create image" tool is enabled
- Check console for errors
- Verify microphone button not clicked

## Quick Commands

```bash
# Start server (if not running)
cd nodejs.server && npm run dev

# Test WebSocket
open test-websocket-browser.html

# Test CLI
./generate-image.sh "Test prompt"

# Direct extension test
# In ChatGPT console:
window.chatGPTImageGenerator.generateImage("Test")
```