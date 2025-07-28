/**
 * Unit tests for training-ui.ts
 */

import {
  TrainingUI,
  generateOptimalSelector,
  generateTrainingText,
  PatternMatcher,
  ContextMatcher,
  PatternValidator,
  TrainingMessage,
  AutomationPattern,
  ExecutionContext
} from './training-ui';

import { 
  TrainingUI, 
  TrainingMessage,
  AutomationPattern,
  ExecutionContext,
  generateOptimalSelector, 
  generateTrainingText,
  PatternMatcher,
  ContextMatcher,
  PatternValidator
} from './training-ui';

// Mock DOM elements and methods
const mockElement = document.createElement('div');
mockElement.id = 'test-element';
mockElement.className = 'test-class another-class';
mockElement.setAttribute('name', 'test-name');
mockElement.setAttribute('data-testid', 'test-data-id');
mockElement.setAttribute('type', 'text');

// Use a safer approach - mock individual properties only when needed in specific tests
// Don't mock globally as it interferes with jsdom

describe('TrainingUI', () => {
  let ui: TrainingUI;

  beforeEach(() => {
    document.body.innerHTML = '';
    ui = new TrainingUI();
  });

  afterEach(() => {
    // Clean up any remaining overlays
    ui.hide();
  });

  describe('Training Mode', () => {
    test('should enable training mode', () => {
      ui.enableTrainingMode();
      expect(ui['isTrainingMode']).toBe(true);
    });

    test('should disable training mode', () => {
      ui.enableTrainingMode();
      ui.disableTrainingMode();
      expect(ui['isTrainingMode']).toBe(false);
    });

    test('should not show prompt when training mode is disabled', () => {
      ui.disableTrainingMode();
      ui.showTrainingPrompt('FillTextRequested', { element: 'input', value: 'test' });
      expect(ui.isVisible()).toBe(false);
    });

    test('should show training prompt when training mode is enabled', () => {
      ui.enableTrainingMode();
      ui.showTrainingPrompt('FillTextRequested', { element: 'input', value: 'test' });
      expect(ui.isVisible()).toBe(true);
      
      const overlay = document.querySelector('.training-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.innerHTML).toContain('Training Mode Active');
    });

    test('should enable element selection when showing prompt', () => {
      ui.enableTrainingMode();
      ui.showTrainingPrompt('ClickElementRequested', { element: 'button' });
      expect(ui.isSelectionModeEnabled()).toBe(true);
      expect(document.body.style.cursor).toBe('crosshair');
    });
  });

  describe('Element Selection', () => {
    beforeEach(() => {
      ui.enableTrainingMode();
      ui.showTrainingPrompt('FillTextRequested', { element: 'input' });
    });

    test('should capture element and selector on click', () => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      Object.defineProperty(clickEvent, 'target', { value: mockElement, writable: true });
      
      ui.getClickHandler()(clickEvent);
      
      expect(ui.getCapturedElement()).toBe(mockElement);
      expect(ui.getCapturedSelector()).toBeTruthy();
    });

    test('should prevent default and stop propagation on element click', () => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      const preventDefaultSpy = jest.spyOn(clickEvent, 'preventDefault');
      const stopPropagationSpy = jest.spyOn(clickEvent, 'stopPropagation');
      
      Object.defineProperty(clickEvent, 'target', { value: mockElement, writable: true });
      
      ui.getClickHandler()(clickEvent);
      
      expect(preventDefaultSpy).toHaveBeenCalled();
      expect(stopPropagationSpy).toHaveBeenCalled();
    });

    test('should show confirmation dialog after element selection', () => {
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      Object.defineProperty(clickEvent, 'target', { value: mockElement, writable: true });
      
      ui.getClickHandler()(clickEvent);
      
      expect(ui.isConfirmationVisible()).toBe(true);
      const confirmation = document.querySelector('.training-confirmation');
      expect(confirmation).toBeTruthy();
      expect(confirmation?.innerHTML).toContain('Element Selected');
    });

    test('should handle mouseover events in selection mode', () => {
      const testElement = document.createElement('button');
      const mouseoverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        view: window
      });
      Object.defineProperty(mouseoverEvent, 'target', { value: testElement, writable: true });
      
      ui.handleMouseOver(mouseoverEvent);
      
      expect(testElement.style.outline).toBe('2px solid blue');
    });

    test('should handle mouseout events in selection mode', () => {
      const testElement = document.createElement('button');
      testElement.style.outline = '2px solid blue';
      
      const mouseoutEvent = new MouseEvent('mouseout', {
        bubbles: true,
        view: window
      });
      Object.defineProperty(mouseoutEvent, 'target', { value: testElement, writable: true });
      
      ui.handleMouseOut(mouseoutEvent);
      
      expect(testElement.style.outline).toBe('');
    });
  });

  describe('UI Visibility', () => {
    test('should return false when overlay is not visible', () => {
      expect(ui.isVisible()).toBe(false);
    });

    test('should return true when overlay is visible', () => {
      ui.enableTrainingMode();
      ui.showTrainingPrompt('ClickElementRequested', { element: 'button' });
      expect(ui.isVisible()).toBe(true);
    });

    test('should hide overlay and clean up', () => {
      ui.enableTrainingMode();
      ui.showTrainingPrompt('ClickElementRequested', { element: 'button' });
      
      ui.hide();
      
      expect(ui.isVisible()).toBe(false);
      expect(ui.isSelectionModeEnabled()).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });

    test('should hide confirmation dialog', () => {
      ui.showConfirmationDialog(mockElement, '#test-element');
      expect(ui.isConfirmationVisible()).toBe(true);
      
      ui.hide();
      
      expect(ui.isConfirmationVisible()).toBe(false);
    });
  });

  describe('Pattern Creation and Storage', () => {
    test('should create automation pattern with correct structure', () => {
      const pattern = ui.createAutomationPattern(
        'FillTextRequested',
        { element: 'input', value: 'test' },
        mockElement,
        '#test-element'
      );
      
      expect(pattern.id).toMatch(/^pattern-\d+-[a-z0-9]+$/);
      expect(pattern.messageType).toBe('FillTextRequested');
      expect(pattern.payload).toEqual({ element: 'input', value: 'test' });
      expect(pattern.selector).toBe('#test-element');
      // Just check that context properties exist, don't test specific values
      expect(pattern.context.url).toBeDefined();
      expect(pattern.context.hostname).toBeDefined();
      expect(pattern.context.pathname).toBeDefined();
      expect(pattern.context.title).toBeDefined();
      expect(pattern.confidence).toBe(1.0);
      expect(pattern.usageCount).toBe(0);
      expect(pattern.successfulExecutions).toBe(0);
    });

    test('should save pattern to storage', () => {
      const pattern = ui.createAutomationPattern(
        'ClickElementRequested',
        { element: 'button' },
        mockElement,
        '#test-element'
      );
      
      ui.savePattern(pattern);
      
      const storedPatterns = ui.getStoredPatterns();
      expect(storedPatterns).toHaveLength(1);
      expect(storedPatterns[0]).toEqual(pattern);
    });

    test('should get patterns by type', () => {
      const pattern1 = ui.createAutomationPattern(
        'FillTextRequested',
        { element: 'input' },
        mockElement,
        '#input1'
      );
      const pattern2 = ui.createAutomationPattern(
        'ClickElementRequested',
        { element: 'button' },
        mockElement,
        '#button1'
      );
      const pattern3 = ui.createAutomationPattern(
        'FillTextRequested',
        { element: 'textarea' },
        mockElement,
        '#textarea1'
      );
      
      ui.savePattern(pattern1);
      ui.savePattern(pattern2);
      ui.savePattern(pattern3);
      
      const fillPatterns = ui.getPatternsByType('FillTextRequested');
      expect(fillPatterns).toHaveLength(2);
      expect(fillPatterns[0].messageType).toBe('FillTextRequested');
      expect(fillPatterns[1].messageType).toBe('FillTextRequested');
    });
  });
});

describe('generateOptimalSelector', () => {
  test('should prioritize ID selector', () => {
    const element = document.createElement('div');
    element.id = 'unique-id';
    element.className = 'some-class';
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('#unique-id');
  });

  test('should use name attribute for form elements', () => {
    const element = document.createElement('input');
    element.setAttribute('name', 'username');
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('input[name="username"]');
  });

  test('should use data-testid when available', () => {
    const element = document.createElement('button');
    element.setAttribute('data-testid', 'submit-button');
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('[data-testid="submit-button"]');
  });

  test('should use class combination', () => {
    const element = document.createElement('div');
    element.className = 'btn btn-primary submit-btn';
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('.btn.btn-primary.submit-btn');
  });

  test('should use type attribute for inputs', () => {
    const element = document.createElement('input');
    element.setAttribute('type', 'email');
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('input[type="email"]');
  });

  test('should fall back to tag name', () => {
    const element = document.createElement('section');
    
    const selector = generateOptimalSelector(element);
    expect(selector).toBe('section');
  });
});

describe('generateTrainingText', () => {
  test('should generate text for FillTextRequested with value', () => {
    const text = generateTrainingText('FillTextRequested', {
      element: 'username input',
      value: 'john.doe'
    });
    
    expect(text).toBe(
      'Received FillTextRequested for the username input element, to fill with "john.doe". ' +
      'Please select the username input element requested.'
    );
  });

  test('should generate text for FillTextRequested without value', () => {
    const text = generateTrainingText('FillTextRequested', {
      element: 'search box'
    });
    
    expect(text).toBe(
      'Received FillTextRequested for the search box element. ' +
      'Please select the search box element requested.'
    );
  });

  test('should generate text for ClickElementRequested', () => {
    const text = generateTrainingText('ClickElementRequested', {
      element: 'submit button'
    });
    
    expect(text).toBe(
      'Received ClickElementRequested for the submit button element. ' +
      'Please select the submit button element requested.'
    );
  });

  test('should generate text for TabSwitchRequested', () => {
    const text = generateTrainingText('TabSwitchRequested', {
      title: 'Settings'
    });
    
    expect(text).toBe(
      'Received TabSwitchRequested for tab "Settings". ' +
      'Please click on the tab you want to switch to.'
    );
  });

  test('should generate generic text for unknown message types', () => {
    const text = generateTrainingText('UnknownRequest', {});
    
    expect(text).toBe(
      'Received UnknownRequest. Please select the appropriate element.'
    );
  });
});

describe('PatternMatcher', () => {
  let matcher: PatternMatcher;
  let samplePattern: AutomationPattern;

  beforeEach(() => {
    matcher = new PatternMatcher();
    samplePattern = {
      id: 'pattern-1',
      messageType: 'FillTextRequested',
      payload: { element: 'username', value: 'test' },
      selector: '#username',
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Test',
        timestamp: new Date()
      },
      confidence: 1.0,
      usageCount: 0,
      successfulExecutions: 0
    };
  });

  test('should add pattern', () => {
    matcher.addPattern(samplePattern);
    const match = matcher.findBestMatch({
      messageType: 'FillTextRequested',
      payload: { element: 'username', value: 'test' }
    });
    expect(match).toBeTruthy();
  });

  test('should find best match by message type', () => {
    matcher.addPattern(samplePattern);
    const match = matcher.findBestMatch({
      messageType: 'FillTextRequested',
      payload: { element: 'username', value: 'test' }
    });
    expect(match?.id).toBe('pattern-1');
  });

  test('should return null for no match', () => {
    matcher.addPattern(samplePattern);
    const match = matcher.findBestMatch({
      messageType: 'ClickElementRequested',
      payload: { element: 'button' }
    });
    expect(match).toBeNull();
  });

  test('should record successful execution', () => {
    matcher.recordSuccessfulExecution(samplePattern);
    expect(samplePattern.usageCount).toBe(1);
    expect(samplePattern.successfulExecutions).toBe(1);
    expect(samplePattern.confidence).toBeGreaterThan(1.0);
  });

  test('should cap confidence at 2.0', () => {
    samplePattern.confidence = 1.9;
    matcher.recordSuccessfulExecution(samplePattern);
    matcher.recordSuccessfulExecution(samplePattern);
    expect(samplePattern.confidence).toBe(2.0);
  });
});

describe('ContextMatcher', () => {
  let contextMatcher: ContextMatcher;

  beforeEach(() => {
    contextMatcher = new ContextMatcher();
  });

  test('should match compatible contexts', () => {
    const patternContext = {
      url: 'https://example.com/test',
      hostname: 'example.com',
      pathname: '/test',
      title: 'Test Page',
      timestamp: new Date()
    };
    
    const currentContext: ExecutionContext = {
      url: 'https://example.com/test',
      hostname: 'example.com',
      pathname: '/test'
    };
    
    expect(contextMatcher.isContextCompatible(patternContext, currentContext)).toBe(true);
  });

  test('should reject incompatible contexts', () => {
    const patternContext = {
      url: 'https://example.com',
      hostname: 'example.com',
      pathname: '/page1',
      title: 'Page 1',
      timestamp: new Date()
    };
    
    const currentContext: ExecutionContext = {
      url: 'https://different.com',
      hostname: 'different.com',
      pathname: '/page2'
    };
    
    expect(contextMatcher.isContextCompatible(patternContext, currentContext)).toBe(false);
  });

  test('should calculate context score with path similarity', () => {
    const patternContext = {
      url: 'https://example.com/users/profile',
      hostname: 'example.com',
      pathname: '/users/profile',
      title: 'User Profile',
      timestamp: new Date()
    };
    
    const currentContext: ExecutionContext = {
      url: 'https://example.com/users/settings',
      hostname: 'example.com',
      pathname: '/users/settings'
    };
    
    const score = contextMatcher.calculateContextScore(patternContext, currentContext);
    expect(score).toBeGreaterThan(0.5); // Same hostname, similar path
    expect(score).toBeLessThan(1.0); // Not identical
  });
});

describe('PatternValidator', () => {
  let validator: PatternValidator;
  let pattern: AutomationPattern;

  beforeEach(() => {
    validator = new PatternValidator();
    pattern = {
      id: 'pattern-1',
      messageType: 'FillTextRequested',
      payload: { element: 'input' },
      selector: '#input',
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Test',
        timestamp: new Date(),
        pageStructureHash: 'hash123'
      },
      confidence: 1.0,
      usageCount: 5,
      successfulExecutions: 4
    };
  });

  test('should validate recent patterns', () => {
    expect(validator.isPatternStillValid(pattern, 'hash123')).toBe(true);
  });

  test('should invalidate old patterns', () => {
    // Set pattern timestamp to 40 days ago
    pattern.context.timestamp = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    expect(validator.isPatternStillValid(pattern)).toBe(false);
  });

  test('should consider page structure changes', () => {
    expect(validator.isPatternStillValid(pattern, 'different-hash')).toBe(false);
  });

  test('should calculate reliability levels', () => {
    expect(validator.getPatternReliabilityLevel(pattern)).toBe('high');
    
    // Reduce success rate
    pattern.usageCount = 10;
    pattern.successfulExecutions = 3;
    expect(validator.getPatternReliabilityLevel(pattern)).toBe('medium');
    
    // Make pattern old
    pattern.context.timestamp = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    expect(validator.getPatternReliabilityLevel(pattern)).toBe('unreliable');
  });

  test('should boost confidence for frequently used patterns', () => {
    const frequentPattern = { ...pattern, usageCount: 10, successfulExecutions: 9 };
    const infrequentPattern = { ...pattern, usageCount: 1, successfulExecutions: 0 };
    
    const frequentScore = validator.calculateValidationScore(frequentPattern);
    const infrequentScore = validator.calculateValidationScore(infrequentPattern);
    
    expect(frequentScore).toBeGreaterThan(infrequentScore);
  });
});