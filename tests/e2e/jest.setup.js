// Jest setup file
const { setupBrowser, getExtensionPage, clearExtensionData } = require('./setup');

// Global test helpers
global.setupBrowser = setupBrowser;
global.getExtensionPage = getExtensionPage;
global.clearExtensionData = clearExtensionData;

// Increase default timeout for E2E tests
jest.setTimeout(30000);

// Custom matchers
expect.extend({
  async toBeVisibleInPage(page, selector) {
    try {
      await page.waitForSelector(selector, { visible: true, timeout: 5000 });
      return {
        pass: true,
        message: () => `Expected ${selector} not to be visible`
      };
    } catch (error) {
      return {
        pass: false,
        message: () => `Expected ${selector} to be visible`
      };
    }
  },
  
  async toHaveText(element, expectedText) {
    const actualText = await element.evaluate(el => el.textContent.trim());
    const pass = actualText === expectedText;
    return {
      pass,
      message: () => pass
        ? `Expected element not to have text "${expectedText}"`
        : `Expected element to have text "${expectedText}", but got "${actualText}"`
    };
  }
});