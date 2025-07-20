/**
 * E2E Tests for Custom Instructions Persistence
 * Tests adding, editing, and persisting custom instructions per project
 */

describe('Custom Instructions Persistence', () => {
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
    
    // Create a test project
    await page.click('[data-testid="create-project-btn"]');
    await page.type('[data-testid="project-name-input"]', 'Test Project');
    await page.click('[data-testid="submit-project-btn"]');
    await page.waitForSelector('[data-testid="project-item"]');
  });

  describe('Adding Instructions', () => {
    test('should add instructions to a project', async () => {
      // Select the project
      await page.click('[data-testid="project-item"]');
      
      // Click add instructions button
      await page.click('[data-testid="add-instructions-btn"]');
      
      // Type instructions
      const instructionText = 'You are a helpful assistant. Always be concise and clear.';
      await page.type('[data-testid="instructions-textarea"]', instructionText);
      
      // Save instructions
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify success notification
      await expect(page).toBeVisibleInPage('[data-testid="success-notification"]');
      
      // Verify instructions displayed
      await expect(page).toBeVisibleInPage('[data-testid="instructions-display"]');
      const savedInstructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(savedInstructions).toBe(instructionText);
    });

    test('should support multi-line instructions', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      const multiLineInstructions = `Line 1: Be helpful
Line 2: Be concise
Line 3: Use examples when needed`;
      
      await page.type('[data-testid="instructions-textarea"]', multiLineInstructions);
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify line breaks preserved
      const savedInstructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.innerText
      );
      expect(savedInstructions).toBe(multiLineInstructions);
    });

    test('should show character count', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      // Initially should show 0/4000
      let charCount = await page.$eval('[data-testid="char-count"]', el => el.textContent);
      expect(charCount).toBe('0/4000');
      
      // Type some text
      const text = 'This is a test instruction.';
      await page.type('[data-testid="instructions-textarea"]', text);
      
      // Verify character count updates
      charCount = await page.$eval('[data-testid="char-count"]', el => el.textContent);
      expect(charCount).toBe(`${text.length}/4000`);
    });

    test('should show warning near character limit', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      // Type text near limit (3800+ characters)
      const longText = 'A'.repeat(3850);
      await page.type('[data-testid="instructions-textarea"]', longText);
      
      // Verify warning appears
      await expect(page).toBeVisibleInPage('[data-testid="char-limit-warning"]');
      const warningText = await page.$eval(
        '[data-testid="char-limit-warning"]',
        el => el.textContent
      );
      expect(warningText).toContain('approaching character limit');
      
      // Verify warning color change
      const charCountClass = await page.$eval(
        '[data-testid="char-count"]',
        el => el.className
      );
      expect(charCountClass).toContain('warning');
    });

    test('should enforce character limit', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      // Try to exceed limit
      const overLimitText = 'A'.repeat(4100);
      await page.type('[data-testid="instructions-textarea"]', overLimitText);
      
      // Verify text is truncated
      const textAreaValue = await page.$eval(
        '[data-testid="instructions-textarea"]',
        el => el.value
      );
      expect(textAreaValue).toHaveLength(4000);
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="char-limit-error"]');
    });
  });

  describe('Editing Instructions', () => {
    beforeEach(async () => {
      // Add initial instructions
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Initial instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      await page.waitForSelector('[data-testid="instructions-display"]');
    });

    test('should edit existing instructions', async () => {
      // Click edit button
      await page.click('[data-testid="edit-instructions-btn"]');
      
      // Clear and type new instructions
      await page.click('[data-testid="instructions-textarea"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type('[data-testid="instructions-textarea"]', 'Updated instructions');
      
      // Save changes
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify updated
      const updatedInstructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(updatedInstructions).toBe('Updated instructions');
    });

    test('should cancel editing without saving', async () => {
      await page.click('[data-testid="edit-instructions-btn"]');
      
      // Make changes
      await page.click('[data-testid="instructions-textarea"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      await page.type('[data-testid="instructions-textarea"]', 'Cancelled changes');
      
      // Cancel
      await page.click('[data-testid="cancel-edit-btn"]');
      
      // Verify original instructions remain
      const instructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(instructions).toBe('Initial instructions');
    });

    test('should preserve formatting when editing', async () => {
      // Add formatted instructions
      await page.click('[data-testid="edit-instructions-btn"]');
      await page.click('[data-testid="instructions-textarea"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      
      const formattedText = `# Markdown Header
- Bullet point 1
- Bullet point 2

Code block:
\`\`\`
console.log('test');
\`\`\``;
      
      await page.type('[data-testid="instructions-textarea"]', formattedText);
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Edit again and verify formatting preserved
      await page.click('[data-testid="edit-instructions-btn"]');
      const textAreaValue = await page.$eval(
        '[data-testid="instructions-textarea"]',
        el => el.value
      );
      expect(textAreaValue).toBe(formattedText);
    });
  });

  describe('Instructions Persistence', () => {
    test('should persist instructions across page reloads', async () => {
      // Add instructions
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Persistent instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Reload page
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      
      // Select project and verify instructions
      await page.click('[data-testid="project-item"]');
      await expect(page).toBeVisibleInPage('[data-testid="instructions-display"]');
      
      const instructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(instructions).toBe('Persistent instructions');
    });

    test('should maintain separate instructions per project', async () => {
      // Add instructions to first project
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Project 1 instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Create second project
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Project 2');
      await page.click('[data-testid="submit-project-btn"]');
      await page.waitForTimeout(500);
      
      // Add different instructions to second project
      await page.click('[data-testid="project-item"]:nth-child(2)');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Project 2 instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Switch back to first project
      await page.click('[data-testid="project-item"]:nth-child(1)');
      let instructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(instructions).toBe('Project 1 instructions');
      
      // Switch to second project
      await page.click('[data-testid="project-item"]:nth-child(2)');
      instructions = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(instructions).toBe('Project 2 instructions');
    });

    test('should handle storage errors gracefully', async () => {
      // Mock storage error
      await page.evaluateOnNewDocument(() => {
        chrome.storage.local.set = (data, callback) => {
          callback({ message: 'Storage quota exceeded' });
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      
      // Try to add instructions
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Test instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="error-notification"]');
      const errorText = await page.$eval(
        '[data-testid="error-notification"]',
        el => el.textContent
      );
      expect(errorText).toContain('Failed to save instructions');
    });
  });

  describe('Special Content Handling', () => {
    test('should handle URLs in instructions', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      const urlText = 'Visit https://example.com for more info';
      await page.type('[data-testid="instructions-textarea"]', urlText);
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify URL is clickable
      await expect(page).toBeVisibleInPage('[data-testid="instructions-display"] a');
      const linkHref = await page.$eval(
        '[data-testid="instructions-display"] a',
        el => el.href
      );
      expect(linkHref).toBe('https://example.com/');
    });

    test('should handle code snippets in instructions', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      const codeText = 'Use this function: `calculateSum(a, b)`';
      await page.type('[data-testid="instructions-textarea"]', codeText);
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify code formatting
      await expect(page).toBeVisibleInPage('[data-testid="instructions-display"] code');
      const codeContent = await page.$eval(
        '[data-testid="instructions-display"] code',
        el => el.textContent
      );
      expect(codeContent).toBe('calculateSum(a, b)');
    });

    test('should sanitize potentially harmful content', async () => {
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      
      const maliciousText = '<script>alert("XSS")</script>Normal text';
      await page.type('[data-testid="instructions-textarea"]', maliciousText);
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify script is not executed
      const displayedText = await page.$eval(
        '[data-testid="instructions-display"]',
        el => el.textContent
      );
      expect(displayedText).toBe('Normal text');
      
      // Verify no script tags in DOM
      const scriptTags = await page.$$('[data-testid="instructions-display"] script');
      expect(scriptTags).toHaveLength(0);
    });
  });

  describe('UI State Management', () => {
    test('should disable save button when no changes made', async () => {
      // Add instructions
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Original text');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Edit again
      await page.click('[data-testid="edit-instructions-btn"]');
      
      // Save button should be disabled initially
      const isDisabled = await page.$eval(
        '[data-testid="save-instructions-btn"]',
        el => el.disabled
      );
      expect(isDisabled).toBe(true);
      
      // Make a change
      await page.type('[data-testid="instructions-textarea"]', ' Modified');
      
      // Save button should be enabled
      const isEnabled = await page.$eval(
        '[data-testid="save-instructions-btn"]',
        el => !el.disabled
      );
      expect(isEnabled).toBe(true);
    });

    test('should show loading state while saving', async () => {
      // Mock slow save
      await page.evaluateOnNewDocument(() => {
        const originalSet = chrome.storage.local.set;
        chrome.storage.local.set = (data, callback) => {
          setTimeout(() => originalSet.call(chrome.storage.local, data, callback), 2000);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Test');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify loading state
      await expect(page).toBeVisibleInPage('[data-testid="saving-spinner"]');
      const buttonText = await page.$eval(
        '[data-testid="save-instructions-btn"]',
        el => el.textContent
      );
      expect(buttonText).toBe('Saving...');
      
      // Button should be disabled during save
      const isDisabled = await page.$eval(
        '[data-testid="save-instructions-btn"]',
        el => el.disabled
      );
      expect(isDisabled).toBe(true);
    });
  });
});