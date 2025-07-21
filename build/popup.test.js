"use strict";
/**
 * Unit Tests for PopupController
 * Tests Chrome extension popup functionality for connection management and status monitoring
 */
// Mock Chrome APIs
const mockChrome = {
    runtime: {
        id: 'test-extension-id',
        sendMessage: jest.fn(),
        onMessage: {
            addListener: jest.fn()
        },
        lastError: null
    },
    tabs: {
        query: jest.fn()
    },
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};
// Mock DOM elements
const mockElements = {
    toggleButton: {
        addEventListener: jest.fn(),
        disabled: false,
        textContent: ''
    },
    statusDot: {
        classList: {
            remove: jest.fn(),
            add: jest.fn()
        }
    },
    statusText: {
        textContent: ''
    },
    serverInput: {
        addEventListener: jest.fn(),
        value: 'ws://localhost:3003/ws'
    },
    extensionIdElement: {
        textContent: ''
    },
    currentTabElement: {
        textContent: ''
    },
    lastMessageElement: {
        textContent: ''
    },
    logPanel: {
        appendChild: jest.fn(),
        removeChild: jest.fn(),
        children: [],
        firstChild: null,
        scrollTop: 0,
        scrollHeight: 100
    }
};
// Setup global mocks
global.chrome = mockChrome;
global.document = {
    getElementById: jest.fn((id) => mockElements[id]),
    createElement: jest.fn(() => ({
        className: '',
        textContent: ''
    })),
    addEventListener: jest.fn()
};
global.setInterval = jest.fn();
global.URL = jest.fn().mockImplementation((url) => {
    const validWs = url.startsWith('ws://') || url.startsWith('wss://');
    if (!validWs)
        throw new Error('Invalid URL');
    return { protocol: url.split(':')[0] + ':' };
});
// Import the class after mocks are set up
let PopupController;
describe('PopupController', () => {
    let controller;
    let consoleSpy;
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset mock element state
        Object.values(mockElements).forEach(element => {
            if ('textContent' in element)
                element.textContent = '';
            if ('disabled' in element)
                element.disabled = false;
            if ('value' in element)
                element.value = 'ws://localhost:3003/ws';
        });
        // Mock successful tab query
        mockChrome.tabs.query.mockResolvedValue([{
                id: 123,
                title: 'Test Tab Title',
                url: 'https://example.com'
            }]);
        // Mock successful storage operations
        mockChrome.storage.local.get.mockResolvedValue({ serverUrl: 'ws://localhost:3003/ws' });
        mockChrome.storage.local.set.mockResolvedValue(undefined);
        // Mock successful message sending
        mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
            if (callback) {
                setTimeout(() => callback({ success: true, status: { connected: false } }), 0);
            }
        });
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        // Dynamically import the PopupController class
        jest.isolateModules(() => {
            const module = require('./popup');
            PopupController = module.PopupController ||
                global.PopupController ||
                eval('PopupController'); // Fallback if module doesn't export properly
        });
    });
    afterEach(() => {
        consoleSpy.mockRestore();
    });
    describe('Initialization', () => {
        test('should initialize DOM elements correctly', () => {
            controller = new PopupController();
            expect(document.getElementById).toHaveBeenCalledWith('toggleButton');
            expect(document.getElementById).toHaveBeenCalledWith('statusDot');
            expect(document.getElementById).toHaveBeenCalledWith('statusText');
            expect(document.getElementById).toHaveBeenCalledWith('serverInput');
            expect(document.getElementById).toHaveBeenCalledWith('extensionId');
            expect(document.getElementById).toHaveBeenCalledWith('currentTab');
            expect(document.getElementById).toHaveBeenCalledWith('lastMessage');
            expect(document.getElementById).toHaveBeenCalledWith('logPanel');
        });
        test('should bind event listeners', () => {
            controller = new PopupController();
            expect(mockElements.toggleButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
            expect(mockElements.serverInput.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
            expect(mockElements.serverInput.addEventListener).toHaveBeenCalledWith('input', expect.any(Function));
        });
        test('should load initial data successfully', async () => {
            controller = new PopupController();
            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(mockChrome.tabs.query).toHaveBeenCalledWith({ active: true, currentWindow: true });
            expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['serverUrl']);
            expect(mockElements.extensionIdElement.textContent).toBe('test-extension-id');
            expect(mockElements.currentTabElement.textContent).toContain('Test Tab Title');
        });
        test('should handle initialization errors gracefully', async () => {
            const error = new Error('Initialization failed');
            mockChrome.tabs.query.mockRejectedValue(error);
            controller = new PopupController();
            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(mockElements.logPanel.appendChild).toHaveBeenCalled();
        });
        test('should start status polling', () => {
            controller = new PopupController();
            expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 2000);
        });
    });
    describe('Connection Management', () => {
        beforeEach(() => {
            controller = new PopupController();
        });
        test('should handle connect action', async () => {
            // Simulate disconnect state
            controller.status = { connected: false, connecting: false };
            const toggleHandler = mockElements.toggleButton.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];
            await toggleHandler();
            expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'connect', serverUrl: 'ws://localhost:3003/ws' }, expect.any(Function));
        });
        test('should handle disconnect action', async () => {
            // Simulate connected state
            controller.status = { connected: true, connecting: false };
            const toggleHandler = mockElements.toggleButton.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];
            await toggleHandler();
            expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'disconnect' }, expect.any(Function));
        });
        test('should ignore clicks while connecting', async () => {
            // Simulate connecting state
            controller.status = { connected: false, connecting: true };
            const toggleHandler = mockElements.toggleButton.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];
            await toggleHandler();
            expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
        });
        test('should handle connection errors', async () => {
            mockChrome.runtime.lastError = { message: 'Connection failed' };
            mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
                if (callback)
                    callback(null);
            });
            controller.status = { connected: false, connecting: false };
            const toggleHandler = mockElements.toggleButton.addEventListener.mock.calls
                .find(call => call[0] === 'click')[1];
            await toggleHandler();
            expect(mockElements.logPanel.appendChild).toHaveBeenCalled();
        });
    });
    describe('Server URL Management', () => {
        beforeEach(() => {
            controller = new PopupController();
        });
        test('should handle server URL changes', () => {
            mockElements.serverInput.value = 'ws://localhost:4000/ws';
            const changeHandler = mockElements.serverInput.addEventListener.mock.calls
                .find(call => call[0] === 'change')[1];
            changeHandler();
            expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
                serverUrl: 'ws://localhost:4000/ws'
            });
            expect(controller.status.serverUrl).toBe('ws://localhost:4000/ws');
        });
        test('should validate WebSocket URLs', () => {
            // Valid WebSocket URLs
            expect(controller.isValidWebSocketUrl('ws://localhost:3003')).toBe(true);
            expect(controller.isValidWebSocketUrl('wss://example.com/ws')).toBe(true);
            // Invalid URLs
            expect(controller.isValidWebSocketUrl('http://example.com')).toBe(false);
            expect(controller.isValidWebSocketUrl('invalid-url')).toBe(false);
            expect(controller.isValidWebSocketUrl('')).toBe(false);
        });
        test('should handle URL validation errors', () => {
            expect(controller.isValidWebSocketUrl('not-a-url')).toBe(false);
        });
    });
    describe('Status Updates', () => {
        beforeEach(() => {
            controller = new PopupController();
        });
        test('should update connection status correctly', () => {
            const newStatus = {
                connected: true,
                connecting: false,
                lastMessage: 'Connected successfully'
            };
            controller.updateStatus(newStatus);
            expect(controller.status.connected).toBe(true);
            expect(controller.status.connecting).toBe(false);
            expect(mockElements.lastMessageElement.textContent).toBe('Connected successfully');
        });
        test('should update connection indicator for connected state', () => {
            controller.status = { connected: true, connecting: false };
            controller.updateConnectionIndicator();
            expect(mockElements.statusDot.classList.remove).toHaveBeenCalledWith('connected', 'disconnected', 'connecting');
            expect(mockElements.statusDot.classList.add).toHaveBeenCalledWith('connected');
            expect(mockElements.statusText.textContent).toBe('Connected');
        });
        test('should update connection indicator for connecting state', () => {
            controller.status = { connected: false, connecting: true };
            controller.updateConnectionIndicator();
            expect(mockElements.statusDot.classList.add).toHaveBeenCalledWith('connecting');
            expect(mockElements.statusText.textContent).toBe('Connecting...');
        });
        test('should update connection indicator for disconnected state', () => {
            controller.status = { connected: false, connecting: false };
            controller.updateConnectionIndicator();
            expect(mockElements.statusDot.classList.add).toHaveBeenCalledWith('disconnected');
            expect(mockElements.statusText.textContent).toBe('Disconnected');
        });
        test('should update toggle button for different states', () => {
            // Test connecting state
            controller.status = { connecting: true };
            controller.updateToggleButton();
            expect(mockElements.toggleButton.disabled).toBe(true);
            expect(mockElements.toggleButton.textContent).toBe('Connecting...');
            // Test connected state
            controller.status = { connecting: false, connected: true };
            controller.updateToggleButton();
            expect(mockElements.toggleButton.disabled).toBe(false);
            expect(mockElements.toggleButton.textContent).toBe('Disconnect');
            // Test disconnected state
            controller.status = { connecting: false, connected: false };
            controller.updateToggleButton();
            expect(mockElements.toggleButton.disabled).toBe(false);
            expect(mockElements.toggleButton.textContent).toBe('Connect');
        });
    });
    describe('Background Communication', () => {
        beforeEach(() => {
            controller = new PopupController();
        });
        test('should send messages to background script', async () => {
            const message = { action: 'test' };
            const result = await controller.sendToBackground(message);
            expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(message, expect.any(Function));
            expect(result).toEqual({ success: true, status: { connected: false } });
        });
        test('should handle background communication errors', async () => {
            const error = { message: 'Background script error' };
            mockChrome.runtime.lastError = error;
            mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
                if (callback)
                    callback(null);
            });
            const message = { action: 'test' };
            await expect(controller.sendToBackground(message)).rejects.toEqual(error);
        });
        test('should request status from background', () => {
            controller.requestStatusFromBackground();
            expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({ action: 'getStatus' }, expect.any(Function));
        });
        test('should handle status request errors', () => {
            mockChrome.runtime.sendMessage.mockImplementation((message, callback) => {
                if (callback) {
                    setTimeout(() => callback(null), 0);
                }
            });
            mockChrome.runtime.lastError = { message: 'Status request failed' };
            controller.requestStatusFromBackground();
            // Wait for async error handling
            setTimeout(() => {
                expect(mockElements.logPanel.appendChild).toHaveBeenCalled();
            }, 10);
        });
    });
    describe('Logging', () => {
        beforeEach(() => {
            controller = new PopupController();
            mockElements.logPanel.children = [];
        });
        test('should add log entries with timestamp', () => {
            const mockLogEntry = { className: '', textContent: '' };
            global.document.createElement = jest.fn(() => mockLogEntry);
            controller.addLog('info', 'Test message');
            expect(document.createElement).toHaveBeenCalledWith('div');
            expect(mockLogEntry.className).toBe('log-entry info');
            expect(mockLogEntry.textContent).toMatch(/^\[\d{1,2}:\d{2}:\d{2}.*\] Test message$/);
            expect(mockElements.logPanel.appendChild).toHaveBeenCalledWith(mockLogEntry);
        });
        test('should limit log entries to 20', () => {
            // Simulate 25 existing log entries
            mockElements.logPanel.children = new Array(25).fill({});
            mockElements.logPanel.firstChild = {};
            controller.addLog('info', 'Test message');
            expect(mockElements.logPanel.removeChild).toHaveBeenCalledTimes(6); // Remove 6 to get to 20
        });
        test('should auto-scroll log panel', () => {
            controller.addLog('info', 'Test message');
            expect(mockElements.logPanel.scrollTop).toBe(mockElements.logPanel.scrollHeight);
        });
        test('should handle different log types', () => {
            const mockLogEntry = { className: '', textContent: '' };
            global.document.createElement = jest.fn(() => mockLogEntry);
            // Test different log types
            controller.addLog('error', 'Error message');
            expect(mockLogEntry.className).toBe('log-entry error');
            controller.addLog('success', 'Success message');
            expect(mockLogEntry.className).toBe('log-entry success');
        });
    });
    describe('Error Handling', () => {
        beforeEach(() => {
            controller = new PopupController();
        });
        test('should handle missing DOM elements gracefully', () => {
            global.document.getElementById = jest.fn(() => null);
            expect(() => new PopupController()).not.toThrow();
        });
        test('should handle Chrome API unavailability', async () => {
            global.chrome = undefined;
            expect(() => new PopupController()).not.toThrow();
        });
        test('should handle storage errors', async () => {
            mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
            controller = new PopupController();
            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(mockElements.logPanel.appendChild).toHaveBeenCalled();
        });
        test('should handle tab query errors', async () => {
            mockChrome.tabs.query.mockRejectedValue(new Error('Tab query failed'));
            controller = new PopupController();
            // Wait for async initialization
            await new Promise(resolve => setTimeout(resolve, 10));
            expect(mockElements.logPanel.appendChild).toHaveBeenCalled();
        });
    });
    describe('Message Listeners', () => {
        test('should listen for status updates', () => {
            expect(mockChrome.runtime.onMessage.addListener).toHaveBeenCalled();
        });
        test('should handle status update messages', () => {
            const listener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
            const message = {
                type: 'statusUpdate',
                status: { connected: true, lastMessage: 'Updated' }
            };
            // Mock console.log to verify message handling
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            listener(message, {}, () => { });
            expect(consoleSpy).toHaveBeenCalledWith('Status update received in popup:', message.status);
            consoleSpy.mockRestore();
        });
    });
    describe('DOM Ready Handler', () => {
        test('should initialize controller when DOM is ready', () => {
            const eventListener = global.document.addEventListener;
            expect(eventListener).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function));
        });
    });
});
