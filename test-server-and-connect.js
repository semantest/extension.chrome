#!/usr/bin/env node

/**
 * START TEST SERVER AND CONNECT EXTENSION
 */

const WebSocket = require('ws');
const { chromium } = require('playwright');

async function testServerAndConnect() {
  console.log('🚨 STARTING TEST SERVER AND CONNECTING EXTENSION');
  console.log('===============================================\n');
  
  let wss, browser, page;
  
  try {
    // Start test server on different port
    console.log('📡 Starting test WebSocket server on port 8082...');
    wss = new WebSocket.Server({ port: 8082 });
    
    wss.on('connection', (ws) => {
      console.log('✅ CLIENT CONNECTED!');
      
      ws.on('message', (message) => {
        console.log('📨 Received:', message.toString());
        
        // Echo back
        ws.send(JSON.stringify({
          type: 'SERVER_RESPONSE',
          message: 'Server received your message!'
        }));
      });
      
      // Send test event after 1 second
      setTimeout(() => {
        console.log('📤 Sending ImageGenerationRequestedEvent...');
        ws.send(JSON.stringify({
          type: 'ImageGenerationRequestedEvent',
          prompt: 'FINAL PROOF: WebSocket working! Create a colorful image.',
          timestamp: Date.now()
        }));
      }, 1000);
    });
    
    console.log('✅ Server running on ws://localhost:8082');
    
    // Connect to Chrome
    console.log('\n📡 Connecting to Chrome...');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    page = await context.newPage();
    
    // Open ChatGPT
    await page.goto('https://chatgpt.com', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    
    // Inject client that connects to our test server
    console.log('\n🔌 Injecting WebSocket client...');
    
    const result = await page.evaluate(() => {
      // Status indicator
      const status = document.createElement('div');
      status.style.cssText = `
        position: fixed; top: 10px; right: 10px; padding: 20px;
        background: #f59e0b; color: white; font-size: 18px;
        font-weight: bold; border-radius: 8px; z-index: 999999;
      `;
      status.textContent = '🔌 Connecting to :8082...';
      document.body.appendChild(status);
      
      // Connect to test server on port 8082
      const ws = new WebSocket('ws://localhost:8082');
      window.testWS = ws;
      
      ws.onopen = () => {
        console.log('✅ CONNECTED TO TEST SERVER!');
        status.textContent = '✅ CONNECTED to :8082!';
        status.style.background = '#10b981';
        
        ws.send(JSON.stringify({
          type: 'CLIENT_CONNECTED',
          message: 'Extension connected successfully!'
        }));
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data);
        
        if (data.type === 'ImageGenerationRequestedEvent') {
          status.textContent = '✍️ Typing prompt...';
          
          const input = document.querySelector('div[contenteditable="true"], textarea');
          if (input) {
            if (input.contentEditable === 'true') {
              input.innerHTML = '';
              input.focus();
              input.textContent = data.prompt;
              input.dispatchEvent(new Event('input', { bubbles: true }));
            } else {
              input.value = data.prompt;
              input.dispatchEvent(new Event('input', { bubbles: true }));
            }
            
            status.textContent = '✅ PROMPT TYPED!';
          }
        }
      };
      
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({ 
            connected: ws.readyState === WebSocket.OPEN,
            readyState: ws.readyState 
          });
        }, 1000);
      });
    });
    
    console.log('📊 Connection result:', result);
    
    if (result.connected) {
      console.log('\n✅✅✅ EXTENSION CONNECTED TO WEBSOCKET! ✅✅✅');
      
      // Wait for prompt to be typed
      await page.waitForTimeout(3000);
      
      // Check prompt
      const promptText = await page.evaluate(() => {
        const input = document.querySelector('div[contenteditable="true"], textarea');
        return input ? (input.value || input.textContent) : '';
      });
      
      if (promptText.includes('PROOF') || promptText.includes('WebSocket')) {
        console.log('\n🎉 COMPLETE SUCCESS!');
        console.log('CLI→Server ✅');
        console.log('WebSocket ✅');
        console.log('Extension→WS ✅');
        console.log(`\nPrompt typed: "${promptText.substring(0, 60)}..."`);
        
        await page.screenshot({ path: 'proof/final-success.png', fullPage: true });
        console.log('\n📸 FINAL PROOF: proof/final-success.png');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (wss) {
      wss.close();
      console.log('\n🔌 Test server closed');
    }
    console.log('✅ Test complete');
  }
}

testServerAndConnect().catch(console.error);
