# User Choice Persistence Test Plan - v1.0.1

**Version**: 1.0.1  
**Created**: July 21, 2025  
**Component**: Privacy Consent User Choice Persistence  
**Priority**: CRITICAL - Chrome Web Store Requirement

## 📋 Test Objectives

Ensure that user privacy consent choices are:
1. **Persisted** correctly across all storage mechanisms
2. **Respected** throughout the extension lifecycle
3. **Synchronized** across devices when using Chrome sync
4. **Migrated** properly during version upgrades
5. **Recoverable** in case of storage corruption

---

## 🗄️ Storage Architecture Testing

### 1. Local Storage Persistence

```javascript
// Test Case: LC-001 - Basic Local Storage Save
describe('Local Storage - User Choice Save', () => {
  test('Saves consent=true to local storage', async () => {
    await consentManager.saveUserChoice(true);
    
    const stored = await chrome.storage.local.get('privacy.telemetryConsent');
    expect(stored['privacy.telemetryConsent']).toBe(true);
  });
  
  test('Saves consent=false to local storage', async () => {
    await consentManager.saveUserChoice(false);
    
    const stored = await chrome.storage.local.get('privacy.telemetryConsent');
    expect(stored['privacy.telemetryConsent']).toBe(false);
  });
  
  test('Saves timestamp with consent', async () => {
    const before = Date.now();
    await consentManager.saveUserChoice(true);
    const after = Date.now();
    
    const stored = await chrome.storage.local.get('privacy.consentTimestamp');
    const timestamp = stored['privacy.consentTimestamp'];
    
    expect(timestamp).toBeGreaterThanOrEqual(before);
    expect(timestamp).toBeLessThanOrEqual(after);
  });
});
```

### 2. Sync Storage Backup

```javascript
// Test Case: SC-001 - Sync Storage Backup
describe('Sync Storage - Backup Mechanism', () => {
  test('Mirrors consent to sync storage', async () => {
    await consentManager.saveUserChoice(true);
    
    // Wait for sync
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const syncStored = await chrome.storage.sync.get('privacy.telemetryConsent');
    expect(syncStored['privacy.telemetryConsent']).toBe(true);
  });
  
  test('Sync storage used when local fails', async () => {
    // Simulate local storage failure
    jest.spyOn(chrome.storage.local, 'set').mockRejectedValue(new Error('Quota exceeded'));
    
    const result = await consentManager.saveUserChoice(true);
    
    expect(result.success).toBe(true);
    expect(result.storage).toBe('sync');
    
    const syncStored = await chrome.storage.sync.get('privacy.telemetryConsent');
    expect(syncStored['privacy.telemetryConsent']).toBe(true);
  });
});
```

### 3. IndexedDB Fallback

```javascript
// Test Case: DB-001 - IndexedDB Fallback
describe('IndexedDB - Ultimate Fallback', () => {
  test('Uses IndexedDB when both Chrome storages fail', async () => {
    // Mock both storage failures
    jest.spyOn(chrome.storage.local, 'set').mockRejectedValue(new Error('Local failed'));
    jest.spyOn(chrome.storage.sync, 'set').mockRejectedValue(new Error('Sync failed'));
    
    const result = await consentManager.saveUserChoice(false);
    
    expect(result.success).toBe(true);
    expect(result.storage).toBe('indexeddb');
    
    // Verify in IndexedDB
    const db = await openDB('semantest-privacy');
    const consent = await db.get('consent', 'telemetry');
    expect(consent.value).toBe(false);
  });
});
```

---

## 🔄 Lifecycle Persistence Testing

### 1. Browser Restart Persistence

```javascript
// Test Case: BR-001 - Browser Restart
describe('Browser Restart - Choice Persistence', () => {
  test('Choice survives browser restart', async () => {
    // Set consent
    await consentManager.saveUserChoice(true);
    
    // Simulate browser restart
    await simulateBrowserRestart();
    
    // Verify consent still exists
    const consent = await consentManager.getUserChoice();
    expect(consent).toBe(true);
  });
  
  test('Timestamp preserved across restart', async () => {
    const originalTimestamp = Date.now();
    await chrome.storage.local.set({
      'privacy.telemetryConsent': false,
      'privacy.consentTimestamp': originalTimestamp
    });
    
    await simulateBrowserRestart();
    
    const stored = await chrome.storage.local.get('privacy.consentTimestamp');
    expect(stored['privacy.consentTimestamp']).toBe(originalTimestamp);
  });
});
```

### 2. Extension Update Persistence

```javascript
// Test Case: EU-001 - Extension Update
describe('Extension Update - Choice Migration', () => {
  test('v1.0.0 to v1.0.1 preserves consent', async () => {
    // Simulate v1.0.0 data structure
    await chrome.storage.local.set({
      'telemetryEnabled': true, // Old key name
      'version': '1.0.0'
    });
    
    // Update to v1.0.1
    await extensionUpdater.update('1.0.1');
    
    // Verify migration
    const newConsent = await chrome.storage.local.get('privacy.telemetryConsent');
    expect(newConsent['privacy.telemetryConsent']).toBe(true);
    
    // Old key should be removed
    const oldKey = await chrome.storage.local.get('telemetryEnabled');
    expect(oldKey.telemetryEnabled).toBeUndefined();
  });
});
```

### 3. Profile Sync Persistence

```javascript
// Test Case: PS-001 - Profile Sync
describe('Chrome Profile Sync - Multi-Device', () => {
  test('Consent syncs to new device', async () => {
    // Device 1: Set consent
    await consentManager.saveUserChoice(true);
    
    // Simulate sync to Device 2
    await simulateDeviceSync('device2');
    
    // Device 2: Check consent
    const device2Consent = await consentManager.getUserChoice();
    expect(device2Consent).toBe(true);
  });
  
  test('Newer timestamp wins in sync conflict', async () => {
    // Device 1: Set consent at time T1
    await chrome.storage.sync.set({
      'privacy.telemetryConsent': true,
      'privacy.consentTimestamp': 1000
    });
    
    // Device 2: Set different consent at time T2
    await chrome.storage.sync.set({
      'privacy.telemetryConsent': false,
      'privacy.consentTimestamp': 2000
    });
    
    // Resolve conflict
    await consentManager.resolveConflicts();
    
    // Newer choice (false) should win
    const resolved = await consentManager.getUserChoice();
    expect(resolved).toBe(false);
  });
});
```

---

## 🛡️ Data Integrity Testing

### 1. Corruption Recovery

```javascript
// Test Case: CR-001 - Corruption Recovery
describe('Storage Corruption - Recovery', () => {
  test('Detects corrupted consent data', async () => {
    // Corrupt the data
    await chrome.storage.local.set({
      'privacy.telemetryConsent': 'not-a-boolean',
      'privacy.consentTimestamp': 'invalid-timestamp'
    });
    
    const isValid = await consentManager.validateStoredConsent();
    expect(isValid).toBe(false);
  });
  
  test('Re-prompts user on corrupted data', async () => {
    // Set corrupted data
    await chrome.storage.local.set({
      'privacy.telemetryConsent': null
    });
    
    // Check if re-prompt needed
    const needsPrompt = await consentManager.needsConsentPrompt();
    expect(needsPrompt).toBe(true);
  });
  
  test('Recovers from sync storage if local corrupted', async () => {
    // Local: corrupted
    await chrome.storage.local.set({
      'privacy.telemetryConsent': 'corrupted'
    });
    
    // Sync: valid
    await chrome.storage.sync.set({
      'privacy.telemetryConsent': true,
      'privacy.consentTimestamp': Date.now()
    });
    
    // Attempt recovery
    const recovered = await consentManager.recoverConsent();
    expect(recovered).toBe(true);
    
    // Local should be fixed
    const local = await chrome.storage.local.get('privacy.telemetryConsent');
    expect(local['privacy.telemetryConsent']).toBe(true);
  });
});
```

### 2. Race Condition Prevention

```javascript
// Test Case: RC-001 - Race Conditions
describe('Concurrent Access - Race Prevention', () => {
  test('Handles concurrent consent saves', async () => {
    // Simulate concurrent saves
    const promises = [
      consentManager.saveUserChoice(true),
      consentManager.saveUserChoice(false),
      consentManager.saveUserChoice(true)
    ];
    
    const results = await Promise.all(promises);
    
    // All should succeed
    expect(results.every(r => r.success)).toBe(true);
    
    // Last write should win
    const final = await consentManager.getUserChoice();
    expect([true, false]).toContain(final); // Either is valid
  });
  
  test('Prevents double consent prompts', async () => {
    let promptCount = 0;
    consentManager.on('prompt', () => promptCount++);
    
    // Simulate multiple simultaneous checks
    const checks = Array(5).fill(null).map(() => 
      consentManager.checkAndPromptIfNeeded()
    );
    
    await Promise.all(checks);
    
    // Should only prompt once
    expect(promptCount).toBe(1);
  });
});
```

---

## 🔍 Edge Case Testing

### 1. Storage Quota Handling

```javascript
// Test Case: SQ-001 - Storage Quota
describe('Storage Quota - Edge Cases', () => {
  test('Handles storage quota exceeded gracefully', async () => {
    // Fill storage near quota
    const largeData = new Array(4.5 * 1024 * 1024).join('x');
    await chrome.storage.local.set({ 'large': largeData });
    
    // Try to save consent
    const result = await consentManager.saveUserChoice(true);
    
    // Should succeed via fallback
    expect(result.success).toBe(true);
    expect(result.storage).not.toBe('local');
  });
});
```

### 2. Clock Skew Handling

```javascript
// Test Case: CS-001 - Clock Skew
describe('Clock Skew - Timestamp Validation', () => {
  test('Handles future timestamps', async () => {
    // Set consent with future timestamp
    const futureTime = Date.now() + (24 * 60 * 60 * 1000); // 1 day ahead
    await chrome.storage.local.set({
      'privacy.telemetryConsent': true,
      'privacy.consentTimestamp': futureTime
    });
    
    // Should still be valid
    const isValid = await consentManager.validateStoredConsent();
    expect(isValid).toBe(true);
  });
  
  test('Handles very old timestamps', async () => {
    // Set consent from 2020
    await chrome.storage.local.set({
      'privacy.telemetryConsent': false,
      'privacy.consentTimestamp': 1577836800000 // Jan 1, 2020
    });
    
    // Should prompt for re-confirmation after 1 year
    const needsReconfirm = await consentManager.needsReconfirmation();
    expect(needsReconfirm).toBe(true);
  });
});
```

---

## 📊 Persistence Verification Matrix

### Storage Locations

| Storage Type | Primary Use | Fallback Priority | Sync Capable |
|--------------|-------------|-------------------|--------------|
| chrome.storage.local | Primary storage | 1st | No |
| chrome.storage.sync | Backup & sync | 2nd | Yes |
| IndexedDB | Ultimate fallback | 3rd | No |
| Session Storage | Temporary cache | N/A | No |

### Persistence Scenarios

| Scenario | Local | Sync | IndexedDB | Expected Behavior |
|----------|-------|------|-----------|-------------------|
| Normal Save | ✅ | ✅ | ❌ | Both local and sync updated |
| Local Full | ❌ | ✅ | ❌ | Falls back to sync only |
| Both Full | ❌ | ❌ | ✅ | Falls back to IndexedDB |
| Corrupted Local | 🔴 | ✅ | ❌ | Recovers from sync |
| All Corrupted | 🔴 | 🔴 | 🔴 | Re-prompts user |

---

## 🧪 Test Execution Plan

### Phase 1: Unit Tests (Automated)
1. Storage mechanism tests
2. Data validation tests
3. Migration logic tests
4. Conflict resolution tests

### Phase 2: Integration Tests (Automated)
1. Multi-storage coordination
2. Browser lifecycle events
3. Extension update scenarios
4. Sync conflict resolution

### Phase 3: Manual Verification
1. Real browser restart
2. Chrome profile sync
3. Extension update from store
4. Storage quota scenarios

### Phase 4: Stress Testing
1. Rapid consent changes
2. Concurrent access patterns
3. Storage failure simulation
4. Network disconnection during sync

---

## ✅ Success Criteria

### Mandatory (Chrome Web Store)
- [ ] Consent choice persists across browser restarts
- [ ] Choice respected immediately after save
- [ ] No telemetry sent if consent=false
- [ ] Recovery from corrupted storage

### Quality Standards
- [ ] Save operation completes in <100ms
- [ ] Zero data loss across all scenarios
- [ ] Automatic corruption recovery
- [ ] Clear user communication on failures

### Performance Targets
- Storage save: <50ms
- Storage read: <10ms
- Validation: <5ms
- Migration: <500ms

---

## 🚨 Critical Test Cases

### P0 - Must Pass
1. **Basic Save/Load**: Consent saved and retrieved correctly
2. **Restart Persistence**: Survives browser restart
3. **Respect Choice**: Telemetry blocked when consent=false
4. **Corruption Recovery**: Handles corrupted data gracefully

### P1 - Should Pass
1. **Sync Functionality**: Multi-device synchronization
2. **Migration Path**: v1.0.0 → v1.0.1 upgrade
3. **Fallback Chain**: Storage fallback mechanisms
4. **Race Prevention**: No duplicate prompts

### P2 - Nice to Have
1. **Performance**: Sub-50ms save times
2. **Conflict Resolution**: Newer timestamp wins
3. **Quota Handling**: Graceful degradation
4. **Re-confirmation**: Annual consent refresh

---

*This test plan ensures robust persistence of user privacy choices across all scenarios, meeting Chrome Web Store requirements and providing excellent user experience.*