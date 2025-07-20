// E2E Test Setup for ChatGPT Browser Extension
const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '../../dist');
const EXTENSION_ID = 'your-extension-id-here'; // Update with actual extension ID

async function setupBrowser() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for CI/CD
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--no-sandbox',
      '--disable-setuid-sandbox'
    ]
  });

  // Wait for extension to load
  await new Promise(resolve => setTimeout(resolve, 2000));

  return browser;
}

async function getExtensionPage(browser) {
  const targets = await browser.targets();
  const extensionTarget = targets.find(target => 
    target.type() === 'page' && 
    target.url().includes(`chrome-extension://${EXTENSION_ID}`)
  );
  
  if (extensionTarget) {
    return await extensionTarget.page();
  }

  // If no extension page found, create one
  const page = await browser.newPage();
  await page.goto(`chrome-extension://${EXTENSION_ID}/popup.html`);
  return page;
}

async function clearExtensionData(page) {
  // Clear all stored data before each test
  await page.evaluate(() => {
    localStorage.clear();
    chrome.storage.local.clear();
  });
}

module.exports = {
  setupBrowser,
  getExtensionPage,
  clearExtensionData,
  EXTENSION_ID
};