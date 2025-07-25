# Semantest Extension Architecture (Refactored)

## Overview

The Semantest Chrome Extension has been refactored from a monolithic ChatGPT-specific extension to a modular, domain-agnostic platform with dynamic addon loading.

## Key Changes

### 1. Core/Addon Separation

**Before**: All ChatGPT logic in main extension code
**After**: Core platform + domain-specific addons

```
src/
├── core/                    # Domain-agnostic core
│   ├── message-bus.js      # Event system
│   ├── message-logger.js   # Message persistence
│   ├── addon-manager.js    # Addon lifecycle
│   └── websocket-client.js # Server communication
└── addons/                 # Domain-specific modules
    └── chatgpt/           # ChatGPT addon
        ├── manifest.json
        ├── index.js
        └── [moved files]
```

### 2. Event-Driven Architecture

**MessageBus**: Central event communication
- Typed events with namespacing
- Request-response pattern support
- Wildcard subscriptions

**Event Flow**:
```
WebSocket → MessageBus → Addon → DOM Action
```

### 3. Dynamic Addon Loading

**AddonManager**: Loads addons based on domain
```javascript
// Addon manifest structure
{
  "addon_id": "chatgpt_addon",
  "domains": ["chat.openai.com"],
  "entry_point": "index.js",
  "websocket_events": ["semantest/custom/image/request/received"]
}
```

### 4. Message Logging System

**Hybrid Storage Pattern**:
- In-memory buffer for performance
- Periodic persistence to chrome.storage
- Real-time popup updates

### 5. New Popup Interface

**Before**: Test buttons and manual actions
**After**: Message log viewer with filtering

Features:
- Real-time message display
- Direction filtering (incoming/outgoing)
- Type filtering
- Connection status
- Message statistics

## Migration Status

### ✅ Completed
- Created core components (MessageBus, MessageLogger, AddonManager)
- Moved ChatGPT files to addon structure
- Created new WebSocket client with MessageBus integration
- Built new popup interface for message viewing
- Updated service worker for modular architecture

### 🔄 In Progress
- Testing end-to-end flow
- Documentation updates

### 📋 TODO
- Test with generate-image.sh script
- Verify ChatGPT addon loads correctly
- Add error handling and recovery
- Create additional addons (Google Images, etc.)

## Testing Instructions

1. **Load Extension**:
   ```bash
   # In Chrome
   1. Go to chrome://extensions/
   2. Enable Developer mode
   3. Load unpacked → select extension.chrome directory
   ```

2. **Test WebSocket**:
   ```bash
   # Terminal 1: Start server
   cd /home/chous/work/semantest
   npm start  # Should run on port 3004

   # Terminal 2: Send test event
   ./generate-image.sh "Test image prompt"
   ```

3. **Verify Addon Loading**:
   - Navigate to chat.openai.com
   - Open extension popup
   - Should show "ChatGPT Addon" as active
   - Check console for addon initialization messages

4. **Check Message Flow**:
   - Send event via generate-image.sh
   - Popup should show incoming WebSocket message
   - ChatGPT page should receive and process the prompt

## Architecture Benefits

1. **Modularity**: Easy to add new domain support
2. **Maintainability**: Clear separation of concerns
3. **Testability**: Isolated components
4. **Performance**: Lazy loading of addons
5. **Flexibility**: Event-driven communication

## Next Steps

1. Complete testing of refactored architecture
2. Add error recovery mechanisms
3. Create Google Images addon example
4. Update user documentation
5. Plan migration for existing users