#!/usr/bin/env node

/**
 * ✅ GREEN PHASE - Fix detector to pass tests
 */

const { chromium } = require('playwright');

async function greenPhaseTest() {
  console.log('✅ TDD Phase: GREEN - Making tests pass');
  console.log('=========================================\n');
  
  let browser;
  let page;
  
  try {
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    page = await context.newPage();
    
    console.log('📍 Navigating to ChatGPT...');
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(4000); // Give more time for page to stabilize
    
    console.log('✅ Injecting FIXED detector...');
    await page.evaluate(() => {
      window.semantestDetector = {
        state: 'unknown',
        observer: null,
        
        init() {
          console.log('✅ GREEN: Initializing FIXED detector');
          
          const indicator = document.createElement('div');
          indicator.id = 'green-indicator';
          indicator.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 25px;
            background: #10b981;
            color: white;
            font-weight: bold;
            font-size: 18px;
            border-radius: 8px;
            z-index: 99999;
          `;
          indicator.textContent = '✅ GREEN: Testing';
          document.body.appendChild(indicator);
          
          // FIXED: More comprehensive observation
          this.observer = new MutationObserver(() => {
            requestAnimationFrame(() => this.checkState());
          });
          
          this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
            attributeOldValue: true
          });
          
          // FIXED: Check state after DOM settles
          setTimeout(() => {
            this.checkState();
            // Double-check after a moment
            setTimeout(() => this.checkState(), 1000);
          }, 500);
          
          return true;
        },
        
        checkState() {
          const oldState = this.state;
          
          // FIXED: More robust element detection
          const possibleInputs = [
            document.querySelector('div[contenteditable="true"]'),
            document.querySelector('textarea#prompt-textarea'),
            document.querySelector('[role="textbox"]'),
            document.querySelector('div.ProseMirror')
          ].filter(Boolean);
          
          const inputElement = possibleInputs[0];
          
          // FIXED: Better send button detection
          const possibleButtons = [
            document.querySelector('button[data-testid="send-button"]'),
            document.querySelector('button[data-testid="fruitjuice-send-button"]'),
            document.querySelector('button[aria-label*="Send"]'),
            document.querySelector('button svg path[d*="M4.5 12"]')?.closest('button'),
            Array.from(document.querySelectorAll('button')).find(b => 
              b.querySelector('svg') && !b.disabled
            )
          ].filter(Boolean);
          
          const sendButton = possibleButtons[0];
          
          // FIXED: Comprehensive busy indicators
          const busyIndicators = [
            // Spinners
            document.querySelector('.animate-spin'),
            document.querySelector('[class*="spinner"]'),
            // Streaming
            document.querySelector('.result-streaming'),
            document.querySelector('.streaming'),
            // States
            document.querySelector('[data-state="pending"]'),
            document.querySelector('[data-state="loading"]'),
            document.querySelector('[data-state="generating"]'),
            // Check if actively generating
            Array.from(document.querySelectorAll('[data-message-author-role="assistant"]'))
              .some(msg => msg.textContent.includes('●'))
          ];
          
          const isBusy = busyIndicators.some(indicator => indicator);
          
          // FIXED: Better state determination
          if (isBusy) {
            this.state = 'busy';
          } else if (inputElement && sendButton) {
            // Check actual interactivity
            const canType = inputElement.contentEditable === 'true' || 
                           !inputElement.disabled;
            const canSend = !sendButton.disabled && 
                           sendButton.getAttribute('aria-disabled') !== 'true';
            
            this.state = (canType && canSend) ? 'idle' : 'busy';
          } else if (inputElement || sendButton) {
            // Partial elements found, likely loading
            this.state = 'busy';
          } else {
            this.state = 'unknown';
          }
          
          if (oldState !== this.state) {
            console.log(`✅ GREEN State Change: ${oldState} → ${this.state}`);
            this.updateIndicator();
          }
          
          return this.state;
        },
        
        updateIndicator() {
          const indicator = document.getElementById('green-indicator');
          if (indicator) {
            if (this.state === 'idle') {
              indicator.style.background = '#10b981';
              indicator.textContent = '✅ IDLE - Tests Pass!';
            } else if (this.state === 'busy') {
              indicator.style.background = '#f59e0b';
              indicator.textContent = '⏳ BUSY';
            } else {
              indicator.style.background = '#6b7280';
              indicator.textContent = '❓ UNKNOWN';
            }
          }
        }
      };
      
      return window.semantestDetector.init();
    });
    
    // Wait for initialization
    await page.waitForTimeout(3000);
    
    // Force state check
    await page.evaluate(() => window.semantestDetector.checkState());
    await page.waitForTimeout(500);
    
    // TEST: Check if now IDLE
    console.log('\n🧪 GREEN TEST: Initial state should be IDLE');
    const state = await page.evaluate(() => window.semantestDetector.state);
    console.log(`   Result: ${state} ${state === 'idle' ? '✅' : '🔴'}`);
    
    await page.screenshot({ path: 'evidence/green-phase-result.png' });
    
    if (state === 'idle') {
      console.log('\n✅ GREEN PHASE SUCCESS!');
      console.log('Tests are now passing. Ready for REFACTOR phase.');
    } else {
      console.log('\n🔴 Still in RED phase. Need more fixes.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

greenPhaseTest().catch(console.error);
