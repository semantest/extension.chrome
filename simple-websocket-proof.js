#!/usr/bin/env node

/**
 * SIMPLE WEBSOCKET PROOF - Using existing Chrome browser
 */

const { chromium } = require('playwright');
const WebSocket = require('ws');
const fs = require('fs');

// Create proof directory
if (!fs.existsSync('proof')) {
  fs.mkdirSync('proof');
}

async function simpleWebSocketProof() {
  console.log('🎯 SIMPLE WEBSOCKET PROOF - Using Existing Chrome');
  console.log('=================================================\n');
  
  let browser, page;
  let wsServer;
  
  try {
    // Step 1: Start WebSocket server
    console.log('📋 Step 1: Starting WebSocket Server on port 8081');
    wsServer = new WebSocket.Server({ port: 8081 });
    
    wsServer.on('connection', (ws) => {
      console.log('✅ Client connected to WebSocket!');
      
      // Send test event after 2 seconds
      setTimeout(() => {
        console.log('📤 Sending ImageGenerationRequestedEvent...');
        ws.send(JSON.stringify({
          type: 'ImageGenerationRequestedEvent',
          prompt: 'PROOF: Create a beautiful sunset over mountains with WebSocket',
          timestamp: Date.now()
        }));
      }, 2000);
      
      ws.on('message', (msg) => {
        console.log('📨 Received:', JSON.parse(msg).type);
      });
    });
    
    console.log('✅ WebSocket server running on ws://localhost:8081');
    
    // Step 2: Connect to existing Chrome
    console.log('\n📋 Step 2: Connecting to Chrome on port 9222');
    browser = await chromium.connectOverCDP('http://localhost:9222');
    const context = browser.contexts()[0];
    console.log('✅ Connected to Chrome browser');
    
    // Step 3: Navigate to ChatGPT
    console.log('\n📋 Step 3: Opening ChatGPT');
    page = await context.newPage();
    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    
    await page.screenshot({ path: 'proof/1-chatgpt-opened.png' });
    console.log('📸 Screenshot: ChatGPT opened');
    
    // Step 4: Inject WebSocket client
    console.log('\n📋 Step 4: Injecting WebSocket Client');
    await page.evaluate(() => {
      // Visual indicator
      const indicator = document.createElement('div');
      indicator.id = 'ws-proof';
      indicator.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px;
        background: #f59e0b;
        color: white;
        font-weight: bold;
        border-radius: 8px;
        z-index: 99999;
      `;
      indicator.textContent = '⏳ Connecting...';
      document.body.appendChild(indicator);
      
      // Connect to WebSocket
      const ws = new WebSocket('ws://localhost:8081');
      
      ws.onopen = () => {
        console.log('✅ Connected to WebSocket!');
        indicator.textContent = '✅ Connected!';
        indicator.style.background = '#10b981';
      };
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log('📨 Received:', data.type);
        
        if (data.type === 'ImageGenerationRequestedEvent') {
          indicator.textContent = '✍️ Typing...';
          
          // Type prompt
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
            
            indicator.textContent = '✅ Prompt Typed!';
            console.log('✅ Prompt typed successfully!');
          }
        }
      };
      
      ws.onerror = () => {
        indicator.textContent = '❌ Error';
        indicator.style.background = '#dc2626';
      };
    });
    
    console.log('✅ WebSocket client injected');
    
    // Step 5: Wait for connection and prompt
    console.log('\n📋 Step 5: Waiting for WebSocket event...');
    await page.waitForTimeout(5000);
    
    // Check if prompt was typed
    const promptText = await page.evaluate(() => {
      const input = document.querySelector('div[contenteditable="true"], textarea');
      return input ? (input.value || input.textContent) : '';
    });
    
    console.log(`✅ Prompt content: "${promptText.substring(0, 50)}..."`);
    
    await page.screenshot({ path: 'proof/2-prompt-typed.png', fullPage: true });
    console.log('📸 Screenshot: Prompt typed!');
    
    // Final report
    console.log('\n========================================');
    console.log('🎯 WEBSOCKET PROOF COMPLETE');
    console.log('========================================\n');
    
    if (promptText.includes('WebSocket') || promptText.includes('sunset')) {
      console.log('✅ SUCCESS! WebSocket integration PROVEN:');
      console.log('  1. Server started on ws://localhost:8081');
      console.log('  2. Client connected successfully');
      console.log('  3. ImageGenerationRequestedEvent sent');
      console.log('  4. Prompt automatically typed in ChatGPT');
      console.log('\n📸 PROOF SCREENSHOTS:');
      console.log('  - proof/1-chatgpt-opened.png');
      console.log('  - proof/2-prompt-typed.png');
    } else {
      console.log('⚠️ Prompt not detected - check screenshots');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (page) {
      await page.screenshot({ path: 'proof/error.png' });
    }
  } finally {
    if (wsServer) {
      wsServer.close();
      console.log('\n🔌 WebSocket server closed');
    }
    console.log('✅ Test complete!');
  }
}

// Run proof
simpleWebSocketProof().catch(console.error);