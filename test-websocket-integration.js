// Automated WebSocket Integration Test for Semantest Extension
// Tests the full flow: WebSocket → Extension → ChatGPT

const { chromium } = require('playwright');

const EXTENSION_PATH = '/home/chous/work/semantest/extension.chrome';
const CHATGPT_URL = 'https://chatgpt.com';
const WEBSOCKET_URL = 'ws://localhost:8080';

async function testWebSocketIntegration() {
  console.log('🚀 Starting automated extension test...');
  
  // Launch Chrome with extension pre-loaded
  const browser = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
      '--auto-open-devtools-for-tabs'  // Optional: auto-open DevTools
    ],
    // Record video for debugging
    recordVideo: {
      dir: './test-videos'
    }
  });

  const page = await browser.newPage();
  
  // Monitor console logs from the page
  page.on('console', msg => {
    console.log(`[PAGE LOG] ${msg.type()}: ${msg.text()}`);
  });
  
  // Monitor WebSocket connections
  let wsConnection = null;
  page.on('websocket', ws => {
    console.log(`🔌 WebSocket created: ${ws.url()}`);
    wsConnection = ws;
    
    ws.on('framesent', frame => {
      console.log('📤 WS sent:', frame.payload);
    });
    
    ws.on('framereceived', frame => {
      console.log('📨 WS received:', frame.payload);
    });
    
    ws.on('close', () => {
      console.log('🔌 WebSocket closed');
    });
  });
  
  try {
    // Navigate to ChatGPT
    console.log('📍 Navigating to ChatGPT...');
    await page.goto(CHATGPT_URL);
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Check if login is needed
    const needsLogin = await page.isVisible('button:has-text("Log in")');
    if (needsLogin) {
      console.log('⚠️  Login required - please log in manually');
      console.log('⏸️  Test paused - press Enter after logging in...');
      await page.pause(); // Pause for manual login
    }
    
    // Wait for ChatGPT to be ready
    console.log('⏳ Waiting for ChatGPT to be ready...');
    await page.waitForSelector('textarea[placeholder*="Message"]', { timeout: 30000 });
    console.log('✅ ChatGPT is ready!');
    
    // Give extension time to initialize
    await page.waitForTimeout(2000);
    
    // Test 1: Check extension popup
    console.log('\n📋 Test 1: Extension Popup');
    // Note: We can't directly click extension icon, but we can check if content scripts loaded
    const hasExtensionScripts = await page.evaluate(() => {
      return typeof window.chatGPTStateDetector !== 'undefined';
    });
    console.log(`Extension scripts loaded: ${hasExtensionScripts ? '✅' : '❌'}`);
    
    // Test 2: Simulate WebSocket message
    console.log('\n📋 Test 2: WebSocket Message Simulation');
    console.log('🎯 Sending test image request via console...');
    
    // Inject a test that simulates receiving a WebSocket message
    await page.evaluate(() => {
      // Simulate extension receiving an image request
      if (window.chrome && window.chrome.runtime) {
        window.chrome.runtime.sendMessage({
          action: 'ImageRequestReceived',
          data: {
            prompt: 'Test: A cat playing piano in space',
            requestId: 'test-' + Date.now(),
            timestamp: Date.now()
          }
        }, response => {
          console.log('Extension response:', response);
        });
      }
    });
    
    // Wait to see if prompt appears
    await page.waitForTimeout(3000);
    
    // Test 3: Check if prompt was sent
    console.log('\n📋 Test 3: Prompt Injection Check');
    const textarea = await page.$('textarea[placeholder*="Message"]');
    const promptValue = await textarea.evaluate(el => el.value);
    console.log(`Prompt value: "${promptValue}"`);
    
    // Test 4: Check ChatGPT state detection
    console.log('\n📋 Test 4: State Detection');
    const state = await page.evaluate(() => {
      if (window.chatGPTStateDetector) {
        return window.chatGPTStateDetector.getStatusReport();
      }
      return null;
    });
    console.log('ChatGPT state:', state);
    
    // Test 5: Network monitoring
    console.log('\n📋 Test 5: Network Monitoring');
    console.log('Watching for WebSocket connections to', WEBSOCKET_URL);
    
    // Keep test running for manual testing
    console.log('\n✅ Automated tests complete!');
    console.log('💡 Browser remains open for manual testing');
    console.log('Press Ctrl+C to close browser and exit');
    
    // Keep browser open
    await new Promise(() => {}); // Infinite wait
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Take screenshot on error
    await page.screenshot({ path: 'test-error.png' });
    console.log('📸 Error screenshot saved to test-error.png');
    
    throw error;
  }
}

// Run the test
testWebSocketIntegration().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Closing browser...');
  process.exit(0);
});