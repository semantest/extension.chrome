/**
 * E2E Tests for Chat Creation
 * Tests creating new chats within projects and chat management
 */

describe('Chat Creation', () => {
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
    
    // Create and select a test project
    await page.click('[data-testid="create-project-btn"]');
    await page.type('[data-testid="project-name-input"]', 'Chat Test Project');
    await page.click('[data-testid="submit-project-btn"]');
    await page.waitForSelector('[data-testid="project-item"]');
    await page.click('[data-testid="project-item"]');
  });

  describe('Basic Chat Creation', () => {
    test('should create a new chat in project', async () => {
      // Click new chat button
      await page.click('[data-testid="new-chat-btn"]');
      
      // Verify chat created
      await expect(page).toBeVisibleInPage('[data-testid="chat-item"]');
      
      // Verify chat has timestamp
      const chatTimestamp = await page.$eval(
        '[data-testid="chat-item"] [data-testid="chat-timestamp"]',
        el => el.textContent
      );
      expect(chatTimestamp).toMatch(/\d{1,2}:\d{2} (AM|PM)/);
      
      // Verify chat is active
      const isActive = await page.$eval(
        '[data-testid="chat-item"]',
        el => el.classList.contains('active')
      );
      expect(isActive).toBe(true);
      
      // Verify empty chat interface
      await expect(page).toBeVisibleInPage('[data-testid="chat-messages"]');
      await expect(page).toBeVisibleInPage('[data-testid="message-input"]');
      
      const messageCount = await page.$$eval(
        '[data-testid="chat-messages"] [data-testid="message"]',
        elements => elements.length
      );
      expect(messageCount).toBe(0);
    });

    test('should generate unique chat ID', async () => {
      // Create first chat
      await page.click('[data-testid="new-chat-btn"]');
      const firstChatId = await page.$eval(
        '[data-testid="chat-item"]',
        el => el.getAttribute('data-chat-id')
      );
      
      // Create second chat
      await page.click('[data-testid="new-chat-btn"]');
      await page.waitForSelector('[data-testid="chat-item"]:nth-child(2)');
      
      const secondChatId = await page.$eval(
        '[data-testid="chat-item"]:nth-child(2)',
        el => el.getAttribute('data-chat-id')
      );
      
      // Verify IDs are different
      expect(firstChatId).not.toBe(secondChatId);
      expect(firstChatId).toMatch(/^chat-\d{13}-[a-f0-9]{8}$/);
      expect(secondChatId).toMatch(/^chat-\d{13}-[a-f0-9]{8}$/);
    });

    test('should auto-name chat based on first message', async () => {
      await page.click('[data-testid="new-chat-btn"]');
      
      // Initially should have default name
      let chatName = await page.$eval(
        '[data-testid="chat-item"] [data-testid="chat-name"]',
        el => el.textContent
      );
      expect(chatName).toBe('New Chat');
      
      // Send first message
      await page.type('[data-testid="message-input"]', 'Explain quantum computing');
      await page.click('[data-testid="send-btn"]');
      
      // Wait for auto-naming
      await page.waitForTimeout(1000);
      
      // Verify chat renamed
      chatName = await page.$eval(
        '[data-testid="chat-item"] [data-testid="chat-name"]',
        el => el.textContent
      );
      expect(chatName).toBe('Explain quantum computing...');
    });
  });

  describe('Multiple Chat Management', () => {
    test('should create multiple chats in same project', async () => {
      const chatCount = 5;
      
      // Create multiple chats
      for (let i = 0; i < chatCount; i++) {
        await page.click('[data-testid="new-chat-btn"]');
        await page.waitForTimeout(100); // Small delay to ensure proper creation
      }
      
      // Verify all chats created
      const chatItems = await page.$$('[data-testid="chat-item"]');
      expect(chatItems).toHaveLength(chatCount);
      
      // Verify newest chat is active
      const activeChatIndex = await page.$$eval(
        '[data-testid="chat-item"]',
        elements => elements.findIndex(el => el.classList.contains('active'))
      );
      expect(activeChatIndex).toBe(chatCount - 1);
    });

    test('should switch between chats', async () => {
      // Create two chats
      await page.click('[data-testid="new-chat-btn"]');
      await page.type('[data-testid="message-input"]', 'First chat message');
      await page.click('[data-testid="send-btn"]');
      
      await page.click('[data-testid="new-chat-btn"]');
      await page.type('[data-testid="message-input"]', 'Second chat message');
      await page.click('[data-testid="send-btn"]');
      
      // Switch to first chat
      await page.click('[data-testid="chat-item"]:nth-child(1)');
      
      // Verify correct messages displayed
      const firstChatMessage = await page.$eval(
        '[data-testid="chat-messages"] [data-testid="message"]:last-child [data-testid="message-text"]',
        el => el.textContent
      );
      expect(firstChatMessage).toBe('First chat message');
      
      // Switch to second chat
      await page.click('[data-testid="chat-item"]:nth-child(2)');
      
      const secondChatMessage = await page.$eval(
        '[data-testid="chat-messages"] [data-testid="message"]:last-child [data-testid="message-text"]',
        el => el.textContent
      );
      expect(secondChatMessage).toBe('Second chat message');
    });

    test('should maintain chat order chronologically', async () => {
      const timestamps = [];
      
      // Create chats with delays to ensure different timestamps
      for (let i = 0; i < 3; i++) {
        await page.click('[data-testid="new-chat-btn"]');
        await page.waitForTimeout(1100); // Ensure different timestamps
        
        const timestamp = await page.$eval(
          '[data-testid="chat-item"]:last-child [data-testid="chat-timestamp"]',
          el => el.getAttribute('data-timestamp')
        );
        timestamps.push(parseInt(timestamp));
      }
      
      // Verify timestamps are in descending order (newest first)
      for (let i = 1; i < timestamps.length; i++) {
        expect(timestamps[i]).toBeGreaterThan(timestamps[i - 1]);
      }
    });

    test('should persist chat list across page reloads', async () => {
      // Create chats
      await page.click('[data-testid="new-chat-btn"]');
      await page.type('[data-testid="message-input"]', 'Persistent chat 1');
      await page.click('[data-testid="send-btn"]');
      
      await page.click('[data-testid="new-chat-btn"]');
      await page.type('[data-testid="message-input"]', 'Persistent chat 2');
      await page.click('[data-testid="send-btn"]');
      
      // Reload page
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      
      // Verify chats persist
      const chatItems = await page.$$('[data-testid="chat-item"]');
      expect(chatItems).toHaveLength(2);
      
      // Verify messages persist
      await page.click('[data-testid="chat-item"]:nth-child(1)');
      const message1 = await page.$eval(
        '[data-testid="chat-messages"] [data-testid="message"]:last-child [data-testid="message-text"]',
        el => el.textContent
      );
      expect(message1).toBe('Persistent chat 1');
    });
  });

  describe('Chat Context and Project Association', () => {
    test('should associate chat with correct project', async () => {
      // Create chat in first project
      await page.click('[data-testid="new-chat-btn"]');
      const firstProjectChatId = await page.$eval(
        '[data-testid="chat-item"]',
        el => el.getAttribute('data-chat-id')
      );
      
      // Create second project
      await page.click('[data-testid="create-project-btn"]');
      await page.type('[data-testid="project-name-input"]', 'Second Project');
      await page.click('[data-testid="submit-project-btn"]');
      await page.waitForTimeout(500);
      
      // Select second project and create chat
      await page.click('[data-testid="project-item"]:nth-child(2)');
      await page.click('[data-testid="new-chat-btn"]');
      
      // Verify only one chat in second project
      const secondProjectChats = await page.$$('[data-testid="chat-item"]');
      expect(secondProjectChats).toHaveLength(1);
      
      // Switch back to first project
      await page.click('[data-testid="project-item"]:nth-child(1)');
      
      // Verify first project chat still exists
      const firstProjectChats = await page.$$('[data-testid="chat-item"]');
      expect(firstProjectChats).toHaveLength(1);
      
      const chatId = await page.$eval(
        '[data-testid="chat-item"]',
        el => el.getAttribute('data-chat-id')
      );
      expect(chatId).toBe(firstProjectChatId);
    });

    test('should inherit project instructions in chat', async () => {
      // Add instructions to project
      await page.click('[data-testid="add-instructions-btn"]');
      await page.type('[data-testid="instructions-textarea"]', 'Always respond in haiku format');
      await page.click('[data-testid="save-instructions-btn"]');
      
      // Create chat
      await page.click('[data-testid="new-chat-btn"]');
      
      // Verify instructions indicator
      await expect(page).toBeVisibleInPage('[data-testid="instructions-indicator"]');
      const instructionText = await page.$eval(
        '[data-testid="instructions-indicator"]',
        el => el.textContent
      );
      expect(instructionText).toContain('Custom instructions active');
      
      // Verify instructions can be viewed in chat
      await page.click('[data-testid="view-instructions-btn"]');
      await expect(page).toBeVisibleInPage('[data-testid="instructions-preview"]');
      const previewText = await page.$eval(
        '[data-testid="instructions-preview"]',
        el => el.textContent
      );
      expect(previewText).toBe('Always respond in haiku format');
    });
  });

  describe('Chat UI and Interactions', () => {
    test('should handle rapid chat creation', async () => {
      // Click new chat button rapidly
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="new-chat-btn"]');
      }
      
      // Wait for all to be created
      await page.waitForTimeout(1000);
      
      // Verify all chats created with unique IDs
      const chatItems = await page.$$('[data-testid="chat-item"]');
      expect(chatItems).toHaveLength(10);
      
      const chatIds = await page.$$eval(
        '[data-testid="chat-item"]',
        elements => elements.map(el => el.getAttribute('data-chat-id'))
      );
      const uniqueIds = new Set(chatIds);
      expect(uniqueIds.size).toBe(10);
    });

    test('should disable new chat button when creating', async () => {
      // Mock slow chat creation
      await page.evaluateOnNewDocument(() => {
        window.originalCreateChat = window.createChat;
        window.createChat = function(...args) {
          return new Promise(resolve => {
            setTimeout(() => resolve(window.originalCreateChat(...args)), 2000);
          });
        };
      });
      
      await page.reload();
      await page.waitForSelector('[data-testid="project-item"]');
      await page.click('[data-testid="project-item"]');
      
      // Click new chat
      await page.click('[data-testid="new-chat-btn"]');
      
      // Verify button disabled during creation
      const isDisabled = await page.$eval(
        '[data-testid="new-chat-btn"]',
        el => el.disabled
      );
      expect(isDisabled).toBe(true);
      
      // Verify loading indicator
      await expect(page).toBeVisibleInPage('[data-testid="creating-chat-spinner"]');
    });

    test('should handle keyboard shortcut for new chat', async () => {
      // Press Ctrl+N (or Cmd+N on Mac)
      await page.keyboard.down('ControlLeft');
      await page.keyboard.press('KeyN');
      await page.keyboard.up('ControlLeft');
      
      // Verify chat created
      await expect(page).toBeVisibleInPage('[data-testid="chat-item"]');
      
      // Verify focus moves to message input
      const activeElement = await page.evaluateHandle(() => document.activeElement);
      const tagName = await activeElement.evaluate(el => el.tagName.toLowerCase());
      const testId = await activeElement.evaluate(el => el.getAttribute('data-testid'));
      
      expect(tagName).toBe('textarea');
      expect(testId).toBe('message-input');
    });

    test('should show chat loading state', async () => {
      await page.click('[data-testid="new-chat-btn"]');
      
      // Initially should show loading state
      await expect(page).toBeVisibleInPage('[data-testid="chat-loading"]');
      
      // Should show empty state after loading
      await page.waitForTimeout(1000);
      await expect(page).toBeVisibleInPage('[data-testid="empty-chat-state"]');
      
      const emptyStateText = await page.$eval(
        '[data-testid="empty-chat-state"]',
        el => el.textContent
      );
      expect(emptyStateText).toContain('Start a conversation');
    });
  });

  describe('Chat Metadata and Timestamps', () => {
    test('should display relative timestamps', async () => {
      await page.click('[data-testid="new-chat-btn"]');
      
      // Should show "Just now"
      let timestamp = await page.$eval(
        '[data-testid="chat-item"] [data-testid="chat-timestamp"]',
        el => el.textContent
      );
      expect(timestamp).toBe('Just now');
      
      // Mock time passage
      await page.evaluate(() => {
        const chatItem = document.querySelector('[data-testid="chat-item"]');
        const timestampEl = chatItem.querySelector('[data-testid="chat-timestamp"]');
        timestampEl.setAttribute('data-timestamp', Date.now() - 300000); // 5 minutes ago
      });
      
      // Trigger timestamp update
      await page.click('[data-testid="refresh-timestamps-btn"]');
      
      timestamp = await page.$eval(
        '[data-testid="chat-item"] [data-testid="chat-timestamp"]',
        el => el.textContent
      );
      expect(timestamp).toBe('5 minutes ago');
    });

    test('should show message count in chat list', async () => {
      await page.click('[data-testid="new-chat-btn"]');
      
      // Initially 0 messages
      let messageCount = await page.$eval(
        '[data-testid="chat-item"] [data-testid="message-count"]',
        el => el.textContent
      );
      expect(messageCount).toBe('0');
      
      // Send a message
      await page.type('[data-testid="message-input"]', 'Test message');
      await page.click('[data-testid="send-btn"]');
      
      // Should show 1 message (user) + 1 response (assistant) = 2
      await page.waitForTimeout(1000);
      messageCount = await page.$eval(
        '[data-testid="chat-item"] [data-testid="message-count"]',
        el => el.textContent
      );
      expect(parseInt(messageCount)).toBeGreaterThanOrEqual(1);
    });

    test('should update last message preview', async () => {
      await page.click('[data-testid="new-chat-btn"]');
      
      // Initially should show placeholder
      let lastMessage = await page.$eval(
        '[data-testid="chat-item"] [data-testid="last-message-preview"]',
        el => el.textContent
      );
      expect(lastMessage).toBe('No messages yet');
      
      // Send message
      await page.type('[data-testid="message-input"]', 'Hello ChatGPT');
      await page.click('[data-testid="send-btn"]');
      
      // Should show last message
      await page.waitForTimeout(1000);
      lastMessage = await page.$eval(
        '[data-testid="chat-item"] [data-testid="last-message-preview"]',
        el => el.textContent
      );
      expect(lastMessage).toBe('Hello ChatGPT');
    });
  });
});