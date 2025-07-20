/**
 * E2E Tests for Project Creation Flow
 * Tests all aspects of creating projects in the ChatGPT extension
 */

describe('Project Creation Flow', () => {
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
  });

  describe('Valid Project Creation', () => {
    test('should create project with valid name', async () => {
      // Click create project button
      await page.click('[data-testid="create-project-btn"]');
      
      // Enter project name
      await page.type('[data-testid="project-name-input"]', 'My Test Project');
      
      // Submit form
      await page.click('[data-testid="submit-project-btn"]');
      
      // Verify project appears in list
      await expect(page).toBeVisibleInPage('[data-testid="project-item"]');
      
      // Verify project name
      const projectName = await page.$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        el => el.textContent
      );
      expect(projectName).toBe('My Test Project');
      
      // Verify success notification
      await expect(page).toBeVisibleInPage('[data-testid="success-notification"]');
    });

    test('should create multiple projects', async () => {
      const projectNames = ['Project Alpha', 'Project Beta', 'Project Gamma'];
      
      for (const name of projectNames) {
        await page.click('[data-testid="create-project-btn"]');
        await page.type('[data-testid="project-name-input"]', name);
        await page.click('[data-testid="submit-project-btn"]');
        
        // Wait for project to be added
        await page.waitForSelector(`[data-testid="project-item"]:nth-child(${projectNames.indexOf(name) + 1})`);
      }
      
      // Verify all projects are listed
      const projectItems = await page.$$('[data-testid="project-item"]');
      expect(projectItems).toHaveLength(3);
      
      // Verify project names
      for (let i = 0; i < projectNames.length; i++) {
        const projectName = await page.$eval(
          `[data-testid="project-item"]:nth-child(${i + 1}) [data-testid="project-name"]`,
          el => el.textContent
        );
        expect(projectName).toBe(projectNames[i]);
      }
    });

    test('should trim whitespace from project names', async () => {
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', '  Trimmed Project  ');
      await page.click('[data-testid="submit-project-btn"]');
      
      const projectName = await page.$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        el => el.textContent
      );
      expect(projectName).toBe('Trimmed Project');
    });

    test('should support unicode and emoji in project names', async () => {
      const unicodeNames = [
        '项目测试 🚀',
        'プロジェクト 🎨',
        'مشروع اختبار 💡'
      ];
      
      for (const name of unicodeNames) {
        await page.click('[data-testid="create-project-btn"]');
        await page.type('[data-testid="project-name-input"]', name);
        await page.click('[data-testid="submit-project-btn"]');
        
        await page.waitForTimeout(500); // Wait for project to be saved
      }
      
      // Verify all unicode names are displayed correctly
      const projectNames = await page.$$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        elements => elements.map(el => el.textContent)
      );
      
      expect(projectNames).toEqual(unicodeNames);
    });
  });

  describe('Invalid Project Creation', () => {
    test('should show error for empty project name', async () => {
      await page.click('[data-testid="create-project-btn"]');
      
      // Try to submit without entering name
      await page.click('[data-testid="submit-project-btn"]');
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="error-message"]');
      const errorText = await page.$eval('[data-testid="error-message"]', el => el.textContent);
      expect(errorText).toBe('Project name is required');
      
      // Verify project not created
      const projectItems = await page.$$('[data-testid="project-item"]');
      expect(projectItems).toHaveLength(0);
    });

    test('should show error for whitespace-only name', async () => {
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', '   ');
      await page.click('[data-testid="submit-project-btn"]');
      
      await expect(page).toBeVisibleInPage('[data-testid="error-message"]');
      const errorText = await page.$eval('[data-testid="error-message"]', el => el.textContent);
      expect(errorText).toBe('Project name cannot be empty');
    });

    test('should show error for duplicate project names', async () => {
      // Create first project
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Duplicate Test');
      await page.click('[data-testid="submit-project-btn"]');
      
      await page.waitForSelector('[data-testid="project-item"]');
      
      // Try to create duplicate
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Duplicate Test');
      await page.click('[data-testid="submit-project-btn"]');
      
      // Verify error and suggestion
      await expect(page).toBeVisibleInPage('[data-testid="error-message"]');
      const errorText = await page.$eval('[data-testid="error-message"]', el => el.textContent);
      expect(errorText).toContain('Project with this name already exists');
      
      // Verify suggestion
      await expect(page).toBeVisibleInPage('[data-testid="name-suggestion"]');
      const suggestion = await page.$eval('[data-testid="name-suggestion"]', el => el.textContent);
      expect(suggestion).toBe('Suggested: Duplicate Test (2)');
    });

    test('should show error for invalid characters', async () => {
      const invalidNames = [
        'Project/Test',
        'Project\\Test',
        'Project<Test>',
        'Project|Test'
      ];
      
      for (const name of invalidNames) {
        await page.click('[data-testid="create-project-btn"]');
        await page.type('[data-testid="project-name-input"]', name);
        await page.click('[data-testid="submit-project-btn"]');
        
        await expect(page).toBeVisibleInPage('[data-testid="error-message"]');
        const errorText = await page.$eval('[data-testid="error-message"]', el => el.textContent);
        expect(errorText).toBe('Invalid characters in project name');
        
        // Close dialog for next iteration
        await page.click('[data-testid="cancel-btn"]');
      }
    });

    test('should truncate long project names', async () => {
      const longName = 'A'.repeat(150); // 150 characters
      
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', longName);
      await page.click('[data-testid="submit-project-btn"]');
      
      // Verify warning about truncation
      await expect(page).toBeVisibleInPage('[data-testid="warning-message"]');
      const warningText = await page.$eval('[data-testid="warning-message"]', el => el.textContent);
      expect(warningText).toBe('Project name truncated to 100 characters');
      
      // Verify truncated name
      const projectName = await page.$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        el => el.textContent
      );
      expect(projectName).toHaveLength(100);
      expect(projectName).toBe('A'.repeat(100));
    });
  });

  describe('Project Storage and Persistence', () => {
    test('should persist projects across page reloads', async () => {
      // Create projects
      const projectNames = ['Persistent 1', 'Persistent 2'];
      
      for (const name of projectNames) {
        await page.click('[data-testid="create-project-btn"]');
        await page.type('[data-testid="project-name-input"]', name);
        await page.click('[data-testid="submit-project-btn"]');
        await page.waitForTimeout(500);
      }
      
      // Reload page
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      
      // Verify projects still exist
      const loadedProjects = await page.$$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        elements => elements.map(el => el.textContent)
      );
      
      expect(loadedProjects).toEqual(projectNames);
    });

    test('should handle storage quota warnings', async () => {
      // Mock storage to be near limit
      await page.evaluate(() => {
        const mockStorage = {
          bytesInUse: 4800000, // 4.8MB of 5MB limit
          quota: 5242880 // 5MB
        };
        chrome.storage.local.getBytesInUse = (callback) => callback(mockStorage.bytesInUse);
      });
      
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Near Limit Project');
      await page.click('[data-testid="submit-project-btn"]');
      
      // Verify storage warning
      await expect(page).toBeVisibleInPage('[data-testid="storage-warning"]');
      const warningText = await page.$eval('[data-testid="storage-warning"]', el => el.textContent);
      expect(warningText).toContain('Storage is 96% full');
    });
  });

  describe('UI Interactions and Edge Cases', () => {
    test('should disable submit button when input is empty', async () => {
      await page.click('[data-testid="create-project-btn"]');
      
      // Check button is initially disabled
      const isDisabled = await page.$eval('[data-testid="submit-project-btn"]', el => el.disabled);
      expect(isDisabled).toBe(true);
      
      // Type something
      await page.type('[data-testid="project-name-input"]', 'Test');
      const isEnabled = await page.$eval('[data-testid="submit-project-btn"]', el => !el.disabled);
      expect(isEnabled).toBe(true);
      
      // Clear input
      await page.click('[data-testid="project-name-input"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      
      const isDisabledAgain = await page.$eval('[data-testid="submit-project-btn"]', el => el.disabled);
      expect(isDisabledAgain).toBe(true);
    });

    test('should handle rapid project creation', async () => {
      const projectNames = Array.from({ length: 10 }, (_, i) => `Rapid Project ${i + 1}`);
      
      // Create projects rapidly
      for (const name of projectNames) {
        await page.click('[data-testid="create-project-btn"]');
        await page.type('[data-testid="project-name-input"]', name);
        await page.click('[data-testid="submit-project-btn"]');
        // Don't wait between creations
      }
      
      // Wait for all to be created
      await page.waitForTimeout(2000);
      
      // Verify all projects created
      const createdProjects = await page.$$('[data-testid="project-item"]');
      expect(createdProjects).toHaveLength(10);
      
      // Verify no duplicate IDs
      const projectIds = await page.$$eval(
        '[data-testid="project-item"]',
        elements => elements.map(el => el.getAttribute('data-project-id'))
      );
      const uniqueIds = new Set(projectIds);
      expect(uniqueIds.size).toBe(10);
    });

    test('should handle keyboard navigation', async () => {
      await page.click('[data-testid="create-project-btn"]');
      
      // Tab to input
      await page.keyboard.press('Tab');
      
      // Type project name
      await page.keyboard.type('Keyboard Nav Project');
      
      // Tab to submit button
      await page.keyboard.press('Tab');
      
      // Press Enter to submit
      await page.keyboard.press('Enter');
      
      // Verify project created
      await expect(page).toBeVisibleInPage('[data-testid="project-item"]');
      const projectName = await page.$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        el => el.textContent
      );
      expect(projectName).toBe('Keyboard Nav Project');
    });

    test('should sync projects across multiple tabs', async () => {
      // Create project in first tab
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Multi-tab Project');
      await page.click('[data-testid="submit-project-btn"]');
      
      await page.waitForSelector('[data-testid="project-item"]');
      
      // Open second tab
      const page2 = await browser.newPage();
      await page2.goto(`chrome-extension://${global.EXTENSION_ID}/popup.html`);
      
      // Wait for sync
      await page2.waitForTimeout(1000);
      
      // Verify project appears in second tab
      await expect(page2).toBeVisibleInPage('[data-testid="project-item"]');
      const projectNameTab2 = await page2.$eval(
        '[data-testid="project-item"] [data-testid="project-name"]',
        el => el.textContent
      );
      expect(projectNameTab2).toBe('Multi-tab Project');
      
      await page2.close();
    });
  });
});