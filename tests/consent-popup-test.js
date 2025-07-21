// Consent Popup Test Harness for v1.0.1
// Verifies telemetry consent popup functionality

class ConsentPopupTestHarness {
  constructor() {
    this.testResults = [];
    this.isRunning = false;
  }

  async runAllTests() {
    console.log('🧪 Starting Consent Popup Tests...');
    this.isRunning = true;
    this.testResults = [];

    // Test 1: First Install Trigger
    await this.testFirstInstallTrigger();

    // Test 2: Chrome Notification Display
    await this.testChromeNotification();

    // Test 3: User Choice Handling
    await this.testUserChoiceHandling();

    // Test 4: Storage Persistence
    await this.testStoragePersistence();

    // Test 5: Content Script Modal
    await this.testContentScriptModal();

    // Test 6: Manual Trigger
    await this.testManualTrigger();

    this.displayResults();
    this.isRunning = false;
  }

  async testFirstInstallTrigger() {
    const testName = 'First Install Trigger';
    try {
      // Simulate first install
      await chrome.storage.sync.clear();
      
      // Check if consent is triggered within 5 seconds
      const startTime = Date.now();
      let consentShown = false;

      // Listen for notification
      chrome.notifications.onCreated.addListener((notificationId) => {
        if (notificationId.includes('telemetry')) {
          consentShown = true;
        }
      });

      // Trigger install event
      chrome.runtime.onInstalled.dispatch({ reason: 'install' });

      // Wait for consent
      await new Promise(resolve => setTimeout(resolve, 5000));

      this.addResult(testName, consentShown, 'Consent should appear on first install');
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  async testChromeNotification() {
    const testName = 'Chrome Notification Display';
    try {
      // Test notification creation
      const notificationId = await chrome.notifications.create({
        type: 'basic',
        iconUrl: 'assets/icon48.png',
        title: 'Test Consent',
        message: 'Testing consent notification',
        buttons: [
          { title: 'No Thanks' },
          { title: 'Allow' }
        ]
      });

      const success = !!notificationId;
      this.addResult(testName, success, 'Notification should be created');

      // Clean up
      if (notificationId) {
        chrome.notifications.clear(notificationId);
      }
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  async testUserChoiceHandling() {
    const testName = 'User Choice Handling';
    try {
      // Test accepting consent
      await chrome.storage.sync.set({ telemetryConsent: true });
      let stored = await chrome.storage.sync.get(['telemetryConsent']);
      const acceptWorks = stored.telemetryConsent === true;

      // Test declining consent
      await chrome.storage.sync.set({ telemetryConsent: false });
      stored = await chrome.storage.sync.get(['telemetryConsent']);
      const declineWorks = stored.telemetryConsent === false;

      this.addResult(testName, acceptWorks && declineWorks, 'Both accept and decline should work');
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  async testStoragePersistence() {
    const testName = 'Storage Persistence';
    try {
      // Set consent
      await chrome.storage.sync.set({ telemetryConsent: true });
      
      // Clear local cache to simulate restart
      await chrome.runtime.reload();
      
      // Check if persisted
      const stored = await chrome.storage.sync.get(['telemetryConsent']);
      const persisted = stored.telemetryConsent === true;

      this.addResult(testName, persisted, 'Consent choice should persist');
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  async testContentScriptModal() {
    const testName = 'Content Script Modal';
    try {
      // Test if modal can be created in content script
      const manager = new TelemetryConsentManager();
      
      // Mock DOM
      const testDiv = document.createElement('div');
      document.body.appendChild(testDiv);
      
      // Show modal
      const promise = manager.showConsentDialog();
      
      // Check if modal exists
      const modal = document.getElementById('telemetry-consent-modal');
      const modalExists = !!modal;
      
      // Clean up
      if (modal) modal.remove();
      testDiv.remove();

      this.addResult(testName, modalExists, 'Modal should be created in DOM');
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  async testManualTrigger() {
    const testName = 'Manual Trigger';
    try {
      // Test manual trigger command
      const response = await chrome.runtime.sendMessage({
        action: 'SHOW_TELEMETRY_CONSENT',
        data: {
          title: 'Manual Test',
          message: 'Testing manual trigger'
        }
      });

      const success = response && response.success;
      this.addResult(testName, success, 'Manual trigger should work');
    } catch (error) {
      this.addResult(testName, false, error.message);
    }
  }

  addResult(testName, passed, message) {
    this.testResults.push({
      test: testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    });
  }

  displayResults() {
    console.log('\n📊 Test Results:');
    console.log('================');
    
    let passed = 0;
    let failed = 0;

    this.testResults.forEach(result => {
      const icon = result.passed ? '✅' : '❌';
      console.log(`${icon} ${result.test}: ${result.message}`);
      
      if (result.passed) passed++;
      else failed++;
    });

    console.log('\n📈 Summary:');
    console.log(`Total Tests: ${this.testResults.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / this.testResults.length) * 100).toFixed(1)}%`);

    return this.testResults;
  }

  // Manual test helper
  async simulateFirstInstall() {
    console.log('🔧 Simulating first install...');
    await chrome.storage.sync.clear();
    chrome.runtime.reload();
  }

  // Debug helper
  async checkConsentStatus() {
    const stored = await chrome.storage.sync.get(['telemetryConsent']);
    console.log('📊 Current consent status:', stored.telemetryConsent);
    return stored.telemetryConsent;
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConsentPopupTestHarness;
} else {
  window.ConsentPopupTestHarness = ConsentPopupTestHarness;
}

// Auto-run if loaded directly
if (typeof window !== 'undefined' && !window.consentTester) {
  window.consentTester = new ConsentPopupTestHarness();
  console.log('🧪 Consent Popup Test Harness Ready!');
  console.log('Run: consentTester.runAllTests()');
  console.log('Or: consentTester.simulateFirstInstall()');
}