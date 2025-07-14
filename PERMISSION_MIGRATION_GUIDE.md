# ChatGPT-Buddy Permission Migration Guide

## Important Security Update: Removal of `<all_urls>` Permission

### Overview

In version 2.0.0, ChatGPT-Buddy has removed the overly broad `<all_urls>` permission in favor of specific domain permissions. This change significantly improves the security of the extension by limiting its access to only the domains it actually needs to function.

### What Changed?

**Before (Version < 2.0.0):**
- Extension had access to ALL websites (`<all_urls>`)
- Content scripts were injected on every webpage
- Potential security risk from broad permissions

**After (Version 2.0.0):**
- Extension only has access to:
  - `https://chat.openai.com/*`
  - `https://chatgpt.com/*`
  - `https://*.google.com/*`
  - `https://google.com/*`
- Content scripts only injected on supported domains
- Significantly reduced security footprint

### Impact on Users

#### What Still Works:
- ✅ All ChatGPT automation features
- ✅ Google search integration
- ✅ Download functionality on supported sites
- ✅ Storage and pattern learning
- ✅ WebSocket communication with server

#### What No Longer Works:
- ❌ Extension functionality on non-supported domains
- ❌ Automation on arbitrary websites
- ❌ Content script injection on non-allowed domains

### Migration Steps

1. **Update the Extension**
   - The extension will automatically update through Chrome Web Store
   - Or manually update via chrome://extensions

2. **Re-enable on Supported Sites**
   - Chrome may prompt you to approve the new permissions
   - Click "Allow" to enable the extension on supported domains

3. **Check Extension Status**
   - Visit https://chat.openai.com or https://google.com
   - Click the extension icon to verify it's active
   - The popup should show "Active" status on supported domains

### Troubleshooting

#### Extension Not Working on ChatGPT/Google?

1. **Check Permissions:**
   ```
   1. Go to chrome://extensions
   2. Find ChatGPT-Buddy
   3. Click "Details"
   4. Check "Site access" shows the allowed domains
   ```

2. **Reload the Extension:**
   ```
   1. Go to chrome://extensions
   2. Toggle the extension off and on
   3. Refresh the ChatGPT/Google tab
   ```

3. **Clear Extension Data (if needed):**
   ```
   1. Right-click extension icon
   2. Select "Manage extension"
   3. Click "Clear data"
   4. Reload the page
   ```

#### Need Access to Other Domains?

The extension is designed specifically for ChatGPT and Google integration. If you need automation on other websites:

1. Consider using the Semantest SDK for custom implementations
2. Request domain support by opening an issue on GitHub
3. Use the activeTab permission for one-time access when clicking the extension

### Security Benefits

1. **Reduced Attack Surface**: Extension can't be exploited to access arbitrary websites
2. **Privacy Protection**: Your browsing on other sites is completely private
3. **Performance Improvement**: Content scripts only load where needed
4. **Compliance**: Better alignment with Chrome Web Store policies

### For Developers

If you're developing plugins or integrations:

```javascript
// Check if extension can access current domain
function canAccessDomain(url) {
  const allowedDomains = [
    'chat.openai.com',
    'chatgpt.com',
    'google.com'
  ];
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    return allowedDomains.some(domain => 
      hostname === domain || 
      hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

// Before sending messages to content script
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (canAccessDomain(tab.url)) {
  chrome.tabs.sendMessage(tab.id, message);
} else {
  console.error('Extension not allowed on this domain');
}
```

### Frequently Asked Questions

**Q: Why was this change made?**  
A: To improve security and protect user privacy by following the principle of least privilege.

**Q: Can I still use the extension on other sites?**  
A: No, the extension is now limited to ChatGPT and Google domains only.

**Q: Will this break my existing automations?**  
A: Only if they were designed for non-supported domains. ChatGPT and Google automations continue to work.

**Q: Can I request support for additional domains?**  
A: Yes, please open an issue on our GitHub repository with your use case.

**Q: Is my data safe?**  
A: Yes, this change makes your data even safer by limiting what the extension can access.

### Need Help?

- 📧 Email: support@semantest.com
- 💬 GitHub Issues: https://github.com/semantest/chrome-extension/issues
- 📚 Documentation: https://docs.semantest.com

---

Thank you for using ChatGPT-Buddy! This security update helps protect your privacy while maintaining all the features you love.