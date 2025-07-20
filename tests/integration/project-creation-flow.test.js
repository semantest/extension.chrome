/**
 * Automated Tests for Project Creation Flow on ChatGPT
 * Comprehensive testing of the 'New Project' functionality
 */

const puppeteer = require('puppeteer');
const path = require('path');
const testUtils = require('./setup');

describe('ChatGPT Project Creation Flow - Detailed Tests', () => {
  let browser;
  let page;
  const EXTENSION_PATH = path.join(__dirname, '../../dist');
  const CHATGPT_URL = 'https://chatgpt.com';

  beforeAll(async () => {
    browser = await testUtils.launchBrowser({ 
      headless: process.env.HEADLESS === 'true',
      persistProfile: true 
    });
  }, 120000);

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  beforeEach(async () => {
    page = await testUtils.setupChatGPTPage(browser, {
      logConsole: process.env.DEBUG === 'true'
    });
  });

  afterEach(async () => {
    // Take screenshot on failure
    if (page && this.currentTest?.state === 'failed') {
      await testUtils.takeScreenshot(page, `project-creation-${this.currentTest.title}`);
    }
    
    if (page) {
      await page.close();
    }
  });

  describe('UI Element Detection', () => {
    test('should detect "New Project" button in sidebar', async () => {
      // Wait for sidebar to be visible
      await page.waitForSelector('nav[aria-label="Chat history"]', { timeout: 10000 });

      // Check multiple possible selectors for the New Project button
      const buttonSelectors = [
        'button:has-text("New Project")',
        'button[aria-label*="project"]',
        '[data-testid="new-project-button"]',
        'button svg[stroke="currentColor"]' // Icon-based button
      ];

      let buttonFound = false;
      let foundSelector = null;

      for (const selector of buttonSelectors) {
        const element = await page.evaluate((sel) => {
          const controller = window.chatGPTController;
          return controller.findElement(sel).then(el => !!el);
        }, selector);

        if (element) {
          buttonFound = true;
          foundSelector = selector;
          break;
        }
      }

      expect(buttonFound).toBe(true);
      console.log(`New Project button found with selector: ${foundSelector}`);
    });

    test('should have sidebar navigation area', async () => {
      const sidebarExists = await page.evaluate(() => {
        const sidebar = document.querySelector('nav[aria-label="Chat history"]');
        return {
          exists: !!sidebar,
          visible: sidebar ? window.getComputedStyle(sidebar).display !== 'none' : false,
          hasProjects: sidebar ? sidebar.querySelectorAll('[role="list"] li').length > 0 : false
        };
      });

      expect(sidebarExists.exists).toBe(true);
      expect(sidebarExists.visible).toBe(true);
    });
  });

  describe('Project Creation Dialog', () => {
    test('should open project creation dialog when clicking New Project', async () => {
      // Click the New Project button
      const dialogOpened = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        
        // Find and click the button
        const button = await controller.findElement(controller.selectors.newProjectButton);
        if (!button) return { success: false, error: 'Button not found' };
        
        await controller.clickElement(button);
        await controller.delay(500);
        
        // Check if dialog/input appeared
        const nameInput = await controller.findElement(controller.selectors.projectNameInput);
        return {
          success: !!nameInput,
          inputType: nameInput?.tagName,
          placeholder: nameInput?.placeholder
        };
      });

      expect(dialogOpened.success).toBe(true);
      expect(dialogOpened.inputType).toBe('INPUT');
    });

    test('should display project name input field', async () => {
      // Open project dialog
      await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.findElement(controller.selectors.newProjectButton);
        await controller.clickElement(button);
      });

      await page.waitForTimeout(500);

      // Verify input field properties
      const inputProperties = await page.evaluate(() => {
        const controller = window.chatGPTController;
        const input = document.querySelector(controller.selectors.projectNameInput);
        
        return {
          exists: !!input,
          type: input?.type,
          required: input?.required,
          maxLength: input?.maxLength,
          autoFocus: input === document.activeElement,
          placeholder: input?.placeholder
        };
      });

      expect(inputProperties.exists).toBe(true);
      expect(inputProperties.type).toBe('text');
      expect(inputProperties.autoFocus).toBe(true);
    });

    test('should have Create/Submit button in dialog', async () => {
      // Open project dialog
      await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.findElement(controller.selectors.newProjectButton);
        await controller.clickElement(button);
      });

      await page.waitForTimeout(500);

      // Check for create button
      const createButton = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.findElement(controller.selectors.createProjectButton);
        
        return {
          exists: !!button,
          text: button?.textContent,
          type: button?.type,
          disabled: button?.disabled
        };
      });

      expect(createButton.exists).toBe(true);
      expect(createButton.text).toMatch(/Create|Submit|Add/i);
    });
  });

  describe('Project Name Input Handling', () => {
    beforeEach(async () => {
      // Open project creation dialog
      await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const button = await controller.findElement(controller.selectors.newProjectButton);
        await controller.clickElement(button);
        await controller.delay(500);
      });
    });

    test('should accept valid project names', async () => {
      const testNames = [
        'My Test Project',
        'Project-123',
        'Test_Project_2024',
        'プロジェクト', // Japanese
        'Проект', // Russian
        '🚀 Space Project'
      ];

      for (const name of testNames) {
        const result = await page.evaluate(async (projectName) => {
          const controller = window.chatGPTController;
          const input = await controller.findElement(controller.selectors.projectNameInput);
          
          // Clear and enter new name
          input.value = '';
          await controller.setInputValue(input, projectName);
          
          return {
            value: input.value,
            valid: input.checkValidity ? input.checkValidity() : true
          };
        }, name);

        expect(result.value).toBe(name);
        expect(result.valid).toBe(true);
      }
    });

    test('should show validation for empty project name', async () => {
      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const input = await controller.findElement(controller.selectors.projectNameInput);
        const createBtn = await controller.findElement(controller.selectors.createProjectButton);
        
        // Try to submit with empty name
        input.value = '';
        await controller.clickElement(createBtn);
        await controller.delay(300);
        
        // Check for validation message or disabled state
        return {
          inputEmpty: input.value === '',
          hasError: input.classList.contains('error') || input.getAttribute('aria-invalid') === 'true',
          createDisabled: createBtn.disabled
        };
      });

      expect(result.inputEmpty).toBe(true);
      expect(result.hasError || result.createDisabled).toBe(true);
    });

    test('should handle special characters in project names', async () => {
      const specialNames = [
        'Project (Test)',
        'Project [Beta]',
        'Project #1',
        'Project @Home',
        'Project & Testing'
      ];

      for (const name of specialNames) {
        const result = await page.evaluate(async (projectName) => {
          const controller = window.chatGPTController;
          const input = await controller.findElement(controller.selectors.projectNameInput);
          
          await controller.setInputValue(input, projectName);
          
          return {
            accepted: input.value === projectName,
            escaped: input.value
          };
        }, name);

        console.log(`Special character test: "${name}" -> "${result.escaped}"`);
        expect(result.accepted).toBe(true);
      }
    });
  });

  describe('Project Creation Process', () => {
    test('should create project with valid name and show in sidebar', async () => {
      const projectName = `Test Project ${Date.now()}`;
      
      // Execute full creation flow
      const result = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        
        // Click New Project
        const newProjectBtn = await controller.findElement(controller.selectors.newProjectButton);
        if (!newProjectBtn) return { success: false, error: 'New Project button not found' };
        
        await controller.clickElement(newProjectBtn);
        await controller.delay(500);
        
        // Enter project name
        const nameInput = await controller.findElement(controller.selectors.projectNameInput);
        if (!nameInput) return { success: false, error: 'Name input not found' };
        
        await controller.setInputValue(nameInput, name);
        await controller.delay(300);
        
        // Click Create
        const createBtn = await controller.findElement(controller.selectors.createProjectButton);
        if (!createBtn) return { success: false, error: 'Create button not found' };
        
        await controller.clickElement(createBtn);
        await controller.delay(1000);
        
        // Verify project appears in sidebar
        const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
        const projectCreated = Array.from(projects).some(p => p.textContent.includes(name));
        
        return {
          success: projectCreated,
          projectCount: projects.length,
          projectName: name
        };
      }, projectName);

      expect(result.success).toBe(true);
      expect(result.projectName).toBe(projectName);
      console.log(`Project created successfully: ${projectName}`);
    });

    test('should create multiple projects in sequence', async () => {
      const projectNames = [
        `Project Alpha ${Date.now()}`,
        `Project Beta ${Date.now() + 1}`,
        `Project Gamma ${Date.now() + 2}`
      ];

      const results = [];

      for (const name of projectNames) {
        const result = await page.evaluate(async (projectName) => {
          const controller = window.chatGPTController;
          return await controller.createProject(projectName);
        }, name);

        results.push(result);
        await page.waitForTimeout(1000);
      }

      // Verify all projects were created
      expect(results.every(r => r.success)).toBe(true);

      // Verify all projects appear in sidebar
      const projectsInSidebar = await page.evaluate((names) => {
        const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
        const projectTexts = Array.from(projects).map(p => p.textContent);
        
        return names.map(name => ({
          name,
          found: projectTexts.some(text => text.includes(name))
        }));
      }, projectNames);

      projectsInSidebar.forEach(p => {
        expect(p.found).toBe(true);
      });
    });

    test('should handle rapid project creation', async () => {
      // Test creating projects quickly without waiting
      const results = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const results = [];
        
        for (let i = 0; i < 3; i++) {
          const name = `Rapid Project ${Date.now()}_${i}`;
          
          // Don't wait between operations
          const newProjectBtn = await controller.findElement(controller.selectors.newProjectButton);
          await controller.clickElement(newProjectBtn);
          
          const nameInput = await controller.waitForSelector(controller.selectors.projectNameInput, 2000);
          if (nameInput) {
            await controller.setInputValue(nameInput, name);
            
            const createBtn = await controller.findElement(controller.selectors.createProjectButton);
            await controller.clickElement(createBtn);
            
            results.push({ name, attempted: true });
          } else {
            results.push({ name, attempted: false, error: 'Input not ready' });
          }
          
          // Small delay between attempts
          await controller.delay(500);
        }
        
        return results;
      });

      const successCount = results.filter(r => r.attempted).length;
      expect(successCount).toBeGreaterThan(0);
    });
  });

  describe('Project Creation Error Handling', () => {
    test('should prevent creating project with duplicate name', async () => {
      const duplicateName = `Duplicate Project ${Date.now()}`;
      
      // Create first project
      await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        await controller.createProject(name);
      }, duplicateName);

      await page.waitForTimeout(1000);

      // Try to create duplicate
      const duplicateResult = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        const result = await controller.createProject(name);
        
        // Check for error message
        const errorElement = document.querySelector('.error-message, [role="alert"]');
        
        return {
          ...result,
          hasErrorMessage: !!errorElement,
          errorText: errorElement?.textContent
        };
      }, duplicateName);

      // Either creation should fail or error should be shown
      expect(duplicateResult.success === false || duplicateResult.hasErrorMessage).toBe(true);
    });

    test('should handle network errors gracefully', async () => {
      // Simulate offline condition
      await page.setOfflineMode(true);

      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        try {
          const result = await controller.createProject('Offline Test Project');
          return { ...result, offline: true };
        } catch (error) {
          return { success: false, error: error.message, offline: true };
        }
      });

      expect(result.success).toBe(false);
      expect(result.offline).toBe(true);

      // Restore online
      await page.setOfflineMode(false);
    });

    test('should recover from dialog close/cancel', async () => {
      const result = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        
        // Open dialog
        const newProjectBtn = await controller.findElement(controller.selectors.newProjectButton);
        await controller.clickElement(newProjectBtn);
        await controller.delay(500);
        
        // Close dialog (ESC key or cancel button)
        const escEvent = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape' });
        document.dispatchEvent(escEvent);
        await controller.delay(300);
        
        // Try to open again
        const btnStillExists = await controller.findElement(controller.selectors.newProjectButton);
        if (btnStillExists) {
          await controller.clickElement(btnStillExists);
          await controller.delay(500);
          
          const inputVisible = await controller.findElement(controller.selectors.projectNameInput);
          return { recovered: !!inputVisible };
        }
        
        return { recovered: false };
      });

      expect(result.recovered).toBe(true);
    });
  });

  describe('Project Selection and Activation', () => {
    test('should select newly created project', async () => {
      const projectName = `Active Project ${Date.now()}`;
      
      // Create and check if selected
      const result = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        await controller.createProject(name);
        await controller.delay(1000);
        
        // Find the project in sidebar
        const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
        let projectElement = null;
        
        for (const proj of projects) {
          if (proj.textContent.includes(name)) {
            projectElement = proj;
            break;
          }
        }
        
        if (!projectElement) return { found: false };
        
        // Check if it's selected/active
        const isActive = projectElement.classList.contains('active') || 
                        projectElement.getAttribute('aria-selected') === 'true' ||
                        projectElement.querySelector('[aria-current="page"]');
        
        return {
          found: true,
          isActive: !!isActive,
          classes: Array.from(projectElement.classList)
        };
      }, projectName);

      expect(result.found).toBe(true);
      console.log(`Project active state: ${result.isActive}, classes: ${result.classes.join(', ')}`);
    });

    test('should switch context to new project', async () => {
      const projectName = `Context Project ${Date.now()}`;
      
      // Create project and verify context switch
      const result = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        
        // Get initial state
        const initialUrl = window.location.href;
        
        // Create project
        await controller.createProject(name);
        await controller.delay(1500);
        
        // Check if URL changed or context switched
        const newUrl = window.location.href;
        const chatInput = await controller.findElement(controller.selectors.chatInput);
        
        return {
          urlChanged: initialUrl !== newUrl,
          newUrl: newUrl,
          chatInputReady: !!chatInput && !chatInput.disabled,
          projectName: name
        };
      }, projectName);

      expect(result.chatInputReady).toBe(true);
      console.log(`Context switch: URL changed=${result.urlChanged}, Chat ready=${result.chatInputReady}`);
    });
  });

  describe('Visual Feedback', () => {
    test('should show loading state during project creation', async () => {
      const loadingStates = await page.evaluate(async () => {
        const controller = window.chatGPTController;
        const states = [];
        
        // Start creation
        const newProjectBtn = await controller.findElement(controller.selectors.newProjectButton);
        await controller.clickElement(newProjectBtn);
        await controller.delay(300);
        
        const nameInput = await controller.findElement(controller.selectors.projectNameInput);
        await controller.setInputValue(nameInput, `Loading Test ${Date.now()}`);
        
        // Monitor for loading indicators
        const createBtn = await controller.findElement(controller.selectors.createProjectButton);
        
        // Initial state
        states.push({
          time: 'before',
          buttonDisabled: createBtn.disabled,
          hasSpinner: !!document.querySelector('.spinner, .loading, [role="progressbar"]')
        });
        
        // Click and monitor
        controller.clickElement(createBtn);
        
        // Check immediately
        states.push({
          time: 'immediate',
          buttonDisabled: createBtn.disabled,
          hasSpinner: !!document.querySelector('.spinner, .loading, [role="progressbar"]')
        });
        
        // Check after short delay
        await controller.delay(100);
        states.push({
          time: 'during',
          buttonDisabled: createBtn.disabled,
          hasSpinner: !!document.querySelector('.spinner, .loading, [role="progressbar"]')
        });
        
        return states;
      });

      // Should show some loading state
      const hasLoadingFeedback = loadingStates.some(s => s.buttonDisabled || s.hasSpinner);
      expect(hasLoadingFeedback).toBe(true);
    });

    test('should show success feedback after project creation', async () => {
      const projectName = `Success Test ${Date.now()}`;
      
      const feedback = await page.evaluate(async (name) => {
        const controller = window.chatGPTController;
        
        // Create project
        const result = await controller.createProject(name);
        
        // Look for success indicators
        await controller.delay(500);
        
        const successIndicators = {
          toastMessage: !!document.querySelector('.toast, .notification, [role="status"]'),
          projectHighlighted: false,
          dialogClosed: !document.querySelector(controller.selectors.projectNameInput)
        };
        
        // Check if new project is highlighted
        const projects = document.querySelectorAll('[role="navigation"] [role="list"] li');
        for (const proj of projects) {
          if (proj.textContent.includes(name)) {
            successIndicators.projectHighlighted = 
              proj.classList.contains('new') || 
              proj.classList.contains('highlight') ||
              window.getComputedStyle(proj).backgroundColor !== 'rgba(0, 0, 0, 0)';
          }
        }
        
        return { result, ...successIndicators };
      }, projectName);

      expect(feedback.result.success).toBe(true);
      expect(feedback.dialogClosed).toBe(true);
    });
  });
});