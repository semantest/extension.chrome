/**
 * Automated Tests for Consent Popup 4 Safety Checks
 * Tests the enhanced safety mechanism in service-worker.js
 */

describe('Consent Popup Safety Checks - v1.0.1', () => {
  let mockChrome;
  let serviceWorker;
  let mockTimers;

  beforeEach(() => {
    // Enable fake timers for testing intervals
    jest.useFakeTimers();
    
    // Mock Chrome APIs
    mockChrome = {
      runtime: {
        onInstalled: {
          addListener: jest.fn()
        },
        onStartup: {
          addListener: jest.fn()
        },
        onMessage: {
          addListener: jest.fn()
        }
      },
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(true)
        }
      },
      tabs: {
        query: jest.fn().mockResolvedValue([]),
        sendMessage: jest.fn().mockResolvedValue(true),
        create: jest.fn()
      },
      notifications: {
        create: jest.fn((id, options, callback) => {
          if (callback) callback(id);
        }),
        onButtonClicked: {
          addListener: jest.fn()
        }
      }
    };

    global.chrome = mockChrome;
    
    // Clear all module cache to get fresh instance
    jest.resetModules();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  describe('Safety Check #1: Install/Update Handler', () => {
    test('triggers consent flow on fresh install', async () => {
      // Get the onInstalled callback
      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate fresh install
      await onInstalledCallback({ reason: 'install' });

      // Verify telemetryConsentPending is set
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryConsentPending: true
        })
      );
    });

    test('triggers consent on update from pre-consent version', async () => {
      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate update from v1.0.0 (pre-consent)
      await onInstalledCallback({ 
        reason: 'update',
        previousVersion: '1.0.0'
      });

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryConsentPending: true
        })
      );
    });

    test('checks for existing consent before showing', async () => {
      // Mock existing consent
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsent: true,
        telemetryConsentPending: false
      });

      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });

      // Should NOT try to show consent again
      expect(mockChrome.notifications.create).not.toHaveBeenCalled();
      expect(mockChrome.tabs.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('Safety Check #2: Extension Startup', () => {
    test('checks for pending consent on startup', async () => {
      // Mock pending consent from previous session
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });

      require('../../src/background/service-worker.js');
      const onStartupCallback = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      
      await onStartupCallback();

      // Should check storage for pending consent
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith([
        'telemetryConsent',
        'telemetryConsentPending'
      ]);
    });

    test('restarts consent process if still pending', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });

      const module = require('../../src/background/service-worker.js');
      const onStartupCallback = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      
      await onStartupCallback();

      // Should trigger ensureConsentShown
      // Advance timer to trigger first retry
      jest.advanceTimersByTime(30000);

      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2); // Initial + retry
    });

    test('does nothing if consent already decided', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: false,
        telemetryConsent: false
      });

      require('../../src/background/service-worker.js');
      const onStartupCallback = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      
      await onStartupCallback();

      // Should not start retry mechanism
      jest.advanceTimersByTime(60000);
      
      // Only the initial check
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('Safety Check #3: Content Script Fallback', () => {
    test('attempts content script when notification fails', async () => {
      // Mock notification failure
      mockChrome.notifications.create.mockImplementation((id, options, callback) => {
        if (callback) callback(null); // Null indicates failure
      });

      // Mock ChatGPT tab available
      mockChrome.tabs.query.mockResolvedValue([
        { id: 123, url: 'https://chatgpt.com/chat' }
      ]);

      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });

      // Should fallback to content script
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        123,
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' }
      );
    });

    test('handles multiple ChatGPT tabs correctly', async () => {
      mockChrome.notifications.create.mockImplementation((id, options, callback) => {
        if (callback) callback(null);
      });

      // Multiple tabs
      mockChrome.tabs.query.mockResolvedValue([
        { id: 1, url: 'https://chatgpt.com/chat1' },
        { id: 2, url: 'https://chat.openai.com/chat' },
        { id: 3, url: 'https://chatgpt.com/chat2' }
      ]);

      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });

      // Should send to first tab only
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledTimes(1);
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        1,
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' }
      );
    });

    test('gracefully handles no ChatGPT tabs', async () => {
      mockChrome.notifications.create.mockImplementation((id, options, callback) => {
        if (callback) callback(null);
      });
      
      mockChrome.tabs.query.mockResolvedValue([]);

      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Should not throw
      await expect(onInstalledCallback({ reason: 'install' })).resolves.not.toThrow();
    });
  });

  describe('Safety Check #4: 30-Second Retry Loop', () => {
    test('retries every 30 seconds when consent pending', async () => {
      // Always return pending state
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });

      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      // Start retry mechanism
      await worker.ensureConsentShown();

      // Initial check
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(1);

      // First retry at 30s
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2);

      // Second retry at 60s
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(3);

      // Third retry at 90s
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(4);
    });

    test('stops retrying after consent decision', async () => {
      // First call returns pending, second returns decided
      mockChrome.storage.sync.get
        .mockResolvedValueOnce({
          telemetryConsentPending: true,
          telemetryConsent: undefined
        })
        .mockResolvedValueOnce({
          telemetryConsentPending: false,
          telemetryConsent: true
        });

      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();

      // First check
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(1);

      // First retry finds consent decided
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2);

      // No more retries
      jest.advanceTimersByTime(60000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2); // No increase
    });

    test('stops retrying after 5 minutes', async () => {
      // Always pending
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });

      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();

      // Advance to 4:30 (9 retries)
      jest.advanceTimersByTime(270000);
      const callsBefore5Min = mockChrome.storage.sync.get.mock.calls.length;

      // Advance past 5 minutes
      jest.advanceTimersByTime(60000); // Now at 5:30
      const callsAfter5Min = mockChrome.storage.sync.get.mock.calls.length;

      // Should stop after 5 minutes
      expect(callsAfter5Min).toBe(callsBefore5Min);
    });

    test('attempts content script fallback during retry', async () => {
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });

      // ChatGPT tab becomes available during retry
      mockChrome.tabs.query
        .mockResolvedValueOnce([]) // No tabs initially
        .mockResolvedValueOnce([{ id: 456, url: 'https://chatgpt.com' }]); // Tab appears

      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();

      // Advance to first retry
      jest.advanceTimersByTime(30000);

      // Should try content script when tab available
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(
        456,
        { action: 'SHOW_TELEMETRY_CONSENT_MODAL' }
      );
    });
  });

  describe('Integration Scenarios', () => {
    test('complete flow: install → pending → retry → user consent', async () => {
      // Setup: pending initially, consent given on 3rd check
      mockChrome.storage.sync.get
        .mockResolvedValueOnce({}) // Fresh install
        .mockResolvedValueOnce({ telemetryConsentPending: true }) // First retry
        .mockResolvedValueOnce({ telemetryConsentPending: true }) // Second retry
        .mockResolvedValueOnce({ 
          telemetryConsentPending: false,
          telemetryConsent: true 
        }); // User consented

      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Install
      await onInstalledCallback({ reason: 'install' });
      
      // Set pending
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ telemetryConsentPending: true })
      );

      // Advance through retries
      jest.advanceTimersByTime(30000); // First retry
      jest.advanceTimersByTime(30000); // Second retry
      jest.advanceTimersByTime(30000); // Third retry - finds consent

      // Verify stopped checking after consent
      const checkCount = mockChrome.storage.sync.get.mock.calls.length;
      jest.advanceTimersByTime(60000); // Advance more
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(checkCount); // No new calls
    });

    test('handles rapid install/uninstall/reinstall', async () => {
      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // First install
      await onInstalledCallback({ reason: 'install' });
      
      // Simulate uninstall by clearing timers
      jest.clearAllTimers();
      
      // Reinstall
      await onInstalledCallback({ reason: 'install' });
      
      // Should handle gracefully
      expect(mockChrome.storage.sync.set).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    test('handles storage errors gracefully', async () => {
      mockChrome.storage.sync.get.mockRejectedValue(new Error('Storage error'));
      
      require('../../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Should not throw
      await expect(onInstalledCallback({ reason: 'install' })).resolves.not.toThrow();
    });

    test('handles tab messaging errors', async () => {
      mockChrome.tabs.sendMessage.mockRejectedValue(new Error('Tab closed'));
      mockChrome.tabs.query.mockResolvedValue([{ id: 789 }]);
      
      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      // Should not throw
      await expect(worker.ensureConsentShown()).resolves.not.toThrow();
    });
  });

  describe('Performance Tests', () => {
    test('clears intervals properly to prevent memory leaks', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: false,
        telemetryConsent: true
      });

      require('../../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();
      
      // Should clear interval immediately when consent found
      expect(clearIntervalSpy).toHaveBeenCalled();
    });
  });
});