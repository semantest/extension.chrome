/**
 * Unit Tests for ConsentModal Component
 * Tests privacy consent modal functionality and user interactions
 */

// Mock chrome API
const mockChrome = {
  storage: {
    sync: {
      set: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined)
    }
  },
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};

global.chrome = mockChrome;

// Import after mocking chrome
const ConsentModal = require('./ConsentModal');

describe('ConsentModal', () => {
  let modal;
  let originalBody;
  let originalHead;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '<meta charset="UTF-8">';
    
    // Clear all mocks
    jest.clearAllMocks();
    
    // Create new modal instance
    modal = new ConsentModal();
    
    // Store original DOM methods
    originalBody = document.body;
    originalHead = document.head;
  });

  afterEach(() => {
    // Cleanup any remaining modals
    const modalElement = document.getElementById('consent-modal-wrapper');
    if (modalElement) {
      modalElement.remove();
    }
    
    // Cleanup styles
    const styles = document.getElementById('consent-modal-styles');
    if (styles) {
      styles.remove();
    }
  });

  describe('Modal Display', () => {
    test('should show modal when show() is called', () => {
      const callback = jest.fn();
      modal.show(callback);

      const modalElement = document.getElementById('consent-modal-wrapper');
      expect(modalElement).toBeTruthy();
      expect(modal.isVisible).toBe(true);
    });

    test('should not create duplicate modals', () => {
      const callback = jest.fn();
      modal.show(callback);
      modal.show(callback);

      const modals = document.querySelectorAll('#consent-modal-wrapper');
      expect(modals.length).toBe(1);
    });

    test('should render all required elements', () => {
      modal.show(jest.fn());

      expect(document.getElementById('consent-yes-btn')).toBeTruthy();
      expect(document.getElementById('consent-no-btn')).toBeTruthy();
      expect(document.getElementById('consent-title')).toBeTruthy();
      expect(document.querySelector('.consent-privacy-link')).toBeTruthy();
      expect(document.querySelector('.consent-modal-description')).toBeTruthy();
    });

    test('should inject styles only once', () => {
      modal.show(jest.fn());
      modal.hide();
      modal = new ConsentModal();
      modal.show(jest.fn());

      const styles = document.querySelectorAll('#consent-modal-styles');
      expect(styles.length).toBe(1);
    });

    test('should focus on Yes button after showing', (done) => {
      modal.show(jest.fn());

      setTimeout(() => {
        const yesButton = document.getElementById('consent-yes-btn');
        expect(document.activeElement).toBe(yesButton);
        done();
      }, 150);
    });
  });

  describe('User Interactions', () => {
    test('should handle Yes button click', async () => {
      const callback = jest.fn();
      modal.show(callback);

      const yesButton = document.getElementById('consent-yes-btn');
      yesButton.click();

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: true,
        telemetryConsentTimestamp: expect.any(String)
      });
      expect(mockChrome.storage.sync.remove).toHaveBeenCalledWith('telemetryConsentPending');
      expect(callback).toHaveBeenCalledWith(true);
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'TELEMETRY_CONSENT_UPDATED',
        consent: true
      });
    });

    test('should handle No button click', async () => {
      const callback = jest.fn();
      modal.show(callback);

      const noButton = document.getElementById('consent-no-btn');
      noButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: false,
        telemetryConsentTimestamp: expect.any(String)
      });
      expect(callback).toHaveBeenCalledWith(false);
    });

    test('should handle Escape key press', async () => {
      const callback = jest.fn();
      modal.show(callback);

      const escapeEvent = new KeyboardEvent('keydown', { key: 'Escape' });
      document.dispatchEvent(escapeEvent);

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(callback).toHaveBeenCalledWith(false);
      expect(mockChrome.storage.sync.set).toHaveBeenCalledWith({
        telemetryConsent: false,
        telemetryConsentTimestamp: expect.any(String)
      });
    });

    test('should shake modal when clicking overlay', () => {
      modal.show(jest.fn());

      const overlay = document.getElementById('consent-modal-wrapper');
      const modalContent = document.querySelector('.consent-modal');
      
      overlay.click();

      expect(modalContent.style.animation).toBe('consent-shake 0.5s');
    });

    test('should not close when clicking inside modal', () => {
      modal.show(jest.fn());

      const modalContent = document.querySelector('.consent-modal-content');
      modalContent.click();

      const modalElement = document.getElementById('consent-modal-wrapper');
      expect(modalElement).toBeTruthy();
      expect(modal.isVisible).toBe(true);
    });
  });

  describe('Modal Hiding', () => {
    test('should hide modal with animation', (done) => {
      modal.show(jest.fn());
      modal.hide();

      const modalElement = document.getElementById('consent-modal-wrapper');
      expect(modalElement.classList.contains('consent-modal-hiding')).toBe(true);

      setTimeout(() => {
        expect(document.getElementById('consent-modal-wrapper')).toBeFalsy();
        expect(modal.isVisible).toBe(false);
        done();
      }, 350);
    });

    test('should hide modal after consent choice', async () => {
      modal.show(jest.fn());
      const hideSpy = jest.spyOn(modal, 'hide');

      const yesButton = document.getElementById('consent-yes-btn');
      yesButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('Feedback Toast', () => {
    test('should show success toast for Yes choice', async () => {
      modal.show(jest.fn());

      const yesButton = document.getElementById('consent-yes-btn');
      yesButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      const toast = document.querySelector('.consent-toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toContain('Thank you for helping us improve!');
      expect(toast.style.background).toBe('rgb(16, 163, 127)');
    });

    test('should show neutral toast for No choice', async () => {
      modal.show(jest.fn());

      const noButton = document.getElementById('consent-no-btn');
      noButton.click();

      await new Promise(resolve => setTimeout(resolve, 50));

      const toast = document.querySelector('.consent-toast');
      expect(toast).toBeTruthy();
      expect(toast.textContent).toContain('You can enable this anytime in settings');
      expect(toast.style.background).toBe('rgb(107, 114, 128)');
    });

    test('should remove toast after timeout', (done) => {
      modal.showFeedback(true);

      setTimeout(() => {
        const toast = document.querySelector('.consent-toast');
        expect(toast).toBeTruthy();
      }, 100);

      setTimeout(() => {
        const toast = document.querySelector('.consent-toast');
        expect(toast).toBeFalsy();
        done();
      }, 3500);
    });
  });

  describe('Error Handling', () => {
    test('should handle storage errors gracefully', async () => {
      mockChrome.storage.sync.set.mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const hideSpy = jest.spyOn(modal, 'hide');

      modal.show(jest.fn());
      const yesButton = document.getElementById('consent-yes-btn');
      yesButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      expect(consoleSpy).toHaveBeenCalledWith('Error saving consent:', expect.any(Error));
      expect(hideSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    test('should handle missing callback gracefully', async () => {
      modal.show(); // No callback provided

      const yesButton = document.getElementById('consent-yes-btn');
      yesButton.click();

      await new Promise(resolve => setTimeout(resolve, 0));

      // Should not throw error
      expect(mockChrome.storage.sync.set).toHaveBeenCalled();
    });
  });

  describe('Chrome Runtime Integration', () => {
    test('should respond to SHOW_CONSENT_MODAL message', () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const result = messageListener(
        { action: 'SHOW_CONSENT_MODAL' },
        {},
        sendResponse
      );

      expect(result).toBe(true); // Indicates async response
      expect(document.getElementById('consent-modal-wrapper')).toBeTruthy();
    });

    test('should ignore unrelated messages', () => {
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      const sendResponse = jest.fn();

      const result = messageListener(
        { action: 'OTHER_ACTION' },
        {},
        sendResponse
      );

      expect(result).toBeUndefined();
      expect(document.getElementById('consent-modal-wrapper')).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      modal.show(jest.fn());

      const dialog = document.querySelector('[role="dialog"]');
      expect(dialog).toBeTruthy();
      expect(dialog.getAttribute('aria-modal')).toBe('true');
      expect(dialog.getAttribute('aria-labelledby')).toBe('consent-title');
    });

    test('should have visible focus indicators', () => {
      modal.show(jest.fn());

      const yesButton = document.getElementById('consent-yes-btn');
      const styles = window.getComputedStyle(yesButton, ':focus');
      
      // Check that focus styles are defined
      expect(document.querySelector('#consent-modal-styles').textContent).toContain('.consent-btn:focus');
    });
  });

  describe('Module Export', () => {
    test('should export ConsentModal class', () => {
      expect(ConsentModal).toBeDefined();
      expect(typeof ConsentModal).toBe('function');
    });

    test('should attach to window in browser environment', () => {
      // Simulate browser environment
      delete require.cache[require.resolve('./ConsentModal')];
      const originalModule = global.module;
      global.module = undefined;

      // Re-require the module
      delete global.ConsentModal;
      require('./ConsentModal');

      expect(global.ConsentModal).toBeDefined();

      // Restore
      global.module = originalModule;
    });
  });
});