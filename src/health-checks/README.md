# Chrome Extension Health Check System

## Overview

The Chrome Extension layer of the health check system is responsible for **ONLY** managing ChatGPT.com tabs. It does not handle browser launching (server's job) or login status (addon's job).

## Responsibilities

### ✅ Extension Layer DOES:
1. Check if ChatGPT.com tabs exist
2. Create new ChatGPT tab if missing
3. Forward health checks to addon for session verification
4. Return health status with child health from addon

### ❌ Extension Layer DOES NOT:
1. Check if browser can launch (server's responsibility)
2. Check login status (addon's responsibility)
3. Handle authentication (addon's responsibility)
4. Manage browser processes (server's responsibility)

## Architecture

```
Server (Browser Health)
    ↓
Extension (Tab Health) ← You are here
    ↓
Addon (Session Health)
```

## Key Components

### TabHealthCheck Class
- `hasChatGPTTab()`: Check if any ChatGPT tabs exist
- `createChatGPTTab()`: Create new tab if needed
- `checkAndEnsureTab()`: Ensure tab exists (create if missing)
- `forwardHealthCheckToAddon()`: Delegate session check to addon
- `performHealthCheck()`: Complete health check with child status

### HealthCheckHandler Class
- Integrates with background script
- Handles health check messages from server
- Manages image generation requests
- Sets up message listeners

## Usage

### From Server (External)
```javascript
// Server sends health check request
chrome.runtime.sendMessageExternal(extensionId, {
  type: 'HEALTH_CHECK'
}, (response) => {
  console.log('Health status:', response.health);
});
```

### From Extension (Internal)
```javascript
// Popup or other extension parts
chrome.runtime.sendMessage({
  action: 'performHealthCheck'
}, (response) => {
  console.log('Health status:', response.health);
});
```

## Health Status Format

```typescript
interface HealthStatus {
  component: 'extension';
  healthy: boolean;
  message?: string;
  action?: string;
  childHealth?: HealthStatus; // From addon
}
```

### Example Responses

When everything is healthy:
```json
{
  "component": "extension",
  "healthy": true,
  "message": "ChatGPT tab active",
  "childHealth": {
    "component": "addon",
    "healthy": true,
    "message": "Logged in as: user@example.com"
  }
}
```

When addon is not loaded:
```json
{
  "component": "extension",
  "healthy": true,
  "message": "ChatGPT tab exists, addon not loaded yet",
  "childHealth": {
    "component": "addon",
    "healthy": false,
    "message": "Addon not loaded in tab",
    "action": "Reload the page"
  }
}
```

When not logged in:
```json
{
  "component": "extension",
  "healthy": true,
  "message": "ChatGPT tab active",
  "childHealth": {
    "component": "addon",
    "healthy": false,
    "message": "Not logged in to ChatGPT",
    "action": "https://chat.openai.com/auth/login"
  }
}
```

## Testing

### Test Tab Health Only
```javascript
// In extension console
const { TabHealthCheck } = await import('./health-checks/tab-health.js');
const tabHealth = new TabHealthCheck();

// Check if tab exists
const hasTab = await tabHealth.hasChatGPTTab();
console.log('Has ChatGPT tab:', hasTab);

// Ensure tab exists
const result = await tabHealth.checkAndEnsureTab();
console.log('Tab result:', result);
```

### Test Complete Health Chain
```javascript
// In extension console
const { healthCheckHandler } = await import('./health-checks/index.js');
const health = await healthCheckHandler.handleHealthCheckRequest();
console.log('Complete health:', health);
```

## Integration Points

1. **Background Script**: Health check handler is initialized on extension startup
2. **Message Listeners**: Both external (from server) and internal (from popup) messages are handled
3. **Content Script Communication**: Uses `chrome.tabs.sendMessage` to communicate with addon
4. **Popup UI**: Health status displayed in popup with visual indicators (health-check-ui.js)

## Popup UI Integration

The extension popup displays real-time health status with visual indicators:

### Visual States
- **Green dot** (`.active`): All systems healthy
- **Red dot** (`.inactive`): Health check failed
- **Status text**: Shows current health message

### Features
- Polls health status every 5 seconds
- Automatically creates ChatGPT tab if missing
- Shows server health status first, then tab health
- Displays actionable error messages

### Implementation
- `health-check-ui.js`: Module that integrates with popup
- Imports `TabHealthCheck` from the health checks module
- Updates DOM elements with health status
- Handles automatic tab creation on failure

## Error Handling

- Timeout after 5 seconds if addon doesn't respond
- Graceful handling of missing content script
- Clear error messages for debugging
- Action suggestions for fixing issues