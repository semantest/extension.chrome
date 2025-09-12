/**
 * REAL Browser Test with Playwright - PROOF for CEO
 * This will actually load the extension and test WebSocket connection
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function testRealWebSocketConnection() {
  console.log('🚨 REAL BROWSER TEST - PROVING WebSocket Works!');
  console.log('================================================\n');
  
  const extensionPath = path.resolve(__dirname);
  console.log('📁 Extension path:', extensionPath);
  
  // Launch Chrome with extension
  console.log('🚀 Launching Chrome with SEMANTEST extension...');
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--auto-open-devtools-for-tabs'
    ],
    viewport: { width: 1280, height: 720 }
  });
  
  // Get extension ID
  const extensionPage = await browser.newPage();
  await extensionPage.goto('chrome://extensions/');
  await extensionPage.waitForTimeout(2000);
  
  // Take screenshot of extensions page
  console.log('📸 Taking screenshot of extensions page...');
  await extensionPage.screenshot({ 
    path: 'evidence/extensions-loaded.png',
    fullPage: true 
  });
  console.log('✅ Screenshot saved: evidence/extensions-loaded.png');
  
  // Open ChatGPT
  console.log('\n🌐 Opening ChatGPT...');
  const chatPage = await browser.newPage();
  await chatPage.goto('https://chatgpt.com');
  await chatPage.waitForTimeout(3000);
  
  // Check console for WebSocket connection
  console.log('🔍 Checking for WebSocket connection...');
  
  // Inject test to check WebSocket
  const wsStatus = await chatPage.evaluate(() => {
    // Check if our content script is loaded
    const indicator = document.getElementById('semantest-status');
    if (indicator) {
      console.log('✅ SEMANTEST indicator found!');
      return {
        indicatorFound: true,
        indicatorText: indicator.textContent,
        indicatorColor: window.getComputedStyle(indicator).backgroundColor
      };
    }
    return { indicatorFound: false };
  });
  
  console.log('📊 WebSocket Status:', wsStatus);
  
  // Take screenshot of ChatGPT with extension
  console.log('📸 Taking screenshot of ChatGPT with extension...');
  await chatPage.screenshot({ 
    path: 'evidence/chatgpt-with-extension.png',
    fullPage: true 
  });
  console.log('✅ Screenshot saved: evidence/chatgpt-with-extension.png');
  
  // Test sending a prompt
  console.log('\n🧪 Testing prompt sending...');
  
  // Send test event via HTTP to server
  console.log('📤 Sending ImageGenerationRequestedEvent to server...');
  const response = await fetch('http://localhost:8080/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'ImageGenerationRequestedEvent',
      payload: {
        domain: 'chatgpt.com',
        prompt: 'Generate an image: a small red circle',
        outputPath: '/tmp/playwright-test.png',
        correlationId: 'playwright-test-001'
      }
    })
  });
  
  const result = await response.json();
  console.log('📨 Server response:', result);
  
  // Wait and check if prompt was typed
  await chatPage.waitForTimeout(3000);
  
  // Check if prompt appeared in ChatGPT
  const promptTyped = await chatPage.evaluate(() => {
    const textarea = document.querySelector('div[contenteditable="true"], textarea#prompt-textarea');
    return textarea ? textarea.textContent || textarea.value : null;
  });
  
  console.log('📝 Prompt in ChatGPT:', promptTyped);
  
  // Take final screenshot
  console.log('📸 Taking final screenshot...');
  await chatPage.screenshot({ 
    path: 'evidence/chatgpt-with-prompt.png',
    fullPage: true 
  });
  console.log('✅ Screenshot saved: evidence/chatgpt-with-prompt.png');
  
  // Check server logs
  console.log('\n📋 EVIDENCE SUMMARY:');
  console.log('1. Extension loaded: evidence/extensions-loaded.png');
  console.log('2. ChatGPT with extension: evidence/chatgpt-with-extension.png');
  console.log('3. Prompt test: evidence/chatgpt-with-prompt.png');
  console.log('4. WebSocket indicator found:', wsStatus.indicatorFound);
  console.log('5. Prompt typed:', promptTyped ? '✅ YES' : '❌ NO');
  
  console.log('\n🎯 TEST COMPLETE - Check evidence folder for proof!');
  
  // Keep browser open for manual inspection
  console.log('\n⏸️  Browser will stay open for 30 seconds for inspection...');
  await chatPage.waitForTimeout(30000);
  
  await browser.close();
}

// Create evidence directory
if (!fs.existsSync('evidence')) {
  fs.mkdirSync('evidence');
}

// Run the test
testRealWebSocketConnection().catch(console.error);