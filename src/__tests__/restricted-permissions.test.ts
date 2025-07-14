/**
 * Tests for restricted domain permissions
 * Verifies the extension works correctly with specific domain permissions
 * instead of <all_urls>
 */

import { isAllowedDomain } from '../background';

describe('Restricted Permissions Security Tests', () => {
  describe('isAllowedDomain', () => {
    const allowedDomains = [
      'https://chat.openai.com',
      'https://chatgpt.com',
      'https://www.google.com',
      'https://google.com',
      'https://images.google.com',
      'https://mail.google.com',
      'https://docs.google.com',
      'https://drive.google.com',
      'https://calendar.google.com',
      'https://meet.google.com',
      'https://google.co.uk',
      'https://google.fr',
      'https://google.de'
    ];

    const disallowedDomains = [
      'https://example.com',
      'https://facebook.com',
      'https://twitter.com',
      'https://github.com',
      'https://stackoverflow.com',
      'https://amazon.com',
      'https://netflix.com',
      'https://youtube.com',
      'https://linkedin.com',
      'https://reddit.com',
      'http://chat.openai.com', // HTTP not allowed
      'http://google.com', // HTTP not allowed
      'file:///local/file.html',
      'chrome://extensions',
      'about:blank',
      'data:text/html,<h1>test</h1>'
    ];

    test('should allow ChatGPT domains', () => {
      expect(isAllowedDomain('https://chat.openai.com')).toBe(true);
      expect(isAllowedDomain('https://chat.openai.com/chat')).toBe(true);
      expect(isAllowedDomain('https://chatgpt.com')).toBe(true);
      expect(isAllowedDomain('https://chatgpt.com/g/123')).toBe(true);
    });

    test('should allow Google domains and subdomains', () => {
      expect(isAllowedDomain('https://google.com')).toBe(true);
      expect(isAllowedDomain('https://www.google.com')).toBe(true);
      expect(isAllowedDomain('https://images.google.com')).toBe(true);
      expect(isAllowedDomain('https://mail.google.com')).toBe(true);
      expect(isAllowedDomain('https://docs.google.com')).toBe(true);
      expect(isAllowedDomain('https://drive.google.com')).toBe(true);
      expect(isAllowedDomain('https://google.co.uk')).toBe(true);
    });

    test('should reject non-allowed domains', () => {
      disallowedDomains.forEach(domain => {
        expect(isAllowedDomain(domain)).toBe(false);
      });
    });

    test('should reject invalid URLs', () => {
      expect(isAllowedDomain(undefined)).toBe(false);
      expect(isAllowedDomain('')).toBe(false);
      expect(isAllowedDomain('not-a-url')).toBe(false);
      expect(isAllowedDomain('javascript:alert(1)')).toBe(false);
    });

    test('should reject HTTP versions of allowed domains', () => {
      expect(isAllowedDomain('http://chat.openai.com')).toBe(false);
      expect(isAllowedDomain('http://google.com')).toBe(false);
      expect(isAllowedDomain('http://chatgpt.com')).toBe(false);
    });
  });

  describe('Message Handler Domain Checks', () => {
    let mockChrome: any;

    beforeEach(() => {
      // Mock Chrome API
      mockChrome = {
        tabs: {
          query: jest.fn(),
          sendMessage: jest.fn()
        },
        runtime: {
          lastError: null,
          id: 'test-extension-id'
        }
      };
      global.chrome = mockChrome;
    });

    test('should reject automation requests on non-allowed domains', async () => {
      // Mock active tab on disallowed domain
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://example.com',
        title: 'Example'
      }]);

      const handler = new AutomationRequestedHandler();
      const message = {
        type: 'automationRequested',
        correlationId: 'test-123',
        payload: { action: 'click', selector: '#button' }
      };

      const mockSendErrorResponse = jest.spyOn(handler, 'sendErrorResponse');
      
      await handler.handle(message);

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        'test-123',
        expect.stringContaining('Extension is not allowed on this domain')
      );
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('should allow automation requests on ChatGPT domains', async () => {
      // Mock active tab on allowed domain
      mockChrome.tabs.query.mockResolvedValue([{
        id: 1,
        url: 'https://chat.openai.com/chat/123',
        title: 'ChatGPT'
      }]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ status: 'success' });
      });

      const handler = new AutomationRequestedHandler();
      const message = {
        type: 'automationRequested',
        correlationId: 'test-456',
        payload: { action: 'click', selector: '#button' }
      };

      const mockSendResponse = jest.spyOn(handler, 'sendResponse');
      
      await handler.handle(message);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        message,
        expect.any(Function)
      );
      expect(mockSendResponse).toHaveBeenCalledWith(
        { status: 'success' },
        'test-456'
      );
    });

    test('should allow automation requests on Google domains', async () => {
      // Mock active tab on Google domain
      mockChrome.tabs.query.mockResolvedValue([{
        id: 2,
        url: 'https://www.google.com/search?q=test',
        title: 'Google Search'
      }]);

      mockChrome.tabs.sendMessage.mockImplementation((tabId, message, callback) => {
        callback({ status: 'success' });
      });

      const handler = new AutomationRequestedHandler();
      const message = {
        type: 'automationRequested',
        correlationId: 'test-789',
        payload: { action: 'search', query: 'test' }
      };

      const mockSendResponse = jest.spyOn(handler, 'sendResponse');
      
      await handler.handle(message);

      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        2,
        message,
        expect.any(Function)
      );
      expect(mockSendResponse).toHaveBeenCalled();
    });
  });

  describe('Content Script Injection', () => {
    test('manifest should only inject on allowed domains', () => {
      const manifest = require('../../manifest.json');
      
      expect(manifest.content_scripts[0].matches).toEqual([
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://*.google.com/*',
        'https://google.com/*'
      ]);
      
      expect(manifest.host_permissions).toEqual([
        'https://chat.openai.com/*',
        'https://chatgpt.com/*',
        'https://*.google.com/*',
        'https://google.com/*'
      ]);
    });

    test('manifest should have CSP configured', () => {
      const manifest = require('../../manifest.json');
      
      expect(manifest.content_security_policy).toBeDefined();
      expect(manifest.content_security_policy.extension_pages).toContain("script-src 'self'");
      expect(manifest.content_security_policy.extension_pages).not.toContain("'unsafe-eval'");
      expect(manifest.content_security_policy.extension_pages).not.toContain("'unsafe-inline'");
    });
  });

  describe('Permission Migration', () => {
    test('should not have <all_urls> permission anywhere', () => {
      const manifest = require('../../manifest.json');
      const manifestString = JSON.stringify(manifest);
      
      expect(manifestString).not.toContain('<all_urls>');
    });

    test('should still have activeTab permission for user-initiated actions', () => {
      const manifest = require('../../manifest.json');
      
      expect(manifest.permissions).toContain('activeTab');
    });

    test('should have all necessary permissions for functionality', () => {
      const manifest = require('../../manifest.json');
      const requiredPermissions = ['activeTab', 'scripting', 'storage', 'downloads'];
      
      requiredPermissions.forEach(permission => {
        expect(manifest.permissions).toContain(permission);
      });
    });
  });
});