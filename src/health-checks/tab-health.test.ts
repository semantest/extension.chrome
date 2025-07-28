/**
 * Unit Tests for Tab Health Check
 * Tests for ChatGPT tab management and health status
 */

import { TabHealthCheck } from './tab-health';

// Mock chrome.tabs API
const mockChrome = {
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    sendMessage: jest.fn()
  },
  runtime: {
    lastError: null as any
  }
};

// Replace global chrome with mock
(global as any).chrome = mockChrome;

describe('TabHealthCheck', () => {
  let tabHealthCheck: TabHealthCheck;

  beforeEach(() => {
    tabHealthCheck = new TabHealthCheck();
    jest.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  describe('hasChatGPTTab', () => {
    test('should return true when ChatGPT tab exists', async () => {
      const mockTabs = [{ id: 1, url: 'https://chat.openai.com/chat' }];
      mockChrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await tabHealthCheck.hasChatGPTTab();

      expect(result).toBe(true);
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: '*://chat.openai.com/*'
      });
    });

    test('should return false when no ChatGPT tab exists', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await tabHealthCheck.hasChatGPTTab();

      expect(result).toBe(false);
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: '*://chat.openai.com/*'
      });
    });

    test('should return false when query fails', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const result = await tabHealthCheck.hasChatGPTTab();

      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('Failed to query tabs:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('getChatGPTTab', () => {
    test('should return first ChatGPT tab when exists', async () => {
      const mockTabs = [
        { id: 1, url: 'https://chat.openai.com/chat' },
        { id: 2, url: 'https://chat.openai.com/another' }
      ];
      mockChrome.tabs.query.mockResolvedValue(mockTabs);

      const result = await tabHealthCheck.getChatGPTTab();

      expect(result).toEqual(mockTabs[0]);
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: '*://chat.openai.com/*'
      });
    });

    test('should return null when no ChatGPT tab exists', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await tabHealthCheck.getChatGPTTab();

      expect(result).toBeNull();
    });

    test('should return null when query fails', async () => {
      mockChrome.tabs.query.mockRejectedValue(new Error('Query failed'));

      const result = await tabHealthCheck.getChatGPTTab();

      expect(result).toBeNull();
    });
  });

  describe('ensureChatGPTTab', () => {
    test('should return existing tab and make it active', async () => {
      const existingTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([existingTab]);
      mockChrome.tabs.update.mockResolvedValue(existingTab);

      const result = await tabHealthCheck.ensureChatGPTTab();

      expect(result).toEqual(existingTab);
      expect(mockChrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
      expect(mockChrome.tabs.create).not.toHaveBeenCalled();
    });

    test('should create new tab when none exists', async () => {
      const newTab = { id: 2, url: 'https://chat.openai.com' };
      mockChrome.tabs.query.mockResolvedValue([]);
      mockChrome.tabs.create.mockResolvedValue(newTab);

      const result = await tabHealthCheck.ensureChatGPTTab();

      expect(result).toEqual(newTab);
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://chat.openai.com',
        active: true
      });
      expect(mockChrome.tabs.update).not.toHaveBeenCalled();
    });
  });

  describe('getHealthStatus', () => {
    test('should return healthy status when ChatGPT tab exists', async () => {
      const mockTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      
      // Mock successful addon health check
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({
          component: 'addon',
          healthy: true,
          message: 'Session active'
        });
      });

      const result = await tabHealthCheck.getHealthStatus();

      expect(result).toEqual({
        component: 'extension',
        healthy: true,
        message: 'ChatGPT tab found (ID: 1)',
        action: undefined,
        childHealth: {
          component: 'addon',
          healthy: true,
          message: 'Session active'
        }
      });
    });

    test('should return unhealthy status when no ChatGPT tab exists', async () => {
      mockChrome.tabs.query.mockResolvedValue([]);

      const result = await tabHealthCheck.getHealthStatus();

      expect(result).toEqual({
        component: 'extension',
        healthy: false,
        message: 'No ChatGPT tab found',
        action: 'Will create ChatGPT tab when needed'
      });
    });

    test('should handle addon health check failure', async () => {
      const mockTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      
      // Mock failed addon health check
      mockChrome.runtime.lastError = { message: 'Could not establish connection' };
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(undefined);
      });

      const result = await tabHealthCheck.getHealthStatus();

      expect(result.childHealth).toEqual({
        component: 'addon',
        healthy: false,
        message: 'Could not establish connection',
        action: 'Reload the ChatGPT page'
      });
    });

    test('should handle addon health check exception', async () => {
      const mockTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      
      // Mock addon health check throwing error
      mockChrome.tabs.sendMessage.mockImplementation(() => {
        throw new Error('sendMessage failed');
      });

      const result = await tabHealthCheck.getHealthStatus();

      expect(result.childHealth).toEqual({
        component: 'addon',
        healthy: false,
        message: 'Failed to check addon health',
        action: 'Ensure content script is loaded'
      });
    });
  });

  describe('checkAddonHealth (private)', () => {
    test('should return healthy status from addon', async () => {
      const mockTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      
      const addonResponse = {
        component: 'addon',
        healthy: true,
        message: 'Session active',
        childHealth: {
          component: 'server',
          healthy: true,
          message: 'Connected'
        }
      };
      
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        expect(tabId).toBe(1);
        expect(message).toEqual({ type: 'CHECK_SESSION' });
        callback(addonResponse);
      });

      const result = await tabHealthCheck.getHealthStatus();

      expect(result.childHealth).toEqual(addonResponse);
    });

    test('should handle runtime.lastError', async () => {
      const mockTab = { id: 1, url: 'https://chat.openai.com/chat' };
      mockChrome.tabs.query.mockResolvedValue([mockTab]);
      
      mockChrome.runtime.lastError = { message: 'Tab not found' };
      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback(undefined);
      });

      const result = await tabHealthCheck.getHealthStatus();

      expect(result.childHealth).toEqual({
        component: 'addon',
        healthy: false,
        message: 'Tab not found',
        action: 'Reload the ChatGPT page'
      });
    });
  });
});