/**
 * E2E Tests for Prompt Sending
 * Tests sending text prompts to ChatGPT and handling responses
 */

describe('Prompt Sending', () => {
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
    
    // Create project, add instructions, and start chat
    await page.click('[data-testid="create-project-btn"]');
    await page.type('[data-testid="project-name-input"]', 'Prompt Test Project');
    await page.click('[data-testid="submit-project-btn"]');
    await page.waitForSelector('[data-testid="project-item"]');
    await page.click('[data-testid="project-item"]');
    await page.click('[data-testid="new-chat-btn"]');
    await page.waitForSelector('[data-testid="message-input"]');
  });

  describe('Basic Prompt Sending', () => {
    test('should send text prompt and receive response', async () => {
      const prompt = 'Hello, what is 2 + 2?';
      
      // Type prompt
      await page.type('[data-testid="message-input"]', prompt);
      
      // Send prompt
      await page.click('[data-testid="send-btn"]');
      
      // Verify user message appears
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toBe(prompt);
      
      // Verify loading state
      await expect(page).toBeVisibleInPage('[data-testid="thinking-indicator"]');
      
      // Wait for response
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]', { timeout: 10000 });
      
      // Verify assistant response
      const assistantMessage = await page.$eval(
        '[data-testid="message"][data-role="assistant"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(assistantMessage).toContain('4');
      
      // Verify input cleared
      const inputValue = await page.$eval('[data-testid="message-input"]', el => el.value);
      expect(inputValue).toBe('');
    });

    test('should send prompt with Enter key', async () => {
      await page.type('[data-testid="message-input"]', 'Test with Enter key');
      await page.keyboard.press('Enter');
      
      // Verify message sent
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toBe('Test with Enter key');
    });

    test('should send prompt with Shift+Enter for new line', async () => {
      await page.type('[data-testid="message-input"]', 'First line');
      await page.keyboard.down('Shift');
      await page.keyboard.press('Enter');
      await page.keyboard.up('Shift');
      await page.type('[data-testid="message-input"]', 'Second line');
      
      // Verify textarea contains new line
      const textareaValue = await page.$eval('[data-testid="message-input"]', el => el.value);
      expect(textareaValue).toBe('First line\nSecond line');
      
      // Send message
      await page.keyboard.press('Enter');
      
      // Verify multi-line message sent
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.innerHTML
      );
      expect(userMessage).toContain('First line<br>Second line');
    });

    test('should handle long prompts', async () => {
      const longPrompt = 'A'.repeat(4000);
      
      await page.type('[data-testid="message-input"]', longPrompt);
      await page.click('[data-testid="send-btn"]');
      
      // Verify full message sent
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toHaveLength(4000);
    });
  });

  describe('Prompt Validation', () => {
    test('should disable send button for empty input', async () => {
      // Button should be disabled initially
      const isDisabled = await page.$eval('[data-testid="send-btn"]', el => el.disabled);
      expect(isDisabled).toBe(true);
      
      // Type something
      await page.type('[data-testid="message-input"]', 'Test');
      const isEnabled = await page.$eval('[data-testid="send-btn"]', el => !el.disabled);
      expect(isEnabled).toBe(true);
      
      // Clear input
      await page.click('[data-testid="message-input"]', { clickCount: 3 });
      await page.keyboard.press('Backspace');
      
      // Button should be disabled again
      const isDisabledAgain = await page.$eval('[data-testid="send-btn"]', el => el.disabled);
      expect(isDisabledAgain).toBe(true);
    });

    test('should handle whitespace-only prompts', async () => {
      await page.type('[data-testid="message-input"]', '   ');
      
      // Send button should remain disabled
      const isDisabled = await page.$eval('[data-testid="send-btn"]', el => el.disabled);
      expect(isDisabled).toBe(true);
    });

    test('should trim whitespace from prompts', async () => {
      await page.type('[data-testid="message-input"]', '  Hello world  ');
      await page.click('[data-testid="send-btn"]');
      
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toBe('Hello world');
    });

    test('should show character count for long prompts', async () => {
      const mediumPrompt = 'A'.repeat(500);
      await page.type('[data-testid="message-input"]', mediumPrompt);
      
      // Verify character count appears
      await expect(page).toBeVisibleInPage('[data-testid="char-count"]');
      const charCount = await page.$eval('[data-testid="char-count"]', el => el.textContent);
      expect(charCount).toBe('500');
      
      // Add more text to trigger warning
      const longPrompt = 'B'.repeat(3500);
      await page.type('[data-testid="message-input"]', longPrompt);
      
      // Verify warning appears
      await expect(page).toBeVisibleInPage('[data-testid="char-count-warning"]');
      const warningText = await page.$eval('[data-testid="char-count-warning"]', el => el.textContent);
      expect(warningText).toContain('approaching limit');
    });
  });

  describe('Response Handling', () => {
    test('should display streaming response', async () => {
      await page.type('[data-testid="message-input"]', 'Tell me a short story');
      await page.click('[data-testid="send-btn"]');
      
      // Wait for assistant message container
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      // Verify streaming indicator
      await expect(page).toBeVisibleInPage('[data-testid="streaming-indicator"]');
      
      // Wait for response to complete
      await page.waitForSelector('[data-testid="message-complete"]', { timeout: 15000 });
      
      // Verify final response
      const response = await page.$eval(
        '[data-testid="message"][data-role="assistant"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(response.length).toBeGreaterThan(50);
    });

    test('should handle API errors gracefully', async () => {
      // Mock API error
      await page.evaluateOnNewDocument(() => {
        window.fetch = () => Promise.reject(new Error('Network error'));
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'This will fail');
      await page.click('[data-testid="send-btn"]');
      
      // Verify error message
      await expect(page).toBeVisibleInPage('[data-testid="error-message"]');
      const errorText = await page.$eval('[data-testid="error-message"]', el => el.textContent);
      expect(errorText).toContain('Failed to send message');
      
      // Verify retry button
      await expect(page).toBeVisibleInPage('[data-testid="retry-btn"]');
    });

    test('should allow retry on failed requests', async () => {
      let requestCount = 0;
      
      // Mock API to fail first time, succeed second time
      await page.evaluateOnNewDocument(() => {
        const originalFetch = window.fetch;
        window.fetch = (...args) => {
          window.requestCount = (window.requestCount || 0) + 1;
          if (window.requestCount === 1) {
            return Promise.reject(new Error('First request fails'));
          }
          return originalFetch(...args);
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Retry test');
      await page.click('[data-testid="send-btn"]');
      
      // Wait for error and retry
      await page.waitForSelector('[data-testid="retry-btn"]');
      await page.click('[data-testid="retry-btn"]');
      
      // Verify successful response
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]', { timeout: 10000 });
      const response = await page.$eval(
        '[data-testid="message"][data-role="assistant"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(response.length).toBeGreaterThan(0);
    });

    test('should handle rate limiting', async () => {
      // Mock rate limit response
      await page.evaluateOnNewDocument(() => {
        window.fetch = () => Promise.resolve({
          status: 429,
          json: () => Promise.resolve({
            error: { message: 'Rate limit exceeded' }
          })
        });
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="new-chat-btn"]');
      
      await page.type('[data-testid="message-input"]', 'Rate limit test');
      await page.click('[data-testid="send-btn"]');
      
      // Verify rate limit message
      await expect(page).toBeVisibleInPage('[data-testid="rate-limit-message"]');
      const rateLimitText = await page.$eval('[data-testid="rate-limit-message"]', el => el.textContent);
      expect(rateLimitText).toContain('Rate limit exceeded');
      
      // Verify retry after countdown
      await expect(page).toBeVisibleInPage('[data-testid="retry-countdown"]');
    });
  });

  describe('Message History and Context', () => {
    test('should maintain conversation context', async () => {
      // Send first message
      await page.type('[data-testid="message-input"]', 'My name is John');
      await page.click('[data-testid="send-btn"]');
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      // Send follow-up message
      await page.type('[data-testid="message-input"]', 'What is my name?');
      await page.click('[data-testid="send-btn"]');
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]:nth-child(4)');
      
      // Verify context maintained
      const response = await page.$eval(
        '[data-testid="message"][data-role="assistant"]:nth-child(4) [data-testid="message-text"]',
        el => el.textContent
      );
      expect(response.toLowerCase()).toContain('john');
    });

    test('should display message timestamps', async () => {
      await page.type('[data-testid="message-input"]', 'Test message');
      await page.click('[data-testid="send-btn"]');
      
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      
      // Verify timestamp
      const timestamp = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-timestamp"]',
        el => el.textContent
      );
      expect(timestamp).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
    });

    test('should persist message history across sessions', async () => {
      // Send message
      await page.type('[data-testid="message-input"]', 'Persistent message');
      await page.click('[data-testid="send-btn"]');
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      // Reload extension
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      await page.click('[data-testid="chat-item"]');
      
      // Verify message history persists
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toBe('Persistent message');
      
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="assistant"]');
    });

    test('should show typing indicator during response', async () => {
      await page.type('[data-testid="message-input"]', 'Show typing indicator');
      await page.click('[data-testid="send-btn"]');
      
      // Verify typing indicator appears
      await expect(page).toBeVisibleInPage('[data-testid="typing-indicator"]');
      
      // Verify indicator contains animation
      const hasAnimation = await page.$eval(
        '[data-testid="typing-indicator"]',
        el => el.querySelector('.typing-dots') !== null
      );
      expect(hasAnimation).toBe(true);
      
      // Wait for response and verify indicator disappears
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      const typingIndicatorExists = await page.$('[data-testid="typing-indicator"]');
      expect(typingIndicatorExists).toBeNull();
    });
  });

  describe('Custom Instructions Integration', () => {
    test('should apply custom instructions to prompts', async () => {
      // Add custom instructions
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Always respond with "As requested:"');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Start new chat
      await page.click('[data-testid="new-chat-btn"]');
      
      // Send message
      await page.type('[data-testid="message-input"]', 'Tell me about cats');
      await page.click('[data-testid="send-btn"]');
      
      // Wait for response
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      const response = await page.$eval(
        '[data-testid="message"][data-role="assistant"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(response).toContain('As requested:');
    });

    test('should show instructions indicator in chat', async () => {
      // Add instructions
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Custom instructions');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Verify indicator in chat
      await expect(page).toBeVisibleInPage('[data-testid="instructions-active-indicator"]');
      const indicatorText = await page.$eval(
        '[data-testid="instructions-active-indicator"]',
        el => el.textContent
      );
      expect(indicatorText).toBe('Custom instructions active');
    });
  });

  describe('Performance and Edge Cases', () => {
    test('should handle rapid message sending', async () => {
      const messages = ['Message 1', 'Message 2', 'Message 3'];
      
      // Send messages rapidly
      for (const message of messages) {
        await page.type('[data-testid="message-input"]', message);
        await page.click('[data-testid="send-btn"]');
        await page.waitForTimeout(100); // Small delay
      }
      
      // Verify all messages sent
      await page.waitForTimeout(2000);
      const userMessages = await page.$$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        elements => elements.map(el => el.textContent)
      );
      
      expect(userMessages).toEqual(messages);
    });

    test('should handle special characters in prompts', async () => {
      const specialPrompt = 'Test with émojis 🚀 and symbols: @#$%^&*()';
      
      await page.type('[data-testid="message-input"]', specialPrompt);
      await page.click('[data-testid="send-btn"]');
      
      await expect(page).toBeVisibleInPage('[data-testid="message"][data-role="user"]');
      const userMessage = await page.$eval(
        '[data-testid="message"][data-role="user"] [data-testid="message-text"]',
        el => el.textContent
      );
      expect(userMessage).toBe(specialPrompt);
    });

    test('should disable send button during request', async () => {
      await page.type('[data-testid="message-input"]', 'Test disable');
      await page.click('[data-testid="send-btn"]');
      
      // Button should be disabled immediately
      const isDisabled = await page.$eval('[data-testid="send-btn"]', el => el.disabled);
      expect(isDisabled).toBe(true);
      
      // Input should also be disabled
      const inputDisabled = await page.$eval('[data-testid="message-input"]', el => el.disabled);
      expect(inputDisabled).toBe(true);
      
      // Wait for response to complete
      await page.waitForSelector('[data-testid="message"][data-role="assistant"]');
      
      // Elements should be re-enabled
      const isEnabled = await page.$eval('[data-testid="send-btn"]', el => !el.disabled);
      const inputEnabled = await page.$eval('[data-testid="message-input"]', el => !el.disabled);
      expect(isEnabled).toBe(true);
      expect(inputEnabled).toBe(true);
    });
  });
});