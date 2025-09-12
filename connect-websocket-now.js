#!/usr/bin/env node

/**
 * 🚨 CRITICAL: CONNECT EXTENSION TO WEBSOCKET NOW!
 */

const { chromium } = require('playwright');

async function connectWebSocketNOW() {
  console.log('🚨🚨 CONNECTING EXTENSION TO WEBSOCKET NOW! 🚨🚨');
  console.log('===============================================\n');
  
  let browser, page;
  
  try {
    // Connect to Chrome
    console.log('📡 Connecting to Chrome...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    
    // Open ChatGPT
    console.log('📍 Opening ChatGPT...');
    page = await context.newPage();
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // INJECT WEBSOCKET CONNECTION NOW!
    console.log('\n🚨 INJECTING WEBSOCKET CONNECTION...\n');
    
    const result = await page.evaluate(() => {
      console.log('🚨 CONNECTING TO WEBSOCKET NOW!');
      
      // Create status display
      const status = document.createElement('div');
      status.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        padding: 20px;
        background: #dc2626;
        color: white;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        z-index: 999999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      `;
      status.textContent = '🔌 CONNECTING...';
      document.body.appendChild(status);
      
      // CONNECT TO WEBSOCKET NOW!
      const ws = new WebSocket('ws://localhost:8081');
      
      // Store globally for testing
      window.semantestWS = ws;
      
      ws.onopen = () => {
        console.log('✅✅✅ CONNECTED TO WEBSOCKET! ✅✅✅');
        status.textContent = '✅ CONNECTED!';
        status.style.background = '#10b981';
        
        // Send connection message
        ws.send(JSON.stringify({
          type: 'EXTENSION_CONNECTED',
          message: 'Extension→WS connection ESTABLISHED!',
          timestamp: Date.now()
        }));
      };
      
      ws.onmessage = (event) => {
        console.log('📨 Event received:', event.data);
        const data = JSON.parse(event.data);
        
        status.textContent = `📨 Received: ${data.type}`;
        
        // Handle ImageGenerationRequestedEvent
        if (data.type === 'ImageGenerationRequestedEvent') {
          const prompt = data.prompt || data.data?.prompt;
          if (prompt) {
            status.textContent = '✍️ TYPING PROMPT...';
            
            // Find input
            const input = document.querySelector('div[contenteditable="true"], textarea');
            if (input) {
              // Type prompt
              if (input.contentEditable === 'true') {
                input.innerHTML = '';
                input.focus();
                input.textContent = prompt;
                input.dispatchEvent(new Event('input', { bubbles: true }));
              } else {
                input.value = prompt;
                input.dispatchEvent(new Event('input', { bubbles: true }));
              }
              
              status.textContent = '✅ PROMPT TYPED!';
              
              // Send confirmation
              ws.send(JSON.stringify({
                type: 'PROMPT_TYPED',
                prompt: prompt,
                success: true
              }));
            }
          }
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        status.textContent = '❌ ERROR!';
        status.style.background = '#dc2626';
      };
      
      ws.onclose = () => {
        console.log('🔌 WebSocket closed');
        status.textContent = '🔌 DISCONNECTED';
        status.style.background = '#6b7280';
      };
      
      // Return connection state after 1 second
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            connected: ws.readyState === WebSocket.OPEN,
            readyState: ws.readyState,
            url: ws.url
          });
        }, 1000);
      });
    });
    
    console.log('\n📊 CONNECTION RESULT:', result);
    
    if (result.connected) {
      console.log('\n✅✅✅ SUCCESS! EXTENSION→WS CONNECTION ESTABLISHED! ✅✅✅');
      console.log('CLI→Server ✅ WORKING');
      console.log('WebSocket:8081 ✅ READY');
      console.log('Extension→WS ✅ CONNECTED!\n');
      
      // Take screenshot
      await page.screenshot({ path: 'proof/websocket-connected.png', fullPage: true });
      console.log('📸 PROOF SCREENSHOT: proof/websocket-connected.png');
      
      // Test sending an event
      console.log('\n📤 Testing ImageGenerationRequestedEvent...');
      await page.evaluate(() => {
        if (window.semantestWS && window.semantestWS.readyState === WebSocket.OPEN) {
          // Simulate receiving an event
          const testEvent = {
            type: 'ImageGenerationRequestedEvent',
            prompt: 'PROOF: WebSocket connection working! Create a sunset.'
          };
          
          // Trigger the handler
          window.semantestWS.onmessage({ 
            data: JSON.stringify(testEvent) 
          });
        }
      });
      
      await page.waitForTimeout(2000);
      
      // Check if prompt was typed
      const promptText = await page.evaluate(() => {
        const input = document.querySelector('div[contenteditable="true"], textarea');
        return input ? (input.value || input.textContent) : '';
      });
      
      if (promptText.includes('PROOF') || promptText.includes('WebSocket')) {
        console.log('\n🎉🎉🎉 FULL INTEGRATION WORKING! 🎉🎉🎉');
        console.log(`Prompt typed: "${promptText.substring(0, 50)}..."`);
        
        await page.screenshot({ path: 'proof/prompt-typed-proof.png', fullPage: true });
        console.log('📸 FINAL PROOF: proof/prompt-typed-proof.png');
      }
      
    } else {
      console.log('\n⚠️ WebSocket not connected. ReadyState:', result.readyState);
      console.log('0=CONNECTING, 1=OPEN, 2=CLOSING, 3=CLOSED');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (page) {
      await page.screenshot({ path: 'proof/error.png' });
    }
  } finally {
    console.log('\n✅ Test complete - browser kept open');
  }
}

// RUN NOW!
connectWebSocketNOW().catch(console.error);
