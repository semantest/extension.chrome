/**
 * Integration Tests for ChatGPT DOM Manipulation
 * Tests the content script's ability to interact with ChatGPT interface
 */

const puppeteer = require('puppeteer');
const path = require('path');

const EXTENSION_PATH = path.join(__dirname, '../../dist');
const EXTENSION_ID = 'your-extension-id'; // Update with actual extension ID
const CHATGPT_URL = 'https://chatgpt.com';

describe('ChatGPT DOM Integration Tests', () => {
  let browser;
  let page;
  let extensionPage;

  beforeAll(async () => {
    // Launch browser with extension
    browser = await puppeteer.launch({
      headless: false, // Set to true for CI
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
        '--no-sandbox',
        '--disable-setuid-sandbox'
      ],
      // Use user data directory to persist ChatGPT login
      userDataDir: './test-profile'
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    // Create new page for each test
    page = await browser.newPage();
    
    // Set viewport
    await page.setViewport({ width: 1280, height: 800 });
    
    // Navigate to ChatGPT
    await page.goto(CHATGPT_URL, { waitUntil: 'networkidle2' });
    
    // Wait for content script to initialize
    await page.waitForFunction(() => window.chatGPTController?.isInitialized, {
      timeout: 15000
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Content Script Initialization', () => {
    test('should load and initialize ChatGPT controller', async () => {
      const controllerStatus = await page.evaluate(() => {
        return window.chatGPTController?.getStatus();
      });

      expect(controllerStatus).toBeTruthy();
      expect(controllerStatus.success).toBe(true);
      expect(controllerStatus.initialized).toBe(true);
      expect(controllerStatus.chatInputPresent).toBe(true);
    });

    test('should inject controller into ChatGPT page', async () => {
      const hasController = await page.evaluate(() => {
        return typeof window.chatGPTController !== 'undefined';
      });

      expect(hasController).toBe(true);
    });

    test('should detect ChatGPT UI elements', async () => {
      const elements = await page.evaluate(() => {
        const controller = window.chatGPTController;
        return {
          chatInput: !!document.querySelector(controller.selectors.chatInput),
          sidebar: !!document.querySelector(controller.selectors.sidebar),
          newChatButton: !!document.querySelector(controller.selectors.newChatButton)
        };
      });

      expect(elements.chatInput).toBe(true);
      expect(elements.sidebar).toBe(true);
      expect(elements.newChatButton).toBe(true);
    });
  });

  describe('Project Management', () => {
    test('should create a new project', async () => {
      const projectName = `Test Project ${Date.now()}`;
      
      // Send create project command through extension
      const result = await page.evaluate(async (name) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CREATE_PROJECT',
            data: { name }
          }, resolve);
        });
      }, projectName);

      expect(result.success).toBe(true);
      expect(result.projectName).toBe(projectName);

      // Verify project appears in sidebar
      await page.waitForTimeout(1000);
      const projectExists = await page.evaluate((name) => {
        const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
        return Array.from(projects).some(p => p.textContent.includes(name));
      }, projectName);

      expect(projectExists).toBe(true);
    });

    test('should handle project creation errors', async () => {
      // Try to create project with empty name
      const result = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CREATE_PROJECT',
            data: { name: '' }
          }, resolve);
        });
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('should detect new project button', async () => {
      const hasButton = await page.evaluate(() => {
        const controller = window.chatGPTController;
        return controller.findElement(controller.selectors.newProjectButton)
          .then(btn => !!btn);
      });

      expect(hasButton).toBe(true);
    });
  });

  describe('Custom Instructions', () => {
    test('should set custom instructions', async () => {
      const aboutUser = 'I am a developer working on Chrome extensions';
      const aboutModel = 'Provide technical answers with code examples';

      const result = await page.evaluate(async (user, model) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'SET_CUSTOM_INSTRUCTIONS',
            data: { aboutUser: user, aboutModel: model }
          }, resolve);
        });
      }, aboutUser, aboutModel);

      expect(result.success).toBe(true);
    });

    test('should open custom instructions dialog', async () => {
      // Click profile button
      const profileClicked = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const profileBtn = await controller.findElement(controller.selectors.profileButton);
        if (profileBtn) {
          controller.clickElement(profileBtn);
          return true;
        }
        return false;
      });

      expect(profileClicked).toBe(true);

      // Wait for menu to appear
      await page.waitForTimeout(500);

      // Check if custom instructions option is visible
      const hasCustomInstructions = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const element = await controller.findElement(controller.selectors.customInstructionsButton);
        return !!element;
      });

      expect(hasCustomInstructions).toBe(true);
    });
  });

  describe('Chat Creation', () => {
    test('should create a new chat', async () => {
      const result = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CREATE_NEW_CHAT'
          }, resolve);
        });
      });

      expect(result.success).toBe(true);

      // Verify chat input is ready
      await page.waitForTimeout(1000);
      const inputReady = await page.evaluate(() => {
        const input = document.querySelector(window.chatGPTController.selectors.chatInput);
        return input && !input.disabled;
      });

      expect(inputReady).toBe(true);
    });

    test('should clear previous conversation when creating new chat', async () => {
      // Send a test message first
      await page.evaluate(async () => {
        const controller = window.chatGPTController;
        await controller.sendPrompt('Test message');
      });

      await page.waitForTimeout(2000);

      // Create new chat
      const result = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CREATE_NEW_CHAT'
          }, resolve);
        });
      });

      expect(result.success).toBe(true);

      // Verify no messages are present
      await page.waitForTimeout(1000);
      const messageCount = await page.evaluate(() => {
        const messages = document.querySelectorAll(window.chatGPTController.selectors.message);
        return messages.length;
      });

      expect(messageCount).toBe(0);
    });
  });

  describe('Prompt Sending', () => {
    test('should send a prompt successfully', async () => {
      const testPrompt = 'What is 2 + 2?';

      const result = await page.evaluate(async (prompt) => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'SEND_PROMPT',
            data: { text: prompt }
          }, resolve);
        });
      }, testPrompt);

      expect(result.success).toBe(true);
      expect(result.prompt).toBe(testPrompt);

      // Wait for response to start
      await page.waitForSelector('[data-message-author-role="assistant"]', {
        timeout: 10000
      });

      // Verify user message appears
      const userMessage = await page.$eval('[data-message-author-role="user"]', el => el.textContent);
      expect(userMessage).toContain(testPrompt);
    });

    test('should handle prompt input and send button interaction', async () => {
      const testPrompt = 'Hello, ChatGPT!';

      // Type in the input field
      const typed = await page.evaluate(async (prompt) => {
        const controller = window.chatGPTController;
        const input = await controller.waitForSelector(controller.selectors.chatInput);
        if (input) {
          await controller.setInputValue(input, prompt);
          return input.value === prompt;
        }
        return false;
      }, testPrompt);

      expect(typed).toBe(true);

      // Check if send button is enabled
      const sendButtonEnabled = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.waitForEnabledButton(controller.selectors.sendButton);
        return !!button;
      });

      expect(sendButtonEnabled).toBe(true);
    });

    test('should wait for streaming response', async () => {
      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        await controller.sendPrompt('Tell me a short joke');
        
        // Check if streaming indicator appears
        const streamingStarted = await controller.waitForSelector(
          controller.selectors.streamingIndicator, 
          5000
        );
        
        return !!streamingStarted;
      });

      expect(result).toBe(true);
    });

    test('should handle empty prompt', async () => {
      const result = await page.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'SEND_PROMPT',
            data: { text: '' }
          }, resolve);
        });
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('DOM Manipulation Helpers', () => {
    test('should find elements with :has-text pseudo-selector', async () => {
      const found = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const element = await controller.findElement('button:has-text("New chat")');
        return !!element;
      });

      expect(found).toBe(true);
    });

    test('should wait for selector with timeout', async () => {
      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const startTime = Date.now();
        const element = await controller.waitForSelector('.non-existent-element', 1000);
        const elapsed = Date.now() - startTime;
        
        return {
          found: !!element,
          timedOut: elapsed >= 900 && elapsed <= 1100
        };
      });

      expect(result.found).toBe(false);
      expect(result.timedOut).toBe(true);
    });

    test('should scroll element into view before clicking', async () => {
      const scrolled = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        
        // Create a test element below the fold
        const testElement = document.createElement('button');
        testElement.textContent = 'Test Button';
        testElement.style.position = 'absolute';
        testElement.style.top = '2000px';
        document.body.appendChild(testElement);
        
        // Record initial scroll position
        const initialScroll = window.scrollY;
        
        // Click the element
        await controller.clickElement(testElement);
        
        // Check if page scrolled
        const scrollChanged = window.scrollY !== initialScroll;
        
        // Cleanup
        testElement.remove();
        
        return scrollChanged;
      });

      expect(scrolled).toBe(true);
    });

    test('should dispatch proper events for React inputs', async () => {
      const eventsDispatched = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const input = await controller.waitForSelector(controller.selectors.chatInput);
        
        const events = [];
        
        // Listen for events
        ['input', 'change', 'keydown'].forEach(eventType => {
          input.addEventListener(eventType, () => events.push(eventType));
        });
        
        // Set value
        await controller.setInputValue(input, 'Test');
        
        return events;
      });

      expect(eventsDispatched).toContain('input');
      expect(eventsDispatched).toContain('change');
      expect(eventsDispatched).toContain('keydown');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization timeout gracefully', async () => {
      // Create a new page that blocks ChatGPT loading
      const blockedPage = await browser.newPage();
      
      // Intercept and block ChatGPT resources
      await blockedPage.setRequestInterception(true);
      blockedPage.on('request', (request) => {
        if (request.url().includes('chatgpt.com')) {
          request.abort();
        } else {
          request.continue();
        }
      });
      
      await blockedPage.goto(CHATGPT_URL, { waitUntil: 'domcontentloaded' });
      
      // Check controller error state
      const errorState = await blockedPage.evaluate(() => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              initialized: window.chatGPTController?.isInitialized || false,
              hasError: !!window.chatGPTController?.lastError
            });
          }, 2000);
        });
      });
      
      expect(errorState.initialized).toBe(false);
      
      await blockedPage.close();
    });

    test('should handle missing UI elements gracefully', async () => {
      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        
        // Override selector to non-existent element
        const originalSelector = controller.selectors.newProjectButton;
        controller.selectors.newProjectButton = '.non-existent-button';
        
        const result = await controller.createProject('Test Project');
        
        // Restore original selector
        controller.selectors.newProjectButton = originalSelector;
        
        return result;
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('Status and Monitoring', () => {
    test('should report accurate status', async () => {
      const status = await page.evaluate(() => {
        return window.chatGPTController.getStatus();
      });

      expect(status).toMatchObject({
        success: true,
        initialized: true,
        url: expect.stringContaining('chatgpt.com'),
        chatInputPresent: true
      });
    });

    test('should send controller ready message', async () => {
      // Listen for postMessage
      const messages = await page.evaluateOnNewDocument(() => {
        window.capturedMessages = [];
        window.addEventListener('message', (event) => {
          if (event.data.source === 'CHATGPT_CONTROLLER') {
            window.capturedMessages.push(event.data);
          }
        });
      });

      // Reload page to trigger initialization
      await page.reload({ waitUntil: 'networkidle2' });
      await page.waitForTimeout(2000);

      const capturedMessages = await page.evaluate(() => window.capturedMessages);
      
      expect(capturedMessages).toContainEqual(
        expect.objectContaining({
          source: 'CHATGPT_CONTROLLER',
          type: 'CONTROLLER_READY'
        })
      );
    });
  });

  describe('Message Listener', () => {
    test('should respond to runtime messages', async () => {
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'GET_STATUS'
          }, resolve);
        });
      });

      expect(response.success).toBe(true);
      expect(response.initialized).toBe(true);
    });

    test('should handle unknown actions', async () => {
      const response = await page.evaluate(() => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'UNKNOWN_ACTION'
          }, resolve);
        });
      });

      expect(response.success).toBe(false);
      expect(response.error).toBe('Unknown action');
    });

    test('should keep message channel open for async responses', async () => {
      // Send multiple commands in sequence
      const results = await page.evaluate(async () => {
        const results = [];
        
        // Send first command
        const result1 = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'GET_STATUS'
          }, resolve);
        });
        results.push(result1);
        
        // Send second command immediately
        const result2 = await new Promise((resolve) => {
          chrome.runtime.sendMessage({
            action: 'CREATE_NEW_CHAT'
          }, resolve);
        });
        results.push(result2);
        
        return results;
      });

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
    });
  });
});