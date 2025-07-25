# Feature Request: Dynamic Addon Loading System

**Requested by**: rydnr  
**Date**: 2025-07-22  
**Target Version**: Post-v1.0  
**Priority**: High (after v1.0 stability)

## Overview

Transform Semantest from a ChatGPT-specific extension into a universal web automation framework by implementing dynamic addon loading based on the active website.

## Current Architecture (v1.0)

- Static loading of ChatGPT addon via manifest.json
- Content scripts always injected on chatgpt.com/* domains
- Single-site automation capability

## Proposed Architecture

### 1. Dynamic Addon Registry

```javascript
// addon-registry.js
const ADDON_REGISTRY = {
  'chatgpt.com': {
    scripts: ['addons/chatgpt/addon.js'],
    matches: ['*://chatgpt.com/*', '*://chat.openai.com/*'],
    capabilities: ['text-generation', 'image-generation']
  },
  'github.com': {
    scripts: ['addons/github/addon.js'],
    matches: ['*://github.com/*'],
    capabilities: ['code-automation', 'pr-management']
  },
  'linkedin.com': {
    scripts: ['addons/linkedin/addon.js'],
    matches: ['*://linkedin.com/*'],
    capabilities: ['profile-automation', 'messaging']
  },
  // More addons...
};
```

### 2. Tab Monitoring System

```javascript
// background/addon-manager.js
class AddonManager {
  constructor() {
    this.activeAddons = new Map(); // tabId -> addon
    this.setupTabMonitoring();
  }

  setupTabMonitoring() {
    // Monitor tab changes
    chrome.tabs.onActivated.addListener(this.handleTabChange);
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
    chrome.webNavigation.onCompleted.addListener(this.handleNavigation);
  }

  async handleTabChange(activeInfo) {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    await this.loadAddonForUrl(tab.id, tab.url);
  }

  async loadAddonForUrl(tabId, url) {
    const domain = new URL(url).hostname;
    const addon = this.findAddonForDomain(domain);
    
    if (addon && !this.activeAddons.has(tabId)) {
      await this.injectAddon(tabId, addon);
    }
  }
}
```

### 3. Addon Interface Standard

```javascript
// addons/base-addon.js
class BaseAddon {
  constructor() {
    this.domain = '';
    this.version = '1.0.0';
    this.capabilities = [];
  }

  // Standard lifecycle methods
  async onLoad() {}
  async onUnload() {}
  
  // Health check
  async checkHealth() {
    return {
      healthy: false,
      status: 'not-implemented'
    };
  }

  // Capability detection
  getCapabilities() {
    return this.capabilities;
  }

  // Message handling
  async handleMessage(message) {
    // Override in specific addons
  }
}
```

### 4. Example Addon Implementation

```javascript
// addons/github/addon.js
class GitHubAddon extends BaseAddon {
  constructor() {
    super();
    this.domain = 'github.com';
    this.capabilities = ['create-issue', 'create-pr', 'code-review'];
  }

  async checkHealth() {
    const isLoggedIn = document.querySelector('.Header-link--profile') !== null;
    return {
      healthy: isLoggedIn,
      username: this.getUsername(),
      capabilities: this.detectAvailableActions()
    };
  }

  async handleMessage(message) {
    switch (message.action) {
      case 'CREATE_ISSUE':
        return await this.createIssue(message.data);
      case 'CREATE_PR':
        return await this.createPullRequest(message.data);
      // More actions...
    }
  }
}
```

## Implementation Plan

### Phase 1: Core Infrastructure (2-3 weeks)
1. Create addon registry system
2. Implement tab monitoring in service worker
3. Build dynamic injection mechanism
4. Create base addon class/interface

### Phase 2: Addon Development Kit (1-2 weeks)
1. Addon development documentation
2. Testing framework for addons
3. Addon validation system
4. Example addons (GitHub, LinkedIn)

### Phase 3: Addon Marketplace (Future)
1. Addon discovery mechanism
2. User-installable addons
3. Addon permissions system
4. Community addon repository

## Benefits

1. **Universal Automation**: Work with any website that has an addon
2. **Modular Architecture**: Easy to add new site support
3. **Performance**: Only load addons when needed
4. **Maintainability**: Site-specific code isolated in addons
5. **Community Driven**: Others can contribute addons

## Technical Considerations

### Security
- Addon sandboxing
- Permission scoping per addon
- Content Security Policy per domain
- Addon code review process

### Performance
- Lazy loading of addons
- Memory management for inactive addons
- Efficient domain matching
- Caching of addon scripts

### Compatibility
- Manifest V3 compliance
- Cross-browser support
- Backwards compatibility with v1.0

## Migration Strategy

1. Keep existing ChatGPT functionality intact
2. Implement new system alongside old
3. Gradually migrate ChatGPT code to addon format
4. Deprecate old system in v2.0

## Example Use Cases

### GitHub Automation
```javascript
// User visits github.com
// Extension automatically loads GitHub addon
// Popup shows GitHub-specific actions:
// - Create issue from template
// - Automate PR reviews
// - Bulk operations
```

### LinkedIn Automation
```javascript
// User visits linkedin.com
// Extension loads LinkedIn addon
// Available actions:
// - Auto-connect with filters
// - Message templates
// - Profile scraping
```

### Custom Corporate Sites
```javascript
// Companies can create private addons
// For their internal tools
// Distributed via internal addon registry
```

## Success Metrics

1. Number of supported sites (target: 10+ popular sites)
2. Addon load time (<100ms)
3. Memory usage per addon (<5MB)
4. Community addon submissions
5. User engagement across different sites

## Notes

- This transforms Semantest from a tool to a platform
- Opens possibility for monetization via premium addons
- Could become the "Greasemonkey for AI automation"
- Requires careful security considerations
- Should maintain backwards compatibility

## Reference Architecture

Similar successful projects:
- Tampermonkey/Greasemonkey (userscript managers)
- 1Password (site-specific password filling)
- uBlock Origin (per-site rule application)

---

*This feature would position Semantest as the universal web automation framework for the AI era.*