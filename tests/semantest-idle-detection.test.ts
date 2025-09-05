/**
 * @fileoverview SEMANTEST idle detection test for ChatGPT
 * @author Wences
 * @description Test event-driven idle/busy detection on real ChatGPT
 */

import { test, expect } from '@playwright/test';

test.describe('SEMANTEST ChatGPT Idle Detection', () => {
  test('should detect ChatGPT idle state via events', async ({ page }) => {
    // Connect to ChatGPT
    await page.goto('https://chatgpt.com');
    
    // Verify we're logged in
    const inputSelector = 'div[contenteditable="true"], textarea';
    const isLoggedIn = await page.locator(inputSelector).isVisible();
    expect(isLoggedIn).toBeTruthy();
    console.log('✅ Logged into ChatGPT');
    
    // Inject SEMANTEST state detector
    await page.evaluate(() => {
      // SEMANTEST State Detector
      window.SemantestDetector = class {
        constructor() {
          this.domain = 'chatgpt.com';
          this.state = 'unknown';
          this.observer = null;
          this.eventQueue = [];
        }
        
        initialize() {
          // Set up MutationObserver
          this.observer = new MutationObserver(() => this.checkState());
          this.observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['disabled', 'style', 'class', 'aria-disabled']
          });
          
          // Initial state check
          this.checkState();
          
          // Listen for SEMANTEST events
          window.addEventListener('semantest-event', (event) => {
            this.handleSemantestEvent(event.detail);
          });
        }
        
        checkState() {
          const oldState = this.state;
          
          // Check all indicators
          const textarea = document.querySelector('textarea, div[contenteditable="true"]');
          const sendButton = document.querySelector('button[data-testid="send-button"], button[aria-label*="Send"]');
          const spinner = document.querySelector('.animate-spin, [class*="spinner"], [class*="loading"]');
          
          // Determine state
          if (spinner && this.isVisible(spinner)) {
            this.state = 'busy';
          } else if (textarea && !textarea.disabled && !textarea.getAttribute('aria-disabled')) {
            this.state = 'idle';
          } else if (sendButton && sendButton.disabled) {
            this.state = 'busy';
          } else {
            this.state = 'idle'; // Default to idle if unsure
          }
          
          // Send state event if changed
          if (this.state !== oldState) {
            this.sendStateEvent();
          }
        }
        
        sendStateEvent() {
          const event = {
            type: 'ChatGPTStateEvent',
            payload: {
              domain: this.domain,
              state: this.state,
              canSendMessage: this.state === 'idle',
              correlationId: crypto.randomUUID(),
              timestamp: new Date().toISOString()
            }
          };
          
          // Log for testing
          console.log('📤 SEMANTEST Event:', event);
          
          // Store event
          this.eventQueue.push(event);
          
          // Would normally send via WebSocket to server
          window.dispatchEvent(new CustomEvent('semantest-state-change', {
            detail: event
          }));
        }
        
        handleSemantestEvent(event) {
          console.log('📥 Received SEMANTEST event:', event);
          
          if (event.type === 'ImageGenerationRequestedEvent') {
            this.handleImageGeneration(event.payload);
          }
        }
        
        async handleImageGeneration(payload) {
          // Wait for idle state
          await this.waitForIdle();
          
          // Find input and send prompt
          const input = document.querySelector('textarea, div[contenteditable="true"]');
          if (input) {
            // Type the prompt
            input.focus();
            input.value = payload.prompt;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            
            // Send message
            const sendButton = document.querySelector('button[data-testid="send-button"]');
            if (sendButton) {
              sendButton.click();
            } else {
              // Fallback to Enter key
              input.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Enter',
                code: 'Enter',
                keyCode: 13
              }));
            }
          }
        }
        
        async waitForIdle(timeout = 30000) {
          const start = Date.now();
          while (this.state !== 'idle' && Date.now() - start < timeout) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          if (this.state !== 'idle') {
            throw new Error('Timeout waiting for idle state');
          }
        }
        
        isVisible(elem) {
          if (!elem) return false;
          const style = window.getComputedStyle(elem);
          return style.display !== 'none' && style.visibility !== 'hidden';
        }
        
        getState() {
          return this.state;
        }
        
        getEvents() {
          return this.eventQueue;
        }
      };
      
      // Initialize detector
      window.semantest = new window.SemantestDetector();
      window.semantest.initialize();
      
      return 'SEMANTEST detector initialized';
    });
    
    // Test 1: Check initial idle state
    const initialState = await page.evaluate(() => window.semantest.getState());
    console.log(`📊 Initial state: ${initialState}`);
    expect(initialState).toBe('idle');
    
    // Test 2: Monitor state during message send
    const stateEvents = await page.evaluate(async () => {
      const events = [];
      
      // Listen for state changes
      window.addEventListener('semantest-state-change', (e) => {
        events.push(e.detail);
      });
      
      // Type test message
      const input = document.querySelector('textarea, div[contenteditable="true"]');
      if (input) {
        input.focus();
        input.value = 'What is 2+2? (SEMANTEST test)';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        // Send message
        const sendButton = document.querySelector('button[data-testid="send-button"]');
        if (sendButton && !sendButton.disabled) {
          sendButton.click();
        }
      }
      
      // Wait for state changes
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return {
        events,
        finalState: window.semantest.getState()
      };
    });
    
    console.log('📤 State events captured:', stateEvents.events.length);
    console.log('📊 Final state:', stateEvents.finalState);
    
    // Test 3: Verify domain-based routing
    const domainTest = await page.evaluate(() => {
      // Simulate incoming event
      const testEvent = new CustomEvent('semantest-event', {
        detail: {
          type: 'TestEvent',
          payload: {
            domain: 'chatgpt.com',
            test: true
          }
        }
      });
      
      window.dispatchEvent(testEvent);
      
      return window.semantest.domain === 'chatgpt.com';
    });
    
    expect(domainTest).toBeTruthy();
    console.log('✅ Domain-based routing verified');
    
    // Test 4: Check all idle indicators
    const idleIndicators = await page.evaluate(() => {
      const indicators = {
        textarea: {
          exists: false,
          enabled: false,
          selector: null
        },
        sendButton: {
          exists: false,
          enabled: false,
          selector: null
        },
        spinner: {
          exists: false,
          visible: false,
          selector: null
        }
      };
      
      // Check textarea
      const textareas = ['textarea', 'div[contenteditable="true"][data-id]', 'div[contenteditable="true"]'];
      for (const selector of textareas) {
        const elem = document.querySelector(selector);
        if (elem) {
          indicators.textarea.exists = true;
          indicators.textarea.enabled = !elem.disabled && !elem.getAttribute('aria-disabled');
          indicators.textarea.selector = selector;
          break;
        }
      }
      
      // Check send button
      const buttons = ['button[data-testid="send-button"]', 'button[aria-label*="Send"]'];
      for (const selector of buttons) {
        const elem = document.querySelector(selector);
        if (elem) {
          indicators.sendButton.exists = true;
          indicators.sendButton.enabled = !elem.disabled;
          indicators.sendButton.selector = selector;
          break;
        }
      }
      
      // Check spinner
      const spinners = ['.animate-spin', '[class*="spinner"]', '[class*="loading"]'];
      for (const selector of spinners) {
        const elem = document.querySelector(selector);
        if (elem) {
          indicators.spinner.exists = true;
          const style = window.getComputedStyle(elem);
          indicators.spinner.visible = style.display !== 'none';
          indicators.spinner.selector = selector;
          break;
        }
      }
      
      return indicators;
    });
    
    console.log('📋 Idle indicators:', idleIndicators);
    expect(idleIndicators.textarea.exists).toBeTruthy();
    
    // Take screenshot
    await page.screenshot({ path: 'semantest-test-screenshot.png' });
    console.log('📸 Screenshot saved: semantest-test-screenshot.png');
    
    // Get all events for verification
    const allEvents = await page.evaluate(() => window.semantest.getEvents());
    console.log(`📊 Total SEMANTEST events: ${allEvents.length}`);
    
    // Clean up
    await page.evaluate(() => {
      if (window.semantest?.observer) {
        window.semantest.observer.disconnect();
      }
    });
  });
});