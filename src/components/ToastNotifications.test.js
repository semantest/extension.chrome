/**
 * Unit Tests for ToastNotifications Component
 * Tests toast notification system with success, error, warning, and info messages
 */

// Import after setting up DOM
const { ToastNotifications, Toast } = require('./ToastNotifications');

describe('ToastNotifications', () => {
  let toastNotifications;
  let container;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '<meta charset="UTF-8">';
    
    // Clear all timers
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Create new instance
    toastNotifications = new ToastNotifications();
  });

  afterEach(() => {
    // Cleanup
    const toastContainer = document.getElementById('toast-container');
    if (toastContainer) {
      toastContainer.remove();
    }
    
    const styles = document.getElementById('toast-notification-styles');
    if (styles) {
      styles.remove();
    }
    
    jest.useRealTimers();
  });

  describe('Initialization', () => {
    test('should create toast container on init', () => {
      container = document.getElementById('toast-container');
      expect(container).toBeTruthy();
      expect(container.className).toBe('toast-container');
    });

    test('should inject styles on init', () => {
      const styles = document.getElementById('toast-notification-styles');
      expect(styles).toBeTruthy();
    });

    test('should not duplicate container or styles', () => {
      const newInstance = new ToastNotifications();
      
      const containers = document.querySelectorAll('#toast-container');
      const styles = document.querySelectorAll('#toast-notification-styles');
      
      expect(containers.length).toBe(1);
      expect(styles.length).toBe(1);
    });

    test('should create global Toast instance', () => {
      expect(Toast).toBeInstanceOf(ToastNotifications);
    });
  });

  describe('Show Toast', () => {
    test('should show basic info toast', () => {
      const id = toastNotifications.show('Test message');
      
      const toast = document.querySelector('.toast');
      expect(toast).toBeTruthy();
      expect(toast.classList.contains('toast-info')).toBe(true);
      
      const message = toast.querySelector('.toast-message');
      expect(message.textContent).toBe('Test message');
    });

    test('should show toast with specific type', () => {
      toastNotifications.show('Success!', 'success');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-success')).toBe(true);
    });

    test('should add show class after animation frame', () => {
      toastNotifications.show('Test');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('show')).toBe(false);
      
      // Trigger animation frame
      jest.advanceTimersByTime(0);
      
      expect(toast.classList.contains('show')).toBe(true);
    });

    test('should show toast with custom options', () => {
      toastNotifications.show('Test', 'info', {
        duration: 5000,
        action: jest.fn(),
        actionText: 'Retry',
        persistent: false,
        icon: true,
        progress: true
      });
      
      const toast = document.querySelector('.toast');
      expect(toast.querySelector('.toast-icon')).toBeTruthy();
      expect(toast.querySelector('.toast-progress')).toBeTruthy();
      expect(toast.querySelector('.toast-action').textContent).toBe('Retry');
    });

    test('should escape HTML in message', () => {
      toastNotifications.show('<script>alert("xss")</script>');
      
      const message = document.querySelector('.toast-message');
      expect(message.textContent).toBe('<script>alert("xss")</script>');
      expect(message.innerHTML).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
    });

    test('should return unique ID', () => {
      const id1 = toastNotifications.show('Test 1');
      const id2 = toastNotifications.show('Test 2');
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
    });

    test('should store toast in Map', () => {
      const id = toastNotifications.show('Test');
      
      expect(toastNotifications.toasts.has(id)).toBe(true);
      expect(toastNotifications.toasts.get(id)).toHaveProperty('element');
      expect(toastNotifications.toasts.get(id)).toHaveProperty('timer');
    });
  });

  describe('Auto-hide Behavior', () => {
    test('should auto-hide after default duration', () => {
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      const id = toastNotifications.show('Test');
      
      expect(hideSpy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(4000);
      
      expect(hideSpy).toHaveBeenCalledWith(id);
    });

    test('should not auto-hide persistent toast', () => {
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      toastNotifications.show('Test', 'info', { persistent: true });
      
      jest.advanceTimersByTime(10000);
      
      expect(hideSpy).not.toHaveBeenCalled();
    });

    test('should use custom duration', () => {
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      const id = toastNotifications.show('Test', 'info', { duration: 2000 });
      
      jest.advanceTimersByTime(1999);
      expect(hideSpy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1);
      expect(hideSpy).toHaveBeenCalledWith(id);
    });

    test('should not auto-hide when duration is 0', () => {
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      toastNotifications.show('Test', 'info', { duration: 0 });
      
      jest.advanceTimersByTime(10000);
      
      expect(hideSpy).not.toHaveBeenCalled();
    });
  });

  describe('Hide Toast', () => {
    test('should hide toast with animation', () => {
      const id = toastNotifications.show('Test');
      const toast = document.querySelector('.toast');
      
      toastNotifications.hide(id);
      
      expect(toast.classList.contains('hiding')).toBe(true);
      expect(toast.parentNode).toBeTruthy(); // Still in DOM
      
      jest.advanceTimersByTime(300);
      
      expect(toast.parentNode).toBeFalsy(); // Removed from DOM
      expect(toastNotifications.toasts.has(id)).toBe(false);
    });

    test('should clear timer when hiding', () => {
      const id = toastNotifications.show('Test');
      const timer = toastNotifications.toasts.get(id).timer;
      
      jest.spyOn(global, 'clearTimeout');
      
      toastNotifications.hide(id);
      
      expect(clearTimeout).toHaveBeenCalledWith(timer);
    });

    test('should handle hiding non-existent toast', () => {
      toastNotifications.hide('non-existent');
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Hide All Toasts', () => {
    test('should hide all toasts', () => {
      const ids = [
        toastNotifications.show('Toast 1'),
        toastNotifications.show('Toast 2'),
        toastNotifications.show('Toast 3')
      ];
      
      expect(document.querySelectorAll('.toast').length).toBe(3);
      
      toastNotifications.hideAll();
      
      // All toasts should have hiding class
      const toasts = document.querySelectorAll('.toast');
      toasts.forEach(toast => {
        expect(toast.classList.contains('hiding')).toBe(true);
      });
      
      jest.advanceTimersByTime(300);
      
      expect(document.querySelectorAll('.toast').length).toBe(0);
      expect(toastNotifications.toasts.size).toBe(0);
    });
  });

  describe('Max Toasts Limit', () => {
    test('should remove oldest toast when exceeding max', () => {
      // Create max toasts
      const ids = [];
      for (let i = 0; i < 5; i++) {
        ids.push(toastNotifications.show(`Toast ${i + 1}`));
      }
      
      expect(toastNotifications.toasts.size).toBe(5);
      
      // Add one more
      toastNotifications.show('Toast 6');
      
      // First toast should be hiding
      const firstToast = document.querySelector('.toast');
      expect(firstToast.classList.contains('hiding')).toBe(true);
      
      jest.advanceTimersByTime(300);
      
      expect(toastNotifications.toasts.has(ids[0])).toBe(false);
      expect(toastNotifications.toasts.size).toBe(5);
    });
  });

  describe('Toast Actions', () => {
    test('should show action button when provided', () => {
      const action = jest.fn();
      toastNotifications.show('Test', 'info', {
        action,
        actionText: 'Retry'
      });
      
      const actionBtn = document.querySelector('.toast-action');
      expect(actionBtn).toBeTruthy();
      expect(actionBtn.textContent).toBe('Retry');
    });

    test('should call action and hide toast on action click', () => {
      const action = jest.fn();
      const id = toastNotifications.show('Test', 'info', {
        action,
        actionText: 'Undo'
      });
      
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      const actionBtn = document.querySelector('.toast-action');
      
      actionBtn.click();
      
      expect(action).toHaveBeenCalled();
      expect(hideSpy).toHaveBeenCalledWith(id);
    });
  });

  describe('Close Button', () => {
    test('should show close button', () => {
      toastNotifications.show('Test');
      
      const closeBtn = document.querySelector('.toast-close');
      expect(closeBtn).toBeTruthy();
      expect(closeBtn.getAttribute('aria-label')).toBe('Close notification');
    });

    test('should hide toast on close button click', () => {
      const id = toastNotifications.show('Test');
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      
      const closeBtn = document.querySelector('.toast-close');
      closeBtn.click();
      
      expect(hideSpy).toHaveBeenCalledWith(id);
    });
  });

  describe('Progress Bar', () => {
    test('should show progress bar when enabled', () => {
      toastNotifications.show('Test', 'info', { progress: true });
      
      const progress = document.querySelector('.toast-progress');
      expect(progress).toBeTruthy();
    });

    test('should not show progress bar when disabled', () => {
      toastNotifications.show('Test', 'info', { progress: false });
      
      const progress = document.querySelector('.toast-progress');
      expect(progress).toBeFalsy();
    });

    test('should pause progress animation on hover', () => {
      toastNotifications.show('Test', 'info', { progress: true });
      
      const toast = document.querySelector('.toast');
      const progress = document.querySelector('.toast-progress');
      
      const mouseEnterEvent = new MouseEvent('mouseenter');
      toast.dispatchEvent(mouseEnterEvent);
      
      expect(progress.style.animationPlayState).toBe('paused');
      
      const mouseLeaveEvent = new MouseEvent('mouseleave');
      toast.dispatchEvent(mouseLeaveEvent);
      
      expect(progress.style.animationPlayState).toBe('running');
    });
  });

  describe('Icons', () => {
    test('should show correct icon for each type', () => {
      const types = ['success', 'error', 'warning', 'info'];
      
      types.forEach(type => {
        toastNotifications.show(`${type} message`, type);
      });
      
      const toasts = document.querySelectorAll('.toast');
      expect(toasts.length).toBe(4);
      
      toasts.forEach((toast, index) => {
        const icon = toast.querySelector('.toast-icon svg');
        expect(icon).toBeTruthy();
      });
    });

    test('should hide icon when disabled', () => {
      toastNotifications.show('Test', 'info', { icon: false });
      
      const icon = document.querySelector('.toast-icon');
      expect(icon).toBeFalsy();
    });
  });

  describe('Convenience Methods', () => {
    test('should show success toast', () => {
      const id = toastNotifications.success('Success!');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-success')).toBe(true);
      expect(id).toBeTruthy();
    });

    test('should show error toast with longer duration', () => {
      toastNotifications.error('Error!');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-error')).toBe(true);
      
      // Error toasts should have 6s duration
      const hideSpy = jest.spyOn(toastNotifications, 'hide');
      
      jest.advanceTimersByTime(5999);
      expect(hideSpy).not.toHaveBeenCalled();
      
      jest.advanceTimersByTime(1);
      expect(hideSpy).toHaveBeenCalled();
    });

    test('should show warning toast', () => {
      toastNotifications.warning('Warning!');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-warning')).toBe(true);
    });

    test('should show info toast', () => {
      toastNotifications.info('Info!');
      
      const toast = document.querySelector('.toast');
      expect(toast.classList.contains('toast-info')).toBe(true);
    });
  });

  describe('Accessibility', () => {
    test('should have proper ARIA attributes', () => {
      toastNotifications.show('Test message');
      
      const toast = document.querySelector('.toast');
      expect(toast.getAttribute('role')).toBe('alert');
      expect(toast.getAttribute('aria-live')).toBe('polite');
    });

    test('should have accessible labels on buttons', () => {
      toastNotifications.show('Test', 'info', {
        action: jest.fn(),
        actionText: 'Undo'
      });
      
      const actionBtn = document.querySelector('.toast-action');
      const closeBtn = document.querySelector('.toast-close');
      
      expect(actionBtn.getAttribute('aria-label')).toBe('Undo');
      expect(closeBtn.getAttribute('aria-label')).toBe('Close notification');
    });
  });

  describe('Style Injection', () => {
    test('should include all component styles', () => {
      const styles = document.getElementById('toast-notification-styles');
      const styleContent = styles.textContent;
      
      // Check for key style definitions
      expect(styleContent).toContain('.toast-container');
      expect(styleContent).toContain('.toast-success');
      expect(styleContent).toContain('.toast-error');
      expect(styleContent).toContain('.toast-warning');
      expect(styleContent).toContain('.toast-info');
      
      // Check for animations
      expect(styleContent).toContain('@keyframes progress');
      expect(styleContent).toContain('@keyframes stackDown');
      
      // Check for responsive styles
      expect(styleContent).toContain('@media (prefers-color-scheme: dark)');
      expect(styleContent).toContain('@media (max-width: 480px)');
      expect(styleContent).toContain('@media (prefers-reduced-motion: reduce)');
    });
  });

  describe('Module Export', () => {
    test('should export ToastNotifications and Toast', () => {
      expect(ToastNotifications).toBeDefined();
      expect(Toast).toBeDefined();
      expect(Toast).toBeInstanceOf(ToastNotifications);
    });

    test('should attach to window in browser environment', () => {
      // Simulate browser environment
      delete require.cache[require.resolve('./ToastNotifications')];
      const originalModule = global.module;
      global.module = undefined;
      
      // Re-require the module
      delete global.ToastNotifications;
      delete global.Toast;
      require('./ToastNotifications');
      
      expect(global.ToastNotifications).toBeDefined();
      expect(global.Toast).toBeDefined();
      
      // Restore
      global.module = originalModule;
    });
  });
});