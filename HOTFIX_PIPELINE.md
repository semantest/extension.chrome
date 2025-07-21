# ChatGPT Extension v1.1.0 Hotfix Pipeline

## 🚨 Critical Issue Response Process

### Priority Levels
- **P0 (CRITICAL)**: Extension breaks ChatGPT, data loss, security issues → Fix within 2 hours
- **P1 (HIGH)**: Core features broken → Fix within 24 hours  
- **P2 (MEDIUM)**: Feature degraded but usable → Fix within 3 days
- **P3 (LOW)**: Minor issues, UI glitches → Next release

### Hotfix Workflow

1. **Issue Detection**
   ```bash
   # Monitor Chrome Web Store reviews
   # Check GitHub issues
   # Monitor error reports
   ```

2. **Quick Fix Branch**
   ```bash
   git checkout feature/v1.1.0-hotfixes
   git pull origin feature/v1.1.0-hotfixes
   git checkout -b hotfix/issue-description
   ```

3. **Rapid Testing**
   ```bash
   # Test fix locally
   npm run test:quick
   # Load unpacked extension in Chrome
   # Verify fix doesn't break other features
   ```

4. **Emergency Deploy**
   ```bash
   # Update version in manifest.json (1.1.0-beta.1, 1.1.0-beta.2, etc)
   npm run build:production
   python3 create_package.py
   # Upload to Chrome Web Store immediately
   ```

## 🔧 Common Beta Issues & Quick Fixes

### 1. Content Script Not Loading
```javascript
// Fix: Add fallback injection in service-worker.js
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('chat.openai.com')) {
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['chatgpt-controller.js']
    }).catch(() => {});
  }
});
```

### 2. Permission Errors
```json
// Fix: Update manifest.json permissions
{
  "permissions": ["activeTab", "storage", "downloads", "scripting"],
  "host_permissions": ["https://chat.openai.com/*", "https://chatgpt.com/*"]
}
```

### 3. Button Selectors Breaking
```javascript
// Fix: Add multiple fallback selectors
const selectors = {
  sendButton: [
    'button[data-testid="send-button"]',
    'button[aria-label*="Send"]',
    'form button:has(svg)',
    'button.text-white'
  ].join(', ')
}
```

### 4. Image Download Failures
```javascript
// Fix: Add blob URL handling
if (url.startsWith('blob:')) {
  const response = await fetch(url);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  // Download objectUrl instead
}
```

## 📊 Beta Monitoring

### Key Metrics to Track
- Extension crash rate
- Feature usage statistics  
- Error frequency by feature
- User feedback sentiment

### Error Reporting
```javascript
// Add to chatgpt-controller.js
window.addEventListener('error', (e) => {
  chrome.runtime.sendMessage({
    type: 'ERROR_REPORT',
    error: {
      message: e.message,
      stack: e.error?.stack,
      url: window.location.href,
      timestamp: new Date().toISOString()
    }
  });
});
```

## 🚀 Rapid Deployment Script

```bash
#!/bin/bash
# hotfix-deploy.sh

echo "🚨 HOTFIX DEPLOYMENT STARTING..."

# 1. Update version
VERSION=$(grep version manifest.json | cut -d'"' -f4)
NEW_VERSION="${VERSION%.*}.$((${VERSION##*.} + 1))"
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" manifest.json

# 2. Clean build
rm -rf build/
mkdir -p build/assets

# 3. Copy production files
cp src/content/chatgpt-controller.js build/
cp src/background/service-worker.js build/
cp src/popup.html build/
cp manifest.json build/
cp -r assets/* build/assets/

# 4. Create package
python3 create_package.py

echo "✅ Hotfix package ready: chatgpt-extension-v$NEW_VERSION.zip"
echo "📦 Upload to Chrome Web Store NOW!"
```

## 🔍 Testing Checklist

Before deploying ANY hotfix:
- [ ] Test on chat.openai.com
- [ ] Test on chatgpt.com  
- [ ] Test all 6 core features still work
- [ ] Test in Chrome, Edge, Brave
- [ ] Verify no console errors
- [ ] Check memory usage

## 📞 Emergency Contacts

- Chrome Web Store Support: [Dashboard](https://chrome.google.com/webstore/devconsole)
- GitHub Issues: [semantest/workspace](https://github.com/semantest/workspace/issues)
- Team Slack: #extension-emergencies

---

**Remember**: Move fast but test thoroughly. A broken hotfix is worse than the original bug!