/**
 * Manual/Visual Test for Project Creation Flow
 * Run this test with HEADLESS=false to see the actual UI interactions
 */

const puppeteer = require('puppeteer');
const path = require('path');

describe('ChatGPT Project Creation - Manual Visual Test', () => {
  let browser;
  let page;
  const EXTENSION_PATH = path.join(__dirname, '../../dist');

  beforeAll(async () => {
    console.log('\n🎯 Starting Manual Project Creation Test');
    console.log('   Run with: HEADLESS=false SLOW_MO=250 npm test project-creation-manual.test.js\n');

    browser = await puppeteer.launch({
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '250'), // Slow down for visibility
      devtools: true,
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--window-size=1400,900'
      ],
      defaultViewport: null
    });
  }, 120000);

  afterAll(async () => {
    console.log('\n✅ Test completed. Browser will remain open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (browser) {
      await browser.close();
    }
  });

  test('MANUAL: Complete project creation flow with visual feedback', async () => {
    console.log('📍 Step 1: Opening ChatGPT...');
    page = await browser.newPage();
    
    // Enable console logging
    page.on('console', msg => {
      if (msg.text().includes('[ChatGPT Controller]')) {
        console.log('  ', msg.text());
      }
    });

    await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
    
    console.log('📍 Step 2: Waiting for content script to initialize...');
    await page.waitForFunction(
      () => window.chatGPTController?.isInitialized,
      { timeout: 30000 }
    );
    console.log('   ✓ Content script initialized');

    // Add visual highlight to show extension is active
    await page.evaluate(() => {
      const indicator = document.createElement('div');
      indicator.innerHTML = '🔧 Extension Active';
      indicator.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        background: #10a37f;
        color: white;
        padding: 8px 16px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        animation: pulse 2s infinite;
      `;
      document.body.appendChild(indicator);
      
      // Add pulse animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.7; }
          100% { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    });

    console.log('\n📍 Step 3: Finding "New Project" button...');
    
    // Highlight the New Project button
    const buttonFound = await page.evaluate(async () => {
      const controller = window.chatGPTController;
      const button = await controller.findElement(controller.selectors.newProjectButton);
      
      if (button) {
        // Add highlight
        button.style.outline = '3px solid #ff0000';
        button.style.outlineOffset = '2px';
        button.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Add arrow pointing to button
        const arrow = document.createElement('div');
        arrow.innerHTML = '👈 Click here';
        arrow.style.cssText = `
          position: absolute;
          color: red;
          font-size: 20px;
          font-weight: bold;
          animation: bounce 1s infinite;
          z-index: 10000;
        `;
        
        const rect = button.getBoundingClientRect();
        arrow.style.left = `${rect.right + 10}px`;
        arrow.style.top = `${rect.top}px`;
        document.body.appendChild(arrow);
        
        return true;
      }
      return false;
    });

    expect(buttonFound).toBe(true);
    console.log('   ✓ New Project button found and highlighted');

    await page.waitForTimeout(2000); // Pause to show the highlight

    console.log('\n📍 Step 4: Clicking "New Project" button...');
    await page.evaluate(async () => {
      const controller = window.chatGPTController;
      const button = await controller.findElement(controller.selectors.newProjectButton);
      await controller.clickElement(button);
    });

    console.log('📍 Step 5: Waiting for project name input...');
    await page.waitForTimeout(1000);

    // Highlight the input field
    const inputFound = await page.evaluate(async () => {
      const controller = window.chatGPTController;
      const input = await controller.findElement(controller.selectors.projectNameInput);
      
      if (input) {
        input.style.outline = '3px solid #00ff00';
        input.style.outlineOffset = '2px';
        input.focus();
        
        // Add helper text
        const helper = document.createElement('div');
        helper.innerHTML = '✏️ Type your project name here';
        helper.style.cssText = `
          position: absolute;
          color: green;
          font-size: 16px;
          font-weight: bold;
          z-index: 10000;
        `;
        
        const rect = input.getBoundingClientRect();
        helper.style.left = `${rect.left}px`;
        helper.style.top = `${rect.bottom + 5}px`;
        document.body.appendChild(helper);
        
        return true;
      }
      return false;
    });

    expect(inputFound).toBe(true);
    console.log('   ✓ Project name input found and highlighted');

    console.log('\n📍 Step 6: Typing project name...');
    const projectName = `Demo Project ${new Date().toLocaleTimeString()}`;
    
    // Type slowly for visual effect
    await page.evaluate(async (name) => {
      const controller = window.chatGPTController;
      const input = await controller.findElement(controller.selectors.projectNameInput);
      
      // Clear input first
      input.value = '';
      
      // Type character by character
      for (const char of name) {
        input.value += char;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, projectName);

    console.log(`   ✓ Typed: "${projectName}"`);
    await page.waitForTimeout(1000);

    console.log('\n📍 Step 7: Finding and highlighting Create button...');
    const createButtonFound = await page.evaluate(async () => {
      const controller = window.chatGPTController;
      const button = await controller.findElement(controller.selectors.createProjectButton);
      
      if (button) {
        button.style.outline = '3px solid #0000ff';
        button.style.outlineOffset = '2px';
        
        // Add click indicator
        const indicator = document.createElement('div');
        indicator.innerHTML = '👆 Click to create';
        indicator.style.cssText = `
          position: absolute;
          color: blue;
          font-size: 16px;
          font-weight: bold;
          z-index: 10000;
        `;
        
        const rect = button.getBoundingClientRect();
        indicator.style.left = `${rect.left}px`;
        indicator.style.top = `${rect.bottom + 5}px`;
        document.body.appendChild(indicator);
        
        return true;
      }
      return false;
    });

    expect(createButtonFound).toBe(true);
    console.log('   ✓ Create button found and highlighted');
    await page.waitForTimeout(2000);

    console.log('\n📍 Step 8: Clicking Create button...');
    await page.evaluate(async () => {
      const controller = window.chatGPTController;
      const button = await controller.findElement(controller.selectors.createProjectButton);
      await controller.clickElement(button);
    });

    console.log('📍 Step 9: Waiting for project to appear in sidebar...');
    await page.waitForTimeout(2000);

    // Check if project was created and highlight it
    const projectCreated = await page.evaluate(async (name) => {
      const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
      
      for (const project of projects) {
        if (project.textContent.includes(name)) {
          // Highlight the new project
          project.style.backgroundColor = '#ffe4b5';
          project.style.outline = '3px solid #ffa500';
          project.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add success indicator
          const success = document.createElement('div');
          success.innerHTML = '✅ Project Created Successfully!';
          success.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: #10a37f;
            color: white;
            padding: 20px 40px;
            border-radius: 10px;
            font-size: 24px;
            font-weight: bold;
            z-index: 10000;
            animation: fadeIn 0.5s;
          `;
          document.body.appendChild(success);
          
          // Add fade animation
          const style = document.createElement('style');
          style.textContent = `
            @keyframes fadeIn {
              from { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
              to { opacity: 1; transform: translate(-50%, -50%) scale(1); }
            }
            @keyframes bounce {
              0%, 100% { transform: translateX(0); }
              50% { transform: translateX(10px); }
            }
          `;
          document.head.appendChild(style);
          
          return true;
        }
      }
      return false;
    }, projectName);

    expect(projectCreated).toBe(true);
    console.log('   ✓ Project created and visible in sidebar!');

    console.log('\n🎉 SUCCESS: Project creation flow completed!');
    console.log(`   Project Name: ${projectName}`);
    console.log('   All UI interactions worked correctly\n');

    // Keep success message visible
    await page.waitForTimeout(3000);

    // Final summary
    await page.evaluate(() => {
      // Clear all indicators
      document.querySelectorAll('[style*="outline"]').forEach(el => {
        el.style.outline = '';
      });
      
      // Show summary
      const summary = document.createElement('div');
      summary.innerHTML = `
        <h3>✅ Test Summary</h3>
        <ul>
          <li>✓ Extension loaded and initialized</li>
          <li>✓ New Project button detected</li>
          <li>✓ Project dialog opened</li>
          <li>✓ Project name entered</li>
          <li>✓ Project created successfully</li>
          <li>✓ Project visible in sidebar</li>
        </ul>
      `;
      summary.style.cssText = `
        position: fixed;
        top: 20px;
        left: 20px;
        background: white;
        border: 2px solid #10a37f;
        padding: 20px;
        border-radius: 10px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
      `;
      document.body.appendChild(summary);
    });

  }, 120000);
});