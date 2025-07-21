# Known Issues - Beta Release

**Extension**: Semantest ChatGPT Browser Extension  
**Version**: 2.0.0-beta  
**Release Type**: BETA - Testing Only  
**Last Updated**: July 21, 2025  

⚠️ **WARNING**: This is a BETA release with known security vulnerabilities. Use at your own risk in controlled environments only.

---

## 🚨 CRITICAL SECURITY ISSUES

### 1. Missing Content Security Policy (CSP)
**Severity**: CRITICAL  
**Impact**: Extension vulnerable to XSS attacks and code injection

**Issue Details**:
- Extension pages have no protection against inline script injection
- External scripts can be loaded without restriction
- Eval() and other dangerous functions not blocked

**Workaround for Beta Testing**:
```javascript
// TEMPORARY: Add to popup.html and other extension pages
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline';">
```

**Permanent Fix Required**: Add proper CSP to manifest.json

### 2. XSS Vulnerabilities in DOM Manipulation
**Severity**: CRITICAL  
**Count**: 45+ instances  
**Impact**: User data can be stolen or malicious code executed

**Vulnerable Code Example**:
```javascript
// VULNERABLE - content_script.js
element.innerHTML = userInput; // ❌ XSS vulnerability
```

**Beta Workaround**:
```javascript
// SAFER approach for beta testing
function safeSetContent(element, content) {
  // Basic sanitization - NOT PRODUCTION READY
  const cleaned = content.replace(/<script/gi, '&lt;script')
                        .replace(/<iframe/gi, '&lt;iframe')
                        .replace(/javascript:/gi, '');
  element.innerHTML = cleaned;
}
```

**Permanent Fix Required**: Use DOMPurify or textContent

### 3. Overly Broad Host Permissions
**Severity**: HIGH  
**Impact**: Extension can access ALL websites, privacy concern

**Current Permission**:
```json
"host_permissions": ["<all_urls>"]
```

**Beta Workaround**:
- Manually enable extension only on ChatGPT tabs
- Users should disable extension when not using ChatGPT
- Right-click extension icon → "This can read and change site data" → "When you click the extension"

**Permanent Fix Required**: Restrict to ChatGPT domains only

### 4. Unencrypted Data Storage
**Severity**: MEDIUM  
**Impact**: Sensitive user data stored in plain text

**Beta Workaround**:
```javascript
// Simple obfuscation for beta - NOT SECURE
function obfuscate(text) {
  return btoa(encodeURIComponent(text)); // Base64 encoding
}

function deobfuscate(text) {
  return decodeURIComponent(atob(text));
}

// Use when storing sensitive data
chrome.storage.local.set({
  customInstructions: obfuscate(userInstructions)
});
```

**Permanent Fix Required**: Implement proper encryption (AES-256)

---

## 🛠️ BUILD & DEPLOYMENT ISSUES

### 5. Jest Test Runner Configuration Error
**Severity**: HIGH  
**Impact**: Cannot run automated tests

**Error Message**:
```
● Validation Error: Jest configuration invalid
```

**Beta Workaround**:
```bash
# Skip tests for beta deployment
npm run build --skip-tests

# Or manually build
tsc && cp manifest.json build/ && cp -r assets build/
```

**Manual Testing Required**: Test all 6 features manually

### 6. No Production Build Pipeline
**Severity**: HIGH  
**Impact**: No minification, large extension size

**Beta Workaround**:
```bash
# Manual beta packaging
cd extension.chrome
mkdir -p dist
cp -r build/* dist/
cp manifest.json dist/
cp -r assets dist/
cd dist && zip -r ../semantest-beta.zip .
```

**File Size Warning**: Beta extension will be larger than optimal

### 7. Missing Chrome Web Store Assets
**Severity**: MEDIUM  
**Impact**: Cannot publish to Chrome Web Store

**Beta Distribution Workaround**:
1. Share .zip file directly with beta testers
2. Install via Developer Mode:
   - Chrome → Extensions → Developer mode ON
   - "Load unpacked" → Select extension directory
   - Or drag .zip file to extensions page

**Beta Installation Guide**: Include installation instructions with beta release

---

## 🐛 FUNCTIONAL ISSUES

### 8. Polling-Based Status Updates
**Severity**: MEDIUM  
**Impact**: Performance degradation, battery drain

**Current Issue**: Status updates every 2 seconds
```javascript
// Current inefficient polling
setInterval(() => {
  this.requestStatusFromBackground();
}, 2000);
```

**Beta Workaround**: Increase polling interval
```javascript
// Temporary fix - reduce polling frequency
setInterval(() => {
  this.requestStatusFromBackground();
}, 5000); // 5 seconds instead of 2
```

### 9. Memory Leaks in Promise Handling
**Severity**: MEDIUM  
**Impact**: Extension slows down over time

**Beta Workaround**: Restart extension periodically
- Disable and re-enable extension every few hours
- Or reload extension from chrome://extensions

### 10. Race Conditions on Page Load
**Severity**: LOW  
**Impact**: Features may not work on first ChatGPT page load

**Beta Workaround**: 
- Refresh ChatGPT page if features don't work
- Wait 2-3 seconds after page load before using features
- Click extension icon to manually initialize

### 11. No Error Recovery for Failed Operations
**Severity**: LOW  
**Impact**: Operations fail silently without retry

**Beta Workaround**: 
- Manually retry failed operations
- Check browser console for error messages
- Refresh page and try again

---

## 🎯 FEATURE-SPECIFIC ISSUES

### Feature 1: Create Project
**Known Issues**:
- May fail if ChatGPT UI changes
- No validation for duplicate project names

**Workaround**: Check if project already exists before creating

### Feature 2: Custom Instructions
**Known Issues**:
- Settings menu navigation may fail on some accounts
- Instructions stored unencrypted (see Issue #4)

**Workaround**: Navigate to settings manually first, then use feature

### Feature 3: Create New Chat
**Known Issues**:
- May not clear previous chat context completely

**Workaround**: Refresh page after creating new chat

### Feature 4: Send Prompts
**Known Issues**:
- Large prompts (>4000 chars) may fail
- Special characters may cause issues

**Workaround**: Split large prompts, avoid special characters

### Feature 5: Image Generation
**Known Issues**:
- DALL-E model detection unreliable
- Generation timeout hardcoded to 30 seconds

**Workaround**: Manually select GPT-4 model, wait longer for images

### Feature 6: Download Images
**Known Issues**:
- Downloads may fail with blob: URLs
- Filename generation may create duplicates

**Workaround**: Right-click → Save Image As for failed downloads

---

## 🔧 BETA TESTING GUIDELINES

### Safe Testing Environment
1. **Use dedicated browser profile** for beta testing
2. **Don't use on production ChatGPT accounts**
3. **Test with non-sensitive data only**
4. **Monitor browser console** for errors
5. **Keep extension disabled** when not testing

### Manual Security Precautions
```javascript
// Add to console for security monitoring
window.monitorXSS = setInterval(() => {
  const scripts = document.querySelectorAll('script');
  console.log(`Script tags found: ${scripts.length}`);
}, 5000);
```

### Performance Monitoring
```javascript
// Check memory usage
if (performance.memory) {
  console.log('Memory usage:', {
    used: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
    total: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB'
  });
}
```

---

## 📝 BETA FEEDBACK COLLECTION

### What to Report
1. **Security Issues**: Any unexpected behavior or access
2. **Feature Failures**: Which features don't work
3. **Performance Issues**: Slowdowns or high resource usage
4. **UI Problems**: Elements not found or interactions failing
5. **ChatGPT Updates**: UI changes breaking features

### How to Report
Include in bug reports:
- Browser version
- ChatGPT URL
- Console errors (F12 → Console)
- Steps to reproduce
- Screenshots if applicable

### Debug Information Collection
```javascript
// Run in console for debug info
console.log({
  extension: chrome.runtime.getManifest().version,
  browser: navigator.userAgent,
  chatGPT: document.title,
  features: {
    projectButton: !!document.querySelector('[aria-label*="project"]'),
    chatInput: !!document.querySelector('#prompt-textarea'),
    customInstructions: !!document.querySelector('[aria-label*="Profile"]')
  }
});
```

---

## ⚠️ LEGAL DISCLAIMER

**BETA SOFTWARE NOTICE**: This extension is provided "AS IS" without warranty of any kind. Beta software contains known issues and security vulnerabilities. Users assume all risks associated with using beta software.

**NOT FOR PRODUCTION USE**: This beta release is for testing purposes only. Do not use with sensitive data or in production environments.

**SECURITY WARNING**: Known security vulnerabilities exist. Use only in controlled environments with test data.

---

## 🚀 ROADMAP TO STABLE RELEASE

### Phase 1: Security Fixes (Weeks 1-2)
- [ ] Implement Content Security Policy
- [ ] Fix all XSS vulnerabilities
- [ ] Restrict permissions to ChatGPT only
- [ ] Implement data encryption

### Phase 2: Build System (Week 3)
- [ ] Fix Jest configuration
- [ ] Create production build pipeline
- [ ] Implement automated testing
- [ ] Add code minification

### Phase 3: Chrome Web Store (Week 4)
- [ ] Create store assets
- [ ] Write privacy policy
- [ ] Prepare store listing
- [ ] Submit for review

### Target Stable Release: 4-6 weeks after beta feedback

---

## 📞 BETA SUPPORT

**Known Issues**: This document  
**Bug Reports**: GitHub Issues (when available)  
**Security Issues**: Report privately to security@semantest.com  
**Feature Requests**: Not accepted during beta  

**Beta Period**: 2-4 weeks  
**Next Release**: v2.1.0 addressing critical issues  

---

*Beta Release Documentation*  
*Last Updated: July 21, 2025*  
*Status: BETA - Not for production use*