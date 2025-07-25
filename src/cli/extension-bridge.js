// Extension Bridge for CLI Communication
// Exposes extension APIs for external CLI access

class ExtensionCLIBridge {
  constructor() {
    this.isEnabled = false;
    this.connectedClients = new Set();
    this.initializeBridge();
  }

  initializeBridge() {
    // Method 1: Native Messaging
    this.setupNativeMessaging();
    
    // Method 2: External Message Listener
    this.setupExternalMessages();
    
    // Method 3: WebSocket Bridge (if enabled)
    if (chrome.storage.sync.get(['enableCLI'])) {
      this.setupWebSocketBridge();
    }
  }

  // Native Messaging for trusted CLI
  setupNativeMessaging() {
    chrome.runtime.onConnectNative.addListener((port) => {
      console.log('CLI connected via native messaging');
      
      port.onMessage.addListener(async (message) => {
        const response = await this.handleCLICommand(message);
        port.postMessage(response);
      });
      
      port.onDisconnect.addListener(() => {
        console.log('CLI disconnected');
      });
    });
  }

  // External messages from CDP or other extensions
  setupExternalMessages() {
    chrome.runtime.onMessageExternal.addListener(
      async (request, sender, sendResponse) => {
        // Validate sender
        if (!this.isAuthorizedSender(sender)) {
          sendResponse({ error: 'Unauthorized' });
          return;
        }
        
        const response = await this.handleCLICommand(request);
        sendResponse(response);
        return true; // Keep channel open for async
      }
    );
  }

  // WebSocket for real-time CLI communication
  setupWebSocketBridge() {
    // Note: This would require a separate WebSocket server
    // For now, we'll use a mock implementation
    this.wsPort = 8765;
    console.log(`WebSocket bridge ready on port ${this.wsPort}`);
  }

  // Validate CLI/external access
  isAuthorizedSender(sender) {
    const trustedOrigins = [
      'http://localhost:*',
      'chrome-extension://cli-companion-id'
    ];
    
    return trustedOrigins.some(origin => 
      sender.origin?.match(origin) || sender.id === 'cli-companion-id'
    );
  }

  // Main command handler
  async handleCLICommand(command) {
    try {
      console.log('CLI Command:', command);
      
      switch (command.action) {
        case 'CREATE_PROJECT':
          return await this.createProject(command.data);
          
        case 'SET_CUSTOM_INSTRUCTIONS':
          return await this.setCustomInstructions(command.data);
          
        case 'CREATE_NEW_CHAT':
          return await this.createNewChat();
          
        case 'SEND_PROMPT':
          return await this.sendPrompt(command.data);
          
        case 'REQUEST_IMAGE':
          return await this.requestImage(command.data);
          
        case 'DOWNLOAD_IMAGES':
          return await this.downloadImages(command.data);
          
        case 'GET_STATUS':
          return await this.getExtensionStatus();
          
        case 'BATCH_COMMANDS':
          return await this.executeBatchCommands(command.data);
          
        default:
          return { 
            success: false, 
            error: `Unknown command: ${command.action}` 
          };
      }
    } catch (error) {
      return { 
        success: false, 
        error: error.message,
        stack: error.stack 
      };
    }
  }

  // Command implementations
  async createProject(data) {
    const tabs = await chrome.tabs.query({ 
      url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] 
    });
    
    if (tabs.length === 0) {
      throw new Error('No ChatGPT tab found. Please open ChatGPT first.');
    }
    
    const response = await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'CREATE_PROJECT',
      data: data
    });
    
    return response;
  }

  async setCustomInstructions(data) {
    const tabs = await this.getChatGPTTabs();
    return await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'SET_CUSTOM_INSTRUCTIONS',
      data: data
    });
  }

  async createNewChat() {
    const tabs = await this.getChatGPTTabs();
    return await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'CREATE_NEW_CHAT'
    });
  }

  async sendPrompt(data) {
    const tabs = await this.getChatGPTTabs();
    return await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'SEND_PROMPT',
      data: data
    });
  }

  async requestImage(data) {
    const imagePrompt = `Create an image: ${data.prompt}`;
    return await this.sendPrompt({ text: imagePrompt });
  }

  async downloadImages(data) {
    const tabs = await this.getChatGPTTabs();
    return await chrome.tabs.sendMessage(tabs[0].id, {
      action: 'DOWNLOAD_IMAGES',
      data: data
    });
  }

  async getExtensionStatus() {
    const tabs = await chrome.tabs.query({ 
      url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] 
    });
    
    const storage = await chrome.storage.sync.get(null);
    
    return {
      success: true,
      status: {
        version: chrome.runtime.getManifest().version,
        chatGPTTabs: tabs.length,
        activeTab: tabs.find(t => t.active)?.id,
        settings: storage,
        cliEnabled: this.isEnabled
      }
    };
  }

  async executeBatchCommands(commands) {
    const results = [];
    
    for (const cmd of commands) {
      const result = await this.handleCLICommand(cmd);
      results.push({
        command: cmd.action,
        result: result
      });
      
      // Add delay between commands to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return {
      success: true,
      results: results
    };
  }

  // Helper methods
  async getChatGPTTabs() {
    const tabs = await chrome.tabs.query({ 
      url: ['*://chat.openai.com/*', '*://chatgpt.com/*'] 
    });
    
    if (tabs.length === 0) {
      throw new Error('No ChatGPT tab found');
    }
    
    return tabs;
  }

  // Enable/disable CLI access
  async toggleCLIAccess(enabled) {
    this.isEnabled = enabled;
    await chrome.storage.sync.set({ enableCLI: enabled });
    
    if (enabled) {
      console.log('CLI access enabled');
    } else {
      console.log('CLI access disabled');
      // Close any active connections
      this.connectedClients.clear();
    }
  }
}

// Initialize bridge if in background script
if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
  window.extensionCLIBridge = new ExtensionCLIBridge();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExtensionCLIBridge;
}