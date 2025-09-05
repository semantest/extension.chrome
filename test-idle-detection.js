#!/usr/bin/env node

/**
 * Script to test ChatGPT idle detection in real browser
 * Run with: node test-idle-detection.js
 */

const { chromium } = require('playwright');

async function testIdleDetection() {
  console.log('🎯 Testing ChatGPT Idle Detection...');
  
  let browser;
  let page;
  
  try {
    // Connect to existing browser (already logged into ChatGPT)
    console.log('📡 Connecting to browser on port 9222...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    
    // Get existing page or create new one
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    const pages = context.pages();
    
    // Find ChatGPT tab or create one
    page = pages.find(p => p.url().includes('chatgpt.com') || p.url().includes('chat.openai.com')) 
           || await context.newPage();
    
    // Navigate to ChatGPT if not already there
    if (!page.url().includes('chat')) {
      console.log('🌐 Navigating to ChatGPT...');
      await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    }
    
    console.log('✅ Connected to ChatGPT:', page.url());
    
    // Inject our state detector code
    console.log('💉 Injecting state detector...');
    await page.evaluate(() => {
      // ChatGPTStateDetector implementation (simplified for injection)
      window.ChatGPTStateDetector = class {
        constructor(doc = document) {
          this.document = doc;
          this.state = 'unknown';
          this.observer = null;
        }
        
        initialize() {
          this.observer = new MutationObserver(() => this.checkState());
          this.observer.observe(this.document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'style', 'class', 'aria-disabled']
          });
          this.checkState();
        }
        
        checkState() {
          const oldState = this.state;
          
          // Check textarea
          const textarea = this.document.querySelector('textarea, div[contenteditable="true"]');
          const sendButton = this.document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
          const spinner = this.document.querySelector('.animate-spin, [class*="spinner"], [class*="loading"]');
          
          if (spinner && this.isVisible(spinner)) {
            this.state = 'busy';
          } else if (textarea && !textarea.disabled && !textarea.getAttribute('aria-disabled')) {
            this.state = 'idle';
          } else if (sendButton && sendButton.disabled) {
            this.state = 'busy';
          } else {
            this.state = 'unknown';
          }
          
          if (this.state !== oldState) {
            console.log(`State changed: ${oldState} → ${this.state}`);
          }
          
          return this.state;
        }
        
        isVisible(elem) {
          if (!elem) return false;
          const style = window.getComputedStyle(elem);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
        
        getState() {
          return this.state;
        }
        
        destroy() {
          if (this.observer) {
            this.observer.disconnect();
          }
        }
      };
      
      // Initialize detector
      window.detector = new window.ChatGPTStateDetector();
      window.detector.initialize();
      
      return 'Detector initialized';
    });
    
    // Test 1: Check initial state
    console.log('\n📊 Test 1: Checking initial state...');
    const initialState = await page.evaluate(() => window.detector.getState());
    console.log(`Initial state: ${initialState}`);
    console.log(initialState === 'idle' ? '✅ PASS' : '❌ FAIL');
    
    // Test 2: Type a message and check state
    console.log('\n📊 Test 2: Testing state during message send...');
    
    // Find input field
    const inputSelector = 'textarea, div[contenteditable="true"][data-id]';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    
    // Type a test message
    console.log('💬 Typing test message...');
    await page.click(inputSelector);
    await page.type(inputSelector, 'What is 2+2? (This is an automated test)');
    
    // Check state before sending
    const beforeSend = await page.evaluate(() => window.detector.getState());
    console.log(`State before send: ${beforeSend}`);
    
    // Send message
    console.log('📤 Sending message...');
    await page.keyboard.press('Enter');
    
    // Check state immediately after sending
    await page.waitForTimeout(500);
    const afterSend = await page.evaluate(() => window.detector.getState());
    console.log(`State after send: ${afterSend}`);
    console.log(afterSend === 'busy' ? '✅ PASS' : '⚠️  WARNING (might be too fast)');
    
    // Wait for response to complete
    console.log('⏳ Waiting for response...');
    await page.waitForFunction(
      () => window.detector.getState() === 'idle',
      { timeout: 30000 }
    ).catch(() => console.log('Timeout waiting for idle'));
    
    const finalState = await page.evaluate(() => window.detector.getState());
    console.log(`Final state: ${finalState}`);
    console.log(finalState === 'idle' ? '✅ PASS' : '❌ FAIL');
    
    // Test 3: Check selectors
    console.log('\n📊 Test 3: Verifying DOM selectors...');
    const selectorCheck = await page.evaluate(() => {
      const results = {
        textarea: !!document.querySelector('textarea, div[contenteditable="true"]'),
        sendButton: !!document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]'),
        responses: document.querySelectorAll('[data-message-author-role="assistant"]').length
      };
      return results;
    });
    
    console.log('Selector check:', selectorCheck);
    console.log(selectorCheck.textarea ? '✅ Input found' : '❌ Input not found');
    console.log(selectorCheck.sendButton ? '✅ Send button found' : '❌ Send button not found');
    console.log(`📝 ${selectorCheck.responses} responses found`);
    
    // Take screenshot
    console.log('\n📸 Taking screenshot...');
    await page.screenshot({ path: 'chatgpt-test-screenshot.png' });
    console.log('Screenshot saved: chatgpt-test-screenshot.png');
    
    // Cleanup
    await page.evaluate(() => {
      if (window.detector) {
        window.detector.destroy();
      }
    });
    
    console.log('\n✅ All tests completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Try to take error screenshot
    if (page) {
      await page.screenshot({ path: 'error-screenshot.png' }).catch(() => {});
    }
  } finally {
    // Don't close browser - it's the user's browser
    console.log('\n🔌 Tests complete (browser kept open)');
  }
}

// Run tests
testIdleDetection().catch(console.error);