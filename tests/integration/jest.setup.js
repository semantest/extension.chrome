/**
 * Jest Setup for Integration Tests
 * Global configuration and utilities for ChatGPT DOM testing
 */

const testUtils = require('./setup');

// Increase timeout for integration tests
jest.setTimeout(60000);

// Global test utilities
global.testUtils = testUtils;

// Custom matchers for Puppeteer
expect.extend({
  async toHaveSelector(page, selector) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      return {
        pass: true,
        message: () => `Expected page not to have selector "${selector}"`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected page to have selector "${selector}"`
      };
    }
  },
  
  async toHaveText(page, selector, expectedText) {
    try {
      const actualText = await page.$eval(selector, el => el.textContent.trim());
      const pass = actualText.includes(expectedText);
      return {
        pass,
        message: () => pass
          ? `Expected "${selector}" not to contain text "${expectedText}"`
          : `Expected "${selector}" to contain text "${expectedText}", but got "${actualText}"`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Element "${selector}" not found`
      };
    }
  },
  
  async toBeEnabled(page, selector) {
    try {
      const isDisabled = await page.$eval(selector, el => el.disabled);
      return {
        pass: !isDisabled,
        message: () => isDisabled
          ? `Expected "${selector}" to be enabled`
          : `Expected "${selector}" to be disabled`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Element "${selector}" not found`
      };
    }
  }
});

// Error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in tests:', reason);
});

// Cleanup on exit
process.on('exit', async () => {
  await testUtils.cleanup();
});

// Screenshot on test failure
global.afterEach(async function() {
  if (this.currentTest && this.currentTest.state === 'failed' && global.page) {
    const testName = this.currentTest.fullTitle().replace(/\s+/g, '-');
    await testUtils.takeScreenshot(global.page, `failure-${testName}`);
  }
});

// Console output formatting
const originalConsoleLog = console.log;
console.log = (...args) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  originalConsoleLog(`[${timestamp}]`, ...args);
};