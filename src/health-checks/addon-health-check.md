# Addon Health Check Documentation

## Overview

The addon health check is the third layer in our health check system, responsible for monitoring the login status on ChatGPT.com. It runs as a content script injected into ChatGPT pages.

## Architecture Position

```
Server (Browser Health)
    ↓
Extension (Tab Health)
    ↓
Addon (Session Health) ← This component
```

## Implementation Details

### File: `health-check-addon.js`

This content script is injected into all ChatGPT.com pages and provides:

1. **Login Status Detection**
   - Checks multiple DOM elements to determine login state
   - Monitors for profile button, chat interface, conversation list
   - Detects login page to identify logged-out state

2. **User Information**
   - Attempts to extract user email from profile elements
   - Provides detailed page state information

3. **Real-time Monitoring**
   - Polls login state every 5 seconds
   - Notifies extension when login state changes
   - Responds to health check requests from extension

### Message Protocol

**Incoming Messages:**
- `CHECK_SESSION`: Request for current health status
- `PING`: Simple connectivity check

**Outgoing Messages:**
- `ADDON_LOADED`: Notifies extension when addon loads
- `LOGIN_STATE_CHANGED`: Notifies when login status changes

### Health Status Response Format

```javascript
{
  component: 'addon',
  healthy: boolean,        // true if logged in
  message: string,         // Status message
  action: string,          // Login URL if not logged in
  details: {
    pageState: string,     // Current page type
    url: string,           // Current URL
    timestamp: string      // ISO timestamp
  }
}
```

## Login Detection Logic

The addon checks for login status using multiple indicators:

1. **Profile Button** - Primary indicator of logged-in state
2. **Chat Interface** - Main chat UI elements
3. **New Chat Button** - Navigation elements
4. **Conversation List** - Chat history sidebar
5. **Login Form** - Negative indicator (means logged out)

## Page States

- `login_page`: On the authentication page
- `conversation`: In a specific conversation
- `home`: On the ChatGPT home page
- `gpt`: Using a custom GPT
- `shared_conversation`: Viewing a shared chat
- `unknown`: Unrecognized page type

## Integration with Extension

The addon integrates with the extension's TabHealthCheck class:

1. Extension checks for ChatGPT tabs
2. If tab exists, sends `CHECK_SESSION` message
3. Addon responds with health status
4. Extension includes addon status in overall health

## Testing

To test the addon health check:

1. **Logged In State**
   - Open ChatGPT while logged in
   - Open extension popup
   - Should show "Logged in" or "Logged in as: [email]"

2. **Logged Out State**
   - Open ChatGPT in incognito/logged out
   - Open extension popup
   - Should show "Not logged in to ChatGPT"
   - Should provide login link

3. **State Changes**
   - Log in/out while extension is open
   - Health status should update within 5 seconds

## Error Handling

- Content script injection failures are logged
- Message sending errors are caught and logged
- DOM query failures default to logged-out state
- All errors maintain safe defaults

## Future Enhancements

- Detect session expiration
- Monitor for rate limiting
- Track conversation limits
- Detect premium account status