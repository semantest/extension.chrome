// Error Telemetry System for ChatGPT Extension Beta
// Captures and reports errors anonymously for debugging

// Prevent duplicate declarations
if (typeof ErrorReporter === 'undefined') {
class ErrorReporter {
  constructor() {
    this.isEnabled = false;
    this.sessionId = this.generateSessionId();
    this.extensionVersion = null;
    this.errorQueue = [];
    this.maxQueueSize = 50;
    this.reportingEndpoint = 'https://api.semantest.com/v1/telemetry/errors';
    this.rateLimitWindow = 60000; // 1 minute
    this.maxErrorsPerWindow = 10;
    this.errorCounts = new Map();
    
    this.init();
  }

  async init() {
    // Get extension version
    try {
      const manifest = chrome.runtime.getManifest();
      this.extensionVersion = manifest.version;
    } catch (error) {
      this.extensionVersion = 'unknown';
    }

    // Check user consent
    await this.checkTelemetryConsent();
    
    if (this.isEnabled) {
      this.setupErrorHandlers();
      console.log('[Telemetry] Error reporting enabled');
    }
  }

  async checkTelemetryConsent() {
    try {
      const result = await chrome.storage.sync.get(['telemetryConsent']);
      const consent = result.telemetryConsent;
      
      if (consent === undefined) {
        // First time - show consent dialog
        this.isEnabled = await this.requestTelemetryConsent();
      } else {
        this.isEnabled = consent === true;
      }
    } catch (error) {
      // Default to disabled if storage fails
      this.isEnabled = false;
    }
  }

  async requestTelemetryConsent() {
    return new Promise((resolve) => {
      // Send message to background script to show consent dialog
      chrome.runtime.sendMessage({
        action: 'SHOW_TELEMETRY_CONSENT',
        data: {
          title: 'Help Improve ChatGPT Extension',
          message: 'Send anonymous error reports to help us fix bugs faster? No personal data is collected.',
          sessionId: this.sessionId
        }
      }, (response) => {
        const consent = response?.consent === true;
        chrome.storage.sync.set({ telemetryConsent: consent });
        resolve(consent);
      });
    });
  }

  setupErrorHandlers() {
    // Global unhandled errors
    window.addEventListener('error', (event) => {
      this.captureError({
        type: 'javascript_error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError({
        type: 'unhandled_rejection',
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        timestamp: new Date().toISOString(),
        url: window.location.href
      });
    });

    // Chrome extension errors
    if (chrome.runtime.onMessage) {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'EXTENSION_ERROR') {
          this.captureError({
            type: 'extension_error',
            ...message.data,
            timestamp: new Date().toISOString()
          });
        }
      });
    }
  }

  captureError(errorData) {
    if (!this.isEnabled) return;

    // Rate limiting
    if (!this.shouldReportError(errorData)) {
      return;
    }

    // Enhance error data
    const enhancedError = this.enhanceErrorData(errorData);
    
    // Add to queue
    this.errorQueue.push(enhancedError);
    
    // Trim queue if too large
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Attempt to send immediately
    this.sendErrorsToBackend();
  }

  shouldReportError(errorData) {
    const errorKey = this.getErrorKey(errorData);
    const now = Date.now();
    const windowStart = now - this.rateLimitWindow;
    
    // Clean old entries
    this.errorCounts.forEach((timestamps, key) => {
      this.errorCounts.set(key, timestamps.filter(t => t > windowStart));
    });

    // Check rate limit for this error type
    const errorTimestamps = this.errorCounts.get(errorKey) || [];
    if (errorTimestamps.length >= this.maxErrorsPerWindow) {
      return false;
    }

    // Add this error
    errorTimestamps.push(now);
    this.errorCounts.set(errorKey, errorTimestamps);
    
    return true;
  }

  getErrorKey(errorData) {
    // Create a key based on error type and message for rate limiting
    return `${errorData.type}:${errorData.message?.substring(0, 100) || 'unknown'}`;
  }

  enhanceErrorData(errorData) {
    return {
      ...errorData,
      sessionId: this.sessionId,
      extensionVersion: this.extensionVersion,
      userAgent: navigator.userAgent,
      timestamp: errorData.timestamp || new Date().toISOString(),
      pageUrl: this.sanitizeUrl(window.location.href),
      referrer: this.sanitizeUrl(document.referrer),
      
      // Browser context
      browserInfo: {
        language: navigator.language,
        platform: navigator.platform,
        cookieEnabled: navigator.cookieEnabled,
        onLine: navigator.onLine
      },

      // Performance context
      performanceInfo: this.getPerformanceInfo(),
      
      // Extension context
      extensionContext: this.getExtensionContext()
    };
  }

  sanitizeUrl(url) {
    try {
      const urlObj = new URL(url);
      // Remove query params and hash for privacy
      return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
    } catch {
      return 'invalid-url';
    }
  }

  getPerformanceInfo() {
    try {
      const perf = performance;
      return {
        memory: perf.memory ? {
          usedJSHeapSize: perf.memory.usedJSHeapSize,
          totalJSHeapSize: perf.memory.totalJSHeapSize,
          jsHeapSizeLimit: perf.memory.jsHeapSizeLimit
        } : null,
        timing: {
          loadEventEnd: perf.timing?.loadEventEnd,
          navigationStart: perf.timing?.navigationStart,
          domContentLoadedEventEnd: perf.timing?.domContentLoadedEventEnd
        }
      };
    } catch {
      return null;
    }
  }

  getExtensionContext() {
    return {
      isContentScript: typeof chrome !== 'undefined' && chrome.runtime,
      documentState: document.readyState,
      visibilityState: document.visibilityState,
      focusState: document.hasFocus()
    };
  }

  async sendErrorsToBackend() {
    if (this.errorQueue.length === 0 || !this.isEnabled) return;

    try {
      const errors = [...this.errorQueue];
      this.errorQueue = []; // Clear queue immediately

      const payload = {
        errors,
        sessionId: this.sessionId,
        extensionVersion: this.extensionVersion,
        timestamp: new Date().toISOString()
      };

      // Send via background script to avoid CORS issues
      chrome.runtime.sendMessage({
        action: 'SEND_TELEMETRY',
        data: payload
      }, (response) => {
        if (!response?.success) {
          // Put errors back in queue for retry
          this.errorQueue.unshift(...errors.slice(0, this.maxQueueSize - this.errorQueue.length));
        }
      });

    } catch (error) {
      // Silent fail - don't create infinite loop
      console.warn('[Telemetry] Failed to send errors:', error.message);
    }
  }

  generateSessionId() {
    // Generate anonymous session ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2);
    return `${timestamp}-${random}`;
  }

  // Manual error reporting for caught exceptions
  reportError(error, context = {}) {
    if (!this.isEnabled) return;

    this.captureError({
      type: 'manual_report',
      message: error.message || String(error),
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }

  // Report feature usage (for debugging context)
  reportFeatureUsage(featureName, success = true, metadata = {}) {
    if (!this.isEnabled) return;

    this.captureError({
      type: 'feature_usage',
      featureName,
      success,
      metadata,
      timestamp: new Date().toISOString(),
      url: window.location.href
    });
  }

  // Disable telemetry
  async disable() {
    this.isEnabled = false;
    this.errorQueue = [];
    await chrome.storage.sync.set({ telemetryConsent: false });
  }

  // Enable telemetry
  async enable() {
    this.isEnabled = true;
    await chrome.storage.sync.set({ telemetryConsent: true });
    this.setupErrorHandlers();
  }

  // Get telemetry status
  getStatus() {
    return {
      enabled: this.isEnabled,
      sessionId: this.sessionId,
      queueSize: this.errorQueue.length,
      extensionVersion: this.extensionVersion
    };
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorReporter;
} else {
  window.ErrorReporter = ErrorReporter;
}

// Auto-initialize if in browser context
if (typeof window !== 'undefined' && !window.errorReporter) {
  window.errorReporter = new ErrorReporter();
}
} // Close the if (typeof ErrorReporter === 'undefined')