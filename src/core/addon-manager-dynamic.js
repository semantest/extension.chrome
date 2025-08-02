/**
 * Dynamic Addon Manager
 * Handles addon discovery, validation, and injection from remote sources
 * Phase 1: Load from REST server without domain validation
 * Based on Aria's architectural design
 */

class DynamicAddonManager {
  constructor() {
    this.addons = new Map();
    this.activeAddons = new Map(); // tabId -> addonId
    this.addonChannels = new Map(); // tabId -> MessageBus
    this.remoteAddons = new Map(); // Cache of remote addons
    this.serverUrl = 'http://localhost:3003'; // REST server URL
  }

  /**
   * Initialize the addon manager
   */
  async initialize() {
    console.log('🚀 Initializing Dynamic Addon Manager...');
    
    // 1. Load remote addon manifests first
    const remoteManifests = await this.loadRemoteManifests();
    
    // 2. Fall back to local manifests if needed
    const localManifests = await this.loadLocalManifests();
    
    // 3. Merge manifests (remote takes precedence)
    const allManifests = [...remoteManifests, ...localManifests];
    
    // 4. Validate and register
    for (const manifest of allManifests) {
      if (this.validateManifest(manifest)) {
        this.addons.set(manifest.addon_id, manifest);
        console.log(`✅ Registered addon: ${manifest.addon_id} (${manifest.source})`);
      }
    }
    
    // 5. Setup domain matching for tabs
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    
    // 6. Check existing tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        await this.checkTabForAddon(tab.id, tab.url);
      }
    }
  }

  /**
   * Load addon manifests from remote server
   */
  async loadRemoteManifests() {
    console.log('📡 Loading remote addon manifests...');
    const manifests = [];
    
    try {
      // Phase 1: Just try to load ChatGPT addon from server
      const addonIds = ['chatgpt'];
      
      for (const addonId of addonIds) {
        try {
          const response = await fetch(`${this.serverUrl}/api/addons/${addonId}/manifest`);
          if (response.ok) {
            const manifest = await response.json();
            manifest.source = 'remote';
            manifest.remoteUrl = `${this.serverUrl}/api/addons/${addonId}`;
            manifests.push(manifest);
            console.log(`✅ Loaded remote manifest for ${addonId}`);
          }
        } catch (error) {
          console.warn(`Failed to load remote manifest for ${addonId}:`, error);
        }
      }
    } catch (error) {
      console.error('Failed to connect to addon server:', error);
    }
    
    return manifests;
  }

  /**
   * Load local addon manifests as fallback
   */
  async loadLocalManifests() {
    const manifests = [];
    
    // Only load local addons if they still exist
    try {
      // Check if local addon directory exists
      const response = await fetch(chrome.runtime.getURL('src/addons/chatgpt/manifest.json'));
      if (response.ok) {
        const manifest = await response.json();
        manifest.source = 'local';
        manifests.push(manifest);
        console.log('📦 Loaded local manifest for chatgpt (fallback)');
      }
    } catch (error) {
      // Local addon not found - this is expected in Phase 1
      console.log('ℹ️ No local addons found (expected in dynamic mode)');
    }
    
    return manifests;
  }

  /**
   * Validate addon manifest
   */
  validateManifest(manifest) {
    const required = ['addon_id', 'version', 'domains', 'entry_point'];
    
    for (const field of required) {
      if (!manifest[field]) {
        console.error(`Invalid manifest: missing ${field}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Load remote addon bundle
   */
  async loadRemoteAddon(addonId) {
    // Check cache first
    if (this.remoteAddons.has(addonId)) {
      console.log(`📦 Using cached addon: ${addonId}`);
      return this.remoteAddons.get(addonId);
    }
    
    const manifest = this.addons.get(addonId);
    if (!manifest || manifest.source !== 'remote') {
      throw new Error(`No remote addon found: ${addonId}`);
    }
    
    try {
      console.log(`⬇️ Downloading addon bundle: ${addonId}`);
      const response = await fetch(`${manifest.remoteUrl}/bundle`);
      if (!response.ok) {
        throw new Error(`Failed to download addon: ${response.status}`);
      }
      
      const bundle = await response.text();
      
      // Cache the bundle
      this.remoteAddons.set(addonId, {
        manifest,
        bundle,
        loadedAt: Date.now()
      });
      
      console.log(`✅ Downloaded addon: ${addonId} (${bundle.length} bytes)`);
      return this.remoteAddons.get(addonId);
    } catch (error) {
      console.error(`Failed to load remote addon ${addonId}:`, error);
      throw error;
    }
  }

  /**
   * Handle tab update events
   */
  handleTabUpdate = async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      await this.checkTabForAddon(tabId, tab.url);
    }
  }

  /**
   * Handle tab removal
   */
  handleTabRemoved = (tabId) => {
    // Clean up addon state for removed tab
    this.activeAddons.delete(tabId);
    this.addonChannels.delete(tabId);
  }

  /**
   * Check if a tab URL matches any addon
   */
  async checkTabForAddon(tabId, url) {
    const addon = this.findAddonForUrl(url);
    
    if (addon) {
      // Check if addon is already active for this tab
      if (this.activeAddons.get(tabId) === addon.addon_id) {
        return; // Already loaded
      }
      
      await this.injectAddon(tabId, addon);
    } else {
      // No addon for this URL, clean up if any was active
      this.activeAddons.delete(tabId);
      this.addonChannels.delete(tabId);
    }
  }

  /**
   * Find addon that matches a URL
   */
  findAddonForUrl(url) {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      
      for (const [addonId, manifest] of this.addons) {
        if (manifest.domains.some(domain => hostname.includes(domain))) {
          return manifest;
        }
      }
    } catch (error) {
      console.error('Invalid URL:', url);
    }
    
    return null;
  }

  /**
   * Inject addon into a tab
   */
  async injectAddon(tabId, addon) {
    console.log(`💉 Injecting addon ${addon.addon_id} into tab ${tabId}`);
    
    try {
      // First inject the content bridge in ISOLATED world
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/chatgpt-bridge.js'],
        world: 'ISOLATED'
      });
      
      // Wait for bridge to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then inject core dependencies in MAIN world
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'src/core/message-bus.js',
          'src/core/message-logger.js'
        ],
        world: 'MAIN'
      });
      
      // Handle remote vs local addon injection
      if (addon.source === 'remote') {
        await this.injectRemoteAddon(tabId, addon);
      } else {
        await this.injectLocalAddon(tabId, addon);
      }
      
      // Mark addon as active
      this.activeAddons.set(tabId, addon.addon_id);
      
      // Create addon communication channel
      this.createAddonChannel(tabId, addon.addon_id);
      
      console.log(`✅ Addon ${addon.addon_id} loaded successfully`);
      
    } catch (error) {
      console.error(`Failed to inject addon ${addon.addon_id}:`, error);
    }
  }

  /**
   * Inject remote addon bundle
   */
  async injectRemoteAddon(tabId, addon) {
    const addonData = await this.loadRemoteAddon(addon.addon_id);
    
    // Inject the bundled code
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (bundleCode, addonId) => {
        // Create a self-executing function to isolate the addon
        const addonWrapper = `
          (function() {
            console.log('🔌 Loading remote addon: ${addonId}');
            try {
              ${bundleCode}
              console.log('✅ Remote addon loaded: ${addonId}');
            } catch (error) {
              console.error('Failed to load remote addon:', error);
            }
          })();
        `;
        
        // Create and execute script element
        const script = document.createElement('script');
        script.textContent = addonWrapper;
        document.head.appendChild(script);
        script.remove();
      },
      args: [addonData.bundle, addon.addon_id],
      world: 'MAIN'
    });
  }

  /**
   * Inject local addon (fallback)
   */
  async injectLocalAddon(tabId, addon) {
    // Original local injection logic
    if (addon.scripts && addon.scripts.length > 0) {
      const addonScripts = addon.scripts.map(script => 
        `src/addons/${addon.addon_id.replace('_addon', '')}/${script}`
      );
      
      await chrome.scripting.executeScript({
        target: { tabId },
        files: addonScripts,
        world: 'MAIN'
      });
    }
    
    if (addon.entry_point) {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [`src/addons/${addon.addon_id.replace('_addon', '')}/${addon.entry_point}`],
        world: 'MAIN'
      });
    }
  }

  /**
   * Create message channel for addon
   */
  createAddonChannel(tabId, addonId) {
    // Set up message passing between background and content script
    chrome.tabs.onMessage.addListener((message, sender, sendResponse) => {
      if (sender.tab && sender.tab.id === tabId) {
        // Forward addon messages to message bus
        if (message.type && message.type.startsWith('addon:')) {
          // In service worker context, we'll handle this differently
          console.log(`📡 Addon message received: ${message.type}`, message.payload);
        }
      }
    });
    
    console.log(`📡 Created message channel for addon ${addonId} in tab ${tabId}`);
  }

  /**
   * Send message to specific addon
   */
  async sendToAddon(tabId, message) {
    if (!this.activeAddons.has(tabId)) {
      console.warn(`No active addon for tab ${tabId}`);
      return;
    }
    
    try {
      await chrome.tabs.sendMessage(tabId, message);
    } catch (error) {
      console.error(`Failed to send message to addon in tab ${tabId}:`, error);
    }
  }

  /**
   * Get active addon for a tab
   */
  getActiveAddon(tabId) {
    const addonId = this.activeAddons.get(tabId);
    return addonId ? this.addons.get(addonId) : null;
  }

  /**
   * Get all registered addons
   */
  getAllAddons() {
    return Array.from(this.addons.values());
  }

  /**
   * Refresh remote addons
   */
  async refreshRemoteAddons() {
    console.log('🔄 Refreshing remote addons...');
    this.remoteAddons.clear();
    const manifests = await this.loadRemoteManifests();
    
    for (const manifest of manifests) {
      if (this.validateManifest(manifest)) {
        this.addons.set(manifest.addon_id, manifest);
      }
    }
    
    return manifests;
  }
}

// Create singleton instance
const dynamicAddonManager = new DynamicAddonManager();

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = dynamicAddonManager;
} else if (typeof self !== 'undefined') {
  // Service worker context
  self.dynamicAddonManager = dynamicAddonManager;
} else if (typeof window !== 'undefined') {
  // Browser context
  window.dynamicAddonManager = dynamicAddonManager;
}