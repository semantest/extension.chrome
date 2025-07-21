# Comprehensive Test Plan - Consent Popup 4 Safety Checks

**Component**: service-worker.js Safety Check System  
**Priority**: CRITICAL - Chrome Web Store Compliance  
**Version**: v1.0.1 with Enhanced Safety Checks

---

## 🛡️ Safety Check Overview

### Safety Check #1: Install/Update Handler
- Triggers on fresh install
- Triggers on update from pre-consent versions
- Sets `telemetryConsentPending: true`

### Safety Check #2: Extension Startup
- Runs on `chrome.runtime.onStartup`
- Checks for pending consent from previous session
- Restarts consent process if needed

### Safety Check #3: Content Script Fallback
- Attempts modal in ChatGPT tabs
- Fallback when notification fails
- Direct message to content script

### Safety Check #4: 30-Second Retry Loop
- `ensureConsentShown()` function
- Retries every 30 seconds for 5 minutes
- Clears after consent decision

---

## 🧪 Test Scenarios

### 1. Fresh Install Flow

#### Test Case FI-001: Clean Install
```
Steps:
1. Uninstall any existing extension
2. Clear all Chrome storage
3. Install v1.0.1 extension
4. DO NOT open ChatGPT yet

Expected:
- Extension badge shows
- Storage has telemetryConsentPending: true
- No consent shown yet (no ChatGPT tab)

5. Open ChatGPT.com
6. Wait 3 seconds

Expected:
- Consent modal appears
- Safety Check #3 triggered
```

#### Test Case FI-002: Install with ChatGPT Open
```
Steps:
1. Open ChatGPT.com first
2. Install extension while on ChatGPT

Expected:
- Consent modal appears immediately
- telemetryConsentPending set to true
- Modal shows within 3 seconds
```

#### Test Case FI-003: Install with Multiple ChatGPT Tabs
```
Steps:
1. Open 3 ChatGPT tabs
2. Install extension

Expected:
- Consent modal appears on active tab
- Other tabs don't show duplicate modals
- Single consent decision applies to all
```

---

### 2. Extension Restart Scenarios

#### Test Case ER-001: Browser Restart with Pending Consent
```
Steps:
1. Install extension
2. Close browser BEFORE making consent choice
3. Restart Chrome
4. Check extension logs

Expected:
- onStartup event fires
- Safety Check #2 detects telemetryConsentPending: true
- ensureConsentShown() starts
- 30-second retry begins
```

#### Test Case ER-002: Chrome Crash Recovery
```
Steps:
1. Install extension
2. Force quit Chrome (simulate crash)
3. Restart Chrome
4. Open ChatGPT

Expected:
- Consent modal appears
- Previous pending state preserved
- Safety Check #2 + #4 working
```

#### Test Case ER-003: Extension Disable/Enable
```
Steps:
1. Install extension (consent pending)
2. Disable extension in chrome://extensions
3. Re-enable extension
4. Open ChatGPT

Expected:
- Consent state preserved
- Modal shows on ChatGPT visit
- No data loss
```

---

### 3. Tab Closed/Reopened Scenarios

#### Test Case TC-001: Close Tab Before Consent
```
Steps:
1. Install extension
2. Open ChatGPT (modal appears)
3. Close tab WITHOUT choosing
4. Wait 35 seconds
5. Check background logs

Expected:
- Safety Check #4 retry at 30 seconds
- Attempts to find ChatGPT tabs
- telemetryConsentPending still true
```

#### Test Case TC-002: Close All Tabs Test
```
Steps:
1. Install extension
2. Close ALL tabs
3. Wait 2 minutes
4. Open new ChatGPT tab

Expected:
- Consent modal appears
- Safety Check #4 kept trying
- Modal shows on new tab
```

#### Test Case TC-003: Navigate Away Test
```
Steps:
1. Install extension on ChatGPT
2. Modal appears
3. Navigate to different site
4. Return to ChatGPT after 1 minute

Expected:
- Modal reappears
- Consent still pending
- Safety Check #4 working
```

---

### 4. 30-Second Retry Interval Tests

#### Test Case RI-001: Basic Retry Mechanism
```
Steps:
1. Install extension
2. Block notifications in Chrome settings
3. Monitor console logs

Expected Timeline:
- 0:00 - Install, notification fails
- 0:30 - First retry (Safety Check #4)
- 1:00 - Second retry
- 1:30 - Third retry
- ...continues for 5 minutes
- 5:00 - Retry stops
```

#### Test Case RI-002: Retry with Tab Opening
```
Steps:
1. Install extension (no ChatGPT open)
2. Wait 45 seconds
3. Open ChatGPT during retry interval

Expected:
- Retry detects new tab
- Sends message to show modal
- Retry loop stops on success
- telemetryConsentPending set to false
```

#### Test Case RI-003: Retry Interruption
```
Steps:
1. Install extension
2. Let retry run for 1 minute
3. User makes consent choice
4. Monitor logs

Expected:
- Retry immediately stops
- clearInterval called
- No more retry attempts
```

---

## 🔍 Edge Cases

### Edge Case EC-001: Rapid Install/Uninstall
```
Steps:
1. Install extension
2. Immediately uninstall (within 5 seconds)
3. Reinstall

Expected:
- Fresh consent flow starts
- No corrupted state
- Safety checks reset properly
```

### Edge Case EC-002: Storage Quota Exceeded
```
Steps:
1. Fill Chrome storage to 99%
2. Install extension
3. Attempt consent flow

Expected:
- Graceful degradation
- Consent still shows
- Falls back to sync storage if needed
```

### Edge Case EC-003: Multiple Browser Profiles
```
Steps:
1. Install in Profile 1
2. Make consent choice
3. Install in Profile 2

Expected:
- Independent consent per profile
- No cross-profile data leak
- Each profile tracks separately
```

### Edge Case EC-004: Incognito Mode
```
Steps:
1. Install extension
2. Allow in incognito
3. Open ChatGPT in incognito

Expected:
- Consent modal appears
- Choice persists in incognito
- No tracking if denied
```

---

## 📊 Performance Tests

### Performance Test PT-001: CPU Impact
```
Measure:
- CPU usage during 5-minute retry period
- Memory consumption
- Background worker efficiency

Expected:
- <1% CPU usage
- <10MB additional memory
- No performance degradation
```

### Performance Test PT-002: Battery Impact
```
Test on laptop:
1. Install extension
2. Let retry run for full 5 minutes
3. Measure battery drain

Expected:
- Negligible battery impact
- Efficient timer implementation
- Clears properly after 5 minutes
```

---

## 🛠️ Debug Verification

### Debug Test DT-001: Console Logging
```
Enable verbose logging:
1. Open chrome://extensions
2. Open service worker inspector
3. Install extension
4. Monitor all safety check logs

Expected Logs:
- "handleFirstInstall()" called
- "telemetryConsentPending: true"
- "ensureConsentShown() started"
- Retry attempts logged every 30s
- "Consent handled, stopping checks"
```

### Debug Test DT-002: Storage State Tracking
```
Monitor chrome.storage.sync:
1. Install extension
2. Check storage after each step
3. Verify state transitions

Expected States:
- Initial: {telemetryConsentPending: true}
- After consent: {telemetryConsent: true/false, telemetryConsentPending: false}
- After restart: State preserved
```

---

## ✅ Test Execution Checklist

### Phase 1: Basic Safety Checks (30 min)
- [ ] Fresh install scenarios (FI-001 to FI-003)
- [ ] Verify all 4 safety checks trigger
- [ ] Confirm modal appears correctly

### Phase 2: Reliability Tests (45 min)
- [ ] Extension restart tests (ER-001 to ER-003)
- [ ] Tab management tests (TC-001 to TC-003)
- [ ] Retry interval tests (RI-001 to RI-003)

### Phase 3: Edge Cases (30 min)
- [ ] Storage edge cases
- [ ] Profile isolation
- [ ] Incognito behavior
- [ ] Performance impact

### Phase 4: Stress Testing (20 min)
- [ ] 5-minute retry duration
- [ ] Rapid state changes
- [ ] Multiple simultaneous triggers

---

## 🎯 Success Criteria

### Must Pass (Chrome Web Store Requirements)
1. ✅ Consent ALWAYS shown on fresh install
2. ✅ Consent persists across restarts
3. ✅ User choice respected immediately
4. ✅ No infinite loops or memory leaks
5. ✅ Graceful handling of all edge cases

### Quality Metrics
- 100% consent visibility rate
- 0% data collection without consent
- <1% CPU usage during retry
- 0 console errors
- All 4 safety checks functional

---

## 🚨 Failure Scenarios

### Critical Failures (Block Release)
1. ❌ Consent not shown on fresh install
2. ❌ Telemetry sent without consent
3. ❌ Retry loop doesn't stop after 5 minutes
4. ❌ High CPU/memory usage

### Major Issues (Fix Required)
1. ⚠️ Consent shown multiple times
2. ⚠️ Storage state corruption
3. ⚠️ Console errors during retry

### Minor Issues (Document)
1. ℹ️ Slight delay in modal appearance
2. ℹ️ Cosmetic UI issues
3. ℹ️ Non-critical console warnings

---

## 📝 Test Reporting Template

```markdown
Test Case: [ID]
Date: [Date]
Tester: [Name]
Chrome Version: [Version]

Steps Executed:
1. [Step 1]
2. [Step 2]
...

Expected Result: [What should happen]
Actual Result: [What actually happened]
Status: [PASS/FAIL]

Evidence:
- Screenshot: [Link]
- Console Log: [Link]
- Storage State: [JSON]

Notes: [Any additional observations]
```

---

*This comprehensive test plan ensures all 4 safety checks work reliably to guarantee consent popup visibility and Chrome Web Store compliance.*