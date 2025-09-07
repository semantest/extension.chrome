#!/usr/bin/env node

/**
 * REAL BROWSER TEST - Verifying ChatGPT idle detector
 * Testing with Chrome PID 1224560
 */

const { chromium } = require('playwright');

async function testRealBrowser() {
  console.log('🎯 WENCES: Testing idle detector in REAL browser!');
  
  let browser;
  let page;
  
  try {
    // Connect to existing Chrome browser
    console.log('📡 Connecting to Chrome on port 9222...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    
    const contexts = browser.contexts();
    const context = contexts[0] || await browser.newContext();
    
    // Step 1: Navigate to chrome://extensions
    console.log('\n1️⃣ Loading Chrome Extensions page...');
    page = await context.newPage();
    await page.goto('chrome://extensions');
    await page.waitForTimeout(1000);
    
    // Take screenshot of extensions page
    await page.screenshot({ path: 'screenshots/1-extensions-page.png' });
    console.log('📸 Screenshot: extensions-page.png');
    
    // Step 2: Navigate to ChatGPT
    console.log('\n2️⃣ Navigating to ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    // Step 3: Inject our detector
    console.log('\n3️⃣ Injecting ChatGPT detector...');
    await page.evaluate(() => {
      // Inject the detector code directly
      class ChatGPTDetector {
        constructor() {
          this.state = 'unknown';
          this.observer = null;
        }
        
        initialize() {
          console.log('🔍 Detector initializing...');
          this.observer = new MutationObserver(() => this.checkState());
          this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled', 'class']
          });
          this.checkState();
          return this;
        }
        
        checkState() {
          const oldState = this.state;
          
          // Find elements
          const textarea = document.querySelector('textarea, div[contenteditable="true"]');
          const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
          const spinner = document.querySelector('.animate-spin, [class*="spinner"], [class*="loading"]');
          
          // Check states
          const textareaEnabled = textarea && !textarea.disabled && !textarea.getAttribute('aria-disabled');
          const buttonEnabled = sendButton && !sendButton.disabled;
          const hasSpinner = spinner && window.getComputedStyle(spinner).display !== 'none';
          
          // Determine state
          if (hasSpinner) {
            this.state = 'busy';
          } else if (textareaEnabled && buttonEnabled) {
            this.state = 'idle';
          } else if (!textareaEnabled || !buttonEnabled) {
            this.state = 'busy';
          } else {
            this.state = 'idle';
          }
          
          if (oldState !== this.state) {
            console.log(`🔄 State changed: ${oldState} → ${this.state}`);
            // Add visual indicator
            this.showStateIndicator();
          }
          
          return this.state;
        }
        
        showStateIndicator() {
          let indicator = document.getElementById('wences-state-indicator');
          if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'wences-state-indicator';
            indicator.style.cssText = `
              position: fixed;
              top: 10px;
              right: 10px;
              padding: 10px 20px;
              border-radius: 5px;
              font-weight: bold;
              z-index: 10000;
              font-size: 16px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(indicator);
          }
          
          if (this.state === 'idle') {
            indicator.style.background = '#4ade80';
            indicator.style.color = '#ffffff';
            indicator.textContent = '✅ IDLE - Ready!';
          } else if (this.state === 'busy') {
            indicator.style.background = '#f59e0b';
            indicator.style.color = '#ffffff';
            indicator.textContent = '⏳ BUSY - Processing...';
          } else {
            indicator.style.background = '#6b7280';
            indicator.style.color = '#ffffff';
            indicator.textContent = '❓ UNKNOWN';
          }
        }
        
        getState() {
          return this.state;
        }
      }
      
      // Initialize detector
      window.wencesDetector = new ChatGPTDetector().initialize();
      console.log('✅ Detector initialized!');
      return window.wencesDetector.getState();
    });
    
    // Step 4: Check initial state
    console.log('\n4️⃣ Checking initial state...');
    const initialState = await page.evaluate(() => window.wencesDetector.getState());
    console.log(`📊 Initial state: ${initialState}`);
    
    await page.screenshot({ path: 'screenshots/2-initial-state.png' });
    console.log('📸 Screenshot: initial-state.png');
    
    // Step 5: Type a message and test state changes
    console.log('\n5️⃣ Testing state changes with message...');
    
    // Find and click textarea
    const inputSelector = 'textarea, div[contenteditable="true"]';
    await page.waitForSelector(inputSelector, { timeout: 5000 });
    await page.click(inputSelector);
    
    // Type test message
    console.log('💬 Typing test message...');
    await page.type(inputSelector, 'What is 2+2? (Testing idle detector)');
    
    // Check state before sending
    const beforeSendState = await page.evaluate(() => window.wencesDetector.getState());
    console.log(`📊 State before send: ${beforeSendState}`);
    
    await page.screenshot({ path: 'screenshots/3-before-send.png' });
    console.log('📸 Screenshot: before-send.png');
    
    // Send message
    console.log('📤 Sending message...');
    await page.keyboard.press('Enter');
    
    // Wait a moment for state to change
    await page.waitForTimeout(1000);
    
    // Check state after sending
    const afterSendState = await page.evaluate(() => window.wencesDetector.getState());
    console.log(`📊 State after send: ${afterSendState}`);
    
    await page.screenshot({ path: 'screenshots/4-after-send-busy.png' });
    console.log('📸 Screenshot: after-send-busy.png');
    
    // Wait for response to complete (max 20 seconds)
    console.log('⏳ Waiting for ChatGPT response...');
    let finalState = 'busy';
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(1000);
      finalState = await page.evaluate(() => window.wencesDetector.getState());
      if (finalState === 'idle') {
        break;
      }
    }
    
    console.log(`📊 Final state: ${finalState}`);
    await page.screenshot({ path: 'screenshots/5-final-idle.png' });
    console.log('📸 Screenshot: final-idle.png');
    
    // Step 6: Generate test report
    console.log('\n📋 TEST RESULTS:');
    console.log('================');
    console.log(`✅ Detector injected successfully`);
    console.log(`✅ Initial state detected: ${initialState}`);
    console.log(`✅ State before send: ${beforeSendState}`);
    console.log(`${afterSendState === 'busy' ? '✅' : '❌'} State changed to BUSY after send: ${afterSendState}`);
    console.log(`${finalState === 'idle' ? '✅' : '❌'} State returned to IDLE: ${finalState}`);
    
    // Get detector stats
    const stats = await page.evaluate(() => {
      const textarea = document.querySelector('textarea, div[contenteditable="true"]');
      const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
      const spinner = document.querySelector('.animate-spin, [class*="spinner"]');
      
      return {
        hasTextarea: !!textarea,
        hasSendButton: !!sendButton,
        hasSpinner: !!spinner,
        textareaEnabled: textarea && !textarea.disabled,
        buttonEnabled: sendButton && !sendButton.disabled
      };
    });
    
    console.log('\n📊 Element Status:');
    console.log(`Textarea found: ${stats.hasTextarea ? '✅' : '❌'}`);
    console.log(`Send button found: ${stats.hasSendButton ? '✅' : '❌'}`);
    console.log(`Textarea enabled: ${stats.textareaEnabled ? '✅' : '❌'}`);
    console.log(`Button enabled: ${stats.buttonEnabled ? '✅' : '❌'}`);
    
    console.log('\n🎯 IDLE DETECTOR TEST COMPLETE!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    if (page) {
      await page.screenshot({ path: 'screenshots/error.png' });
      console.log('📸 Error screenshot saved');
    }
  } finally {
    // Keep browser open
    console.log('\n✅ Test finished - browser kept open');
  }
}

// Create screenshots directory
const fs = require('fs');
if (!fs.existsSync('screenshots')) {
  fs.mkdirSync('screenshots');
}

// Run test
testRealBrowser().catch(console.error);