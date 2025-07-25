/**
 * Health Check UI Integration for Semantest Extension
 * This module adds health check functionality to the popup
 */

// Import TabHealthCheck functionality
import { TabHealthCheck } from './health-checks/tab-health.js';

// Health check UI controller
class HealthCheckUI {
  constructor() {
    this.tabHealthCheck = new TabHealthCheck();
    this.healthStatusDot = null;
    this.healthStatusText = null;
    this.healthStatus = null;
    
    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.initialize());
    } else {
      this.initialize();
    }
  }
  
  initialize() {
    this.initializeElements();
    this.startHealthCheckPolling();
  }
  
  initializeElements() {
    // Get layer status dots
    this.browserDot = document.querySelector('[data-layer="browser"]');
    this.extensionDot = document.querySelector('[data-layer="extension"]');
    this.addonDot = document.querySelector('[data-layer="addon"]');
    
    // Get action buttons
    this.healthActions = document.getElementById('healthActions');
    this.launchBrowserBtn = document.getElementById('launchBrowserBtn');
    this.openChatGPTBtn = document.getElementById('openChatGPTBtn');
    
    // Add button listeners
    if (this.launchBrowserBtn) {
      this.launchBrowserBtn.addEventListener('click', () => this.launchBrowser());
    }
    if (this.openChatGPTBtn) {
      this.openChatGPTBtn.addEventListener('click', () => this.openChatGPT());
    }
  }
  
  startHealthCheckPolling() {
    // Check health immediately
    this.checkHealth();
    
    // Poll health status every 5 seconds
    setInterval(() => {
      this.checkHealth();
    }, 5000);
  }
  
  async checkHealth() {
    try {
      // Check all 3 layers for comprehensive health monitoring
      const healthStatuses = {
        browser: { healthy: false, message: 'Checking...' },
        extension: { healthy: false, message: 'Checking...' },
        addon: { healthy: false, message: 'Checking...' }
      };
      
      // 1. Check server/browser health
      const serverHealth = await this.checkServerHealth();
      healthStatuses.browser = {
        healthy: serverHealth.healthy,
        message: serverHealth.message || 'Browser ready',
        action: serverHealth.action
      };
      
      // 2. Check extension health (tab status)
      try {
        const tabHealth = await this.tabHealthCheck.getHealthStatus();
        healthStatuses.extension = {
          healthy: tabHealth.healthy,
          message: tabHealth.message || 'Extension active',
          action: tabHealth.action
        };
      } catch (err) {
        healthStatuses.extension = {
          healthy: false,
          message: 'Extension check failed',
          action: 'Check permissions'
        };
      }
      
      // 3. Check addon health (content script)
      healthStatuses.addon = await this.checkAddonHealth();
      
      // Update UI for all layers
      this.updateAllHealthStatuses(healthStatuses);
      
    } catch (error) {
      console.error('Health check error:', error);
      this.updateAllHealthStatuses({
        browser: { healthy: false, message: 'Check failed' },
        extension: { healthy: false, message: 'Check failed' },
        addon: { healthy: false, message: 'Check failed' }
      });
    }
  }
  
  async checkServerHealth() {
    try {
      const response = await fetch('http://localhost:8080/health');
      if (response.ok) {
        const health = await response.json();
        return health;
      }
      return { healthy: false, message: 'Server offline', action: 'Start server at localhost:8080' };
    } catch {
      return { healthy: false, message: 'Server offline', action: 'Start server at localhost:8080' };
    }
  }
  
  async checkAddonHealth() {
    try {
      // Check if content script is injected in ChatGPT tab
      const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
      if (tabs.length > 0) {
        // Try to ping the content script
        try {
          const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'ping' });
          if (response && response.pong) {
            return { healthy: true, message: 'Addon active' };
          }
        } catch {
          return { healthy: false, message: 'Addon not responding', action: 'Reload ChatGPT tab' };
        }
      }
      return { healthy: false, message: 'No ChatGPT tab', action: 'Open ChatGPT' };
    } catch (error) {
      return { healthy: false, message: 'Addon check failed', action: 'Check permissions' };
    }
  }
  
  updateAllHealthStatuses(statuses) {
    // Update each layer's status dot
    this.updateLayerStatus(this.browserDot, statuses.browser);
    this.updateLayerStatus(this.extensionDot, statuses.extension);
    this.updateLayerStatus(this.addonDot, statuses.addon);
    
    // Show action buttons if any layer is unhealthy
    const hasIssues = !statuses.browser.healthy || !statuses.extension.healthy || !statuses.addon.healthy;
    if (hasIssues && this.healthActions) {
      this.healthActions.classList.remove('hidden');
    } else if (this.healthActions) {
      this.healthActions.classList.add('hidden');
    }
    
    // Log status for bulk generation monitoring
    console.log('Health Status Update:', {
      browser: statuses.browser.healthy ? '✅' : '❌',
      extension: statuses.extension.healthy ? '✅' : '❌',
      addon: statuses.addon.healthy ? '✅' : '❌'
    });
  }
  
  updateLayerStatus(dot, status) {
    if (!dot) return;
    
    dot.classList.remove('active', 'inactive', 'warning');
    
    if (status.healthy) {
      dot.classList.add('active');
      dot.title = status.message || 'Healthy';
    } else {
      dot.classList.add('inactive');
      dot.title = `${status.message || 'Unhealthy'}${status.action ? ' - ' + status.action : ''}`;
    }
  }
  
  async handleCreateChatGPTTab() {
    try {
      const tab = await this.tabHealthCheck.ensureChatGPTTab();
      console.log(`Created ChatGPT tab (ID: ${tab.id})`);
      // Re-check health after creating tab
      setTimeout(() => this.checkHealth(), 1000);
    } catch (error) {
      console.error(`Failed to create ChatGPT tab: ${error.message}`);
    }
  }
  
  async launchBrowser() {
    try {
      // Open new browser window or tab
      const tab = await chrome.tabs.create({ 
        url: 'https://chatgpt.com',
        active: true 
      });
      console.log('Launched browser with ChatGPT');
      setTimeout(() => this.checkHealth(), 2000);
    } catch (error) {
      console.error('Failed to launch browser:', error);
    }
  }
  
  async openChatGPT() {
    try {
      // Find existing ChatGPT tab or create new one
      const tabs = await chrome.tabs.query({ url: 'https://chatgpt.com/*' });
      if (tabs.length > 0) {
        await chrome.tabs.update(tabs[0].id, { active: true });
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      } else {
        await chrome.tabs.create({ 
          url: 'https://chatgpt.com',
          active: true 
        });
      }
      console.log('Opened ChatGPT');
      setTimeout(() => this.checkHealth(), 2000);
    } catch (error) {
      console.error('Failed to open ChatGPT:', error);
    }
  }
}

// Initialize health check UI
new HealthCheckUI();