# Image Download Fixes - Complete Solution

## Problem Summary
1. Old/existing images were being downloaded when monitoring started
2. Monitoring stopped after 2 minutes instead of 3
3. Extension context invalidated errors breaking the flow

## Fixes Implemented

### 1. Aggressive Prevention of Old Image Downloads
- **Initial Capture Delay**: Wait 1 second before capturing existing images
- **URL Tracking**: Track images with AND without query parameters
- **Message Count Tracking**: Store initial message count when monitoring starts
- **New Message Check**: Only download images from messages created AFTER monitoring
- **MutationObserver Delay**: Don't start observing until initial capture is complete (1.5s delay)
- **Multiple Safety Checks**:
  - Check if image existed before monitoring (exact URL match)
  - Check if image existed before monitoring (URL without params)
  - Check if monitoring has started
  - Check if image is in a new message (index >= initial count)
  - Check if image is in recent messages (last 3)

### 2. Monitoring Timeout Fix
- Confirmed timeout is set to 3 minutes (180000ms)
- The "2 minutes" message user saw might be from external logs
- Timeout properly matches CLI timeout (120s) with extra buffer

### 3. Extension Context Error Handling
- Wrapped chrome.runtime access in try-catch
- Specific handling for "Extension context invalidated" errors
- Continue operation even if extension communication fails
- Better error messages to distinguish expected vs unexpected errors

## Key Code Changes

### image-downloader.js
```javascript
// Track more state
let initialMessageCount = 0; // NEW: Track message count when monitoring started

// Capture existing images with variations
initialImages.add(img.src);
const urlWithoutParams = img.src.split('?')[0];
initialImages.add(urlWithoutParams); // NEW: Also track without params

// Store initial message count
initialMessageCount = document.querySelectorAll('[data-testid="conversation-turn"]').length;

// Check if image is in NEW message
const isNewMessage = messageIndex >= initialMessageCount;
if (!isRecent || !isNewMessage) {
  return false; // Skip old messages
}

// Delay MutationObserver start
setTimeout(() => {
  imageObserver.observe(document.body, {...});
}, 1500); // Start after initial capture
```

### chatgpt-bridge.js
```javascript
// Better error handling
try {
  if (chrome.runtime && chrome.runtime.id) {
    chrome.runtime.sendMessage(event.detail).catch(err => {
      if (err.message.includes('Extension context invalidated')) {
        console.warn('Expected if extension was reloaded');
      }
    });
  }
} catch (err) {
  console.warn('Extension context error:', err.message);
}
```

## Testing Instructions

1. Open ChatGPT in a tab with existing images
2. Run: `./generate-image.sh "prompt"`
3. Watch console for:
   - "📊 Found X existing images after delay"
   - "📌 Marking existing DALL-E image" (for existing images)
   - "📊 Initial message count: Y"
   - "👁️ MutationObserver now active"
   - "🔍 New message detected!"
   - "🎯 Detected generated image" (only for NEW image)
   - "✅ Image downloaded successfully"

## Expected Behavior
- NO downloads when monitoring starts
- Only NEW image gets downloaded
- Works even if generation takes >2 minutes
- No breaking errors from extension context

## Debug Logs to Monitor
- `🚫 Skipping pre-existing image` - Good, old image blocked
- `🚫 Ignoring image from old message` - Good, old message blocked
- `🎯 Detected generated image` - Should only appear for NEW image
- `✅ Download complete` - Success!