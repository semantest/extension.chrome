/**
 * Popup Script for Semantest Extension
 * Displays message logs and connection status
 */

class PopupInterface {
  constructor() {
    this.port = null;
    this.messages = [];
    this.filters = {
      type: '',
      direction: ''
    };
    
    this.init();
  }

  async init() {
    // Connect to background script
    this.port = chrome.runtime.connect({ name: 'popup' });
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Load initial data
    await this.loadInitialData();
    
    // Set up port message listener
    this.port.onMessage.addListener((message) => {
      if (message.type === 'message-update') {
        this.handleMessageUpdate(message.event, message.data);
      }
    });
  }

  setupEventListeners() {
    // Filter controls
    document.getElementById('filter-type').addEventListener('change', (e) => {
      this.filters.type = e.target.value;
      this.renderMessages();
    });
    
    document.getElementById('filter-direction').addEventListener('change', (e) => {
      this.filters.direction = e.target.value;
      this.renderMessages();
    });
    
    // Clear button
    document.getElementById('clear-messages').addEventListener('click', () => {
      this.clearMessages();
    });
    
    // Reconnect button
    document.getElementById('reconnect-ws').addEventListener('click', () => {
      this.reconnectWebSocket();
    });
    
    // Settings button
    document.getElementById('open-settings').addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }

  async loadInitialData() {
    // Get WebSocket status
    const wsStatus = await chrome.runtime.sendMessage({ action: 'WEBSOCKET_STATUS' });
    this.updateConnectionStatus(wsStatus);
    
    // Get messages
    const response = await chrome.runtime.sendMessage({
      action: 'GET_MESSAGES',
      filter: {},
      limit: 100
    });
    
    if (response.success && response.messages) {
      this.messages = response.messages;
      this.renderMessages();
    }
    
    // Get active addon
    const addonResponse = await chrome.runtime.sendMessage({ action: 'GET_ACTIVE_ADDON' });
    if (addonResponse.success && addonResponse.addon) {
      this.updateAddonInfo(addonResponse.addon);
    }
    
    // Get stats
    this.updateStats();
  }

  handleMessageUpdate(event, data) {
    switch (event) {
      case 'message-added':
        this.messages.push(data);
        if (this.messages.length > 100) {
          this.messages.shift(); // Keep only last 100
        }
        this.renderMessages();
        this.updateStats();
        break;
        
      case 'messages-cleared':
        this.messages = [];
        this.renderMessages();
        this.updateStats();
        break;
        
      case 'messages-loaded':
        this.messages = data;
        this.renderMessages();
        this.updateStats();
        break;
    }
  }

  renderMessages() {
    const container = document.getElementById('messages-container');
    
    // Filter messages
    let filtered = this.messages;
    
    if (this.filters.type) {
      filtered = filtered.filter(msg => msg.type.includes(this.filters.type));
    }
    
    if (this.filters.direction) {
      filtered = filtered.filter(msg => msg.direction === this.filters.direction);
    }
    
    // Sort by timestamp (newest first)
    filtered.sort((a, b) => b.timestamp - a.timestamp);
    
    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <p>No messages match filters</p>
          <p class="empty-state-hint">Try adjusting your filters</p>
        </div>
      `;
      return;
    }
    
    // Render messages
    container.innerHTML = filtered.map(msg => this.renderMessage(msg)).join('');
  }

  renderMessage(message) {
    const time = new Date(message.timestamp).toLocaleTimeString();
    const payload = typeof message.payload === 'string' 
      ? message.payload 
      : JSON.stringify(message.payload, null, 2);
    
    return `
      <div class="message-item">
        <div class="message-header">
          <span class="message-type">${this.escapeHtml(message.type)}</span>
          <span class="message-direction ${message.direction}">${message.direction}</span>
          <span class="message-time">${time}</span>
        </div>
        <div class="message-payload">${this.escapeHtml(payload)}</div>
      </div>
    `;
  }

  updateStats() {
    const stats = {
      total: this.messages.length,
      incoming: this.messages.filter(m => m.direction === 'incoming').length,
      outgoing: this.messages.filter(m => m.direction === 'outgoing').length
    };
    
    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-incoming').textContent = stats.incoming;
    document.getElementById('stat-outgoing').textContent = stats.outgoing;
  }

  updateConnectionStatus(status) {
    const indicator = document.getElementById('ws-status');
    const text = document.getElementById('ws-status-text');
    
    if (status.connected) {
      indicator.classList.add('connected');
      text.textContent = 'Connected';
    } else {
      indicator.classList.remove('connected');
      text.textContent = 'Disconnected';
    }
  }

  updateAddonInfo(addon) {
    document.getElementById('addon-name').textContent = addon.name || addon.addon_id || 'None';
  }

  async clearMessages() {
    await chrome.runtime.sendMessage({ action: 'CLEAR_MESSAGES' });
    this.messages = [];
    this.renderMessages();
    this.updateStats();
  }

  async reconnectWebSocket() {
    await chrome.runtime.sendMessage({ action: 'WEBSOCKET_CONNECT' });
    
    // Check status after a short delay
    setTimeout(async () => {
      const status = await chrome.runtime.sendMessage({ action: 'WEBSOCKET_STATUS' });
      this.updateConnectionStatus(status);
    }, 1000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  updateAddonInfo(addonName) {
    const addonNameElement = document.getElementById('addon-name');
    if (addonNameElement) {
      addonNameElement.textContent = addonName || 'None';
    }
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupInterface();
});