// ToastNotifications.js - Beautiful toast notification system for v1.0.2
// Supports success, error, warning, and info messages with smooth animations

class ToastNotifications {
  constructor() {
    this.containerId = 'toast-container';
    this.toasts = new Map();
    this.maxToasts = 5;
    this.defaultDuration = 4000;
    this.init();
  }

  // Initialize the toast container
  init() {
    if (!document.getElementById(this.containerId)) {
      const container = document.createElement('div');
      container.id = this.containerId;
      container.className = 'toast-container';
      document.body.appendChild(container);
      this.injectStyles();
    }
  }

  // Show a toast notification
  show(message, type = 'info', options = {}) {
    const {
      duration = this.defaultDuration,
      action = null,
      actionText = 'Undo',
      persistent = false,
      icon = true,
      progress = true
    } = options;

    const id = this.generateId();
    const toast = this.createToast(id, message, type, { action, actionText, icon, progress });
    
    // Add to container
    const container = document.getElementById(this.containerId);
    container.appendChild(toast);

    // Trigger entrance animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    // Store toast reference
    this.toasts.set(id, { element: toast, timer: null });

    // Auto-hide after duration (unless persistent)
    if (!persistent && duration > 0) {
      const timer = setTimeout(() => {
        this.hide(id);
      }, duration);
      this.toasts.get(id).timer = timer;
    }

    // Remove oldest toast if exceeding max
    if (this.toasts.size > this.maxToasts) {
      const firstId = this.toasts.keys().next().value;
      this.hide(firstId);
    }

    return id;
  }

  // Hide a specific toast
  hide(id) {
    const toastData = this.toasts.get(id);
    if (!toastData) return;

    const { element, timer } = toastData;
    
    // Clear timer if exists
    if (timer) clearTimeout(timer);

    // Add hide animation
    element.classList.add('hiding');
    
    // Remove after animation
    setTimeout(() => {
      element.remove();
      this.toasts.delete(id);
    }, 300);
  }

  // Hide all toasts
  hideAll() {
    this.toasts.forEach((_, id) => this.hide(id));
  }

  // Create toast element
  createToast(id, message, type, options) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    
    const iconSvg = this.getIcon(type);
    const hasAction = options.action && options.actionText;

    toast.innerHTML = `
      ${options.icon ? `
        <div class="toast-icon">
          ${iconSvg}
        </div>
      ` : ''}
      
      <div class="toast-content">
        <div class="toast-message">${this.escapeHtml(message)}</div>
        ${hasAction ? `
          <button class="toast-action" aria-label="${options.actionText}">
            ${options.actionText}
          </button>
        ` : ''}
      </div>
      
      <button class="toast-close" aria-label="Close notification">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M13 1L1 13M1 1L13 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
      
      ${options.progress ? '<div class="toast-progress"></div>' : ''}
    `;

    // Add event listeners
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => this.hide(id));

    if (hasAction) {
      const actionBtn = toast.querySelector('.toast-action');
      actionBtn.addEventListener('click', () => {
        options.action();
        this.hide(id);
      });
    }

    // Pause progress on hover
    if (options.progress) {
      toast.addEventListener('mouseenter', () => {
        const progress = toast.querySelector('.toast-progress');
        if (progress) progress.style.animationPlayState = 'paused';
      });

      toast.addEventListener('mouseleave', () => {
        const progress = toast.querySelector('.toast-progress');
        if (progress) progress.style.animationPlayState = 'running';
      });
    }

    return toast;
  }

  // Get icon for toast type
  getIcon(type) {
    const icons = {
      success: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M6 10L9 13L14 7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `,
      error: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M13 7L7 13M7 7L13 13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `,
      warning: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L2 16H18L10 2Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
          <path d="M10 11V7M10 15H10.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `,
      info: `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
          <path d="M10 14V10M10 6H10.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      `
    };
    return icons[type] || icons.info;
  }

  // Utility: Generate unique ID
  generateId() {
    return `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Utility: Escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Convenience methods
  success(message, options = {}) {
    return this.show(message, 'success', options);
  }

  error(message, options = {}) {
    return this.show(message, 'error', { ...options, duration: 6000 });
  }

  warning(message, options = {}) {
    return this.show(message, 'warning', options);
  }

  info(message, options = {}) {
    return this.show(message, 'info', options);
  }

  // Inject required styles
  injectStyles() {
    if (document.getElementById('toast-notification-styles')) return;

    const styles = `
      <style id="toast-notification-styles">
        .toast-container {
          position: fixed;
          top: 20px;
          right: 20px;
          z-index: 999999;
          pointer-events: none;
        }

        .toast {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          background: white;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          min-width: 300px;
          pointer-events: all;
          transform: translateX(calc(100% + 20px));
          opacity: 0;
          transition: all 0.3s cubic-bezier(0.19, 1, 0.22, 1);
          position: relative;
          overflow: hidden;
        }

        .toast.show {
          transform: translateX(0);
          opacity: 1;
        }

        .toast.hiding {
          transform: translateX(calc(100% + 20px));
          opacity: 0;
        }

        .toast-icon {
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        .toast-success {
          border-left: 4px solid #10a37f;
        }

        .toast-success .toast-icon {
          color: #10a37f;
        }

        .toast-error {
          border-left: 4px solid #ef4444;
        }

        .toast-error .toast-icon {
          color: #ef4444;
        }

        .toast-warning {
          border-left: 4px solid #f59e0b;
        }

        .toast-warning .toast-icon {
          color: #f59e0b;
        }

        .toast-info {
          border-left: 4px solid #3b82f6;
        }

        .toast-info .toast-icon {
          color: #3b82f6;
        }

        .toast-content {
          flex: 1;
          margin-right: 8px;
        }

        .toast-message {
          font-size: 14px;
          line-height: 1.5;
          color: #1f2937;
          margin: 0;
        }

        .toast-action {
          display: inline-block;
          margin-top: 8px;
          padding: 4px 12px;
          background: transparent;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s;
        }

        .toast-action:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
          color: #1f2937;
        }

        .toast-close {
          position: absolute;
          top: 12px;
          right: 12px;
          background: transparent;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #9ca3af;
          transition: all 0.2s;
          border-radius: 4px;
        }

        .toast-close:hover {
          background: #f3f4f6;
          color: #6b7280;
        }

        .toast-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: currentColor;
          opacity: 0.2;
          animation: progress linear forwards;
        }

        .toast-success .toast-progress {
          animation-duration: 4s;
          background: #10a37f;
        }

        .toast-error .toast-progress {
          animation-duration: 6s;
          background: #ef4444;
        }

        .toast-warning .toast-progress,
        .toast-info .toast-progress {
          animation-duration: 4s;
        }

        .toast-warning .toast-progress {
          background: #f59e0b;
        }

        .toast-info .toast-progress {
          background: #3b82f6;
        }

        @keyframes progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .toast {
            background: #1f2937;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
          }

          .toast-message {
            color: #f9fafb;
          }

          .toast-action {
            border-color: #374151;
            color: #d1d5db;
          }

          .toast-action:hover {
            background: #374151;
            border-color: #4b5563;
            color: #f9fafb;
          }

          .toast-close {
            color: #6b7280;
          }

          .toast-close:hover {
            background: #374151;
            color: #d1d5db;
          }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .toast-container {
            top: 10px;
            right: 10px;
            left: 10px;
          }

          .toast {
            max-width: 100%;
            min-width: auto;
          }
        }

        /* Stacking animation */
        .toast:not(:last-child) {
          animation: stackDown 0.3s ease-out;
        }

        @keyframes stackDown {
          from {
            transform: translateY(-12px);
          }
          to {
            transform: translateY(0);
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .toast {
            transition: none;
          }

          .toast-progress {
            animation: none;
            display: none;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }
}

// Create global instance
const Toast = new ToastNotifications();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToastNotifications, Toast };
} else {
  window.ToastNotifications = ToastNotifications;
  window.Toast = Toast;
}