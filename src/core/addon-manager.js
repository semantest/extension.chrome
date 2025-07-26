/**
 * Addon Manager
 * Handles addon discovery, validation, and injection
 * Based on Aria's architectural design
 */

class AddonManager {
  constructor() {
    this.addons = new Map();
    this.activeAddons = new Map(); // tabId -> addonId
    this.addonChannels = new Map(); // tabId -> MessageBus
  }

  /**
   * Initialize the addon manager
   */
  async initialize() {
    console.log('🚀 Initializing Addon Manager...');
    
    // 1. Load all addon manifests
    const manifests = await this.loadManifests();
    
    // 2. Validate and register
    for (const manifest of manifests) {
      if (this.validateManifest(manifest)) {
        this.addons.set(manifest.addon_id, manifest);
        console.log(`✅ Registered addon: ${manifest.addon_id}`);
      }
    }
    
    // 3. Setup domain matching for tabs
    chrome.tabs.onUpdated.addListener(this.handleTabUpdate);
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved);
    
    // 4. Check existing tabs
    const tabs = await chrome.tabs.query({});
    for (const tab of tabs) {
      if (tab.url) {
        await this.checkTabForAddon(tab.id, tab.url);
      }
    }
  }

  /**
   * Load all addon manifests
   */
  async loadManifests() {
    // For now, hardcode the addon list
    // In production, this could scan the addons directory
    const addonIds = ['chatgpt'];
    const manifests = [];
    
    for (const addonId of addonIds) {
      try {
        const response = await fetch(chrome.runtime.getURL(`src/addons/${addonId}/manifest.json`));
        const manifest = await response.json();
        manifests.push(manifest);
      } catch (error) {
        console.error(`Failed to load addon manifest for ${addonId}:`, error);
      }
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
      // First inject the content bridge in ISOLATED world for chrome.runtime access
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/chatgpt-bridge.js'],
        world: 'ISOLATED' // Content script world for chrome.runtime API access
      });
      
      // Wait a bit for bridge to initialize
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Then inject the message bus and core dependencies in MAIN world
      await chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'src/core/message-bus.js',
          'src/core/message-logger.js'
        ],
        world: 'MAIN' // Main world for DOM access
      });
      
      // Then inject addon scripts if defined
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
      
      // Always inject the entry point
      if (addon.entry_point) {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: [`src/addons/${addon.addon_id.replace('_addon', '')}/${addon.entry_point}`],
          world: 'MAIN'
        });
      }
      
      // Mark addon as active
      this.activeAddons.set(tabId, addon.addon_id);
      
      // Create addon communication channel
      this.createAddonChannel(tabId, addon.addon_id);
      
      // Notify that addon is loaded
      if (window.messageBus) {
        window.messageBus.emit('core:addon:loaded', {
          tabId,
          addonId: addon.addon_id,
          url: (await chrome.tabs.get(tabId)).url
        });
      }
      
    } catch (error) {
      console.error(`Failed to inject addon ${addon.addon_id}:`, error);
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
          if (window.messageBus) {
            window.messageBus.emit(message.type, message.payload);
          }
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
}

// Create singleton instance
const addonManager = new AddonManager();

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = addonManager;
} else {
  window.addonManager = addonManager;
}