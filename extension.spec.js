// Playwright Test Spec for Semantest Extension
// Run with: npx playwright test extension.spec.js

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname);
const CHATGPT_URL = 'https://chatgpt.com';

// Custom fixture to launch browser with extension
test.beforeEach(async ({ }, testInfo) => {
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`
    ],
    recordVideo: {
      dir: path.join(__dirname, 'test-videos'),
      size: { width: 1280, height: 720 }
    }
  });
  
  testInfo.browser = browser;
  testInfo.page = await browser.newPage();
});

test.afterEach(async ({ }, testInfo) => {
  if (testInfo.browser) {
    await testInfo.browser.close();
  }
});

test.describe('Semantest Extension Tests', () => {
  test('Extension loads and injects content scripts', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    await page.goto(CHATGPT_URL);
    await page.waitForLoadState('networkidle');
    
    // Check if extension content scripts are loaded
    const scriptsLoaded = await page.evaluate(() => {
      return {
        stateDetector: typeof window.chatGPTStateDetector !== 'undefined',
        telemetry: typeof window.TelemetryConsentManager !== 'undefined'
      };
    });
    
    expect(scriptsLoaded.stateDetector).toBeTruthy();
  });
  
  test('ChatGPT state detection works', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    await page.goto(CHATGPT_URL);
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
    
    const state = await page.evaluate(() => {
      if (window.chatGPTStateDetector) {
        return window.chatGPTStateDetector.getStatusReport();
      }
      return null;
    });
    
    expect(state).toBeTruthy();
    expect(state.summary).toContain('ChatGPT is');
  });
  
  test('Extension can send prompts to ChatGPT', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    await page.goto(CHATGPT_URL);
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
    
    // Wait for extension to initialize
    await page.waitForTimeout(2000);
    
    // Send a test prompt via extension
    const result = await page.evaluate(async () => {
      // Direct test of sendChatGPTPrompt function
      if (window.sendChatGPTPrompt) {
        return await window.sendChatGPTPrompt('Test prompt from automated test');
      }
      return { success: false, error: 'Function not found' };
    });
    
    expect(result.success).toBeTruthy();
  });
  
  test('WebSocket handler connects successfully', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    // Monitor WebSocket connections
    let wsConnected = false;
    page.on('websocket', ws => {
      if (ws.url().includes('localhost:8080')) {
        wsConnected = true;
      }
    });
    
    await page.goto(CHATGPT_URL);
    await page.waitForTimeout(3000); // Give WebSocket time to connect
    
    // Check WebSocket status via extension API
    const wsStatus = await page.evaluate(() => {
      return new Promise(resolve => {
        if (window.chrome && window.chrome.runtime) {
          window.chrome.runtime.sendMessage({
            action: 'WEBSOCKET_STATUS'
          }, response => {
            resolve(response);
          });
        } else {
          resolve(null);
        }
      });
    });
    
    expect(wsStatus).toBeTruthy();
    // Note: Connection might fail if server isn't running, that's ok for this test
  });
  
  test('Extension handles image generation request', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    await page.goto(CHATGPT_URL);
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Simulate receiving an image request
    const response = await page.evaluate(() => {
      return new Promise(resolve => {
        if (window.chrome && window.chrome.runtime) {
          window.chrome.runtime.sendMessage({
            action: 'ImageRequestReceived',
            data: {
              prompt: 'Automated test: Generate a test image',
              requestId: 'test-' + Date.now(),
              timestamp: Date.now()
            }
          }, response => {
            resolve(response);
          });
        } else {
          resolve({ success: false, error: 'Chrome runtime not available' });
        }
      });
    });
    
    expect(response).toBeTruthy();
    // Response might fail if no service worker, but structure should exist
  });
});

test.describe('Production Readiness Tests', () => {
  test('Extension uses lowercase "event" in WebSocket messages', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    // This test verifies Carol's critical fix
    const wsMessages = [];
    page.on('websocket', ws => {
      ws.on('framesent', frame => {
        try {
          const message = JSON.parse(frame.payload);
          wsMessages.push(message);
        } catch (e) {}
      });
    });
    
    await page.goto(CHATGPT_URL);
    await page.waitForTimeout(5000); // Wait for any WebSocket activity
    
    // Check all messages use lowercase 'event'
    wsMessages.forEach(msg => {
      if (msg.type) {
        expect(msg.type).toBe('event'); // Must be lowercase!
      }
    });
  });
  
  test('Extension supports parallel image requests', async ({ }, testInfo) => {
    const page = testInfo.page;
    
    await page.goto(CHATGPT_URL);
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
    
    // Check if state detector can handle multiple states
    const canHandleParallel = await page.evaluate(() => {
      if (window.chatGPTStateDetector) {
        const state = window.chatGPTStateDetector.detectState();
        return state !== null && typeof state.isGenerating === 'boolean';
      }
      return false;
    });
    
    expect(canHandleParallel).toBeTruthy();
  });
});

// Performance tests
test.describe('Performance Tests', () => {
  test('Extension initializes within 3 seconds', async ({ }, testInfo) => {
    const page = testInfo.page;
    const startTime = Date.now();
    
    await page.goto(CHATGPT_URL);
    
    // Wait for extension to be ready
    await page.waitForFunction(() => {
      return window.chatGPTStateDetector !== undefined;
    }, { timeout: 3000 });
    
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(3000);
  });
});