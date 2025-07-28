import { TrainingUI, generateOptimalSelector, generateTrainingText, PatternMatcher, ContextMatcher, PatternValidator } from './training-ui';

describe('TrainingUI', () => {
  let trainingUI: TrainingUI;
  
  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    trainingUI = new TrainingUI();
  });
  
  describe('Training Mode', () => {
    it('should start with training mode disabled', () => {
      expect(trainingUI.isVisible()).toBe(false);
    });
    
    it('should enable training mode', () => {
      trainingUI.enableTrainingMode();
      // Training mode is internal state, show training prompt to verify
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input', value: 'test' });
      expect(trainingUI.isVisible()).toBe(true);
    });
    
    it('should disable training mode', () => {
      trainingUI.enableTrainingMode();
      trainingUI.disableTrainingMode();
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input', value: 'test' });
      expect(trainingUI.isVisible()).toBe(false);
    });
  });
  
  describe('Training Prompt', () => {
    beforeEach(() => {
      trainingUI.enableTrainingMode();
    });
    
    it('should show training prompt with FillTextRequested', () => {
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input', value: 'test value' });
      expect(trainingUI.isVisible()).toBe(true);
      const overlay = document.querySelector('.training-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.textContent).toContain('Training Mode Active');
      expect(overlay?.textContent).toContain('fill with "test value"');
    });
    
    it('should show training prompt with ClickElementRequested', () => {
      trainingUI.showTrainingPrompt('ClickElementRequested', { element: 'button' });
      expect(trainingUI.isVisible()).toBe(true);
      const overlay = document.querySelector('.training-overlay');
      expect(overlay?.textContent).toContain('Received ClickElementRequested for the button element');
    });
    
    it('should enable selection mode when showing prompt', () => {
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input' });
      expect(trainingUI.isSelectionModeEnabled()).toBe(true);
      expect(document.body.style.cursor).toBe('crosshair');
    });
  });
  
  describe('hide', () => {
    it('should remove overlay and disable selection mode', () => {
      trainingUI.enableTrainingMode();
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input' });
      
      trainingUI.hide();
      
      expect(trainingUI.isVisible()).toBe(false);
      expect(trainingUI.isSelectionModeEnabled()).toBe(false);
      expect(document.body.style.cursor).toBe('');
    });
  });
  
  describe('Element Selection', () => {
    beforeEach(() => {
      trainingUI.enableTrainingMode();
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input' });
    });
    
    it('should capture element on click', () => {
      const testButton = document.createElement('button');
      testButton.id = 'test-button';
      document.body.appendChild(testButton);
      
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      
      Object.defineProperty(clickEvent, 'target', {
        value: testButton,
        writable: false
      });
      
      const handler = trainingUI.getClickHandler();
      handler(clickEvent);
      
      expect(trainingUI.getCapturedElement()).toBe(testButton);
      expect(trainingUI.getCapturedSelector()).toBe('#test-button');
    });
    
    it('should show confirmation dialog after element selection', () => {
      const testElement = document.createElement('div');
      testElement.className = 'test-class';
      
      trainingUI.showConfirmationDialog(testElement, '.test-class');
      
      expect(trainingUI.isConfirmationVisible()).toBe(true);
      const confirmation = document.querySelector('.training-confirmation');
      expect(confirmation?.textContent).toContain('Element Selected');
      expect(confirmation?.textContent).toContain('div');
      expect(confirmation?.textContent).toContain('.test-class');
    });
  });
  
  describe('Mouse Hover Effects', () => {
    beforeEach(() => {
      trainingUI.enableTrainingMode();
      trainingUI.showTrainingPrompt('FillTextRequested', { element: 'input' });
    });
    
    it('should highlight element on mouseover', () => {
      const testElement = document.createElement('div');
      document.body.appendChild(testElement);
      
      const mouseOverEvent = new MouseEvent('mouseover', {
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(mouseOverEvent, 'target', {
        value: testElement,
        writable: false
      });
      
      trainingUI.handleMouseOver(mouseOverEvent);
      
      expect(testElement.style.outline).toBe('2px solid blue');
    });
    
    it('should remove highlight on mouseout', () => {
      const testElement = document.createElement('div');
      testElement.style.outline = '2px solid blue';
      document.body.appendChild(testElement);
      
      const mouseOutEvent = new MouseEvent('mouseout', {
        bubbles: true,
        cancelable: true
      });
      Object.defineProperty(mouseOutEvent, 'target', {
        value: testElement,
        writable: false
      });
      
      trainingUI.handleMouseOut(mouseOutEvent);
      
      expect(testElement.style.outline).toBe('');
    });
  });
  
  describe('Pattern Creation and Storage', () => {
    it('should create automation pattern', () => {
      const element = document.createElement('input');
      element.name = 'username';
      
      const pattern = trainingUI.createAutomationPattern(
        'FillTextRequested',
        { element: 'username', value: 'testuser' },
        element,
        'input[name="username"]'
      );
      
      expect(pattern.messageType).toBe('FillTextRequested');
      expect(pattern.payload.element).toBe('username');
      expect(pattern.selector).toBe('input[name="username"]');
      expect(pattern.confidence).toBe(1.0);
      expect(pattern.usageCount).toBe(0);
    });
    
    it('should save and retrieve patterns', () => {
      const pattern = trainingUI.createAutomationPattern(
        'ClickElementRequested',
        { element: 'submit' },
        document.createElement('button'),
        'button[type="submit"]'
      );
      
      trainingUI.savePattern(pattern);
      
      const patterns = trainingUI.getStoredPatterns();
      expect(patterns.length).toBe(1);
      expect(patterns[0]).toEqual(pattern);
    });
    
    it('should filter patterns by type', () => {
      const fillPattern = trainingUI.createAutomationPattern(
        'FillTextRequested',
        { element: 'input' },
        document.createElement('input'),
        'input'
      );
      
      const clickPattern = trainingUI.createAutomationPattern(
        'ClickElementRequested',
        { element: 'button' },
        document.createElement('button'),
        'button'
      );
      
      trainingUI.savePattern(fillPattern);
      trainingUI.savePattern(clickPattern);
      
      const fillPatterns = trainingUI.getPatternsByType('FillTextRequested');
      expect(fillPatterns.length).toBe(1);
      expect(fillPatterns[0].messageType).toBe('FillTextRequested');
    });
  });
});

describe('generateOptimalSelector', () => {
  it('should prefer ID selector', () => {
    const element = document.createElement('div');
    element.id = 'unique-id';
    element.className = 'some-class';
    
    expect(generateOptimalSelector(element)).toBe('#unique-id');
  });
  
  it('should use name attribute for form elements', () => {
    const input = document.createElement('input');
    input.name = 'email';
    
    expect(generateOptimalSelector(input)).toBe('input[name="email"]');
  });
  
  it('should use data-testid when available', () => {
    const button = document.createElement('button');
    button.setAttribute('data-testid', 'submit-button');
    
    expect(generateOptimalSelector(button)).toBe('[data-testid="submit-button"]');
  });
  
  it('should use class selector when no better option', () => {
    const div = document.createElement('div');
    div.className = 'card primary';
    
    expect(generateOptimalSelector(div)).toBe('.card.primary');
  });
  
  it('should use type attribute for inputs', () => {
    const input = document.createElement('input');
    input.type = 'email';
    
    expect(generateOptimalSelector(input)).toBe('input[type="email"]');
  });
  
  it('should fallback to tag name', () => {
    const span = document.createElement('span');
    
    expect(generateOptimalSelector(span)).toBe('span');
  });
});

describe('generateTrainingText', () => {
  it('should generate text for FillTextRequested with value', () => {
    const text = generateTrainingText('FillTextRequested', {
      element: 'username field',
      value: 'john.doe'
    });
    
    expect(text).toContain('username field');
    expect(text).toContain('john.doe');
  });
  
  it('should generate text for FillTextRequested without value', () => {
    const text = generateTrainingText('FillTextRequested', {
      element: 'search box'
    });
    
    expect(text).toContain('search box');
    expect(text).not.toContain('fill with');
  });
  
  it('should generate text for ClickElementRequested', () => {
    const text = generateTrainingText('ClickElementRequested', {
      element: 'submit button'
    });
    
    expect(text).toContain('ClickElementRequested');
    expect(text).toContain('submit button');
  });
  
  it('should generate text for TabSwitchRequested', () => {
    const text = generateTrainingText('TabSwitchRequested', {
      title: 'Settings'
    });
    
    expect(text).toContain('TabSwitchRequested');
    expect(text).toContain('Settings');
  });
  
  it('should handle unknown message types', () => {
    const text = generateTrainingText('UnknownType', {});
    
    expect(text).toContain('UnknownType');
    expect(text).toContain('select the appropriate element');
  });
});

describe('PatternMatcher', () => {
  let matcher: PatternMatcher;
  
  beforeEach(() => {
    matcher = new PatternMatcher();
  });
  
  it('should find best match for same message type', () => {
    const pattern = {
      id: 'test-1',
      messageType: 'FillTextRequested',
      payload: { element: 'username' },
      selector: 'input',
      context: {
        url: 'test.com',
        title: 'Test',
        timestamp: new Date()
      },
      confidence: 1.0,
      usageCount: 0
    };
    
    matcher.addPattern(pattern);
    
    const match = matcher.findBestMatch({
      messageType: 'FillTextRequested',
      payload: { element: 'username' }
    });
    
    expect(match).toBe(pattern);
  });
  
  it('should return null for no matching patterns', () => {
    const match = matcher.findBestMatch({
      messageType: 'NonExistent',
      payload: {}
    });
    
    expect(match).toBeNull();
  });
  
  it('should record successful execution', () => {
    const pattern = {
      id: 'test-1',
      messageType: 'ClickElementRequested',
      payload: {},
      selector: 'button',
      context: {
        url: 'test.com',
        title: 'Test',
        timestamp: new Date()
      },
      confidence: 1.0,
      usageCount: 0,
      successfulExecutions: 0
    };
    
    matcher.recordSuccessfulExecution(pattern);
    
    expect(pattern.usageCount).toBe(1);
    expect(pattern.successfulExecutions).toBe(1);
    expect(pattern.confidence).toBeGreaterThan(1.0);
  });
});

describe('ContextMatcher', () => {
  let contextMatcher: ContextMatcher;
  
  beforeEach(() => {
    contextMatcher = new ContextMatcher();
  });
  
  it('should match compatible contexts', () => {
    const patternContext = {
      url: 'https://example.com/login',
      hostname: 'example.com',
      pathname: '/login',
      title: 'Login',
      timestamp: new Date()
    };
    
    const currentContext = {
      url: 'https://example.com/login',
      hostname: 'example.com',
      pathname: '/login'
    };
    
    expect(contextMatcher.isContextCompatible(patternContext, currentContext)).toBe(true);
  });
  
  it('should reject incompatible contexts', () => {
    const patternContext = {
      url: 'https://example.com/login',
      hostname: 'example.com',
      pathname: '/login',
      title: 'Login',
      timestamp: new Date()
    };
    
    const currentContext = {
      url: 'https://different.com/page',
      hostname: 'different.com',
      pathname: '/page'
    };
    
    expect(contextMatcher.isContextCompatible(patternContext, currentContext)).toBe(false);
  });
});

describe('PatternValidator', () => {
  let validator: PatternValidator;
  
  beforeEach(() => {
    validator = new PatternValidator();
  });
  
  it('should validate fresh patterns as valid', () => {
    const pattern = {
      id: 'test-1',
      messageType: 'ClickElementRequested',
      payload: {},
      selector: 'button',
      context: {
        url: 'test.com',
        title: 'Test',
        timestamp: new Date()
      },
      confidence: 1.0,
      usageCount: 5,
      successfulExecutions: 5
    };
    
    expect(validator.isPatternStillValid(pattern)).toBe(true);
  });
  
  it('should invalidate very old patterns', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 60); // 60 days old
    
    const pattern = {
      id: 'test-1',
      messageType: 'ClickElementRequested',
      payload: {},
      selector: 'button',
      context: {
        url: 'test.com',
        title: 'Test',
        timestamp: oldDate
      },
      confidence: 1.0,
      usageCount: 1,
      successfulExecutions: 1
    };
    
    expect(validator.isPatternStillValid(pattern)).toBe(false);
  });
  
  it('should determine reliability levels', () => {
    const highReliability = {
      id: 'test-1',
      messageType: 'ClickElementRequested',
      payload: {},
      selector: 'button',
      context: {
        url: 'test.com',
        title: 'Test',
        timestamp: new Date()
      },
      confidence: 1.0,
      usageCount: 10,
      successfulExecutions: 10
    };
    
    expect(validator.getPatternReliabilityLevel(highReliability)).toBe('high');
  });
});