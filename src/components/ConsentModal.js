// ConsentModal.js - Clean telemetry consent modal component
// Handles privacy consent with Yes/No options and chrome.storage updates

class ConsentModal {
  constructor() {
    this.modalId = 'consent-modal-wrapper';
    this.isVisible = false;
    this.onConsentCallback = null;
  }

  // Show the consent modal
  show(onConsentCallback) {
    if (this.isVisible) return;
    
    this.isVisible = true;
    this.onConsentCallback = onConsentCallback;
    this.render();
    this.attachEventListeners();
    
    // Focus on Yes button for accessibility
    setTimeout(() => {
      const yesButton = document.getElementById('consent-yes-btn');
      if (yesButton) yesButton.focus();
    }, 100);
  }

  // Hide and cleanup the modal
  hide() {
    const modal = document.getElementById(this.modalId);
    if (modal) {
      modal.classList.add('consent-modal-hiding');
      setTimeout(() => {
        modal.remove();
        this.isVisible = false;
      }, 300);
    }
  }

  // Render the modal HTML
  render() {
    const modalHTML = `
      <div id="${this.modalId}" class="consent-modal-overlay">
        <div class="consent-modal" role="dialog" aria-modal="true" aria-labelledby="consent-title">
          <div class="consent-modal-content">
            <div class="consent-modal-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="#10a37f" stroke-width="2"/>
                <path d="M12 8V12" stroke="#10a37f" stroke-width="2" stroke-linecap="round"/>
                <circle cx="12" cy="16" r="1" fill="#10a37f"/>
              </svg>
            </div>
            
            <h2 id="consent-title" class="consent-modal-title">
              Help Improve Semantest
            </h2>
            
            <p class="consent-modal-description">
              We'd like to collect anonymous usage data to help improve the extension. 
              No personal information or ChatGPT conversations are ever collected.
            </p>
            
            <div class="consent-modal-privacy">
              <a href="https://semantest.com/privacy" target="_blank" rel="noopener noreferrer" class="consent-privacy-link">
                View Privacy Policy
                <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                  <path d="M3.5 3a.5.5 0 0 0-.5.5v5a.5.5 0 0 0 .5.5h5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 1 1 0v1A1.5 1.5 0 0 1 8.5 10h-5A1.5 1.5 0 0 1 2 8.5v-5A1.5 1.5 0 0 1 3.5 2h1a.5.5 0 0 1 0 1h-1z"/>
                  <path d="M7 1a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v3a.5.5 0 0 1-1 0V1.707L5.854 5.854a.5.5 0 1 1-.708-.708L9.293 1H7.5A.5.5 0 0 1 7 1z"/>
                </svg>
              </a>
            </div>
            
            <div class="consent-modal-actions">
              <button id="consent-no-btn" class="consent-btn consent-btn-secondary">
                No Thanks
              </button>
              <button id="consent-yes-btn" class="consent-btn consent-btn-primary">
                Yes, I'd Like to Help
              </button>
            </div>
            
            <p class="consent-modal-note">
              You can change this anytime in settings
            </p>
          </div>
        </div>
      </div>
    `;

    // Add styles
    this.injectStyles();

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Add show animation
    requestAnimationFrame(() => {
      const modal = document.getElementById(this.modalId);
      if (modal) modal.classList.add('consent-modal-visible');
    });
  }

  // Inject required styles
  injectStyles() {
    if (document.getElementById('consent-modal-styles')) return;

    const styles = `
      <style id="consent-modal-styles">
        .consent-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(2px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 999999;
          opacity: 0;
          transition: opacity 0.3s ease;
          padding: 20px;
        }

        .consent-modal-overlay.consent-modal-visible {
          opacity: 1;
        }

        .consent-modal-overlay.consent-modal-hiding {
          opacity: 0;
        }

        .consent-modal {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
          max-width: 440px;
          width: 100%;
          transform: scale(0.9);
          transition: transform 0.3s ease;
        }

        .consent-modal-visible .consent-modal {
          transform: scale(1);
        }

        .consent-modal-content {
          padding: 32px;
          text-align: center;
        }

        .consent-modal-icon {
          margin-bottom: 20px;
        }

        .consent-modal-title {
          font-size: 22px;
          font-weight: 600;
          color: #1a1a1a;
          margin: 0 0 12px 0;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .consent-modal-description {
          font-size: 15px;
          line-height: 1.5;
          color: #666666;
          margin: 0 0 16px 0;
        }

        .consent-modal-privacy {
          margin-bottom: 24px;
        }

        .consent-privacy-link {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          color: #10a37f;
          text-decoration: none;
          font-size: 14px;
          font-weight: 500;
          transition: opacity 0.2s ease;
        }

        .consent-privacy-link:hover {
          opacity: 0.8;
          text-decoration: underline;
        }

        .consent-modal-actions {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
        }

        .consent-btn {
          flex: 1;
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.2s ease;
          min-height: 40px;
        }

        .consent-btn:focus {
          outline: 2px solid #10a37f;
          outline-offset: 2px;
        }

        .consent-btn-secondary {
          background: #f3f4f6;
          color: #374151;
        }

        .consent-btn-secondary:hover {
          background: #e5e7eb;
        }

        .consent-btn-primary {
          background: #10a37f;
          color: #ffffff;
        }

        .consent-btn-primary:hover {
          background: #0e8f6d;
        }

        .consent-modal-note {
          font-size: 12px;
          color: #9ca3af;
          margin: 0;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          .consent-modal {
            background: #1f2937;
          }

          .consent-modal-title {
            color: #f9fafb;
          }

          .consent-modal-description {
            color: #d1d5db;
          }

          .consent-btn-secondary {
            background: #374151;
            color: #e5e7eb;
          }

          .consent-btn-secondary:hover {
            background: #4b5563;
          }

          .consent-modal-note {
            color: #6b7280;
          }
        }

        /* Mobile responsive */
        @media (max-width: 480px) {
          .consent-modal-content {
            padding: 24px;
          }

          .consent-modal-actions {
            flex-direction: column;
          }

          .consent-btn {
            width: 100%;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          .consent-modal-overlay,
          .consent-modal {
            transition: none;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Attach event listeners
  attachEventListeners() {
    const yesBtn = document.getElementById('consent-yes-btn');
    const noBtn = document.getElementById('consent-no-btn');
    const overlay = document.getElementById(this.modalId);

    if (yesBtn) {
      yesBtn.addEventListener('click', () => this.handleConsent(true));
    }

    if (noBtn) {
      noBtn.addEventListener('click', () => this.handleConsent(false));
    }

    // Prevent closing by clicking overlay - force explicit choice
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          // Shake the modal to indicate action required
          const modal = overlay.querySelector('.consent-modal');
          if (modal) {
            modal.style.animation = 'consent-shake 0.5s';
            setTimeout(() => {
              modal.style.animation = '';
            }, 500);
          }
        }
      });
    }

    // Handle ESC key (counts as "No")
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        this.handleConsent(false);
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Add shake animation
    const shakeStyle = document.createElement('style');
    shakeStyle.textContent = `
      @keyframes consent-shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-10px); }
        75% { transform: translateX(10px); }
      }
    `;
    document.head.appendChild(shakeStyle);
  }

  // Handle user consent choice
  async handleConsent(consent) {
    try {
      // Update chrome storage
      await chrome.storage.sync.set({
        telemetryConsent: consent,
        telemetryConsentTimestamp: new Date().toISOString()
      });

      // Clear any pending flag
      await chrome.storage.sync.remove('telemetryConsentPending');

      // Log for debugging
      console.log('Telemetry consent saved:', consent);

      // Call callback if provided
      if (this.onConsentCallback) {
        this.onConsentCallback(consent);
      }

      // Send message to background/other scripts
      if (chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          action: 'TELEMETRY_CONSENT_UPDATED',
          consent: consent
        });
      }

      // Show brief feedback
      this.showFeedback(consent);

      // Hide modal
      this.hide();

    } catch (error) {
      console.error('Error saving consent:', error);
      // Still hide modal on error
      this.hide();
    }
  }

  // Show feedback toast
  showFeedback(consent) {
    const message = consent 
      ? '✓ Thank you for helping us improve!'
      : '✓ You can enable this anytime in settings';

    const toast = document.createElement('div');
    toast.className = 'consent-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: ${consent ? '#10a37f' : '#6b7280'};
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      z-index: 999999;
      opacity: 0;
      transform: translateY(10px);
      transition: all 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });

    // Remove after delay
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConsentModal;
} else {
  window.ConsentModal = ConsentModal;
}

// Auto-initialize if needed
if (typeof chrome !== 'undefined' && chrome.runtime) {
  // Listen for consent request messages
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SHOW_CONSENT_MODAL') {
      const modal = new ConsentModal();
      modal.show((consent) => {
        sendResponse({ consent: consent });
      });
      return true; // Will respond asynchronously
    }
  });
}