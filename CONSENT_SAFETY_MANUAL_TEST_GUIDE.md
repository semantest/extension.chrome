# 🚨 Quick Manual Test Guide - 4 Safety Checks

**Time Required**: 15 minutes  
**Critical for**: Chrome Web Store Approval

---

## ⚡ Quick Test #1: Fresh Install (2 min)
```
1. Uninstall extension completely
2. Install v1.0.1
3. Open ChatGPT.com
✅ PASS: Consent popup appears within 3 seconds
❌ FAIL: No popup = CRITICAL BUG
```

---

## ⚡ Quick Test #2: Browser Restart (3 min)
```
1. Install extension (don't choose consent)
2. Quit Chrome completely
3. Restart Chrome
4. Open ChatGPT.com
✅ PASS: Consent popup reappears
❌ FAIL: No popup = Safety Check #2 failed
```

---

## ⚡ Quick Test #3: Tab Close Test (2 min)
```
1. Install extension
2. See popup, close tab immediately
3. Wait 35 seconds
4. Open new ChatGPT tab
✅ PASS: Popup appears again
❌ FAIL: No popup = Safety Check #3 failed
```

---

## ⚡ Quick Test #4: 30-Second Retry (3 min)
```
1. Install extension (no ChatGPT open)
2. Open DevTools > Service Worker console
3. Watch logs for 90 seconds
✅ PASS: See retry attempts every 30s
❌ FAIL: No retries = Safety Check #4 failed
```

---

## ⚡ Quick Test #5: User Choice (2 min)
```
1. Install extension
2. Click "Allow" on consent
3. Refresh ChatGPT
4. Check DevTools Network tab
✅ PASS: Telemetry requests sent
❌ FAIL: No telemetry = Not respecting choice

5. Reset and test "Deny":
✅ PASS: NO telemetry requests
❌ FAIL: Telemetry sent = PRIVACY VIOLATION
```

---

## 🔍 Debug Commands

### Check Consent State:
```javascript
// In service worker console:
chrome.storage.sync.get(['telemetryConsent', 'telemetryConsentPending'], console.log)
```

### Force Reset (Testing Only):
```javascript
// Clear consent to test again:
chrome.storage.sync.clear()
```

### Monitor Retry Loop:
```javascript
// Watch for retry attempts:
console.log('Monitoring consent retry...')
// Should see attempts every 30s for 5 min
```

---

## 📊 Test Results Template

```
Date: _______
Tester: _______
Version: v1.0.1
Chrome: _______

Safety Check Results:
[ ] #1 Install Handler - PASS/FAIL
[ ] #2 Startup Check - PASS/FAIL  
[ ] #3 Content Fallback - PASS/FAIL
[ ] #4 30s Retry - PASS/FAIL

Critical Issues Found:
_________________________

Ready for Store: YES / NO
```

---

## 🚨 IF ANY TEST FAILS:
1. DO NOT submit to Chrome Store
2. Report immediately to Engineer
3. Include console logs
4. Note exact failure point

**Remember**: Consent popup is MANDATORY for Chrome Web Store approval!