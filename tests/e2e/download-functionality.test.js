/**
 * E2E Tests for Download Functionality
 * Tests downloading generated images and handling download workflows
 */

describe('Download Functionality', () => {
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
    
    // Create project, start chat, and generate an image
    await page.click('[data-testid="create-project-btn"]');
    await page.type('[data-testid="project-name-input"]', 'Download Test Project');
    await page.click('[data-testid="submit-project-btn"]');
    await page.waitForSelector('[data-testid="project-item"]');
    await page.click('[data-testid="project-item"]');
    await page.click('[data-testid="new-chat-btn"]');
    await page.waitForSelector('[data-testid="message-input"]');
    
    // Generate test image
    await page.type('[data-testid="message-input"]', 'Test download image');
    await page.click('[data-testid="image-request-btn"]');
    await page.waitForSelector('[data-testid="generated-image"]', { timeout: 15000 });
  });

  describe('Basic Download Functionality', () => {
    test('should download image when clicking download button', async () => {
      // Set up download path and listener
      await page._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: '/tmp/test-downloads'
      });
      
      let downloadPath = null;
      page.on('response', async response => {
        if (response.url().includes('download')) {
          downloadPath = response.url();
        }
      });
      
      // Click download button
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify download initiated
      await page.waitForTimeout(2000);
      
      // Check download success notification
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
      const successText = await page.$eval('[data-testid="download-success"]', el => el.textContent);
      expect(successText).toContain('Image downloaded successfully');
    });

    test('should show download button on image hover', async () => {
      // Hover over image
      await page.hover('[data-testid="generated-image"]');
      
      // Verify download button appears
      await expect(page).toBeVisibleInPage('[data-testid="download-image-btn"]');
      
      // Verify button tooltip
      const tooltip = await page.$eval(
        '[data-testid="download-image-btn"]',
        el => el.getAttribute('title')
      );
      expect(tooltip).toBe('Download image');
      
      // Move away from image
      await page.hover('[data-testid="chat-messages"]');
      
      // Verify button becomes less prominent (but may still be visible)
      const buttonOpacity = await page.$eval(
        '[data-testid="download-image-btn"]',
        el => getComputedStyle(el).opacity
      );
      expect(parseFloat(buttonOpacity)).toBeLessThan(1);
    });

    test('should generate appropriate filename', async () => {
      // Mock download to capture filename
      let downloadFilename = null;
      
      await page.evaluateOnNewDocument(() => {
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(this, tagName);
          if (tagName.toLowerCase() === 'a' && element.download !== undefined) {
            // Capture download filename
            Object.defineProperty(element, 'download', {
              set: function(value) {
                window.lastDownloadFilename = value;
                this._download = value;
              },
              get: function() {
                return this._download;
              }
            });
          }
          return element;
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      // Download image
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Get filename
      const filename = await page.evaluate(() => window.lastDownloadFilename);
      
      // Verify filename format
      expect(filename).toMatch(/^chatgpt-image-\d{13}\.png$/);
    });

    test('should maintain original image quality', async () => {
      // Get original image data
      const originalImageData = await page.$eval(
        '[data-testid="generated-image"]',
        el => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.width = el.naturalWidth;
          canvas.height = el.naturalHeight;
          ctx.drawImage(el, 0, 0);
          return canvas.toDataURL();
        }
      );
      
      // Mock download to capture blob
      let downloadedData = null;
      await page.evaluateOnNewDocument(() => {
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          window.lastDownloadBlob = blob;
          return originalCreateObjectURL(blob);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify blob was created
      const blobExists = await page.evaluate(() => window.lastDownloadBlob !== undefined);
      expect(blobExists).toBe(true);
      
      // Verify blob type
      const blobType = await page.evaluate(() => window.lastDownloadBlob.type);
      expect(blobType).toBe('image/png');
    });
  });

  describe('Download Options and Formats', () => {
    test('should offer multiple download formats', async () => {
      // Right-click for context menu or click options
      await page.click('[data-testid="download-options-btn"]');
      
      // Verify format options
      await expect(page).toBeVisibleInPage('[data-testid="format-selector"]');
      
      const formatOptions = await page.$$eval(
        '[data-testid="format-option"]',
        options => options.map(opt => opt.textContent)
      );
      
      expect(formatOptions).toContain('PNG');
      expect(formatOptions).toContain('JPEG');
      expect(formatOptions).toContain('WEBP');
      
      // Select JPEG format
      await page.click('[data-testid="format-jpeg"]');
      await page.click('[data-testid="download-with-format-btn"]');
      
      // Verify JPEG download
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
    });

    test('should offer quality options for JPEG', async () => {
      await page.click('[data-testid="download-options-btn"]');
      await page.click('[data-testid="format-jpeg"]');
      
      // Verify quality slider appears
      await expect(page).toBeVisibleInPage('[data-testid="quality-slider"]');
      
      // Adjust quality
      await page.click('[data-testid="quality-slider"]');
      await page.keyboard.press('ArrowRight'); // Increase quality
      
      const qualityValue = await page.$eval('[data-testid="quality-value"]', el => el.textContent);
      expect(parseInt(qualityValue)).toBeGreaterThan(80);
      
      await page.click('[data-testid="download-with-format-btn"]');
      
      // Verify download with custom quality
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
    });

    test('should offer resolution options', async () => {
      await page.click('[data-testid="download-options-btn"]');
      
      // Check for resolution options
      await expect(page).toBeVisibleInPage('[data-testid="resolution-selector"]');
      
      const resolutionOptions = await page.$$eval(
        '[data-testid="resolution-option"]',
        options => options.map(opt => opt.textContent)
      );
      
      expect(resolutionOptions).toContain('Original');
      expect(resolutionOptions).toContain('1920×1080');
      expect(resolutionOptions).toContain('1280×720');
      
      // Select different resolution
      await page.click('[data-testid="resolution-1920x1080"]');
      await page.click('[data-testid="download-with-format-btn"]');
      
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
    });

    test('should allow custom filename input', async () => {
      await page.click('[data-testid="download-options-btn"]');
      
      // Check for filename input
      await expect(page).toBeVisibleInPage('[data-testid="filename-input"]');
      
      // Clear and enter custom filename
      await page.click('[data-testid="filename-input"]', { clickCount: 3 });
      await page.type('[data-testid="filename-input"]', 'my-custom-image');
      
      await page.click('[data-testid="download-with-format-btn"]');
      
      // Verify download with custom filename
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
      const successText = await page.$eval('[data-testid="download-success"]', el => el.textContent);
      expect(successText).toContain('my-custom-image');
    });
  });

  describe('Multiple Image Downloads', () => {
    beforeEach(async () => {
      // Generate additional images
      await page.type('[data-testid="message-input"]', 'Second test image');
      await page.click('[data-testid="image-request-btn"]');
      await page.waitForSelector('[data-testid="generated-image"]:nth-child(2)', { timeout: 15000 });
    });

    test('should download all images in conversation', async () => {
      // Click download all button
      await page.click('[data-testid="download-all-btn"]');
      
      // Verify download all confirmation
      await expect(page).toBeVisibleInPage('[data-testid="download-all-confirmation"]');
      const confirmText = await page.$eval('[data-testid="download-all-confirmation"]', el => el.textContent);
      expect(confirmText).toContain('Download 2 images?');
      
      // Confirm download
      await page.click('[data-testid="confirm-download-all"]');
      
      // Verify batch download progress
      await expect(page).toBeVisibleInPage('[data-testid="batch-download-progress"]');
      
      // Wait for completion
      await page.waitForSelector('[data-testid="batch-download-complete"]', { timeout: 10000 });
      
      const completeText = await page.$eval('[data-testid="batch-download-complete"]', el => el.textContent);
      expect(completeText).toContain('2 images downloaded');
    });

    test('should show download progress for multiple images', async () => {
      await page.click('[data-testid="download-all-btn"]');
      await page.click('[data-testid="confirm-download-all"]');
      
      // Verify progress bar
      await expect(page).toBeVisibleInPage('[data-testid="download-progress-bar"]');
      
      // Verify progress text
      const progressText = await page.$eval('[data-testid="download-progress-text"]', el => el.textContent);
      expect(progressText).toMatch(/Downloading \d+ of \d+/);
      
      // Wait for completion
      await page.waitForSelector('[data-testid="batch-download-complete"]', { timeout: 15000 });
    });

    test('should allow selective image download', async () => {
      // Enable selection mode
      await page.click('[data-testid="select-images-btn"]');
      
      // Verify selection checkboxes appear
      await expect(page).toBeVisibleInPage('[data-testid="image-checkbox"]:nth-child(1)');
      await expect(page).toBeVisibleInPage('[data-testid="image-checkbox"]:nth-child(2)');
      
      // Select first image only
      await page.click('[data-testid="image-checkbox"]:nth-child(1)');
      
      // Download selected
      await page.click('[data-testid="download-selected-btn"]');
      
      // Verify single download
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
      const successText = await page.$eval('[data-testid="download-success"]', el => el.textContent);
      expect(successText).toContain('1 image downloaded');
    });

    test('should create ZIP archive for multiple downloads', async () => {
      await page.click('[data-testid="download-all-btn"]');
      await page.click('[data-testid="zip-archive-option"]');
      await page.click('[data-testid="confirm-download-all"]');
      
      // Verify ZIP creation progress
      await expect(page).toBeVisibleInPage('[data-testid="zip-creation-progress"]');
      
      // Wait for ZIP completion
      await page.waitForSelector('[data-testid="zip-download-complete"]', { timeout: 10000 });
      
      const completeText = await page.$eval('[data-testid="zip-download-complete"]', el => el.textContent);
      expect(completeText).toContain('ZIP archive downloaded');
    });
  });

  describe('Download Error Handling', () => {
    test('should handle download failures gracefully', async () => {
      // Mock download failure
      await page.evaluateOnNewDocument(() => {
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          throw new Error('Download failed');
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="download-error"]');
      const errorText = await page.$eval('[data-testid="download-error"]', el => el.textContent);
      expect(errorText).toContain('Download failed');
      
      // Verify retry button
      await expect(page).toBeVisibleInPage('[data-testid="retry-download-btn"]');
    });

    test('should handle corrupted image data', async () => {
      // Mock corrupted image
      await page.evaluate(() => {
        const image = document.querySelector('[data-testid="generated-image"]');
        image.src = 'data:image/png;base64,corrupted-data';
      });
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify error handling
      await expect(page).toBeVisibleInPage('[data-testid="download-error"]');
      const errorText = await page.$eval('[data-testid="download-error"]', el => el.textContent);
      expect(errorText).toContain('Invalid image data');
    });

    test('should handle insufficient storage space', async () => {
      // Mock storage quota exceeded
      await page.evaluateOnNewDocument(() => {
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify storage error message
      await expect(page).toBeVisibleInPage('[data-testid="storage-error"]');
      const errorText = await page.$eval('[data-testid="storage-error"]', el => el.textContent);
      expect(errorText).toContain('Insufficient storage space');
      
      // Verify cleanup suggestion
      await expect(page).toBeVisibleInPage('[data-testid="cleanup-suggestion"]');
    });

    test('should retry failed downloads', async () => {
      let downloadAttempts = 0;
      
      await page.evaluateOnNewDocument(() => {
        const originalCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = function(blob) {
          window.downloadAttempts = (window.downloadAttempts || 0) + 1;
          if (window.downloadAttempts === 1) {
            throw new Error('First attempt fails');
          }
          return originalCreateObjectURL(blob);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Wait for error and retry
      await page.waitForSelector('[data-testid="retry-download-btn"]');
      await page.click('[data-testid="retry-download-btn"]');
      
      // Verify successful retry
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
    });
  });

  describe('Download Management and History', () => {
    test('should track download history', async () => {
      // Download first image
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      await page.waitForSelector('[data-testid="download-success"]');
      
      // Generate and download second image
      await page.type('[data-testid="message-input"]', 'Another image');
      await page.click('[data-testid="image-request-btn"]');
      await page.waitForSelector('[data-testid="generated-image"]:nth-child(2)', { timeout: 15000 });
      await page.hover('[data-testid="generated-image"]:nth-child(2)');
      await page.click('[data-testid="download-image-btn"]:nth-child(2)');
      
      // Check download history
      await page.click('[data-testid="download-history-btn"]');
      await expect(page).toBeVisibleInPage('[data-testid="download-history-panel"]');
      
      const historyItems = await page.$$('[data-testid="download-history-item"]');
      expect(historyItems).toHaveLength(2);
      
      // Verify history item details
      const firstHistoryItem = await page.$eval(
        '[data-testid="download-history-item"]:nth-child(1)',
        el => el.textContent
      );
      expect(firstHistoryItem).toContain('Test download image');
    });

    test('should show download statistics', async () => {
      // Download an image
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      await page.waitForSelector('[data-testid="download-success"]');
      
      // Check statistics
      await page.click('[data-testid="download-stats-btn"]');
      await expect(page).toBeVisibleInPage('[data-testid="download-stats-panel"]');
      
      // Verify stats
      const totalDownloads = await page.$eval('[data-testid="total-downloads"]', el => el.textContent);
      expect(totalDownloads).toBe('1');
      
      const totalSize = await page.$eval('[data-testid="total-size"]', el => el.textContent);
      expect(totalSize).toMatch(/\d+(\.\d+)?\s*(KB|MB)/);
    });

    test('should clear download history', async () => {
      // Download image to create history
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      await page.waitForSelector('[data-testid="download-success"]');
      
      // Open history and clear
      await page.click('[data-testid="download-history-btn"]');
      await page.click('[data-testid="clear-history-btn"]');
      
      // Confirm clear
      await page.click('[data-testid="confirm-clear-history"]');
      
      // Verify history cleared
      const historyItems = await page.$$('[data-testid="download-history-item"]');
      expect(historyItems).toHaveLength(0);
      
      const emptyState = await page.$eval('[data-testid="history-empty-state"]', el => el.textContent);
      expect(emptyState).toBe('No downloads yet');
    });
  });

  describe('Browser Permissions and Compatibility', () => {
    test('should handle browser download permission denial', async () => {
      // Mock permission denial
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'permissions', {
          value: {
            query: () => Promise.resolve({ state: 'denied' })
          }
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify permission error
      await expect(page).toBeVisibleInPage('[data-testid="permission-error"]');
      const errorText = await page.$eval('[data-testid="permission-error"]', el => el.textContent);
      expect(errorText).toContain('Download permission required');
      
      // Verify instructions to enable downloads
      await expect(page).toBeVisibleInPage('[data-testid="enable-downloads-help"]');
    });

    test('should work in incognito mode', async () => {
      // Note: This test assumes the extension is allowed in incognito
      // In a real test, you'd launch a browser in incognito mode
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Verify download works in incognito
      await expect(page).toBeVisibleInPage('[data-testid="download-success"]');
    });

    test('should handle older browser compatibility', async () => {
      // Mock older browser without download attribute support
      await page.evaluateOnNewDocument(() => {
        const originalCreateElement = document.createElement;
        document.createElement = function(tagName) {
          const element = originalCreateElement.call(this, tagName);
          if (tagName.toLowerCase() === 'a') {
            // Remove download attribute support
            delete element.download;
          }
          return element;
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      await page.hover('[data-testid="generated-image"]');
      await page.click('[data-testid="download-image-btn"]');
      
      // Should fallback to alternative method
      await expect(page).toBeVisibleInPage('[data-testid="download-fallback"]');
      const fallbackText = await page.$eval('[data-testid="download-fallback"]', el => el.textContent);
      expect(fallbackText).toContain('Right-click to save image');
    });
  });
});