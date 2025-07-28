/**
 * Unit tests for AutomationPattern entity
 */

import { AutomationPattern } from './automation-pattern';
import {
  AutomationPatternMatched,
  AutomationPatternExecuted,
  PatternExecutionFailed,
  ExecutionContext,
  AutomationPatternData,
  AutomationRequest
} from '../events/training-events';

// Mock DOM elements
const mockElement = document.createElement('div');
const mockInput = document.createElement('input');

// Helper to create test pattern data
const createTestPatternData = (overrides?: Partial<AutomationPatternData>): AutomationPatternData => ({
  id: 'test-pattern-1',
  messageType: 'ClickElementRequested',
  payload: { element: 'button' },
  selector: '.test-button',
  context: {
    url: 'https://example.com/page',
    hostname: 'example.com',
    pathname: '/page',
    title: 'Test Page',
    timestamp: new Date('2024-01-01')
  },
  confidence: 0.8,
  usageCount: 5,
  successfulExecutions: 4,
  ...overrides
});

// Helper to create test request
const createTestRequest = (overrides?: Partial<AutomationRequest>): AutomationRequest => ({
  messageType: 'ClickElementRequested',
  payload: { element: 'button' },
  context: {
    url: 'https://example.com/page',
    hostname: 'example.com',
    pathname: '/page',
    title: 'Test Page',
    timestamp: new Date()
  },
  ...overrides
});

describe('AutomationPattern', () => {
  let pattern: AutomationPattern;

  beforeEach(() => {
    jest.clearAllMocks();
    pattern = new AutomationPattern(createTestPatternData());
    
    // Reset DOM
    document.body.innerHTML = '';
  });

  describe('Basic Properties', () => {
    test('should initialize with correct data', () => {
      expect(pattern.id).toBe('test-pattern-1');
      expect(pattern.messageType).toBe('ClickElementRequested');
      expect(pattern.selector).toBe('.test-button');
      expect(pattern.confidence).toBe(0.8);
      expect(pattern.usageCount).toBe(5);
      expect(pattern.successfulExecutions).toBe(4);
    });

    test('should calculate success rate correctly', () => {
      expect(pattern.successRate).toBe(0.8); // 4/5
    });

    test('should return 0 success rate when no usage', () => {
      const newPattern = new AutomationPattern(createTestPatternData({
        usageCount: 0,
        successfulExecutions: 0
      }));
      expect(newPattern.successRate).toBe(0);
    });
  });

  describe('Pattern Matching', () => {
    test('should evaluate exact match with high score', async () => {
      const request = createTestRequest();
      const criteria = await pattern.evaluateMatch(request);

      expect(criteria.messageTypeMatch).toBe(true);
      expect(criteria.payloadSimilarity).toBeGreaterThan(0.8);
      expect(criteria.contextCompatibility).toBeGreaterThan(0.8);
      expect(criteria.overallScore).toBeGreaterThan(0.7);
    });

    test('should fail match with different message type', async () => {
      const request = createTestRequest({
        messageType: 'FillTextRequested'
      });
      const criteria = await pattern.evaluateMatch(request);

      expect(criteria.messageTypeMatch).toBe(false);
      expect(criteria.overallScore).toBe(0);
    });

    test('should calculate payload similarity correctly', async () => {
      const request = createTestRequest({
        payload: { element: 'button', extra: 'data' }
      });
      const criteria = await pattern.evaluateMatch(request);

      expect(criteria.payloadSimilarity).toBeGreaterThan(0.5);
      expect(criteria.payloadSimilarity).toBeLessThan(1.0);
    });

    test('should identify good matches', async () => {
      const request = createTestRequest();
      const criteria = await pattern.evaluateMatch(request);

      expect(pattern.isGoodMatch(criteria)).toBe(true);
    });

    test('should reject poor matches', async () => {
      const request = createTestRequest({
        context: {
          ...createTestRequest().context,
          hostname: 'different.com'
        }
      });
      const criteria = await pattern.evaluateMatch(request);

      expect(pattern.isGoodMatch(criteria)).toBe(false);
    });
  });

  describe('Context Validation', () => {
    test('should validate matching context', () => {
      const currentContext: ExecutionContext = {
        url: 'https://example.com/page',
        hostname: 'example.com',
        pathname: '/page',
        title: 'Test Page',
        timestamp: new Date()
      };

      expect(pattern.isValidForContext(currentContext)).toBe(true);
    });

    test('should reject different hostname', () => {
      const currentContext: ExecutionContext = {
        url: 'https://different.com/page',
        hostname: 'different.com',
        pathname: '/page',
        title: 'Test Page',
        timestamp: new Date()
      };

      expect(pattern.isValidForContext(currentContext)).toBe(false);
    });

    test('should reject old patterns', () => {
      const oldPattern = new AutomationPattern(createTestPatternData({
        context: {
          ...createTestPatternData().context,
          timestamp: new Date('2020-01-01') // Very old
        }
      }));

      const currentContext = createTestRequest().context;
      expect(oldPattern.isValidForContext(currentContext)).toBe(false);
    });

    test('should allow reliable patterns despite page structure changes', () => {
      const reliablePattern = new AutomationPattern(createTestPatternData({
        usageCount: 100,
        successfulExecutions: 85,
        context: {
          ...createTestPatternData().context,
          pageStructureHash: 'old-hash'
        }
      }));

      const currentContext: ExecutionContext = {
        ...createTestRequest().context,
        pageStructureHash: 'new-hash'
      };

      expect(reliablePattern.isValidForContext(currentContext)).toBe(true);
    });
  });

  describe('Reliability Assessment', () => {
    test('should classify high reliability patterns', () => {
      const highReliability = new AutomationPattern(createTestPatternData({
        confidence: 0.9,
        usageCount: 20,
        successfulExecutions: 18
      }));

      expect(highReliability.getReliabilityLevel()).toBe('high');
    });

    test('should classify medium reliability patterns', () => {
      const mediumReliability = new AutomationPattern(createTestPatternData({
        confidence: 0.7,
        usageCount: 10,
        successfulExecutions: 7
      }));

      expect(mediumReliability.getReliabilityLevel()).toBe('medium');
    });

    test('should classify low reliability patterns', () => {
      const lowReliability = new AutomationPattern(createTestPatternData({
        confidence: 0.5,
        usageCount: 10,
        successfulExecutions: 5
      }));

      expect(lowReliability.getReliabilityLevel()).toBe('low');
    });

    test('should classify unreliable patterns', () => {
      const unreliable = new AutomationPattern(createTestPatternData({
        confidence: 0.3,
        usageCount: 10,
        successfulExecutions: 2
      }));

      expect(unreliable.getReliabilityLevel()).toBe('unreliable');
    });
  });

  describe('Retraining Detection', () => {
    test('should recommend retraining for low success rate', () => {
      const lowSuccess = new AutomationPattern(createTestPatternData({
        usageCount: 10,
        successfulExecutions: 4
      }));

      expect(lowSuccess.shouldBeRetrained()).toBe(true);
    });

    test('should recommend retraining for old unused patterns', () => {
      const oldPattern = new AutomationPattern(createTestPatternData({
        context: {
          ...createTestPatternData().context,
          timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000) // 20 days old
        }
      }));

      expect(oldPattern.shouldBeRetrained()).toBe(true);
    });

    test('should not recommend retraining for successful patterns', () => {
      const successful = new AutomationPattern(createTestPatternData({
        confidence: 0.9,
        usageCount: 20,
        successfulExecutions: 19,
        context: {
          ...createTestPatternData().context,
          timestamp: new Date() // Recent
        }
      }));

      expect(successful.shouldBeRetrained()).toBe(false);
    });
  });

  describe('Pattern Execution', () => {
    test('should execute click pattern successfully', async () => {
      // Setup DOM
      const button = document.createElement('button');
      button.className = 'test-button';
      document.body.appendChild(button);
      
      jest.spyOn(document, 'querySelector').mockReturnValue(button);
      jest.spyOn(button, 'click');

      const event = new AutomationPatternMatched(
        pattern,
        createTestRequest(),
        0.8,
        'test-correlation-id'
      );

      const result = await pattern.executePattern(event);

      expect(result).toBeInstanceOf(AutomationPatternExecuted);
      expect(button.click).toHaveBeenCalled();
    });

    test('should fail execution when element not found', async () => {
      jest.spyOn(document, 'querySelector').mockReturnValue(null);

      const event = new AutomationPatternMatched(
        pattern,
        createTestRequest(),
        0.8,
        'test-correlation-id'
      );

      const result = await pattern.executePattern(event);

      expect(result).toBeInstanceOf(PatternExecutionFailed);
      if (result instanceof PatternExecutionFailed) {
        expect(result.reason).toContain('Element not found');
      }
    });

    test('should fail execution when confidence too low', async () => {
      const event = new AutomationPatternMatched(
        pattern,
        createTestRequest(),
        0.5, // Low confidence
        'test-correlation-id'
      );

      const result = await pattern.executePattern(event);

      expect(result).toBeInstanceOf(PatternExecutionFailed);
      if (result instanceof PatternExecutionFailed) {
        expect(result.reason).toContain('confidence too low');
      }
    });

    test('should fail execution for invalid context', async () => {
      const event = new AutomationPatternMatched(
        pattern,
        createTestRequest({
          context: {
            ...createTestRequest().context,
            hostname: 'different.com'
          }
        }),
        0.8,
        'test-correlation-id'
      );

      const result = await pattern.executePattern(event);

      expect(result).toBeInstanceOf(PatternExecutionFailed);
      if (result instanceof PatternExecutionFailed) {
        expect(result.reason).toContain('context validation failed');
      }
    });

    test('should execute fill text pattern', async () => {
      const fillPattern = new AutomationPattern(createTestPatternData({
        messageType: 'FillTextRequested',
        selector: '.test-input'
      }));

      const input = document.createElement('input');
      input.className = 'test-input';
      document.body.appendChild(input);
      
      jest.spyOn(document, 'querySelector').mockReturnValue(input);
      jest.spyOn(input, 'focus');
      jest.spyOn(input, 'dispatchEvent');

      const event = new AutomationPatternMatched(
        fillPattern,
        createTestRequest({
          messageType: 'FillTextRequested',
          payload: { value: 'test text' }
        }),
        0.8,
        'test-correlation-id'
      );

      const result = await fillPattern.executePattern(event);

      expect(result).toBeInstanceOf(AutomationPatternExecuted);
      expect(input.value).toBe('test text');
      expect(input.focus).toHaveBeenCalled();
      expect(input.dispatchEvent).toHaveBeenCalledTimes(2); // input and change events
    });
  });
});