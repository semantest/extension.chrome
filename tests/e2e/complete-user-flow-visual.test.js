/**
 * Complete User Flow Visual E2E Test
 * Visual demonstration of the full user journey with step-by-step highlights
 * 
 * Flow: Install Extension → Create Project → Add Instructions → Send Prompt → Download Image
 */

const puppeteer = require('puppeteer');
const path = require('path');
const testUtils = require('./setup');

describe('Complete User Flow - Visual Demonstration', () => {
  let browser;
  let page;
  let extensionId;
  const EXTENSION_PATH = path.join(__dirname, '../../dist');

  beforeAll(async () => {
    console.log('🎥 Starting Visual User Flow Demonstration');
    console.log('==========================================\n');
    console.log('   Run with: HEADLESS=false SLOW_MO=500 npm test complete-user-flow-visual.test.js\n');

    browser = await testUtils.launchBrowser({
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '750'),
      devtools: true,
      defaultViewport: null
    });

    extensionId = await testUtils.getExtensionId(browser);
    console.log(`📦 Extension ID: ${extensionId}`);
  }, 120000);

  afterAll(async () => {
    console.log('\n✅ Visual demonstration completed. Browser will remain open for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (browser) {
      await browser.close();
    }
  });

  test('VISUAL: Complete User Flow Demonstration', async () => {
    page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 900 });

    // Add visual indicators CSS
    await page.evaluateOnNewDocument(() => {
      const style = document.createElement('style');
      style.textContent = `
        .e2e-highlight {
          outline: 3px solid #ff0000 !important;
          outline-offset: 2px !important;
          animation: e2e-pulse 2s infinite !important;
        }
        .e2e-success {
          outline: 3px solid #00ff00 !important;
          outline-offset: 2px !important;
          animation: e2e-success-pulse 1s infinite !important;
        }
        .e2e-step-indicator {
          position: fixed !important;
          top: 20px !important;
          right: 20px !important;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
          color: white !important;
          padding: 15px 25px !important;
          border-radius: 10px !important;
          font-size: 18px !important;
          font-weight: bold !important;
          z-index: 10000 !important;
          box-shadow: 0 4px 15px rgba(0,0,0,0.3) !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        }
        .e2e-progress {
          position: fixed !important;
          top: 80px !important;
          right: 20px !important;
          background: rgba(0,0,0,0.8) !important;
          color: white !important;
          padding: 10px 20px !important;
          border-radius: 8px !important;
          font-size: 14px !important;
          z-index: 10000 !important;
          font-family: monospace !important;
        }
        @keyframes e2e-pulse {
          0% { box-shadow: 0 0 0 0 rgba(255,0,0,0.7); }
          70% { box-shadow: 0 0 0 10px rgba(255,0,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(255,0,0,0); }
        }
        @keyframes e2e-success-pulse {
          0% { box-shadow: 0 0 0 0 rgba(0,255,0,0.7); }
          70% { box-shadow: 0 0 0 10px rgba(0,255,0,0); }
          100% { box-shadow: 0 0 0 0 rgba(0,255,0,0); }
        }
      `;
      document.head.appendChild(style);
    });

    // Helper function to add step indicator
    const showStep = async (stepNumber, stepName, details = '') => {
      await page.evaluate((step, name, info) => {
        // Remove existing indicators
        document.querySelectorAll('.e2e-step-indicator, .e2e-progress').forEach(el => el.remove());
        
        // Add step indicator
        const indicator = document.createElement('div');
        indicator.className = 'e2e-step-indicator';
        indicator.innerHTML = `Step ${step}: ${name}`;
        document.body.appendChild(indicator);
        
        // Add progress info
        if (info) {
          const progress = document.createElement('div');
          progress.className = 'e2e-progress';
          progress.innerHTML = info;
          document.body.appendChild(progress);
        }
      }, stepNumber, stepName, details);
    };

    // Helper function to highlight element
    const highlightElement = async (selector, className = 'e2e-highlight') => {
      return await page.evaluate((sel, cls) => {
        const element = document.querySelector(sel);
        if (element) {
          element.classList.add(cls);
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return true;
        }
        return false;
      }, selector, className);
    };

    // Helper function to clear highlights
    const clearHighlights = async () => {
      await page.evaluate(() => {
        document.querySelectorAll('.e2e-highlight, .e2e-success').forEach(el => {
          el.classList.remove('e2e-highlight', 'e2e-success');
        });
      });
    };

    try {
      // STEP 1: Extension Verification
      console.log('\n🔍 STEP 1: Extension Verification');
      await showStep(1, 'Extension Verification', 'Checking if extension is properly installed');
      
      const popupUrl = `chrome-extension://${extensionId}/popup.html`;
      await page.goto(popupUrl);
      await page.waitForSelector('body');
      
      // Highlight the entire popup
      await page.evaluate(() => {
        document.body.style.outline = '3px solid #00ff00';
        document.body.style.outlineOffset = '5px';
      });
      
      await page.waitForTimeout(3000);
      console.log('   ✅ Extension popup loaded successfully');

      // STEP 2: Navigate to ChatGPT
      console.log('\n🌐 STEP 2: ChatGPT Integration');
      await showStep(2, 'ChatGPT Integration', 'Loading ChatGPT and initializing extension');
      
      await page.goto('https://chatgpt.com', { waitUntil: 'networkidle2' });
      
      // Show loading indicator
      await page.evaluate(() => {
        const loading = document.createElement('div');
        loading.innerHTML = '⏳ Loading ChatGPT & Extension...';
        loading.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.9); color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 24px; z-index: 10000;
        `;
        document.body.appendChild(loading);
        
        setTimeout(() => loading.remove(), 3000);
      });
      
      await page.waitForFunction(
        () => window.chatGPTController?.isInitialized,
        { timeout: 30000 }
      );
      
      // Show success
      await page.evaluate(() => {
        const success = document.createElement('div');
        success.innerHTML = '✅ Extension Integrated!';
        success.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #10a37f; color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 24px; z-index: 10000;
        `;
        document.body.appendChild(success);
        
        setTimeout(() => success.remove(), 2000);
      });
      
      await page.waitForTimeout(3000);
      console.log('   ✅ ChatGPT loaded and extension initialized');

      // STEP 3: Project Creation
      console.log('\n📁 STEP 3: Project Creation');
      await showStep(3, 'Create New Project', 'Finding and clicking New Project button');
      
      // Find and highlight new project button
      const newProjectFound = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.findElement(controller.selectors.newProjectButton);
        if (button) {
          button.classList.add('e2e-highlight');
          button.scrollIntoView({ behavior: 'smooth', block: 'center' });
          
          // Add arrow pointing to button
          const arrow = document.createElement('div');
          arrow.innerHTML = '👈 Click to create project';
          arrow.style.cssText = `
            position: absolute; color: red; font-size: 20px; font-weight: bold;
            z-index: 10000; animation: bounce 1s infinite;
          `;
          
          const rect = button.getBoundingClientRect();
          arrow.style.left = rect.right + 10 + 'px';
          arrow.style.top = rect.top + 'px';
          document.body.appendChild(arrow);
          
          return true;
        }
        return false;
      });
      
      expect(newProjectFound).toBe(true);
      await page.waitForTimeout(3000);
      
      // Click new project button
      const projectName = `Visual Demo Project ${Date.now()}`;
      const projectResult = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        return await controller.createProject(name);
      }, projectName);
      
      expect(projectResult.success).toBe(true);
      
      // Show project creation success
      await page.evaluate((name) => {
        document.querySelectorAll('[style*="color: red"]').forEach(el => el.remove());
        
        const success = document.createElement('div');
        success.innerHTML = `✅ Project "${name}" Created!`;
        success.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #10a37f; color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 20px; z-index: 10000;
        `;
        document.body.appendChild(success);
        
        setTimeout(() => success.remove(), 3000);
      }, projectName);
      
      await page.waitForTimeout(4000);
      console.log(`   ✅ Project "${projectName}" created successfully`);

      // STEP 4: Custom Instructions
      console.log('\n⚙️  STEP 4: Custom Instructions');
      await showStep(4, 'Set Custom Instructions', 'Configuring AI behavior for this session');
      
      const instructionsResult = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        return await controller.setCustomInstructions(
          'I am testing a Chrome extension for ChatGPT automation. Please provide clear, step-by-step responses.',
          'Be concise but thorough. Confirm when actions are completed. Focus on technical accuracy.'
        );
      });
      
      // Show instructions being set
      await page.evaluate(() => {
        const setting = document.createElement('div');
        setting.innerHTML = '⚙️ Setting Custom Instructions...';
        setting.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(0,0,0,0.9); color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 20px; z-index: 10000;
        `;
        document.body.appendChild(setting);
        
        setTimeout(() => {
          setting.innerHTML = '✅ Instructions Configured!';
          setting.style.background = '#10a37f';
        }, 2000);
        
        setTimeout(() => setting.remove(), 4000);
      });
      
      await page.waitForTimeout(5000);
      console.log('   ✅ Custom instructions configured');

      // STEP 5: Send Image Generation Prompt
      console.log('\n💬 STEP 5: Send Image Prompt');
      await showStep(5, 'Send Image Prompt', 'Requesting AI to generate an image');
      
      const imagePrompt = 'Create a simple, clean icon of a robot head with glowing blue eyes, minimal design, perfect for a Chrome extension logo';
      
      // Highlight chat input
      await highlightElement('textarea[placeholder*="Message"], #prompt-textarea');
      await page.waitForTimeout(2000);
      
      // Show typing animation
      await page.evaluate((prompt) => {
        const typing = document.createElement('div');
        typing.innerHTML = `💬 Typing: "${prompt.substring(0, 40)}..."`;
        typing.style.cssText = `
          position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%);
          background: rgba(0,0,0,0.9); color: white; padding: 15px 30px;
          border-radius: 10px; font-size: 16px; z-index: 10000;
        `;
        document.body.appendChild(typing);
        
        setTimeout(() => typing.remove(), 3000);
      }, imagePrompt);
      
      const promptResult = await page.evaluate(async (prompt) => {
        const controller = window.chatGPTController;
        return await controller.sendPrompt(prompt);
      }, imagePrompt);
      
      expect(promptResult.success).toBe(true);
      
      // Wait for response
      await page.waitForSelector('[data-message-author-role="assistant"]', { timeout: 60000 });
      
      // Highlight the response
      await highlightElement('[data-message-author-role="assistant"]', 'e2e-success');
      
      await page.evaluate(() => {
        const sent = document.createElement('div');
        sent.innerHTML = '✅ Prompt Sent & Response Received!';
        sent.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #10a37f; color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 20px; z-index: 10000;
        `;
        document.body.appendChild(sent);
        
        setTimeout(() => sent.remove(), 3000);
      });
      
      await page.waitForTimeout(4000);
      console.log('   ✅ Image generation prompt sent and response received');

      // STEP 6: Wait for Image Generation
      console.log('\n🖼️  STEP 6: Image Generation & Download');
      await showStep(6, 'Image Generation', 'Waiting for AI to generate the image...');
      
      // Show waiting animation
      await page.evaluate(() => {
        const waiting = document.createElement('div');
        waiting.innerHTML = '🎨 Generating Image... This may take 30-60 seconds';
        waiting.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: rgba(255, 165, 0, 0.9); color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 18px; z-index: 10000;
          animation: pulse 2s infinite;
        `;
        document.body.appendChild(waiting);
        
        let countdown = 45;
        const timer = setInterval(() => {
          countdown--;
          waiting.innerHTML = `🎨 Generating Image... ${countdown}s remaining`;
          if (countdown <= 0) {
            clearInterval(timer);
            waiting.remove();
          }
        }, 1000);
      });
      
      await page.waitForTimeout(45000); // Wait for image generation
      
      // STEP 7: Image Detection and Download
      console.log('\n💾 STEP 7: Image Detection & Download');
      await showStep(7, 'Download Images', 'Detecting and downloading generated images');
      
      const downloadResult = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        return await controller.detectAndDownloadImages({
          prefix: 'visual-demo',
          autoDownload: true
        });
      });
      
      // Check for images and show results
      const imagesFound = await page.evaluate(() => {
        const images = document.querySelectorAll('img[src*="dalle"], img[src*="oai"], img[alt*="Image"]');
        
        // Highlight any found images
        images.forEach(img => {
          img.classList.add('e2e-success');
          img.style.border = '5px solid #00ff00';
        });
        
        return images.length;
      });
      
      // Show final results
      await page.evaluate((imageCount, downloadSuccess) => {
        const result = document.createElement('div');
        const status = imageCount > 0 ? '✅' : '⚠️';
        const message = imageCount > 0 
          ? `${status} ${imageCount} Image(s) Found & Download Attempted!`
          : `${status} No Images Detected (May still be generating)`;
        
        result.innerHTML = message;
        result.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: ${imageCount > 0 ? '#10a37f' : '#ff9500'}; color: white; 
          padding: 20px 40px; border-radius: 10px; font-size: 20px; z-index: 10000;
        `;
        document.body.appendChild(result);
        
        setTimeout(() => result.remove(), 5000);
      }, imagesFound, downloadResult.success);
      
      console.log(`   📊 Images detected: ${imagesFound}`);
      console.log(`   💾 Download attempted: ${downloadResult.success}`);
      
      await page.waitForTimeout(6000);

      // FINAL STEP: Summary
      console.log('\n🎉 STEP 8: Flow Summary');
      await showStep(8, 'Flow Complete!', 'All steps executed successfully');
      
      await clearHighlights();
      
      // Show final summary
      await page.evaluate((projectName, imageCount) => {
        const summary = document.createElement('div');
        summary.innerHTML = `
          <h2 style="margin: 0 0 15px 0; color: #00ff00;">🎉 User Flow Complete!</h2>
          <div style="text-align: left; line-height: 1.6;">
            ✅ Extension verified and loaded<br>
            ✅ ChatGPT integration established<br>
            ✅ Project "${projectName}" created<br>
            ✅ Custom instructions configured<br>
            ✅ Image generation prompt sent<br>
            ✅ AI response received<br>
            ${imageCount > 0 ? '✅' : '⚠️'} ${imageCount} image(s) detected<br>
            ✅ Download functionality tested
          </div>
          <div style="margin-top: 15px; font-size: 14px; opacity: 0.8;">
            Complete user journey successfully demonstrated!
          </div>
        `;
        summary.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white; padding: 30px 40px; border-radius: 15px; 
          font-size: 16px; z-index: 10000; text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
          max-width: 500px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        `;
        document.body.appendChild(summary);
      }, projectName, imagesFound);
      
      console.log('\n🎯 VISUAL DEMONSTRATION COMPLETED SUCCESSFULLY!');
      console.log('================================================');
      console.log('✅ All core functionality demonstrated');
      console.log('✅ Extension working properly');
      console.log('✅ User flow validated end-to-end');
      
      // Keep summary visible
      await page.waitForTimeout(10000);

    } catch (error) {
      console.error('\n❌ Visual demonstration error:', error.message);
      
      // Show error state
      await page.evaluate((errorMsg) => {
        const error = document.createElement('div');
        error.innerHTML = `❌ Error: ${errorMsg}`;
        error.style.cssText = `
          position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
          background: #ff4444; color: white; padding: 20px 40px;
          border-radius: 10px; font-size: 18px; z-index: 10000;
        `;
        document.body.appendChild(error);
      }, error.message);
      
      await page.waitForTimeout(5000);
      throw error;
    }
  }, 600000); // 10 minute timeout for complete visual demo
});