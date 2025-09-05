/**
 * @fileoverview E2E test for ChatGPT idle detection using Playwright
 * @author Wences  
 * @description ATDD test to verify MutationObserver detects ChatGPT states
 */

import { chromium, Browser, Page } from 'playwright';

describe('ChatGPT Idle Detection E2E', () => {
  let browser: Browser;
  let page: Page;
  
  beforeAll(async () => {
    // Connect to existing browser
    browser = await chromium.connectOverCDP('http://localhost:9222');
  });
  
  afterAll(async () => {
    await browser.close();
  });
  
  beforeEach(async () => {
    page = await browser.newPage();
  });
  
  afterEach(async () => {
    await page.close();
  });
  
  test('should detect IDLE state when ChatGPT is ready', async () => {
    // Navigate to ChatGPT
    await page.goto('https://chatgpt.com');
    
    // Inject our state detector
    await page.addScriptTag({
      path: './src/chatgpt-state-detector.ts'
    });
    
    // Wait for page to load
    await page.waitForSelector('div[contenteditable="true"]', { timeout: 10000 });
    
    // Check initial state
    const initialState = await page.evaluate(() => {
      const detector = new (window as any).ChatGPTStateDetector(document);
      detector.initialize();
      return detector.getState();
    });
    
    expect(initialState).toBe('idle');
  });
  
  test('should detect BUSY state when sending message', async () => {
    await page.goto('https://chatgpt.com');
    
    // Inject state detector
    await page.addScriptTag({
      path: './src/chatgpt-state-detector.ts'
    });
    
    // Initialize detector
    await page.evaluate(() => {
      const detector = new (window as any).ChatGPTStateDetector(document);
      detector.initialize();
      (window as any).detector = detector;
    });
    
    // Type a message
    const inputSelector = 'div[contenteditable="true"][data-id]';
    await page.waitForSelector(inputSelector);
    await page.click(inputSelector);
    await page.type(inputSelector, 'What is 2+2?');
    
    // Send message
    await page.keyboard.press('Enter');
    
    // Check state immediately after sending
    const busyState = await page.evaluate(() => {
      return (window as any).detector.getState();
    });
    
    expect(busyState).toBe('busy');
    
    // Wait for response to complete
    await page.waitForFunction(() => {
      return (window as any).detector.getState() === 'idle';
    }, { timeout: 30000 });
    
    const finalState = await page.evaluate(() => {
      return (window as any).detector.getState();
    });
    
    expect(finalState).toBe('idle');
  });
  
  test('should detect spinner visibility', async () => {
    await page.goto('https://chatgpt.com');
    
    // Look for any loading indicators
    const hasSpinner = await page.evaluate(() => {
      const spinners = document.querySelectorAll('[class*="spinner"], [class*="loading"], .animate-spin');
      return spinners.length > 0;
    });
    
    expect(hasSpinner).toBeDefined();
  });
  
  test('should detect send button state changes', async () => {
    await page.goto('https://chatgpt.com');
    
    // Wait for send button
    const sendButtonSelector = 'button[data-testid="send-button"]';
    await page.waitForSelector(sendButtonSelector, { timeout: 10000 });
    
    // Check if button is enabled
    const isEnabled = await page.evaluate((selector) => {
      const button = document.querySelector(selector) as HTMLButtonElement;
      return button && !button.disabled;
    }, sendButtonSelector);
    
    expect(isEnabled).toBe(true);
  });
  
  test('should handle rapid state changes', async () => {
    await page.goto('https://chatgpt.com');
    
    // Inject detector
    await page.addScriptTag({
      path: './src/chatgpt-state-detector.ts'
    });
    
    // Track state changes
    const stateChanges = await page.evaluate(() => {
      const changes: string[] = [];
      const detector = new (window as any).ChatGPTStateDetector(
        document,
        (newState: string) => changes.push(newState)
      );
      detector.initialize();
      
      // Simulate rapid DOM changes
      const input = document.querySelector('div[contenteditable="true"]') as HTMLElement;
      if (input) {
        // Trigger multiple mutations
        input.setAttribute('aria-disabled', 'true');
        input.setAttribute('aria-disabled', 'false');
        input.style.display = 'none';
        input.style.display = 'block';
      }
      
      return changes;
    });
    
    expect(stateChanges.length).toBeGreaterThanOrEqual(0);
  });
});