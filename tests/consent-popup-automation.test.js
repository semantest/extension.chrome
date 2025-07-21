/**
 * Automated Tests for Consent Popup Core Functionality
 * Tests install behavior, retry logic, and storage flags
 */

describe('Consent Popup Automation Tests', () => {
  let mockChrome;
  let serviceWorker;
  let originalChrome;

  beforeEach(() => {
    // Save original chrome object
    originalChrome = global.chrome;
    
    // Create comprehensive Chrome API mocks
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
        },
        getManifest: jest.fn(() => ({ version: '1.0.1' }))
      },
      storage: {
        sync: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(true),
          clear: jest.fn().mockResolvedValue(true)
        },
        local: {
          get: jest.fn().mockResolvedValue({}),
          set: jest.fn().mockResolvedValue(true)
        }
      },
      tabs: {
        create: jest.fn().mockResolvedValue({ id: 123 }),
        query: jest.fn().mockResolvedValue([]),
        sendMessage: jest.fn().mockResolvedValue({ success: true }),
        get: jest.fn().mockResolvedValue({ id: 123, url: 'https://chatgpt.com' })
      },
      notifications: {
        create: jest.fn((id, options, callback) => {
          const notifId = id || 'consent-notification';
          if (callback) callback(notifId);
          return Promise.resolve(notifId);
        }),
        onButtonClicked: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        },
        clear: jest.fn()
      },
      contextMenus: {
        create: jest.fn(),
        onClicked: {
          addListener: jest.fn()
        }
      },
      commands: {
        onCommand: {
          addListener: jest.fn()
        }
      },
      scripting: {
        executeScript: jest.fn().mockResolvedValue([{ result: true }])
      },
      downloads: {
        download: jest.fn().mockResolvedValue(1),
        onChanged: {
          addListener: jest.fn(),
          removeListener: jest.fn()
        }
      }
    };

    // Set mock as global chrome
    global.chrome = mockChrome;
    
    // Enable fake timers
    jest.useFakeTimers();
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Reset modules to get fresh instance
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original chrome
    global.chrome = originalChrome;
    
    // Clear timers
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Test 1: Consent Popup Appears on Install', () => {
    test('should show consent popup on fresh install', async () => {
      // Load service worker
      require('../src/background/service-worker.js');
      
      // Get the onInstalled callback
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Trigger fresh install
      await onInstalledCallback({ reason: 'install' });
      
      // Verify telemetryConsentPending flag is set
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryConsentPending: true,
          installTime: expect.any(Number)
        })
      );
      
      // Verify ChatGPT tab is created
      expect(mockChrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://chat.openai.com/',
        active: true
      });
      
      // Fast-forward to trigger consent popup (3 second delay)
      jest.advanceTimersByTime(3000);
      
      // Verify notification is created for consent
      expect(mockChrome.notifications.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'basic',
          title: expect.stringContaining('ChatGPT Extension'),
          message: expect.stringContaining('anonymous error reports'),
          buttons: expect.arrayContaining([
            { title: 'No Thanks' },
            { title: 'Allow' }
          ])
        })
      );
    });

    test('should not show consent popup if already decided', async () => {
      // Mock existing consent decision
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsent: true,
        telemetryConsentPending: false
      });
      
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });
      
      // Should check storage first
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['telemetryConsent', 'telemetryConsentPending']);
      
      // Should NOT create notification if consent already decided
      jest.advanceTimersByTime(5000);
      expect(mockChrome.notifications.create).not.toHaveBeenCalled();
    });

    test('should handle notification creation failure with content script fallback', async () => {
      // Mock notification failure
      mockChrome.notifications.create.mockImplementation((options, callback) => {
        if (callback) callback(null); // null indicates failure
        return Promise.resolve(null);
      });
      
      // Mock ChatGPT tab available
      mockChrome.tabs.query.mockResolvedValue([
        { id: 456, url: 'https://chatgpt.com/chat' }
      ]);
      
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });
      
      // Fast-forward to trigger consent attempt
      jest.advanceTimersByTime(3000);
      
      // Should fall back to content script
      expect(mockChrome.tabs.sendMessage).toHaveBeenCalledWith(456, {
        action: 'SHOW_TELEMETRY_CONSENT_MODAL'
      });
    });
  });

  describe('Test 2: Retry Logic Works', () => {
    test('should retry consent popup every 30 seconds', async () => {
      // Always return pending state
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });
      
      require('../src/background/service-worker.js');
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
      
      // Verify retry attempts to show consent
      expect(mockChrome.notifications.create.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    test('should stop retrying after 5 minutes', async () => {
      // Always pending
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });
      
      require('../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();
      
      // Advance to 4:30 (should still be retrying)
      jest.advanceTimersByTime(270000); // 4.5 minutes
      const callsAt4Min = mockChrome.storage.sync.get.mock.calls.length;
      
      // Advance past 5 minutes
      jest.advanceTimersByTime(60000); // Now at 5:30
      const callsAt5Min = mockChrome.storage.sync.get.mock.calls.length;
      
      // Should stop after 5 minutes (no new calls)
      expect(callsAt5Min).toBe(callsAt4Min);
    });

    test('should stop retrying when consent is given', async () => {
      // First call returns pending, subsequent calls return decided
      mockChrome.storage.sync.get
        .mockResolvedValueOnce({
          telemetryConsentPending: true,
          telemetryConsent: undefined
        })
        .mockResolvedValueOnce({
          telemetryConsentPending: true,
          telemetryConsent: undefined
        })
        .mockResolvedValueOnce({
          telemetryConsentPending: false,
          telemetryConsent: true
        });
      
      require('../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      await worker.ensureConsentShown();
      
      // First check
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(1);
      
      // First retry at 30s
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2);
      
      // Second retry at 60s finds consent decided
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(3);
      
      // No more retries after consent found
      jest.advanceTimersByTime(60000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(3); // No increase
    });

    test('should restart retry on browser startup if consent pending', async () => {
      // Mock pending consent from previous session
      mockChrome.storage.sync.get.mockResolvedValue({
        telemetryConsentPending: true,
        telemetryConsent: undefined
      });
      
      require('../src/background/service-worker.js');
      const onStartupCallback = mockChrome.runtime.onStartup.addListener.mock.calls[0][0];
      
      // Trigger browser startup
      await onStartupCallback();
      
      // Should check for pending consent
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith([
        'telemetryConsent',
        'telemetryConsentPending'
      ]);
      
      // Should start retry mechanism
      jest.advanceTimersByTime(30000);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledTimes(2); // Initial + retry
    });
  });

  describe('Test 3: Storage Flags Set Correctly', () => {
    test('should set correct flags on fresh install', async () => {
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });
      
      // Verify initial flags
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        autoDetectChatGPT: true,
        enableNotifications: true,
        defaultCustomInstructions: '',
        autoCreateProjects: false
      });
      
      // Verify consent pending flag
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsentPending: true,
        installTime: expect.any(Number)
      });
    });

    test('should update flags when user allows telemetry', async () => {
      require('../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      // Mock user clicking "Allow" button
      const notificationClickHandler = mockChrome.notifications.onButtonClicked.addListener.mock.calls[0][0];
      
      // Trigger consent popup
      const consentPromise = worker.showTelemetryConsent({
        title: 'Test Consent',
        message: 'Test message'
      });
      
      // Get notification ID from create call
      const notificationId = await mockChrome.notifications.create.mock.results[0].value;
      
      // Simulate user clicking "Allow" (button index 1)
      notificationClickHandler(notificationId, 1);
      
      const result = await consentPromise;
      
      // Verify consent is stored as true
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: true
      });
      
      expect(result).toEqual({ success: true, consent: true });
    });

    test('should update flags when user denies telemetry', async () => {
      require('../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      // Mock user clicking "No Thanks" button
      const notificationClickHandler = mockChrome.notifications.onButtonClicked.addListener.mock.calls[0][0];
      
      // Trigger consent popup
      const consentPromise = worker.showTelemetryConsent({
        title: 'Test Consent',
        message: 'Test message'
      });
      
      // Get notification ID from create call
      const notificationId = await mockChrome.notifications.create.mock.results[0].value;
      
      // Simulate user clicking "No Thanks" (button index 0)
      notificationClickHandler(notificationId, 0);
      
      const result = await consentPromise;
      
      // Verify consent is stored as false
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: false
      });
      
      expect(result).toEqual({ success: true, consent: false });
    });

    test('should clear pending flag after showing consent', async () => {
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      await onInstalledCallback({ reason: 'install' });
      
      // Fast-forward to consent attempt
      jest.advanceTimersByTime(3000);
      
      // After showing consent, pending flag should be cleared
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsentPending: false
      });
    });

    test('should respect telemetry consent when sending data', async () => {
      // Test when consent is false
      mockChrome.storage.sync.get.mockResolvedValue({ telemetryConsent: false });
      
      require('../src/background/service-worker.js');
      const worker = global.backgroundWorker;
      
      const result = await worker.sendTelemetryData({ error: 'test' });
      
      expect(result).toEqual({ success: false, error: 'Telemetry disabled' });
      
      // Verify no network request was made
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test('should handle update from pre-consent version', async () => {
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // Simulate update from v1.0.0 (pre-consent)
      await onInstalledCallback({ 
        reason: 'update',
        previousVersion: '1.0.0'
      });
      
      // Should trigger consent flow for updates from pre-consent versions
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({
          telemetryConsentPending: true
        })
      );
    });
  });

  describe('Integration Tests', () => {
    test('complete consent flow from install to user choice', async () => {
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      const notificationClickHandler = mockChrome.notifications.onButtonClicked.addListener.mock.calls[0][0];
      
      // Step 1: Fresh install
      await onInstalledCallback({ reason: 'install' });
      
      // Step 2: Verify pending flag set
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ telemetryConsentPending: true })
      );
      
      // Step 3: Fast-forward to consent popup
      jest.advanceTimersByTime(3000);
      
      // Step 4: Get notification ID
      const notificationId = await mockChrome.notifications.create.mock.results[0].value;
      
      // Step 5: User makes choice (Allow)
      notificationClickHandler(notificationId, 1);
      
      // Step 6: Verify consent stored
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: true
      });
      
      // Step 7: Verify pending flag cleared
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsentPending: false
      });
    });

    test('handles rapid install/uninstall/reinstall gracefully', async () => {
      require('../src/background/service-worker.js');
      const onInstalledCallback = mockChrome.runtime.onInstalled.addListener.mock.calls[0][0];
      
      // First install
      await onInstalledCallback({ reason: 'install' });
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ telemetryConsentPending: true })
      );
      
      // Clear all timers (simulating uninstall)
      jest.clearAllTimers();
      
      // Reset storage mock
      mockChrome.storage.sync.set.mockClear();
      
      // Reinstall
      await onInstalledCallback({ reason: 'install' });
      
      // Should handle reinstall properly
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith(
        expect.objectContaining({ telemetryConsentPending: true })
      );
    });
  });
});