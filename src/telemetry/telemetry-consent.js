// Telemetry Consent UI Component
// Handles user consent for error reporting

// Check if already defined to avoid duplicate declaration
if (typeof TelemetryConsentManager === 'undefined') {

class TelemetryConsentManager {
  constructor() {
    this.consentModalId = 'telemetry-consent-modal';
    this.isShowing = false;
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
    modal.innerHTML = `
      <div class="telemetry-consent-overlay">
        <div class="telemetry-consent-modal">
          <div class="telemetry-consent-header">
            <h3>Help Improve ChatGPT Extension</h3>
            <button class="telemetry-close-btn" aria-label="Close">&times;</button>
          </div>
          
          <div class="telemetry-consent-content">
            <div class="telemetry-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2"/>
                <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2"/>
                <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2"/>
              </svg>
            </div>
            
            <p class="telemetry-message">
              We'd like to collect anonymous error reports to help fix bugs faster and improve your experience.
            </p>
            
            <div class="telemetry-details">
              <h4>What we collect:</h4>
              <ul>
                <li>Error messages and stack traces</li>
                <li>Extension version and browser info</li>
                <li>Anonymous session ID</li>
                <li>Page URL (without personal data)</li>
              </ul>
              
              <h4>What we DON'T collect:</h4>
              <ul>
                <li>Your conversations with ChatGPT</li>
                <li>Personal information or login details</li>
                <li>Browsing history</li>
                <li>Any content you type</li>
              </ul>
            </div>
            
            <div class="telemetry-privacy-note">
              <small>
                ℹ️ All data is anonymous and helps us fix bugs. You can change this setting anytime in the extension popup.
              </small>
            </div>
          </div>
          
          <div class="telemetry-consent-actions">
            <button class="telemetry-btn telemetry-btn-secondary" data-choice="false">
              No Thanks
            </button>
            <button class="telemetry-btn telemetry-btn-primary" data-choice="true">
              Allow Error Reports
            </button>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = this.getConsentModalStyles();
    document.head.appendChild(style);

    // Add to page
    document.body.appendChild(modal);

    // Handle user choice
    modal.addEventListener('click', (e) => {
      const choice = e.target.dataset.choice;
      const isClose = e.target.classList.contains('telemetry-close-btn') || 
                     e.target.classList.contains('telemetry-consent-overlay');
      
      if (choice !== undefined) {
        this.handleConsentChoice(choice === 'true', onDecision);
      } else if (isClose) {
        this.handleConsentChoice(false, onDecision);
      }
    });

    // ESC key to close
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        this.handleConsentChoice(false, onDecision);
        document.removeEventListener('keydown', handleEsc);
      }
    };
    document.addEventListener('keydown', handleEsc);

    // Focus management
    modal.querySelector('.telemetry-btn-primary').focus();
  }

  handleConsentChoice(consent, callback) {
    this.isShowing = false;
    this.removeConsentModal();
    
    // Store choice
    chrome.storage.sync.set({ telemetryConsent: consent });
    
    // Show confirmation
    this.showConsentConfirmation(consent);
    
    callback(consent);
  }

  showConsentConfirmation(consent) {
    const message = consent 
      ? '✅ Thank you! Error reporting enabled.'
      : '👍 No problem! Error reporting disabled.';
    
    this.showToast(message);
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'telemetry-toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #4CAF50;
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 1000001;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  removeConsentModal() {
    const existing = document.getElementById(this.consentModalId);
    if (existing) {
      existing.remove();
    }
  }

  getConsentModalStyles() {
    return `
      @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      
      @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
      }

      .telemetry-consent-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        animation: fadeIn 0.2s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .telemetry-consent-modal {
        background: white;
        border-radius: 12px;
        max-width: 500px;
        margin: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
        overflow: hidden;
        animation: scaleIn 0.3s ease-out;
      }

      @keyframes scaleIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
      }

      .telemetry-consent-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 20px 24px 16px;
        border-bottom: 1px solid #e0e0e0;
      }

      .telemetry-consent-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      }

      .telemetry-close-btn {
        background: none;
        border: none;
        font-size: 24px;
        color: #666;
        cursor: pointer;
        padding: 0;
        width: 30px;
        height: 30px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        transition: background-color 0.2s;
      }

      .telemetry-close-btn:hover {
        background: #f0f0f0;
      }

      .telemetry-consent-content {
        padding: 20px 24px;
      }

      .telemetry-icon {
        text-align: center;
        margin-bottom: 16px;
        color: #4CAF50;
      }

      .telemetry-message {
        font-size: 16px;
        line-height: 1.5;
        color: #333;
        margin: 0 0 20px;
        text-align: center;
      }

      .telemetry-details {
        background: #f8f9fa;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
      }

      .telemetry-details h4 {
        margin: 0 0 8px;
        font-size: 14px;
        font-weight: 600;
        color: #333;
      }

      .telemetry-details ul {
        margin: 0 0 16px;
        padding-left: 16px;
        font-size: 13px;
        color: #666;
        line-height: 1.4;
      }

      .telemetry-details ul:last-child {
        margin-bottom: 0;
      }

      .telemetry-details li {
        margin-bottom: 4px;
      }

      .telemetry-privacy-note {
        background: #e3f2fd;
        border-radius: 6px;
        padding: 12px;
        text-align: center;
      }

      .telemetry-privacy-note small {
        color: #1976d2;
        font-size: 12px;
        line-height: 1.4;
      }

      .telemetry-consent-actions {
        display: flex;
        gap: 12px;
        padding: 20px 24px;
        background: #f8f9fa;
        justify-content: flex-end;
      }

      .telemetry-btn {
        padding: 10px 20px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        transition: all 0.2s;
        min-width: 120px;
      }

      .telemetry-btn-secondary {
        background: white;
        color: #666;
        border: 1px solid #ddd;
      }

      .telemetry-btn-secondary:hover {
        background: #f5f5f5;
        border-color: #ccc;
      }

      .telemetry-btn-primary {
        background: #4CAF50;
        color: white;
      }

      .telemetry-btn-primary:hover {
        background: #45a049;
      }

      .telemetry-btn:focus {
        outline: 2px solid #4CAF50;
        outline-offset: 2px;
      }

      /* Dark mode support */
      @media (prefers-color-scheme: dark) {
        .telemetry-consent-modal {
          background: #2d2d2d;
          color: #fff;
        }

        .telemetry-consent-header {
          border-bottom-color: #444;
        }

        .telemetry-consent-header h3 {
          color: #fff;
        }

        .telemetry-close-btn {
          color: #ccc;
        }

        .telemetry-close-btn:hover {
          background: #444;
        }

        .telemetry-message {
          color: #fff;
        }

        .telemetry-details {
          background: #333;
        }

        .telemetry-details h4 {
          color: #fff;
        }

        .telemetry-details ul {
          color: #ccc;
        }

        .telemetry-consent-actions {
          background: #333;
        }

        .telemetry-btn-secondary {
          background: #444;
          color: #fff;
          border-color: #555;
        }

        .telemetry-btn-secondary:hover {
          background: #555;
        }
      }
    `;
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TelemetryConsentManager;
} else {
  window.TelemetryConsentManager = TelemetryConsentManager;
}

} // End of if (typeof TelemetryConsentManager === 'undefined')