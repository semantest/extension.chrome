# URGENT Browser Tests Required - ChatGPT Extension v1.0.0

**CRITICAL**: Need someone with Chrome browser access to test these IMMEDIATELY!

## 🚨 PRIORITY 1: Privacy Compliance (BLOCKER)

### Telemetry Consent Popup Test
**Why Critical**: Chrome Web Store requires privacy consent for telemetry

**Steps**:
1. Install extension fresh (no prior data)
2. **EXPECTED**: Notification popup should appear asking for telemetry consent
3. **CHECK**: Can user click "Allow" or "Deny"?
4. **VERIFY**: Choice is saved and respected

**If NO popup appears**: CRITICAL PRIVACY VIOLATION - DO NOT SHIP!

---

## 🔴 PRIORITY 2: Core Functionality (5-minute test)

### Quick Smoke Test
1. **Load Extension**
   - Open `chrome://extensions`
   - Enable Developer Mode
   - Load unpacked from `extension.chrome/build/`
   - **CHECK**: Extension loads without errors?

2. **Test Feature 1: Project Creation**
   - Go to https://chatgpt.com
   - Wait 5 seconds for extension to initialize
   - Look for "New Project" button
   - Click and create project "Test Project 1"
   - **CHECK**: Project appears in sidebar?

3. **Test Feature 4: Send Prompt**
   - Type any message using extension
   - **CHECK**: Message sends successfully?

4. **Test Feature 5: Image Download**
   - Ask ChatGPT: "Create a simple smiley face"
   - Wait for image generation
   - Try to download using extension
   - **CHECK**: Image saves to Downloads folder?

---

## ⚠️ PRIORITY 3: Known Issues to Verify

### Telemetry Bugs (Already documented)
- Feature 1: Telemetry fires BEFORE operation completes
- Features 2-5: Missing telemetry completely
- **Not blockers** - Will fix in v1.0.1

### Performance Check
- **CHECK**: Extension uses <200MB memory?
- **CHECK**: Page loads in <5 seconds?

---

## 📋 Quick Test Report Template

**Tester Name**: _______________
**Chrome Version**: _______________
**Time**: _______________

**CRITICAL CHECKS**:
- [ ] Consent popup appears on first install
- [ ] Extension loads without errors
- [ ] At least 1 feature works (project/prompt/image)

**GO/NO-GO DECISION**:
- [ ] GO - Ship to Chrome Store
- [ ] NO-GO - Critical issue found: _______________

---

## 🚀 If All Pass = READY TO SHIP!

**Contact QA immediately with results!**

Time needed: 5-10 minutes maximum
Priority: URGENT - Blocking store submission

---

*Created by QA team for anyone with browser access*