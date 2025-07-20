/**
 * E2E Tests for Image Request Handling
 * Tests requesting image generation from ChatGPT
 */

describe('Image Request Handling', () => {
  let browser;
  let page;

  beforeAll(async () => {
    browser = await setupBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await getExtensionPage(browser);
    await clearExtensionData(page);
    
    // Create project and start chat
    await page.click('[data-testid="create-project-btn"]');
    await page.type('[data-testid="project-name-input"]', 'Image Test Project');
    await page.click('[data-testid="submit-project-btn"]');
    await page.waitForSelector('[data-testid="project-item"]');
    await page.click('[data-testid="project-item"]');
    await page.click('[data-testid="new-chat-btn"]');
    await page.waitForSelector('[data-testid="message-input"]');
  });

  describe('Basic Image Requests', () => {
    test('should request image generation with text prompt', async () => {
      const imagePrompt = 'A serene mountain landscape at sunset';
      
      // Type image prompt
      await page.type('[data-testid="message-input"]', imagePrompt);
      
      // Click image generation button
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify image request message
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"][data-message-type="image-request"]');
      
      const requestMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(requestMessage).toBe(`Generate image: ${imagePrompt}`);
      
      // Verify image request indicator
      await expect(page).toBeVisibleInPage('[data-testid="image-request-indicator"]');
      
      // Verify loading state
      await expect(page).toBeVisibleInPage('[data-testid="image-generating-indicator"]');
      
      // Wait for image response
      await page.waitForSelector('[data-testid="message"][data-role="assistant"][data-message-type="image-response"]', { timeout: 15000 });
      
      // Verify image displayed
      await expect(page).toBeVisibleInPage('[data-testid="generated-image"]');
      
      const imageCount = await page.$$eval('[data-testid="generated-image"]', images => images.length);
      expect(imageCount).toBeGreaterThanOrEqual(1);
    });

    test('should show image generation button when appropriate', async () => {
      // Image button should be visible by default
      await expect(page).toBeVisibleInPage('[data-testid="image-request-btn"]');
      
      // Type text that suggests image generation
      await page.type('[data-testid="message-input"]', 'Create an image of');
      
      // Button should remain visible
      const isVisible = await page.$eval(
        '[data-testid="image-request-btn"]',
        el => !el.hidden && getComputedStyle(el).display !== 'none'
      );
      expect(isVisible).toBe(true);
      
      // Button should have proper tooltip
      const tooltip = await page.$eval(
        '[data-testid="image-request-btn"]',
        el => el.getAttribute('title')
      );
      expect(tooltip).toBe('Generate image from this prompt');
    });

    test('should disable image button for empty input', async () => {
      // Button should be disabled when input is empty
      const isDisabled = await page.$eval('[data-testid="image-request-btn"]', el => el.disabled);
      expect(isDisabled).toBe(true);
      
      // Type something
      await page.type('[data-testid="message-input"]', 'A beautiful flower');
      
      // Button should be enabled
      const isEnabled = await page.$eval('[data-testid="image-request-btn"]', el => !el.disabled);
      expect(isEnabled).toBe(true);
      
      // Clear input
      await page.click('[data-testid="message-input"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      
      // Button should be disabled again
      const isDisabledAgain = await page.$eval('[data-testid="image-request-btn"]', el => el.disabled);
      expect(isDisabledAgain).toBe(true);
    });

    test('should handle complex image prompts', async () => {
      const complexPrompt = 'A futuristic cityscape with flying cars, neon lights, cyberpunk style, highly detailed, 4K resolution, digital art';
      
      await page.type('[data-testid="message-input"]', complexPrompt);
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify complex prompt is sent correctly
      const requestMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(requestMessage).toContain(complexPrompt);
      
      // Wait for image generation
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 20000 });
      
      // Verify image metadata includes prompt
      const imageAlt = await page.$eval(
        '[data-testid="generated-image"]',
        el => el.getAttribute('alt')
      );
      expect(imageAlt).toContain('Generated image');
    });
  });

  describe('Image Generation UI', () => {
    test('should show generation progress', async () => {
      await page.type('[data-testid="message-input"]', 'A red rose');
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify progress indicator
      await expect(page).toBeVisibleInPage('[data-testid="image-generation-progress"]');
      
      // Verify progress text
      const progressText = await page.$eval(
        '[data-testid="generation-status-text"]',
        el => el.textContent
      );
      expect(progressText).toBe('Generating image...');
      
      // Verify animated loading spinner
      await expect(page).toBeVisibleInPage('[data-testid="generation-spinner"]');
      
      // Check for progress bar if available
      const progressBar = await page.$('[data-testid="generation-progress-bar"]');
      if (progressBar) {
        const progressValue = await progressBar.evaluate(el => el.value);
        expect(progressValue).toBeGreaterThanOrEqual(0);
      }
    });

    test('should show estimated time for generation', async () => {
      await page.type('[data-testid="message-input"]', 'Ocean waves');
      await page.click('[data-testid="image-request-btn"]');
      
      // Look for time estimate
      await page.waitForSelector('[data-testid="estimated-time"]', { timeout: 5000 });
      
      const estimatedTime = await page.$eval(
        '[data-testid="estimated-time"]',
        el => el.textContent
      );
      expect(estimatedTime).toMatch(/Estimated: \d+-\d+ seconds/);
    });

    test('should handle multiple image variants', async () => {
      await page.type('[data-testid="message-input"]', 'Abstract art');
      await page.click('[data-testid="image-request-btn"]');
      
      // Wait for images to generate
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 20000 });
      
      // Check if multiple variants are provided
      const imageCount = await page.$$eval('[data-testid="generated-image"]', images => images.length);
      
      if (imageCount > 1) {
        // Verify variant selection UI
        await expect(page).toBeVisibleInPage('[data-testid="image-variants"]');
        
        // Verify each variant is clickable
        for (let i = 0; i < imageCount; i++) {
          const variantButton = await page.$(`[data-testid="image-variant-${i}"]`);
          expect(variantButton).toBeTruthy();
        }
      }
    });

    test('should display image metadata and details', async () => {
      await page.type('[data-testid="message-input"]', 'Space nebula');
      await page.click('[data-testid="image-request-btn"]');
      
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 15000 });
      
      // Check for image details panel
      await page.click('[data-testid="image-details-btn"]');
      await expect(page).toBeVisibleInPage('[data-testid="image-details-panel"]');
      
      // Verify metadata fields
      await expect(page).toBeVisibleInPage('[data-testid="image-prompt"]');
      await expect(page).toBeVisibleInPage('[data-testid="image-dimensions"]');
      await expect(page).toBeVisibleInPage('[data-testid="image-format"]');
      await expect(page).toBeVisibleInPage('[data-testid="generation-time"]');
      
      const promptText = await page.$eval('[data-testid="image-prompt"]', el => el.textContent);
      expect(promptText).toContain('Space nebula');
    });
  });

  describe('Error Handling', () => {
    test('should handle image generation failures', async () => {
      // Mock API failure
      await page.evaluateOnNewDocument(() => {
        const originalFetch = window.fetch;
        window.fetch = (url, ...args) => {
          if (url.includes('image')) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: () => Promise.resolve({
                error: { message: 'Content policy violation' }
              })
            });
          }
          return originalFetch(url, ...args);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Test image');
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="image-error-message"]');
      const errorText = await page.$eval('[data-testid="image-error-message"]', el => el.textContent);
      expect(errorText).toContain('Content policy violation');
      
      // Verify retry button
      await expect(page).toBeVisibleInPage('[data-testid="retry-image-btn"]');
    });

    test('should handle content policy violations', async () => {
      const violatingPrompt = 'Inappropriate content request';
      
      // Mock content policy violation
      await page.evaluateOnNewDocument(() => {
        const originalFetch = window.fetch;
        window.fetch = (url, ...args) => {
          if (url.includes('image')) {
            return Promise.resolve({
              ok: false,
              status: 400,
              json: () => Promise.resolve({
                error: { 
                  code: 'content_policy_violation',
                  message: 'Your request was rejected due to content policy'
                }
              })
            });
          }
          return originalFetch(url, ...args);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', violatingPrompt);
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify specific content policy message
      await expect(page).toBeVisibleInPage('[data-testid="content-policy-error"]');
      const policyText = await page.$eval('[data-testid="content-policy-error"]', el => el.textContent);
      expect(policyText).toContain('content policy');
      
      // Verify helpful suggestions
      await expect(page).toBeVisibleInPage('[data-testid="prompt-suggestions"]');
    });

    test('should handle network timeouts', async () => {
      // Mock timeout
      await page.evaluateOnNewDocument(() => {
        const originalFetch = window.fetch;
        window.fetch = (url, ...args) => {
          if (url.includes('image')) {
            return new Promise(() => {}); // Never resolves (timeout)
          }
          return originalFetch(url, ...args);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Timeout test');
      await page.click('[data-testid="image-request-btn"]');
      
      // Wait for timeout (should happen after 30 seconds)
      await page.waitForSelector('[data-testid="timeout-error"]', { timeout: 35000 });
      
      const timeoutText = await page.$eval('[data-testid="timeout-error"]', el => el.textContent);
      expect(timeoutText).toContain('Request timed out');
      
      // Verify retry option
      await expect(page).toBeVisibleInPage('[data-testid="retry-image-btn"]');
    });

    test('should retry failed image generation', async () => {
      let requestCount = 0;
      
      // Mock to fail first time, succeed second time
      await page.evaluateOnNewDocument(() => {
        const originalFetch = window.fetch;
        window.fetch = (url, ...args) => {
          if (url.includes('image')) {
            window.imageRequestCount = (window.imageRequestCount || 0) + 1;
            if (window.imageRequestCount === 1) {
              return Promise.resolve({
                ok: false,
                status: 500,
                json: () => Promise.resolve({ error: { message: 'Server error' } })
              });
            }
            // Mock successful response
            return Promise.resolve({
              ok: true,
              json: () => Promise.resolve({
                data: [{ url: 'data:image/png;base64,mock-image-data' }]
              })
            });
          }
          return originalFetch(url, ...args);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Retry test');
      await page.click('[data-testid="image-request-btn"]');
      
      // Wait for error and retry
      await page.waitForSelector('[data-testid="retry-image-btn"]');
      await page.click('[data-testid="retry-image-btn"]');
      
      // Verify successful generation
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 10000 });
      const imageExists = await page.$('[data-testid="generated-image"]');
      expect(imageExists).toBeTruthy();
    });
  });

  describe('Image Quality and Options', () => {
    test('should offer image quality options', async () => {
      await page.type('[data-testid="message-input"]', 'High quality artwork');
      
      // Check for quality selector
      await page.click('[data-testid="image-options-btn"]');
      await expect(page).toBeVisibleInPage('[data-testid="quality-selector"]');
      
      // Verify quality options
      const qualityOptions = await page.$$eval(
        '[data-testid="quality-option"]',
        options => options.map(opt => opt.textContent)
      );
      expect(qualityOptions).toContain('Standard');
      expect(qualityOptions).toContain('High');
      
      // Select high quality
      await page.click('[data-testid="quality-high"]');
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify quality setting in request
      const requestMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(requestMessage).toContain('High quality artwork');
    });

    test('should offer image size options', async () => {
      await page.type('[data-testid="message-input"]', 'Landscape photo');
      await page.click('[data-testid="image-options-btn"]');
      
      // Verify size options
      await expect(page).toBeVisibleInPage('[data-testid="size-selector"]');
      const sizeOptions = await page.$$eval(
        '[data-testid="size-option"]',
        options => options.map(opt => opt.textContent)
      );
      expect(sizeOptions).toContain('1024×1024');
      expect(sizeOptions).toContain('1792×1024');
      expect(sizeOptions).toContain('1024×1792');
      
      // Select landscape size
      await page.click('[data-testid="size-1792x1024"]');
      await page.click('[data-testid="image-request-btn"]');
      
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 15000 });
      
      // Verify image dimensions (if available in metadata)
      await page.click('[data-testid="image-details-btn"]');
      const dimensions = await page.$eval('[data-testid="image-dimensions"]', el => el.textContent);
      expect(dimensions).toContain('1792×1024');
    });

    test('should show style options', async () => {
      await page.type('[data-testid="message-input"]', 'Art piece');
      await page.click('[data-testid="image-options-btn"]');
      
      // Check for style selector
      await expect(page).toBeVisibleInPage('[data-testid="style-selector"]');
      
      const styleOptions = await page.$$eval(
        '[data-testid="style-option"]',
        options => options.map(opt => opt.textContent)
      );
      expect(styleOptions.length).toBeGreaterThan(0);
      
      // Select a style if available
      if (styleOptions.includes('Natural')) {
        await page.click('[data-testid="style-natural"]');
      }
      
      await page.click('[data-testid="image-request-btn"]');
      
      // Verify style applied to request
      await page.waitForSelector('[data-testid="message"][data-role="user"]');
      const hasStyleIndicator = await page.$('[data-testid="style-indicator"]');
      expect(hasStyleIndicator).toBeTruthy();
    });
  });

  describe('Image History and Management', () => {
    test('should maintain image history in chat', async () => {
      // Generate first image
      await page.type('[data-testid="message-input"]', 'First image');
      await page.click('[data-testid="image-request-btn"]');
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 15000 });
      
      // Generate second image
      await page.type('[data-testid="message-input"]', 'Second image');
      await page.click('[data-testid="image-request-btn"]');
      await page.waitForSelector('[data-testid="generated-image"]:nth-child(2)', { timeout: 15000 });
      
      // Verify both images exist in chat
      const imageCount = await page.$$eval('[data-testid="generated-image"]', images => images.length);
      expect(imageCount).toBe(2);
      
      // Verify images have correct prompts
      const firstPrompt = await page.$eval(
        '[data-testid="message"][data-role="user"]:nth-child(1) [data-testid="message-text"]',
        el => el.textContent
      );
      const secondPrompt = await page.$eval(
        '[data-testid="message"][data-role="user"]:nth-child(3) [data-testid="message-text"]',
        el => el.textContent
      );
      
      expect(firstPrompt).toContain('First image');
      expect(secondPrompt).toContain('Second image');
    });

    test('should persist images across sessions', async () => {
      // Generate image
      await page.type('[data-testid="message-input"]', 'Persistent image');
      await page.click('[data-testid="image-request-btn"]');
      await page.waitForSelector('[data-testid="generated-image"]', { timeout: 15000 });
      
      // Get image source for comparison
      const imageSrc = await page.$eval('[data-testid="generated-image"]', el => el.src);
      
      // Reload extension
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      // Verify image persists
      await expect(page).toBeVisibleInPage('[data-testid="generated-image"]');
      const persistedImageSrc = await page.$eval('[data-testid="generated-image"]', el => el.src);
      expect(persistedImageSrc).toBe(imageSrc);
    });

    test('should handle image loading errors', async () => {
      // Mock image loading error
      await page.evaluateOnNewDocument(() => {
        // Override image loading to simulate error
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(this, tagName);
          if (tagName.toLowerCase() === 'img') {
            setTimeout(() => {
              element.dispatchEvent(new Event('error'));
            }, 100);
          }
          return element;
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Error test');
      await page.click('[data-testid="image-request-btn"]');
      
      // Wait for error state
      await page.waitForSelector('[data-testid="image-load-error"]', { timeout: 10000 });
      
      // Verify error message
      const errorText = await page.$eval('[data-testid="image-load-error"]', el => el.textContent);
      expect(errorText).toContain('Failed to load image');
      
      // Verify reload button
      await expect(page).toBeVisibleInPage('[data-testid="reload-image-btn"]');
    });
  });
});