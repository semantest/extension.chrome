/**
 * @jest-environment jsdom
 */

import {
  DomainEvent,
  TrainingModeRequested,
  TrainingModeEnabled,
  TrainingModeDisabled,
  ElementSelectionRequested,
  ElementSelected,
  ElementSelectionFailed,
  PatternLearningRequested,
  PatternLearned,
  PatternLearningFailed,
  AutomationPatternMatched,
  AutomationPatternExecuted,
  PatternExecutionFailed,
  TrainingSessionStarted,
  TrainingSessionEnded,
  UserGuidanceDisplayed,
  UserActionConfirmed,
  UserActionCancelled,
  ExecutionContext,
  AutomationPatternData,
  AutomationRequest,
  ExecutionResult,
  UserGuidanceData,
  TrainingDomainEvent
} from './training-events';

describe('Training Events', () => {
  const mockCorrelationId = 'test-correlation-id';
  const mockWebsite = 'https://example.com';
  const mockSessionId = 'test-session-id';
  
  const mockContext: ExecutionContext = {
    url: 'https://example.com/page',
    hostname: 'example.com',
    pathname: '/page',
    title: 'Test Page',
    timestamp: new Date(),
    pageStructureHash: 'hash123'
  };
  
  const mockElement = document.createElement('button');
  
  const mockPatternData: AutomationPatternData = {
    id: 'pattern-123',
    messageType: 'click',
    payload: { action: 'submit' },
    selector: 'button.submit',
    context: mockContext,
    confidence: 0.95,
    usageCount: 10,
    successfulExecutions: 9
  };
  
  const mockRequest: AutomationRequest = {
    messageType: 'click',
    payload: { action: 'submit' },
    context: mockContext
  };
  
  const mockExecutionResult: ExecutionResult = {
    success: true,
    data: { result: 'completed' },
    timestamp: new Date()
  };
  
  const mockGuidanceData: UserGuidanceData = {
    messageType: 'click',
    elementDescription: 'Submit button',
    instructions: 'Click on the submit button',
    overlayType: 'prompt'
  };
  
  describe('DomainEvent Base Class', () => {
    // Create a concrete test class
    class TestEvent extends DomainEvent {
      get eventType(): string {
        return 'TestEvent';
      }
    }
    
    it('should create event with unique id', () => {
      const event1 = new TestEvent(mockCorrelationId);
      const event2 = new TestEvent(mockCorrelationId);
      
      expect(event1.id).toBeDefined();
      expect(event2.id).toBeDefined();
      expect(event1.id).not.toBe(event2.id);
      expect(event1.id).toMatch(/^TestEvent-\d+-[a-z0-9]+$/);
    });
    
    it('should set timestamp to current date', () => {
      const before = Date.now();
      const event = new TestEvent(mockCorrelationId);
      const after = Date.now();
      
      expect(event.timestamp.getTime()).toBeGreaterThanOrEqual(before);
      expect(event.timestamp.getTime()).toBeLessThanOrEqual(after);
    });
    
    it('should set correlation id', () => {
      const event = new TestEvent(mockCorrelationId);
      expect(event.correlationId).toBe(mockCorrelationId);
    });
  });
  
  describe('Training Mode Events', () => {
    describe('TrainingModeRequested', () => {
      it('should create event with correct properties', () => {
        const event = new TrainingModeRequested(mockWebsite, mockCorrelationId);
        
        expect(event.eventType).toBe('TrainingModeRequested');
        expect(event.website).toBe(mockWebsite);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('TrainingModeEnabled', () => {
      it('should create event with correct properties', () => {
        const event = new TrainingModeEnabled(mockSessionId, mockWebsite, mockCorrelationId);
        
        expect(event.eventType).toBe('TrainingModeEnabled');
        expect(event.sessionId).toBe(mockSessionId);
        expect(event.website).toBe(mockWebsite);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('TrainingModeDisabled', () => {
      it('should create event with correct properties', () => {
        const reason = 'User requested';
        const event = new TrainingModeDisabled(mockSessionId, reason, mockCorrelationId);
        
        expect(event.eventType).toBe('TrainingModeDisabled');
        expect(event.sessionId).toBe(mockSessionId);
        expect(event.reason).toBe(reason);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('Element Selection Events', () => {
    describe('ElementSelectionRequested', () => {
      it('should create event with correct properties', () => {
        const messageType = 'click';
        const elementDescription = 'Submit button';
        const event = new ElementSelectionRequested(messageType, elementDescription, mockContext, mockCorrelationId);
        
        expect(event.eventType).toBe('ElementSelectionRequested');
        expect(event.messageType).toBe(messageType);
        expect(event.elementDescription).toBe(elementDescription);
        expect(event.context).toBe(mockContext);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('ElementSelected', () => {
      it('should create event with correct properties', () => {
        const selector = 'button.submit';
        const messageType = 'click';
        const event = new ElementSelected(mockElement, selector, messageType, mockContext, mockCorrelationId);
        
        expect(event.eventType).toBe('ElementSelected');
        expect(event.element).toBe(mockElement);
        expect(event.selector).toBe(selector);
        expect(event.messageType).toBe(messageType);
        expect(event.context).toBe(mockContext);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('ElementSelectionFailed', () => {
      it('should create event with correct properties', () => {
        const reason = 'Element not found';
        const messageType = 'click';
        const event = new ElementSelectionFailed(reason, messageType, mockCorrelationId);
        
        expect(event.eventType).toBe('ElementSelectionFailed');
        expect(event.reason).toBe(reason);
        expect(event.messageType).toBe(messageType);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('Pattern Learning Events', () => {
    describe('PatternLearningRequested', () => {
      it('should create event with correct properties', () => {
        const messageType = 'click';
        const payload = { action: 'submit' };
        const selector = 'button.submit';
        const event = new PatternLearningRequested(messageType, payload, selector, mockContext, mockCorrelationId);
        
        expect(event.eventType).toBe('PatternLearningRequested');
        expect(event.messageType).toBe(messageType);
        expect(event.payload).toBe(payload);
        expect(event.selector).toBe(selector);
        expect(event.context).toBe(mockContext);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('PatternLearned', () => {
      it('should create event with correct properties', () => {
        const event = new PatternLearned(mockPatternData, mockCorrelationId);
        
        expect(event.eventType).toBe('PatternLearned');
        expect(event.pattern).toBe(mockPatternData);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('PatternLearningFailed', () => {
      it('should create event with correct properties', () => {
        const reason = 'Invalid selector';
        const messageType = 'click';
        const event = new PatternLearningFailed(reason, messageType, mockCorrelationId);
        
        expect(event.eventType).toBe('PatternLearningFailed');
        expect(event.reason).toBe(reason);
        expect(event.messageType).toBe(messageType);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('Pattern Execution Events', () => {
    describe('AutomationPatternMatched', () => {
      it('should create event with correct properties', () => {
        const confidence = 0.95;
        const event = new AutomationPatternMatched(mockPatternData, mockRequest, confidence, mockCorrelationId);
        
        expect(event.eventType).toBe('AutomationPatternMatched');
        expect(event.pattern).toBe(mockPatternData);
        expect(event.request).toBe(mockRequest);
        expect(event.confidence).toBe(confidence);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('AutomationPatternExecuted', () => {
      it('should create event with correct properties', () => {
        const patternId = 'pattern-123';
        const event = new AutomationPatternExecuted(patternId, mockExecutionResult, mockCorrelationId);
        
        expect(event.eventType).toBe('AutomationPatternExecuted');
        expect(event.patternId).toBe(patternId);
        expect(event.executionResult).toBe(mockExecutionResult);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('PatternExecutionFailed', () => {
      it('should create event with correct properties', () => {
        const patternId = 'pattern-123';
        const reason = 'Element not found';
        const event = new PatternExecutionFailed(patternId, reason, mockCorrelationId);
        
        expect(event.eventType).toBe('PatternExecutionFailed');
        expect(event.patternId).toBe(patternId);
        expect(event.reason).toBe(reason);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('Training Session Events', () => {
    describe('TrainingSessionStarted', () => {
      it('should create event with correct properties', () => {
        const event = new TrainingSessionStarted(mockSessionId, mockWebsite, mockCorrelationId);
        
        expect(event.eventType).toBe('TrainingSessionStarted');
        expect(event.sessionId).toBe(mockSessionId);
        expect(event.website).toBe(mockWebsite);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('TrainingSessionEnded', () => {
      it('should create event with correct properties', () => {
        const duration = 3600000; // 1 hour
        const patternsLearned = 5;
        const event = new TrainingSessionEnded(mockSessionId, duration, patternsLearned, mockCorrelationId);
        
        expect(event.eventType).toBe('TrainingSessionEnded');
        expect(event.sessionId).toBe(mockSessionId);
        expect(event.duration).toBe(duration);
        expect(event.patternsLearned).toBe(patternsLearned);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('User Guidance Events', () => {
    describe('UserGuidanceDisplayed', () => {
      it('should create event with correct properties', () => {
        const event = new UserGuidanceDisplayed(mockGuidanceData, mockCorrelationId);
        
        expect(event.eventType).toBe('UserGuidanceDisplayed');
        expect(event.guidance).toBe(mockGuidanceData);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('UserActionConfirmed', () => {
      it('should create event with correct properties', () => {
        const action = 'click';
        const elementSelector = 'button.submit';
        const event = new UserActionConfirmed(action, elementSelector, mockCorrelationId);
        
        expect(event.eventType).toBe('UserActionConfirmed');
        expect(event.action).toBe(action);
        expect(event.elementSelector).toBe(elementSelector);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
    
    describe('UserActionCancelled', () => {
      it('should create event with correct properties', () => {
        const action = 'click';
        const reason = 'User cancelled';
        const event = new UserActionCancelled(action, reason, mockCorrelationId);
        
        expect(event.eventType).toBe('UserActionCancelled');
        expect(event.action).toBe(action);
        expect(event.reason).toBe(reason);
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
  
  describe('Supporting Types', () => {
    it('should create valid ExecutionContext', () => {
      const context: ExecutionContext = {
        url: 'https://example.com/test',
        hostname: 'example.com',
        pathname: '/test',
        title: 'Test Page',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      };
      
      expect(context.url).toBe('https://example.com/test');
      expect(context.hostname).toBe('example.com');
      expect(context.pathname).toBe('/test');
      expect(context.title).toBe('Test Page');
      expect(context.timestamp).toBeInstanceOf(Date);
      expect(context.pageStructureHash).toBe('abc123');
    });
    
    it('should create valid AutomationPatternData', () => {
      const pattern: AutomationPatternData = mockPatternData;
      
      expect(pattern.id).toBe('pattern-123');
      expect(pattern.messageType).toBe('click');
      expect(pattern.payload).toEqual({ action: 'submit' });
      expect(pattern.selector).toBe('button.submit');
      expect(pattern.context).toBe(mockContext);
      expect(pattern.confidence).toBe(0.95);
      expect(pattern.usageCount).toBe(10);
      expect(pattern.successfulExecutions).toBe(9);
    });
    
    it('should create valid AutomationRequest', () => {
      const request: AutomationRequest = mockRequest;
      
      expect(request.messageType).toBe('click');
      expect(request.payload).toEqual({ action: 'submit' });
      expect(request.context).toBe(mockContext);
    });
    
    it('should create valid ExecutionResult', () => {
      const result: ExecutionResult = mockExecutionResult;
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ result: 'completed' });
      expect(result.timestamp).toBeInstanceOf(Date);
    });
    
    it('should create valid UserGuidanceData', () => {
      const guidance: UserGuidanceData = mockGuidanceData;
      
      expect(guidance.messageType).toBe('click');
      expect(guidance.elementDescription).toBe('Submit button');
      expect(guidance.instructions).toBe('Click on the submit button');
      expect(guidance.overlayType).toBe('prompt');
    });
  });
  
  describe('Event Union Type', () => {
    it('should accept all event types in union', () => {
      const events: TrainingDomainEvent[] = [
        new TrainingModeRequested(mockWebsite, mockCorrelationId),
        new TrainingModeEnabled(mockSessionId, mockWebsite, mockCorrelationId),
        new TrainingModeDisabled(mockSessionId, 'reason', mockCorrelationId),
        new ElementSelectionRequested('click', 'button', mockContext, mockCorrelationId),
        new ElementSelected(mockElement, 'button', 'click', mockContext, mockCorrelationId),
        new ElementSelectionFailed('reason', 'click', mockCorrelationId),
        new PatternLearningRequested('click', {}, 'button', mockContext, mockCorrelationId),
        new PatternLearned(mockPatternData, mockCorrelationId),
        new PatternLearningFailed('reason', 'click', mockCorrelationId),
        new AutomationPatternMatched(mockPatternData, mockRequest, 0.95, mockCorrelationId),
        new AutomationPatternExecuted('pattern-123', mockExecutionResult, mockCorrelationId),
        new PatternExecutionFailed('pattern-123', 'reason', mockCorrelationId),
        new TrainingSessionStarted(mockSessionId, mockWebsite, mockCorrelationId),
        new TrainingSessionEnded(mockSessionId, 3600000, 5, mockCorrelationId),
        new UserGuidanceDisplayed(mockGuidanceData, mockCorrelationId),
        new UserActionConfirmed('click', 'button', mockCorrelationId),
        new UserActionCancelled('click', 'reason', mockCorrelationId)
      ];
      
      expect(events).toHaveLength(17);
      events.forEach(event => {
        expect(event).toBeInstanceOf(DomainEvent);
        expect(event.eventType).toBeDefined();
        expect(event.correlationId).toBe(mockCorrelationId);
      });
    });
  });
});