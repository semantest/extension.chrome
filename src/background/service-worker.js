// Background Service Worker for ChatGPT Chrome Extension
// Handles extension lifecycle, tab management, and communication

class BackgroundServiceWorker {
  constructor() {
    this.chatGPTTabs = new Map();
    this.commandQueue = new Map();
    this.extensionState = {
      isActive: true,
      activeTab: null,
      lastCommand: null,
      errors: []
    };
    
    this.init();
  }

  init() {
    
    // Set up event listeners
    this.setupInstallationHandlers();
    this.setupTabHandlers();
    this.setupMessageHandlers();
    this.setupContextMenus();
    this.setupCommandHandlers();
    
  }

  setupInstallationHandlers() {
    // Extension installation
    chrome.runtime.onInstalled.addListener((details) => {
      
      if (details.reason === 'install') {
        this.handleFirstInstall();
      } else if (details.reason === 'update') {
        this.handleUpdate(details.previousVersion);
      }
    });

    // Extension startup
    chrome.runtime.onStartup.addListener(async () => {
      this.refreshChatGPTTabs();
      
      // SAFETY CHECK 4: Check if consent is still pending from previous session
      const stored = await chrome.storage.sync.get(['telemetryConsent', 'telemetryConsentPending']);
      if (stored.telemetryConsentPending && stored.telemetryConsent === undefined) {
        // Restart consent check process
        this.ensureConsentShown();
      }
    });
  }

  async handleFirstInstall() {
    
    // Set default settings
    await chrome.storage.sync.set({
      autoDetectChatGPT: true,
      enableNotifications: true,
      defaultCustomInstructions: '',
      autoCreateProjects: false
    });

    // SAFETY CHECK 1: Mark that consent needs to be shown
    await chrome.storage.sync.set({
      telemetryConsentPending: true,
      installTime: Date.now()
    });

    // Open ChatGPT tab
    const tab = await chrome.tabs.create({
      url: 'https://chat.openai.com/',
      active: true
    });

    // SAFETY CHECK 2: Multiple trigger attempts with increasing delays
    const showConsentWithRetries = async (attempts = 0) => {
      // Check if consent already given (in case of race condition)
      const stored = await chrome.storage.sync.get(['telemetryConsent', 'telemetryConsentPending']);
      if (stored.telemetryConsent !== undefined || !stored.telemetryConsentPending) {
        return; // Already handled
      }

      try {
        // First try Chrome notification
        await this.showTelemetryConsent({
          title: 'Welcome to ChatGPT Extension!',
          message: 'Help us improve by allowing anonymous error reports? You can change this anytime in settings.'
        });
        
        // Mark as shown
        await chrome.storage.sync.set({ telemetryConsentPending: false });
      } catch (error) {
        // Fallback: Send message to content script
        try {
          await chrome.tabs.sendMessage(tab.id, {
            action: 'SHOW_TELEMETRY_CONSENT_MODAL'
          });
          
          // Mark as shown
          await chrome.storage.sync.set({ telemetryConsentPending: false });
        } catch (e) {
          // Retry with exponential backoff (max 5 attempts)
          if (attempts < 5) {
            const delay = Math.min(2000 * Math.pow(2, attempts), 10000);
            setTimeout(() => showConsentWithRetries(attempts + 1), delay);
          }
        }
      }
    };

    // Initial attempt after 3 seconds
    setTimeout(() => showConsentWithRetries(0), 3000);

    // SAFETY CHECK 3: Background timer to ensure consent is shown
    this.ensureConsentShown();
  }

  async handleUpdate(previousVersion) {
    
    // Handle version-specific migrations
    if (previousVersion && this.needsMigration(previousVersion)) {
      await this.migrateuserData(previousVersion);
    }
  }

  needsMigration(version) {
    // Check if data migration is needed
    return false; // Implement version checking logic
  }

  setupTabHandlers() {
    // Tab updates (URL changes, page loads)
    chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        await this.handleTabUpdate(tabId, tab);
      }
    });

    // Tab activation
    chrome.tabs.onActivated.addListener(async (activeInfo) => {
      await this.handleTabActivation(activeInfo.tabId);
    });

    // Tab removal
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.handleTabRemoval(tabId);
    });
  }

  async handleTabUpdate(tabId, tab) {
    if (this.isChatGPTUrl(tab.url)) {
      
      // Register ChatGPT tab
      this.chatGPTTabs.set(tabId, {
        id: tabId,
        url: tab.url,
        title: tab.title,
        lastUpdated: Date.now(),
        controllerReady: false
      });

      // Inject content script if needed
      await this.ensureContentScriptInjected(tabId);
      
      // Update extension state
      this.extensionState.activeTab = tabId;
    }
  }

  async handleTabActivation(tabId) {
    const tab = await chrome.tabs.get(tabId).catch(() => null);
    if (tab && this.isChatGPTUrl(tab.url)) {
      this.extensionState.activeTab = tabId;
    }
  }

  handleTabRemoval(tabId) {
    if (this.chatGPTTabs.has(tabId)) {
      this.chatGPTTabs.delete(tabId);
      
      if (this.extensionState.activeTab === tabId) {
        this.extensionState.activeTab = null;
      }
    }
  }

  isChatGPTUrl(url) {
    return url && (
      url.includes('chat.openai.com') ||
      url.includes('chatgpt.com')
    );
  }

  async ensureContentScriptInjected(tabId) {
    try {
      // Check if content script is already injected
      const response = await chrome.tabs.sendMessage(tabId, {
        action: 'GET_STATUS'
      }).catch(() => null);

      if (!response) {
        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['src/content/chatgpt-controller.js']
        });
        
      }
    } catch (error) {
    }
  }

  setupMessageHandlers() {
    // Messages from content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      
      // Handle async responses
      (async () => {
        try {
          let response;
          
          switch (request.action) {
            case 'CONTROLLER_READY':
              response = await this.handleControllerReady(sender.tab.id);
              break;
              
            case 'CONTROLLER_ERROR':
              response = await this.handleControllerError(sender.tab.id, request.error);
              break;
              
            case 'EXECUTE_COMMAND':
              response = await this.executeCommand(request.command, request.data, sender.tab.id);
              break;
              
            case 'GET_EXTENSION_STATE':
              response = this.getExtensionState();
              break;
              
            case 'SET_SETTINGS':
              response = await this.updateSettings(request.settings);
              break;
              
            case 'DOWNLOAD_IMAGE':
              response = await this.downloadImage(request.data.url, request.data.filename);
              break;
              
            case 'SEND_TELEMETRY':
              response = await this.sendTelemetryData(request.data);
              break;
              
            case 'SHOW_TELEMETRY_CONSENT':
              response = await this.showTelemetryConsent(request.data);
              break;
              
            default:
              response = { success: false, error: 'Unknown action' };
          }
          
          sendResponse(response);
        } catch (error) {
          sendResponse({ success: false, error: error.message });
        }
      })();
      
      return true; // Keep message channel open
    });

    // Messages from popup
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'popup') {
        this.setupPopupConnection(port);
      }
    });
  }

  async handleControllerReady(tabId) {
    
    const tabInfo = this.chatGPTTabs.get(tabId);
    if (tabInfo) {
      tabInfo.controllerReady = true;
      this.chatGPTTabs.set(tabId, tabInfo);
    }
    
    return { success: true };
  }

  async handleControllerError(tabId, error) {
    
    this.extensionState.errors.push({
      tabId,
      error,
      timestamp: Date.now()
    });
    
    return { success: true };
  }

  setupPopupConnection(port) {
    
    port.onMessage.addListener(async (message) => {
      try {
        let response;
        
        switch (message.action) {
          case 'GET_CHATGPT_TABS':
            response = await this.getChatGPTTabs();
            break;
            
          case 'EXECUTE_CHATGPT_COMMAND':
            response = await this.executeChatGPTCommand(
              message.command,
              message.data,
              message.tabId
            );
            break;
            
          case 'GET_SETTINGS':
            response = await this.getSettings();
            break;
            
          case 'UPDATE_SETTINGS':
            response = await this.updateSettings(message.settings);
            break;
            
          default:
            response = { success: false, error: 'Unknown popup action' };
        }
        
        port.postMessage(response);
      } catch (error) {
        port.postMessage({ success: false, error: error.message });
      }
    });

    port.onDisconnect.addListener(() => {
    });
  }

  setupContextMenus() {
    // Create context menu items
    chrome.contextMenus.create({
      id: 'chatgpt-create-project',
      title: 'Create ChatGPT Project',
      contexts: ['page'],
      documentUrlPatterns: ['*://chat.openai.com/*', '*://chatgpt.com/*']
    });

    chrome.contextMenus.create({
      id: 'chatgpt-new-chat',
      title: 'New Chat',
      contexts: ['page'],
      documentUrlPatterns: ['*://chat.openai.com/*', '*://chatgpt.com/*']
    });

    chrome.contextMenus.create({
      id: 'chatgpt-send-prompt',
      title: 'Send Custom Prompt',
      contexts: ['selection'],
      documentUrlPatterns: ['*://chat.openai.com/*', '*://chatgpt.com/*']
    });

    // Context menu click handler
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      await this.handleContextMenuClick(info, tab);
    });
  }

  async handleContextMenuClick(info, tab) {
    
    switch (info.menuItemId) {
      case 'chatgpt-create-project':
        await this.promptForProjectCreation(tab.id);
        break;
        
      case 'chatgpt-new-chat':
        await this.executeChatGPTCommand('CREATE_NEW_CHAT', {}, tab.id);
        break;
        
      case 'chatgpt-send-prompt':
        if (info.selectionText) {
          await this.executeChatGPTCommand('SEND_PROMPT', {
            text: info.selectionText
          }, tab.id);
        }
        break;
    }
  }

  setupCommandHandlers() {
    // Keyboard shortcuts
    chrome.commands.onCommand.addListener(async (command) => {
      
      const activeTab = await this.getActiveChatGPTTab();
      if (!activeTab) {
        return;
      }
      
      switch (command) {
        case 'new-chat':
          await this.executeChatGPTCommand('CREATE_NEW_CHAT', {}, activeTab.id);
          break;
          
        case 'create-project':
          await this.promptForProjectCreation(activeTab.id);
          break;
      }
    });
  }

  // Command Execution Methods
  async executeChatGPTCommand(command, data = {}, tabId = null) {
    const targetTabId = tabId || this.extensionState.activeTab;
    
    if (!targetTabId) {
      throw new Error('No ChatGPT tab available');
    }

    const tabInfo = this.chatGPTTabs.get(targetTabId);
    if (!tabInfo || !tabInfo.controllerReady) {
      throw new Error('ChatGPT controller not ready');
    }


    try {
      const response = await chrome.tabs.sendMessage(targetTabId, {
        action: command,
        data
      });

      this.extensionState.lastCommand = {
        command,
        data,
        tabId: targetTabId,
        timestamp: Date.now(),
        success: response.success
      };

      return response;
    } catch (error) {
      throw error;
    }
  }

  async promptForProjectCreation(tabId) {
    // This would typically show a prompt dialog
    // For now, use a default name
    const projectName = `Project ${Date.now()}`;
    
    return await this.executeChatGPTCommand('CREATE_PROJECT', {
      name: projectName
    }, tabId);
  }

  // State Management
  async getChatGPTTabs() {
    const tabs = Array.from(this.chatGPTTabs.values());
    return { success: true, tabs };
  }

  async getActiveChatGPTTab() {
    if (this.extensionState.activeTab) {
      return this.chatGPTTabs.get(this.extensionState.activeTab);
    }
    
    // Fallback: find any ChatGPT tab
    const tabs = Array.from(this.chatGPTTabs.values());
    return tabs.length > 0 ? tabs[0] : null;
  }

  getExtensionState() {
    return {
      success: true,
      state: {
        ...this.extensionState,
        chatGPTTabsCount: this.chatGPTTabs.size,
        activeChatGPTTab: this.chatGPTTabs.get(this.extensionState.activeTab)
      }
    };
  }

  async refreshChatGPTTabs() {
    // Clear existing tabs
    this.chatGPTTabs.clear();
    
    // Find all ChatGPT tabs
    const tabs = await chrome.tabs.query({});
    
    for (const tab of tabs) {
      if (this.isChatGPTUrl(tab.url)) {
        await this.handleTabUpdate(tab.id, tab);
      }
    }
    
  }

  // Settings Management
  async getSettings() {
    const settings = await chrome.storage.sync.get([
      'autoDetectChatGPT',
      'enableNotifications',
      'defaultCustomInstructions',
      'autoCreateProjects'
    ]);
    
    return { success: true, settings };
  }

  async updateSettings(newSettings) {
    await chrome.storage.sync.set(newSettings);
    
    return { success: true };
  }

  // Notification Methods
  async showNotification(title, message, type = 'basic') {
    const settings = await this.getSettings();
    if (!settings.settings.enableNotifications) {
      return;
    }

    chrome.notifications.create({
      type,
      iconUrl: 'assets/icon-48.png',
      title,
      message
    });
  }

  // Image Download Method
  async downloadImage(url, filename) {
    try {
      
      // Use Chrome downloads API
      const downloadId = await chrome.downloads.download({
        url,
        filename: `ChatGPT_Images/${filename}`,
        saveAs: false,
        conflictAction: 'uniquify'
      });
      
      // Wait for download to complete
      return new Promise((resolve) => {
        const checkDownload = (delta) => {
          if (delta.id === downloadId) {
            if (delta.state && delta.state.current === 'complete') {
              chrome.downloads.onChanged.removeListener(checkDownload);
              resolve({ success: true, downloadId });
            } else if (delta.state && delta.state.current === 'interrupted') {
              chrome.downloads.onChanged.removeListener(checkDownload);
              resolve({ success: false, error: 'Download interrupted' });
            }
          }
        };
        
        chrome.downloads.onChanged.addListener(checkDownload);
        
        // Timeout after 30 seconds
        setTimeout(() => {
          chrome.downloads.onChanged.removeListener(checkDownload);
          resolve({ success: false, error: 'Download timeout' });
        }, 30000);
      });
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // Error Handling
  handleError(error, context = '') {
    
    this.extensionState.errors.push({
      error: error.message || error,
      context,
      timestamp: Date.now()
    });

    // Show notification for critical errors
    if (context.includes('critical')) {
      this.showNotification(
        'ChatGPT Extension Error',
        error.message || 'An unexpected error occurred'
      );
    }
  }

  // Telemetry Methods
  async sendTelemetryData(payload) {
    try {
      // Check if telemetry is enabled
      const settings = await chrome.storage.sync.get(['telemetryConsent']);
      if (!settings.telemetryConsent) {
        return { success: false, error: 'Telemetry disabled' };
      }

      const response = await fetch('https://api.semantest.com/v1/telemetry/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ChatGPT-Extension/' + chrome.runtime.getManifest().version
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        return { success: true };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      // Silent fail for telemetry
      return { success: false, error: error.message };
    }
  }

  async showTelemetryConsent(data) {
    try {
      // Create notification to request consent
      const notificationId = await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icon48.png',
        title: data.title || 'ChatGPT Extension',
        message: data.message || 'Help improve the extension by sending anonymous error reports?',
        buttons: [
          { title: 'No Thanks' },
          { title: 'Allow' }
        ]
      });

      return new Promise((resolve) => {
        const handleClick = (clickedId, buttonIndex) => {
          if (clickedId === notificationId) {
            const consent = buttonIndex === 1; // Second button is "Allow"
            chrome.storage.sync.set({ telemetryConsent: consent });
            chrome.notifications.onButtonClicked.removeListener(handleClick);
            chrome.notifications.clear(notificationId);
            resolve({ success: true, consent });
          }
        };

        chrome.notifications.onButtonClicked.addListener(handleClick);

        // Timeout after 30 seconds
        setTimeout(() => {
          chrome.notifications.onButtonClicked.removeListener(handleClick);
          chrome.notifications.clear(notificationId);
          resolve({ success: true, consent: false });
        }, 30000);
      });
    } catch (error) {
      // Fallback: Try content script modal if notification fails
      await this.showConsentInContentScript();
      return { success: false, error: error.message };
    }
  }

  async showConsentInContentScript() {
    try {
      // Find an active ChatGPT tab
      const activeTabs = await chrome.tabs.query({
        url: ['*://chat.openai.com/*', '*://chatgpt.com/*'],
        active: true
      });

      if (activeTabs.length > 0) {
        // Send message to content script to show modal
        const response = await chrome.tabs.sendMessage(activeTabs[0].id, {
          action: 'SHOW_TELEMETRY_CONSENT_MODAL'
        });
        return response;
      }
    } catch (error) {
      // Silent fail for fallback
    }
  }

  // SAFETY CHECK: Ensure consent popup is shown
  async ensureConsentShown() {
    // Check every 30 seconds if consent is still pending
    const checkInterval = setInterval(async () => {
      const stored = await chrome.storage.sync.get(['telemetryConsent', 'telemetryConsentPending']);
      
      // If consent is pending and no decision made
      if (stored.telemetryConsentPending && stored.telemetryConsent === undefined) {
        // Try to show consent again
        try {
          await this.showTelemetryConsent({
            title: 'ChatGPT Extension - Privacy Choice',
            message: 'Would you like to help improve the extension with anonymous error reports?'
          });
          
          // Mark as shown
          await chrome.storage.sync.set({ telemetryConsentPending: false });
          clearInterval(checkInterval);
        } catch (error) {
          // Try content script fallback
          const tabs = await chrome.tabs.query({
            url: ['*://chat.openai.com/*', '*://chatgpt.com/*']
          });
          
          if (tabs.length > 0) {
            try {
              await chrome.tabs.sendMessage(tabs[0].id, {
                action: 'SHOW_TELEMETRY_CONSENT_MODAL'
              });
              await chrome.storage.sync.set({ telemetryConsentPending: false });
              clearInterval(checkInterval);
            } catch (e) {
              // Will retry in next interval
            }
          }
        }
      } else {
        // Consent already handled
        clearInterval(checkInterval);
      }
    }, 30000); // Check every 30 seconds

    // Stop checking after 5 minutes
    setTimeout(() => {
      clearInterval(checkInterval);
    }, 300000);
  }
}

// Initialize service worker
const backgroundWorker = new BackgroundServiceWorker();

// Keep service worker alive
chrome.runtime.onMessage.addListener(() => {
  // This listener keeps the service worker active
  return true;
});

