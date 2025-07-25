// Web-Buddy Extension Popup Script
// Provides UI for connection management and status monitoring
import { TabHealthCheck } from './health-checks/tab-health';
class PopupController {
    constructor() {
        this.status = {
            connected: false,
            connecting: false,
            serverUrl: 'ws://localhost:3003/ws',
            extensionId: '',
            lastMessage: 'None',
            lastError: ''
        };
        this.healthStatus = null;
        this.tabHealthCheck = new TabHealthCheck();
        this.initializeElements();
        this.bindEvents();
        this.loadInitialData();
        this.startStatusPolling();
        this.startHealthCheckPolling();
    }
    initializeElements() {
        this.toggleButton = document.getElementById('toggleButton');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.serverInput = document.getElementById('serverInput');
        this.extensionIdElement = document.getElementById('extensionId');
        this.currentTabElement = document.getElementById('currentTab');
        this.lastMessageElement = document.getElementById('lastMessage');
        this.logPanel = document.getElementById('logPanel');
        // Health check elements
        this.healthStatusDot = document.getElementById('healthStatusDot');
        this.healthStatusText = document.getElementById('healthStatusText');
    }
    bindEvents() {
        this.toggleButton.addEventListener('click', () => this.handleToggleConnection());
        this.serverInput.addEventListener('change', () => this.handleServerUrlChange());
        this.serverInput.addEventListener('input', () => this.handleServerUrlChange());
    }
    async loadInitialData() {
        try {
            // Get extension ID
            this.status.extensionId = chrome.runtime.id;
            this.extensionIdElement.textContent = this.status.extensionId;
            // Get current tab info
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (tab) {
                this.currentTabElement.textContent = `${tab.title?.substring(0, 30)}... (${tab.id})`;
            }
            // Load saved server URL
            const result = await chrome.storage.local.get(['serverUrl']);
            if (result.serverUrl) {
                this.status.serverUrl = result.serverUrl;
                this.serverInput.value = result.serverUrl;
            }
            // Get initial connection status from background script
            this.requestStatusFromBackground();
        }
        catch (error) {
            this.addLog('error', `Failed to load initial data: ${error}`);
        }
    }
    async handleToggleConnection() {
        if (this.status.connecting) {
            return; // Ignore clicks while connecting
        }
        try {
            if (this.status.connected) {
                await this.sendToBackground({ action: 'disconnect' });
                this.addLog('info', 'Disconnection requested');
            }
            else {
                await this.sendToBackground({
                    action: 'connect',
                    serverUrl: this.serverInput.value
                });
                this.addLog('info', `Connection requested to ${this.serverInput.value}`);
            }
        }
        catch (error) {
            this.addLog('error', `Toggle connection failed: ${error}`);
        }
    }
    handleServerUrlChange() {
        const url = this.serverInput.value.trim();
        this.status.serverUrl = url;
        // Save to storage
        chrome.storage.local.set({ serverUrl: url });
        if (url && this.isValidWebSocketUrl(url)) {
            this.addLog('info', `Server URL updated: ${url}`);
        }
    }
    isValidWebSocketUrl(url) {
        try {
            const urlObj = new URL(url);
            return urlObj.protocol === 'ws:' || urlObj.protocol === 'wss:';
        }
        catch {
            return false;
        }
    }
    async sendToBackground(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, (response) => {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                }
                else {
                    resolve(response);
                }
            });
        });
    }
    requestStatusFromBackground() {
        this.sendToBackground({ action: 'getStatus' })
            .then((response) => {
            if (response && response.status) {
                this.updateStatus(response.status);
            }
        })
            .catch((error) => {
            this.addLog('error', `Failed to get status: ${error}`);
        });
    }
    updateStatus(newStatus) {
        // Update status object
        Object.assign(this.status, newStatus);
        // Update UI elements
        this.updateConnectionIndicator();
        this.updateToggleButton();
        if (newStatus.lastMessage && newStatus.lastMessage !== 'None') {
            this.lastMessageElement.textContent = newStatus.lastMessage;
        }
    }
    updateConnectionIndicator() {
        // Remove all status classes
        this.statusDot.classList.remove('connected', 'disconnected', 'connecting');
        if (this.status.connecting) {
            this.statusDot.classList.add('connecting');
            this.statusText.textContent = 'Connecting...';
        }
        else if (this.status.connected) {
            this.statusDot.classList.add('connected');
            this.statusText.textContent = 'Connected';
        }
        else {
            this.statusDot.classList.add('disconnected');
            this.statusText.textContent = 'Disconnected';
        }
    }
    updateToggleButton() {
        this.toggleButton.disabled = this.status.connecting;
        if (this.status.connecting) {
            this.toggleButton.textContent = 'Connecting...';
        }
        else if (this.status.connected) {
            this.toggleButton.textContent = 'Disconnect';
        }
        else {
            this.toggleButton.textContent = 'Connect';
        }
    }
    addLog(type, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        this.logPanel.appendChild(logEntry);
        // Keep only last 20 log entries
        while (this.logPanel.children.length > 20) {
            this.logPanel.removeChild(this.logPanel.firstChild);
        }
        // Scroll to bottom
        this.logPanel.scrollTop = this.logPanel.scrollHeight;
    }
    startStatusPolling() {
        // Poll status every 2 seconds
        setInterval(() => {
            this.requestStatusFromBackground();
        }, 2000);
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
            // First check server health
            const serverHealthy = await this.checkServerHealth();
            if (!serverHealthy) {
                this.updateHealthStatus({
                    component: 'server',
                    healthy: false,
                    message: 'Server unavailable',
                    action: 'Start the server at localhost:3003'
                });
                return;
            }
            // Then check tab health
            const tabHealth = await this.tabHealthCheck.getHealthStatus();
            this.updateHealthStatus(tabHealth);
        }
        catch (error) {
            this.updateHealthStatus({
                component: 'extension',
                healthy: false,
                message: `Health check failed: ${error}`,
                action: 'Check extension permissions'
            });
        }
    }
    async checkServerHealth() {
        try {
            const response = await fetch('http://localhost:3003/health');
            if (response.ok) {
                const health = await response.json();
                return health.healthy === true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    updateHealthStatus(status) {
        this.healthStatus = status;
        // Update UI
        this.healthStatusDot.classList.remove('active', 'inactive', 'warning');
        if (status.healthy) {
            this.healthStatusDot.classList.add('active');
            this.healthStatusText.textContent = 'All systems healthy';
        }
        else {
            this.healthStatusDot.classList.add('inactive');
            this.healthStatusText.textContent = status.message || 'Health check failed';
        }
        // Log health status changes
        if (!status.healthy) {
            this.addLog('error', `Health: ${status.message} - ${status.action || 'No action available'}`);
        }
        // Handle automatic tab creation if needed
        if (status.component === 'extension' && !status.healthy && status.message?.includes('No ChatGPT tab')) {
            this.handleCreateChatGPTTab();
        }
    }
    async handleCreateChatGPTTab() {
        try {
            const tab = await this.tabHealthCheck.ensureChatGPTTab();
            this.addLog('success', `Created ChatGPT tab (ID: ${tab.id})`);
            // Re-check health after creating tab
            setTimeout(() => this.checkHealth(), 1000);
        }
        catch (error) {
            this.addLog('error', `Failed to create ChatGPT tab: ${error}`);
        }
    }
}
// Listen for status updates from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'statusUpdate') {
        // This will be handled by the PopupController instance
        console.log('Status update received in popup:', message.status);
    }
});
// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupController();
});
