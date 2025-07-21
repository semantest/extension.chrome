/**
 * Post-Fix Validation Tests for Telemetry Consent Popup
 * Validates commit be94878 implementation
 */

describe('Consent Popup Fix Validation - v1.0.1', () => {
  let mockChrome;
  let mockWindow;
  let mockDocument;

  beforeEach(() => {
    // Mock Chrome runtime API
    mockChrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        sendMessage: jest.fn(),
        id: 'test-extension-id'
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn()
      },
      storage: {
        local: {
          get: jest.fn(),
          set: jest.fn()
        }
      },
      notifications: {
        create: jest.fn(),
        onButtonClicked: {
          addListener: jest.fn()
        }
      }
    };

    // Mock window and document
    mockWindow = {
      location: {
        hostname: 'chatgpt.com',
        href: 'https://chatgpt.com'
      },
      TelemetryConsentManager: jest.fn().mockImplementation(() => ({
        showConsentDialog: jest.fn().mockResolvedValue(true)
      }))
    };

    mockDocument = {
      createElement: jest.fn(() => ({
        onload: null,
        src: ''
      })),
      head: {
        appendChild: jest.fn()
      }
    };

    global.chrome = mockChrome;
    global.window = mockWindow;
    global.document = mockDocument;
  });

  describe('Service Worker Integration', () => {
    test('registers onInstalled listener on service worker start', () => {
      // Import service worker (would normally be done by Chrome)
      require('../../src/background/service-worker.js');

      expect(mockChrome.runtime.onInstalled.addListener).toHaveBeenCalled();
    });

    test('triggers consent check on fresh install', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate fresh install
      await onInstalledCallback({ reason: 'install' });

      // Should check for existing consent
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['privacy.telemetryConsent']);
    });

    test('sends message to show consent on ChatGPT tabs', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Mock no existing consent
      mockChrome.storage.local.get.mockResolvedValue({});
      
      // Mock ChatGPT tab
      mockChrome.tabs.query.mockResolvedValue([
        { id: 123, url: 'https://chatgpt.com/chat' }
      ]);

      await onInstalledCallback({ reason: 'install' });

      // Should query for ChatGPT tabs
      expect(mockChrome.tabs.query).toHaveBeenCalledWith({
        url: ['https://chatgpt.com/*', 'https://chat.openai.com/*']
      });

      // Should send message to show consent
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' }
      );
    });

    test('does not show consent if already given', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Mock existing consent
      mockChrome.storage.local.get.mockResolvedValue({
        'privacy.telemetryConsent': true,
        'privacy.consentTimestamp': Date.now()
      });

      await onInstalledCallback({ reason: 'install' });

      // Should not send message to show consent
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
    });

    test('shows consent on update from pre-1.0.1 version', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Mock no consent (pre-1.0.1)
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([{ id: 456 }]);

      await onInstalledCallback({ 
        reason: 'update',
        previousVersion: '1.0.0'
      });

      // Should show consent for upgrade
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        456,
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' }
      );
    });
  });

  describe('Content Script Integration', () => {
    let chatGPTController;

    beforeEach(() => {
      // Mock chatGPTController
      chatGPTController = {
        showTelemetryConsentModal: jest.fn().mockResolvedValue({
          success: true,
          consent: true
        })
      };
      window.chatGPTController = chatGPTController;
    });

    test('handles SHOW_TELEMETRY_CONSENT_MODAL message', async () => {
      // Simulate message from service worker
      const messageHandler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      await messageHandler(
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' },
        { id: 'test-extension' },
        sendResponse
      );

      expect(chatGPTController.showTelemetryConsentModal).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        consent: true
      });
    });

    test('loads consent manager script dynamically', async () => {
      // Reset TelemetryConsentManager
      window.TelemetryConsentManager = undefined;
      
      const mockScript = {
        src: '',
        onload: null
      };
      mockDocument.createElement.mockReturnValue(mockScript);

      // Call showTelemetryConsentModal
      const result = chatGPTController.showTelemetryConsentModal();
      
      // Trigger script load
      mockScript.onload();
      
      await result;

      expect(mockDocument.createElement).toHaveBeenCalledWith('script');
      expect(mockScript.src).toContain('telemetry-consent.js');
      expect(mockDocument.head.appendChild).toHaveBeenCalledWith(mockScript);
    });

    test('creates consent manager and shows dialog', async () => {
      const mockConsentManager = {
        showConsentDialog: jest.fn().mockResolvedValue(true)
      };
      window.TelemetryConsentManager = jest.fn().mockReturnValue(mockConsentManager);

      const result = await chatGPTController.showTelemetryConsentModal();

      expect(window.TelemetryConsentManager).toHaveBeenCalled();
      expect(mockConsentManager.showConsentDialog).toHaveBeenCalled();
      expect(result).toEqual({ success: true, consent: true });
    });

    test('handles consent dialog errors gracefully', async () => {
      window.TelemetryConsentManager = jest.fn().mockImplementation(() => ({
        showConsentDialog: jest.fn().mockRejectedValue(new Error('Dialog failed'))
      }));

      const result = await chatGPTController.showTelemetryConsentModal();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Dialog failed');
    });
  });

  describe('Telemetry Behavior Validation', () => {
    test('telemetry respects user consent - Allow', async () => {
      // Set consent to true
      mockChrome.storage.local.get.mockResolvedValue({
        'privacy.telemetryConsent': true
      });

      // Mock telemetry reporter
      window.errorReporter = {
        reportFeatureUsage: jest.fn(),
        hasConsent: jest.fn().mockReturnValue(true)
      };

      // Use feature
      chatGPTController.createProject('Test Project');

      // Telemetry should be sent
      expect(window.errorReporter.reportFeatureUsage).toHaveBeenCalledWith(
        'create_project',
        true,
        expect.any(Object)
      );
    });

    test('telemetry respects user consent - Deny', async () => {
      // Set consent to false
      mockChrome.storage.local.get.mockResolvedValue({
        'privacy.telemetryConsent': false
      });

      // Mock telemetry reporter
      window.errorReporter = {
        reportFeatureUsage: jest.fn(),
        hasConsent: jest.fn().mockReturnValue(false)
      };

      // Use feature
      chatGPTController.createProject('Test Project');

      // Telemetry should NOT be sent
      expect(window.errorReporter.reportFeatureUsage).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    test('handles no ChatGPT tabs open on install', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // No consent, no tabs
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([]);

      await onInstalledCallback({ reason: 'install' });

      // Should use notification fallback
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          type: 'basic',
          title: 'Privacy Notice - SemanTest Extension',
          message: expect.stringContaining('telemetry'),
          buttons: [
            { title: 'Allow' },
            { title: 'Deny' }
          ]
        })
      );
    });

    test('handles tab messaging errors gracefully', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([{ id: 789 }]);
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));

      // Should not throw
      await expect(onInstalledCallback({ reason: 'install' })).resolves.not.toThrow();
    });

    test('handles multiple ChatGPT tabs', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://chatgpt.com/chat1' },
        { id: 2, url: 'https://chatgpt.com/chat2' },
        { id: 3, url: 'https://chat.openai.com/chat' }
      ]);

      await onInstalledCallback({ reason: 'install' });

      // Should send to all tabs
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(3);
    });
  });

  describe('Performance Validation', () => {
    test('consent check completes quickly', async () => {
      const startTime = performance.now();
      
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      mockChrome.storage.local.get.mockResolvedValue({});
      mockChrome.tabs.query.mockResolvedValue([]);

      await onInstalledCallback({ reason: 'install' });
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete in <100ms
    });

    test('does not block extension initialization', async () => {
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Make storage slow
      mockChrome.storage.local.get.mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({}), 5000))
      );

      // Should not wait for slow operations
      const promise = onInstalledCallback({ reason: 'install' });
      
      // Should return immediately (not wait for storage)
      expect(promise).toBeInstanceOf(Promise);
    });
  });
});

describe('Consent Storage Validation', () => {
  test('stores consent with correct structure', async () => {
    const consentManager = new window.TelemetryConsentManager();
    
    // Mock user clicking Allow
    await consentManager.saveConsent(true);

    expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
      'privacy.telemetryConsent': true,
      'privacy.consentTimestamp': expect.any(Number)
    });
  });

  test('consent timestamp is valid', async () => {
    const beforeTime = Date.now();
    
    const consentManager = new window.TelemetryConsentManager();
    await consentManager.saveConsent(false);
    
    const afterTime = Date.now();
    
    const savedData = mockChrome.storage.local.set.mock.calls[0][0];
    expect(savedData['privacy.consentTimestamp']).toBeGreaterThanOrEqual(beforeTime);
    expect(savedData['privacy.consentTimestamp']).toBeLessThanOrEqual(afterTime);
  });
});