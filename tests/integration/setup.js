/**
 * Integration Test Setup
 * Configuration and utilities for ChatGPT DOM integration testing
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs').promises;

// Test configuration
const config = {
  extensionPath: path.join(__dirname, '../../dist'),
  extensionId: process.env.EXTENSION_ID || 'your-extension-id',
  chatGPTUrl: 'https://chatgpt.com',
  testTimeout: 30000,
  headless: process.env.HEADLESS === 'true',
  slowMo: parseInt(process.env.SLOW_MO || '0'),
  userDataDir: path.join(__dirname, '../../test-profile'),
  screenshotDir: path.join(__dirname, '../../screenshots')
};

/**
 * Launch browser with extension loaded
 */
async function launchBrowser(options = {}) {
  const launchOptions = {
    headless: options.headless ?? config.headless,
    slowMo: options.slowMo ?? config.slowMo,
    args: [
      `--disable-extensions-except=${config.extensionPath}`,
      `--load-extension=${config.extensionPath}`,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process'
    ],
    userDataDir: options.persistProfile ? config.userDataDir : undefined
  };

  if (options.viewport) {
    launchOptions.defaultViewport = options.viewport;
  }

  return await puppeteer.launch(launchOptions);
}

/**
 * Navigate to ChatGPT and wait for content script
 */
async function setupChatGPTPage(browser, options = {}) {
  const page = await browser.newPage();
  
  // Set viewport
  await page.setViewport(options.viewport || { width: 1280, height: 800 });
  
  // Enable console logging
  if (options.logConsole) {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  }
  
  // Navigate to ChatGPT
  await page.goto(config.chatGPTUrl, { 
    waitUntil: options.waitUntil || 'networkidle2',
    timeout: options.timeout || config.testTimeout
  });
  
  // Wait for content script to initialize
  try {
    await page.waitForFunction(
      () => window.chatGPTController?.isInitialized,
      { timeout: options.initTimeout || 15000 }
    );
  } catch (error) {
    console.error('Content script initialization timeout');
    throw error;
  }
  
  return page;
}

/**
 * Login to ChatGPT (if needed)
 */
async function loginToChatGPT(page, credentials) {
  // Check if already logged in
  const isLoggedIn = await page.evaluate(() => {
    return !!document.querySelector('textarea[placeholder*="Message"]');
  });
  
  if (isLoggedIn) {
    console.log('Already logged in to ChatGPT');
    return true;
  }
  
  console.log('Logging in to ChatGPT...');
  
  // Click login button
  await page.click('button:has-text("Log in")');
  await page.waitForNavigation({ waitUntil: 'networkidle2' });
  
  // Enter email
  await page.type('input[name="email"]', credentials.email);
  await page.click('button[type="submit"]');
  
  // Enter password
  await page.waitForSelector('input[name="password"]');
  await page.type('input[name="password"]', credentials.password);
  await page.click('button[type="submit"]');
  
  // Wait for main interface
  await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
  
  return true;
}

/**
 * Take screenshot for debugging
 */
async function takeScreenshot(page, name) {
  try {
    await fs.mkdir(config.screenshotDir, { recursive: true });
    const filename = `${name}-${Date.now()}.png`;
    const filepath = path.join(config.screenshotDir, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    console.log(`Screenshot saved: ${filename}`);
    return filepath;
  } catch (error) {
    console.error('Failed to take screenshot:', error);
    return null;
  }
}

/**
 * Mock Chrome extension API for content script
 */
async function mockChromeAPI(page) {
  await page.evaluateOnNewDocument(() => {
    if (!window.chrome) {
      window.chrome = {};
    }
    
    if (!window.chrome.runtime) {
      window.chrome.runtime = {
        sendMessage: (message, callback) => {
          // Simulate extension message handling
          window.postMessage({
            source: 'MOCK_EXTENSION',
            type: 'RUNTIME_MESSAGE',
            message: message,
            callbackId: Date.now()
          }, '*');
          
          // Listen for response
          const responseHandler = (event) => {
            if (event.data.source === 'MOCK_EXTENSION_RESPONSE' && 
                event.data.callbackId === callbackId) {
              window.removeEventListener('message', responseHandler);
              if (callback) callback(event.data.response);
            }
          };
          
          window.addEventListener('message', responseHandler);
        },
        
        onMessage: {
          addListener: (listener) => {
            window.addEventListener('message', (event) => {
              if (event.data.source === 'MOCK_EXTENSION_MESSAGE') {
                listener(event.data.message, {}, (response) => {
                  window.postMessage({
                    source: 'MOCK_EXTENSION_RESPONSE',
                    messageId: event.data.messageId,
                    response: response
                  }, '*');
                });
              }
            });
          }
        }
      };
    }
  });
}

/**
 * Wait for ChatGPT response to complete
 */
async function waitForResponse(page, timeout = 30000) {
  // Wait for streaming indicator to appear
  await page.waitForSelector('[data-testid="streaming-indicator"], .result-streaming', {
    timeout: 5000
  });
  
  // Wait for streaming to complete
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="streaming-indicator"], .result-streaming'),
    { timeout }
  );
  
  // Additional wait for DOM updates
  await page.waitForTimeout(500);
}

/**
 * Extract conversation messages
 */
async function getConversationMessages(page) {
  return await page.evaluate(() => {
    const messages = [];
    const messageElements = document.querySelectorAll('[data-message-author-role]');
    
    messageElements.forEach(element => {
      messages.push({
        role: element.getAttribute('data-message-author-role'),
        content: element.textContent.trim()
      });
    });
    
    return messages;
  });
}

/**
 * Create test utilities object
 */
const testUtils = {
  config,
  launchBrowser,
  setupChatGPTPage,
  loginToChatGPT,
  takeScreenshot,
  mockChromeAPI,
  waitForResponse,
  getConversationMessages,
  
  // Helper to wait for element and click
  async clickElement(page, selector, options = {}) {
    await page.waitForSelector(selector, options);
    await page.click(selector);
  },
  
  // Helper to wait for element and type
  async typeInElement(page, selector, text, options = {}) {
    await page.waitForSelector(selector, options);
    await page.click(selector);
    await page.keyboard.type(text, { delay: options.delay || 50 });
  },
  
  // Helper to check if element exists
  async elementExists(page, selector) {
    try {
      await page.waitForSelector(selector, { timeout: 1000 });
      return true;
    } catch {
      return false;
    }
  },
  
  // Helper to get element text
  async getElementText(page, selector) {
    try {
      return await page.$eval(selector, el => el.textContent.trim());
    } catch {
      return null;
    }
  },
  
  // Helper to wait for navigation
  async navigateAndWait(page, action, options = {}) {
    const [response] = await Promise.all([
      page.waitForNavigation(options),
      action()
    ]);
    return response;
  },
  
  // Clean up test artifacts
  async cleanup() {
    try {
      // Clean screenshots older than 1 day
      const files = await fs.readdir(config.screenshotDir);
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      
      for (const file of files) {
        const filepath = path.join(config.screenshotDir, file);
        const stats = await fs.stat(filepath);
        if (now - stats.mtime.getTime() > oneDay) {
          await fs.unlink(filepath);
        }
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }
};

module.exports = testUtils;