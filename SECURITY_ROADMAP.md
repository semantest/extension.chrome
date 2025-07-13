# Chrome Extension Security Roadmap

## Overview
The Chrome extension has the most critical security issues, particularly around permissions. This is the highest priority for Phase 9.

## Critical Security Issues

### 1. Permission Model (CRITICAL - Week 1-2)
**Current State**: `"host_permissions": ["<all_urls>"]`

**Target State**:
```json
"host_permissions": [
  "https://*.openai.com/*",
  "https://*.chatgpt.com/*",
  "https://*.google.com/*",
  "https://*.wikipedia.org/*"
],
"optional_host_permissions": ["https://*/*"]
```

### 2. Storage Encryption (HIGH - Week 3-4)
- Implement encrypted storage for all sensitive data
- Key management system required
- Migration strategy for existing users

### 3. Dynamic Code Execution (CRITICAL - Week 5-6)
- Remove `new Function()` from plugin-security.ts
- Implement Worker-based sandboxing
- Plugin signature verification

## Implementation Plan

### Phase 1: Emergency Permission Fix (Week 1)
1. Deploy update with reduced permissions
2. Implement permission request UI
3. Add migration for existing users

### Phase 2: Core Security (Weeks 2-6)
1. Storage encryption system
2. Remove dynamic code execution
3. Message validation framework

### Phase 3: Testing & Audit (Weeks 7-8)
1. Security testing suite
2. External security audit
3. Performance impact assessment

## Success Metrics
- Zero use of `<all_urls>` permission
- All storage encrypted
- No dynamic code execution
- Pass security audit

## References
- Main security plan: [../docs/SECURITY_REMEDIATION_PLAN.md](../docs/SECURITY_REMEDIATION_PLAN.md)
- Checklist: [../docs/SECURITY_CHECKLIST.md](../docs/SECURITY_CHECKLIST.md)

---
*Chrome Extension - Semantest Phase 9 Security*