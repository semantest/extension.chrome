# Telemetry Consent Popup Testing Guide for v1.0.1

## Overview
This guide provides manual testing steps to verify the telemetry consent popup functionality in the ChatGPT Chrome Extension v1.0.1.

## Test Environment Setup

### Prerequisites
1. Chrome browser (latest version)
2. Extension loaded in Developer Mode
3. Clear Chrome storage for fresh install testing

### Loading the Extension
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (top right)
3. Click "Load unpacked"
4. Select the `extension.chrome` directory
5. Note the extension ID for later reference

## Test Cases

### Test Case 1: First Install Consent Popup
**Objective**: Verify consent popup appears on first extension install

**Steps**:
1. Clear all extension data:
   - Open Chrome DevTools on any page
   - Go to Application → Storage
   - Click "Clear site data"
2. Remove and reload the extension:
   - Go to `chrome://extensions/`
   - Remove the ChatGPT extension
   - Load unpacked again
3. Wait 3 seconds after installation
4. **Expected Result**: Chrome notification appears with telemetry consent request

**Verification**:
- [ ] Notification appears within 3-5 seconds
- [ ] Title: "Welcome to ChatGPT Extension!"
- [ ] Message: "Help us improve by allowing anonymous error reports?"
- [ ] Two buttons: "No Thanks" and "Allow"

### Test Case 2: Consent Choice Persistence
**Objective**: Verify user choice is saved correctly

**Steps**:
1. Click "Allow" on the consent notification
2. Check storage:
   - Open extension popup
   - Right-click → Inspect
   - Console: `chrome.storage.sync.get(['telemetryConsent'], console.log)`
3. **Expected Result**: `{telemetryConsent: true}`

**Alternative Test**:
1. Click "No Thanks" on the consent notification  
2. Check storage as above
3. **Expected Result**: `{telemetryConsent: false}`

### Test Case 3: Fallback Modal (Chrome Notification Failure)
**Objective**: Verify content script modal appears if Chrome notifications fail

**Steps**:
1. Disable Chrome notifications:
   - Chrome Settings → Privacy and security → Site Settings
   - Notifications → Don't allow sites to send notifications
2. Clear extension data and reload
3. Navigate to https://chat.openai.com/
4. Wait 3-5 seconds
5. **Expected Result**: In-page modal appears with consent request

**Verification**:
- [ ] Modal overlay covers the page
- [ ] Modal contains same consent information
- [ ] Clicking outside or ESC closes modal (counts as decline)
- [ ] Buttons work correctly

### Test Case 4: Manual Consent Trigger
**Objective**: Test manual consent popup trigger

**Steps**:
1. Open extension background page:
   - `chrome://extensions/`
   - Click "service worker" link
2. In console, run:
   ```javascript
   chrome.runtime.sendMessage({
     action: 'SHOW_TELEMETRY_CONSENT',
     data: {
       title: 'Manual Test',
       message: 'Testing manual trigger'
     }
   });
   ```
3. **Expected Result**: Consent notification appears immediately

### Test Case 5: Test Harness Validation
**Objective**: Run automated test suite

**Steps**:
1. Open extension background page console
2. Load test harness:
   ```javascript
   const script = document.createElement('script');
   script.src = chrome.runtime.getURL('tests/consent-popup-test.js');
   document.head.appendChild(script);
   ```
3. Run tests:
   ```javascript
   setTimeout(() => {
     window.consentTester.runAllTests();
   }, 1000);
   ```
4. **Expected Result**: All 6 tests pass

### Test Case 6: No Duplicate Popups
**Objective**: Ensure consent popup doesn't appear if already set

**Steps**:
1. Set consent manually:
   ```javascript
   chrome.storage.sync.set({telemetryConsent: true});
   ```
2. Reload extension
3. Wait 10 seconds
4. **Expected Result**: No consent popup appears

## Known Issues & Workarounds

### Issue: Chrome Notifications Disabled
**Symptom**: No notification appears on first install
**Workaround**: Extension will attempt content script modal on ChatGPT tabs

### Issue: Test Harness Chrome API Access
**Symptom**: Test harness shows API errors
**Workaround**: Run tests from extension background page context only

## Debugging Tips

### Check Current Consent Status
```javascript
chrome.storage.sync.get(['telemetryConsent'], (result) => {
  console.log('Current consent:', result.telemetryConsent);
});
```

### Force Clear Consent
```javascript
chrome.storage.sync.remove(['telemetryConsent'], () => {
  console.log('Consent cleared');
});
```

### Monitor Notification Events
```javascript
chrome.notifications.onCreated.addListener((id) => {
  console.log('Notification created:', id);
});

chrome.notifications.onButtonClicked.addListener((id, buttonIndex) => {
  console.log('Button clicked:', id, buttonIndex);
});
```

## Acceptance Criteria

- [ ] Consent popup appears on first install (within 3-5 seconds)
- [ ] User choices are correctly saved to storage
- [ ] Fallback modal works when notifications fail
- [ ] No duplicate popups after consent is set
- [ ] Both "Allow" and "No Thanks" options work correctly
- [ ] Test harness reports 80%+ pass rate

## Notes for QA Team

1. **Privacy Focus**: Emphasize that telemetry is anonymous and opt-in
2. **User Experience**: Consent should be non-intrusive and easy to understand
3. **Persistence**: Once set, consent choice should persist across sessions
4. **Error Handling**: If consent fails, extension should still work normally

---

Last Updated: v1.0.1 Consent Popup Fix