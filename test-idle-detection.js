#!/usr/bin/env node

/**
 * 🔴 RED PHASE - Test for IDLE state detection
 * This test SHOULD FAIL initially, then we make it pass
 */

const { chromium } = require('playwright');

async function testIdleDetection() {
  console.log('🔴 TDD Phase: RED - Writing failing test for IDLE detection');
  console.log('================================================\n');
  
  let browser;
  let page;
  
  try {
    // Connect to Chrome
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    page = await context.newPage();
    
    // Navigate to ChatGPT
    console.log('📍 Navigating to ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    
    // Inject improved detector
    console.log('💉 Injecting improved SEMANTEST detector...');
    await page.evaluate(() => {
      window.semantestDetector = {
        state: 'unknown',
        observer: null,
        
        init() {
          console.log('🔴 TDD: Initializing detector for IDLE test');
          
          // Visual indicator
          const indicator = document.createElement('div');
          indicator.id = 'tdd-indicator';
          indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #dc2626;
            color: white;
            font-weight: bold;
            font-size: 18px;
            border-radius: 8px;
            z-index: 99999;
          `;
          indicator.textContent = '🔴 TDD: Testing IDLE';
          document.body.appendChild(indicator);
          
          this.observer = new MutationObserver(() => this.checkState());
          this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'aria-disabled', 'class', 'style', 'data-state']
          });
          
          // Delay initial check to let page stabilize
          setTimeout(() => this.checkState(), 1000);
          return true;
        },
        
        checkState() {
          const oldState = this.state;
          
          // Find ChatGPT elements
          const textarea = document.querySelector('textarea#prompt-textarea');
          const contentEditable = document.querySelector('div[contenteditable="true"]');
          const inputElement = contentEditable || textarea;
          
          // Find send button
          const sendButton = 
            document.querySelector('button[data-testid="send-button"]') ||
            document.querySelector('button[data-testid="fruitjuice-send-button"]') ||
            document.querySelector('button[aria-label*="Send"]') ||
            document.querySelector('form button:last-child');
          
          // Check for ANY loading indicators
          const hasSpinner = !!document.querySelector('.animate-spin, [class*="spinner"]');
          const hasStreaming = !!document.querySelector('.result-streaming');
          const hasPending = !!document.querySelector('[data-state="pending"], [data-state="loading"]');
          
          // Get last assistant message
          const assistantMessages = document.querySelectorAll('[data-message-author-role="assistant"]');
          const lastMessage = assistantMessages[assistantMessages.length - 1];
          const isGenerating = lastMessage?.querySelector('.result-streaming') !== null;
          
          // Determine state
          if (hasSpinner || hasStreaming || hasPending || isGenerating) {
            this.state = 'busy';
          } else if (inputElement && sendButton) {
            // Both elements exist, check if enabled
            const inputOk = !inputElement.disabled && inputElement.getAttribute('aria-disabled') !== 'true';
            const buttonOk = !sendButton.disabled && sendButton.getAttribute('aria-disabled') !== 'true';
            
            this.state = (inputOk && buttonOk) ? 'idle' : 'busy';
          } else {
            // Page not ready
            this.state = 'unknown';
          }
          
          if (oldState !== this.state) {
            console.log(`🔴 TDD State Change: ${oldState} → ${this.state}`);
            this.updateIndicator();
          }
          
          return this.state;
        },
        
        updateIndicator() {
          const indicator = document.getElementById('tdd-indicator');
          if (indicator) {
            if (this.state === 'idle') {
              indicator.style.background = '#10b981';
              indicator.textContent = '✅ TDD: IDLE (Test Passing!)';
            } else if (this.state === 'busy') {
              indicator.style.background = '#f59e0b';
              indicator.textContent = '🔴 TDD: BUSY';
            } else {
              indicator.style.background = '#dc2626';
              indicator.textContent = '🔴 TDD: UNKNOWN';
            }
          }
        }
      };
      
      return window.semantestDetector.init();
    });
    
    // Wait for initial state
    await page.waitForTimeout(2000);
    
    // TEST 1: Initial state
    console.log('\n🧪 TEST 1: Initial state should be IDLE');
    const initialState = await page.evaluate(() => window.semantestDetector.state);
    console.log(`   Result: ${initialState} ${initialState === 'idle' ? '✅' : '🔴'}`);
    
    // Take screenshot
    await page.screenshot({ path: 'evidence/tdd-initial-state.png' });
    
    console.log('\n📊 TDD Test Results:');
    console.log('====================');
    if (initialState === 'idle') {
      console.log('✅ GREEN: Test passing - detector correctly identifies IDLE state!');
    } else {
      console.log('🔴 RED: Test failing - need to fix IDLE detection');
    }
    
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testIdleDetection().catch(console.error);
