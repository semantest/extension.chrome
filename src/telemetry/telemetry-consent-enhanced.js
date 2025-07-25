// Enhanced Telemetry Consent UI Component
// Integrates with safety checks and ensures proper consent flow

class EnhancedTelemetryConsentManager {
  constructor() {
    this.consentModalId = 'telemetry-consent-modal';
    this.isShowing = false;
    this.messageListener = null;
    this.setupMessageListener();
  }

  setupMessageListener() {
    // Listen for SHOW_TELEMETRY_CONSENT_MODAL messages
    this.messageListener = (message, sender, sendResponse) => {
      if (message.action === 'SHOW_TELEMETRY_CONSENT_MODAL') {
        this.showConsentDialog().then(consent => {
          sendResponse({ consent });
        });
        return true; // Keep channel open for async response
      }
    };
    
    chrome.runtime.onMessage.addListener(this.messageListener);
  }

  async showConsentDialog() {
    if (this.isShowing) return null;
    
    return new Promise((resolve) => {
      this.isShowing = true;
      this.createConsentModal(resolve);
    });
  }

  createConsentModal(onDecision) {
    // Remove existing modal if any
    this.removeConsentModal();

    const modal = document.createElement('div');
    modal.id = this.consentModalId;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'consent-title');
    modal.setAttribute('aria-describedby', 'consent-description');
    
    modal.innerHTML = `
      <div class="telemetry-consent-overlay" role="presentation">
        <div class="telemetry-consent-modal" role="document">
          <div class="telemetry-consent-header">
            <h2 id="consent-title">Help Improve Semantest</h2>
          </div>
          
          <div class="telemetry-consent-content">
            <div class="telemetry-icon-wrapper">
              <div class="telemetry-icon">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="#10a37f" opacity="0.1"/>
                  <path d="M12 6V14" stroke="#10a37f" stroke-width="2" stroke-linecap="round"/>
                  <circle cx="12" cy="18" r="1" fill="#10a37f"/>
                  <path d="M8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12" stroke="#10a37f" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
            
            <p id="consent-description" class="telemetry-message">
              We'd like your permission to collect anonymous error reports. This helps us fix bugs faster and improve your experience.
            </p>
            
            <div class="telemetry-privacy-card">
              <div class="privacy-section">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 2L3 7V11C3 15.55 5.84 19.74 10 21C14.16 19.74 17 15.55 17 11V7L10 2Z"/>
                  </svg>
                  What we collect
                </h3>
                <ul class="privacy-list">
                  <li>
                    <span class="privacy-icon">✓</span>
                    Error messages to fix bugs
                  </li>
                  <li>
                    <span class="privacy-icon">✓</span>
                    Extension version info
                  </li>
                  <li>
                    <span class="privacy-icon">✓</span>
                    Anonymous usage patterns
                  </li>
                </ul>
              </div>
              
              <div class="privacy-section">
                <h3>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 1L13.09 7.26L20 8.27L15 13.14L16.18 20L10 16.77L3.82 20L5 13.14L0 8.27L6.91 7.26L10 1Z"/>
                  </svg>
                  Your privacy
                </h3>
                <ul class="privacy-list">
                  <li>
                    <span class="privacy-icon">🔒</span>
                    No personal data collected
                  </li>
                  <li>
                    <span class="privacy-icon">🔒</span>
                    No ChatGPT conversations
                  </li>
                  <li>
                    <span class="privacy-icon">🔒</span>
                    You can opt-out anytime
                  </li>
                </ul>
              </div>
            </div>
            
            <div class="telemetry-learn-more">
              <a href="#" id="privacy-policy-link" class="learn-more-link">
                Learn more about our privacy practices
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6.5 3L11.5 8L6.5 13" stroke="currentColor" stroke-width="2" fill="none"/>
                </svg>
              </a>
            </div>
          </div>
          
          <div class="telemetry-consent-actions">
            <button class="telemetry-btn telemetry-btn-secondary" id="consent-decline" aria-label="Decline telemetry">
              No Thanks
            </button>
            <button class="telemetry-btn telemetry-btn-primary" id="consent-accept" aria-label="Accept telemetry">
              Allow & Help Improve
            </button>
          </div>
          
          <div class="telemetry-consent-footer">
            <p class="footer-note">You can change this anytime in extension settings</p>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.injectStyles();

    // Add to page
    document.body.appendChild(modal);

    // Set up event handlers
    this.setupEventHandlers(modal, onDecision);

    // Focus management
    const acceptBtn = modal.querySelector('#consent-accept');
    acceptBtn.focus();

    // Trap focus within modal
    this.setupFocusTrap(modal);

    // Add entrance animation
    requestAnimationFrame(() => {
      modal.classList.add('show');
    });
  }

  setupEventHandlers(modal, onDecision) {
    const acceptBtn = modal.querySelector('#consent-accept');
    const declineBtn = modal.querySelector('#consent-decline');
    const privacyLink = modal.querySelector('#privacy-policy-link');

    acceptBtn.addEventListener('click', () => {
      this.handleConsentChoice(true, onDecision);
    });

    declineBtn.addEventListener('click', () => {
      this.handleConsentChoice(false, onDecision);
    });

    privacyLink.addEventListener('click', (e) => {
      e.preventDefault();
      chrome.tabs.create({ url: 'https://semantest.com/privacy' });
    });

    // ESC key handling
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.handleConsentChoice(false, onDecision);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Prevent clicking outside to close (force explicit choice)
    modal.querySelector('.telemetry-consent-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        // Shake the modal to indicate it requires action
        const modalContent = modal.querySelector('.telemetry-consent-modal');
        modalContent.classList.add('shake');
        setTimeout(() => modalContent.classList.remove('shake'), 500);
      }
    });
  }

  setupFocusTrap(modal) {
    const focusableElements = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    modal.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      }
    });
  }

  async handleConsentChoice(consent, callback) {
    this.isShowing = false;
    
    try {
      // Update storage with user choice
      await chrome.storage.sync.set({ 
        telemetryConsent: consent,
        telemetryConsentTimestamp: new Date().toISOString()
      });
      
      // Clear the pending flag
      await chrome.storage.sync.remove('telemetryConsentPending');
      
      // Animate out
      const modal = document.getElementById(this.consentModalId);
      modal.classList.add('hide');
      
      // Show confirmation
      this.showConsentConfirmation(consent);
      
      // Remove modal after animation
      setTimeout(() => {
        this.removeConsentModal();
      }, 300);
      
      // Notify the callback
      callback(consent);
      
      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'TELEMETRY_CONSENT_UPDATED',
        consent: consent
      });
      
    } catch (error) {
      console.error('Error saving consent choice:', error);
      callback(false); // Default to no consent on error
    }
  }

  showConsentConfirmation(consent) {
    const message = consent 
      ? '✅ Thank you! You\'re helping us improve Semantest.'
      : '👍 No problem! You can enable this anytime in settings.';
    
    this.showToast(message, consent ? 'success' : 'info');
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `telemetry-toast telemetry-toast-${type}`;
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.add('hide');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  removeConsentModal() {
    const existing = document.getElementById(this.consentModalId);
    if (existing) {
      existing.remove();
    }
  }

  injectStyles() {
    if (document.getElementById('telemetry-consent-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'telemetry-consent-styles';
    style.textContent = `
      .telemetry-consent-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2147483647;
        backdrop-filter: blur(4px);
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      #telemetry-consent-modal.show .telemetry-consent-overlay {
        opacity: 1;
      }

      #telemetry-consent-modal.hide .telemetry-consent-overlay {
        opacity: 0;
      }

      .telemetry-consent-modal {
        background: white;
        border-radius: 16px;
        max-width: 480px;
        width: 90%;
        margin: 20px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        transform: translateY(20px) scale(0.95);
        transition: transform 0.3s ease;
        max-height: 90vh;
        overflow-y: auto;
      }

      #telemetry-consent-modal.show .telemetry-consent-modal {
        transform: translateY(0) scale(1);
      }

      #telemetry-consent-modal.hide .telemetry-consent-modal {
        transform: translateY(20px) scale(0.95);
      }

      .telemetry-consent-modal.shake {
        animation: shake 0.5s ease-in-out;
      }

      @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
      }

      .telemetry-consent-header {
        padding: 32px 32px 0;
        text-align: center;
      }

      .telemetry-consent-header h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 600;
        color: #1a1a1a;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .telemetry-consent-content {
        padding: 24px 32px;
      }

      .telemetry-icon-wrapper {
        text-align: center;
        margin-bottom: 24px;
      }

      .telemetry-icon {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 80px;
        height: 80px;
        background: #f0fdf4;
        border-radius: 50%;
        animation: pulse 2s ease-in-out infinite;
      }

      @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.05); opacity: 0.8; }
      }

      .telemetry-message {
        font-size: 16px;
        line-height: 1.6;
        color: #4b5563;
        margin: 0 0 24px;
        text-align: center;
      }

      .telemetry-privacy-card {
        background: #f9fafb;
        border-radius: 12px;
        padding: 24px;
        margin-bottom: 20px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
      }

      .privacy-section h3 {
        font-size: 14px;
        font-weight: 600;
        color: #1f2937;
        margin: 0 0 12px;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .privacy-section h3 svg {
        width: 20px;
        height: 20px;
        color: #10a37f;
      }

      .privacy-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .privacy-list li {
        display: flex;
        align-items: flex-start;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #6b7280;
        line-height: 1.4;
      }

      .privacy-icon {
        font-size: 14px;
        margin-top: 1px;
      }

      .telemetry-learn-more {
        text-align: center;
        margin-bottom: 24px;
      }

      .learn-more-link {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        color: #10a37f;
        text-decoration: none;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .learn-more-link:hover {
        gap: 8px;
      }

      .learn-more-link svg {
        transition: transform 0.2s ease;
      }

      .learn-more-link:hover svg {
        transform: translateX(2px);
      }

      .telemetry-consent-actions {
        display: flex;
        gap: 12px;
        padding: 0 32px 24px;
      }

      .telemetry-btn {
        flex: 1;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 15px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        font-family: inherit;
        position: relative;
        overflow: hidden;
      }

      .telemetry-btn:focus {
        outline: 2px solid #10a37f;
        outline-offset: 2px;
      }

      .telemetry-btn:active {
        transform: scale(0.98);
      }

      .telemetry-btn-secondary {
        background: #f3f4f6;
        color: #4b5563;
      }

      .telemetry-btn-secondary:hover {
        background: #e5e7eb;
      }

      .telemetry-btn-primary {
        background: #10a37f;
        color: white;
      }

      .telemetry-btn-primary:hover {
        background: #0e9168;
        box-shadow: 0 4px 12px rgba(16, 163, 127, 0.3);
      }

      .telemetry-consent-footer {
        padding: 16px 32px;
        background: #f9fafb;
        border-top: 1px solid #e5e7eb;
      }

      .footer-note {
        margin: 0;
        font-size: 12px;
        color: #9ca3af;
        text-align: center;
      }

      /* Toast notifications */
      .telemetry-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #1f2937;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        z-index: 2147483648;
        font-size: 14px;
        font-weight: 500;
        transform: translateX(400px);
        transition: transform 0.3s ease;
        max-width: 320px;
      }

      .telemetry-toast.show {
        transform: translateX(0);
      }

      .telemetry-toast.hide {
        transform: translateX(400px);
      }

      .telemetry-toast-success {
        background: #10a37f;
      }

      .telemetry-toast-info {
        background: #3b82f6;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .telemetry-consent-modal {
          background: #1f2937;
          color: #f9fafb;
        }

        .telemetry-consent-header h2 {
          color: #f9fafb;
        }

        .telemetry-message {
          color: #d1d5db;
        }

        .telemetry-privacy-card {
          background: #111827;
        }

        .privacy-section h3 {
          color: #f3f4f6;
        }

        .privacy-list li {
          color: #9ca3af;
        }

        .telemetry-btn-secondary {
          background: #374151;
          color: #e5e7eb;
        }

        .telemetry-btn-secondary:hover {
          background: #4b5563;
        }

        .telemetry-consent-footer {
          background: #111827;
          border-top-color: #374151;
        }

        .footer-note {
          color: #6b7280;
        }
      }

      /* Responsive design */
      @media (max-width: 540px) {
        .telemetry-consent-modal {
          margin: 10px;
        }

        .telemetry-consent-header,
        .telemetry-consent-content,
        .telemetry-consent-actions {
          padding-left: 20px;
          padding-right: 20px;
        }

        .telemetry-privacy-card {
          grid-template-columns: 1fr;
          gap: 16px;
          padding: 16px;
        }

        .telemetry-consent-actions {
          flex-direction: column;
        }

        .telemetry-btn {
          width: 100%;
        }
      }

      /* High contrast mode */
      @media (prefers-contrast: high) {
        .telemetry-consent-modal {
          border: 2px solid currentColor;
        }

        .telemetry-btn {
          border: 2px solid currentColor;
        }
      }

      /* Reduced motion */
      @media (prefers-reduced-motion: reduce) {
        .telemetry-consent-overlay,
        .telemetry-consent-modal,
        .telemetry-btn,
        .telemetry-toast {
          transition: none !important;
        }

        .telemetry-icon,
        .telemetry-consent-modal.shake {
          animation: none !important;
        }
      }
    `;
    
    document.head.appendChild(style);
  }

  // Clean up when extension unloads
  cleanup() {
    if (this.messageListener) {
      chrome.runtime.onMessage.removeListener(this.messageListener);
    }
    this.removeConsentModal();
  }
}

// Initialize the enhanced consent manager
const telemetryConsentManager = new EnhancedTelemetryConsentManager();

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EnhancedTelemetryConsentManager;
} else {
  window.EnhancedTelemetryConsentManager = EnhancedTelemetryConsentManager;
}