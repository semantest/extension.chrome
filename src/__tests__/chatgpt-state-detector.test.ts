/**
 * @fileoverview Tests for ChatGPT idle/busy state detection using MutationObserver
 * @author Wences
 * @description TDD test suite for detecting when ChatGPT is ready to receive messages
 */

import { ChatGPTStateDetector, ChatGPTState } from '../chatgpt-state-detector';

describe('ChatGPTStateDetector', () => {
  let detector: ChatGPTStateDetector;
  let mockDocument: Document;
  let mockTextarea: HTMLTextAreaElement;
  let mockSendButton: HTMLButtonElement;
  let mockSpinnerDiv: HTMLDivElement;
  let mockObserverCallback: jest.Mock;
  
  // Mock MutationObserver
  const MockMutationObserver = jest.fn().mockImplementation(function(callback) {
    mockObserverCallback = callback;
    return {
      observe: jest.fn(),
      disconnect: jest.fn(),
      takeRecords: jest.fn(() => [])
    };
  });
  
  beforeEach(() => {
    // Reset global MutationObserver
    global.MutationObserver = MockMutationObserver as any;
    
    // Mock window object for getComputedStyle
    global.window = {
      getComputedStyle: jest.fn(() => ({
        display: 'block',
        visibility: 'visible',
        opacity: '1'
      }))
    } as any;
    
    // Create mock DOM elements
    mockDocument = document.implementation.createHTMLDocument();
    
    // Create textarea element (ChatGPT's main input)
    mockTextarea = mockDocument.createElement('textarea');
    mockTextarea.setAttribute('data-id', 'root');
    mockTextarea.id = 'prompt-textarea';
    mockTextarea.disabled = false;
    
    // Create send button
    mockSendButton = mockDocument.createElement('button');
    mockSendButton.setAttribute('data-testid', 'send-button');
    mockSendButton.disabled = false;
    
    // Create spinner div (shown during API calls)
    mockSpinnerDiv = mockDocument.createElement('div');
    mockSpinnerDiv.className = 'spinner-container';
    mockSpinnerDiv.style.display = 'none';
    
    // Add elements to document
    mockDocument.body.appendChild(mockTextarea);
    mockDocument.body.appendChild(mockSendButton);
    mockDocument.body.appendChild(mockSpinnerDiv);
    
    // Mock getBoundingClientRect for all elements
    const mockRect = { width: 100, height: 50, top: 0, left: 0, bottom: 50, right: 100 };
    mockTextarea.getBoundingClientRect = jest.fn(() => mockRect as any);
    mockSendButton.getBoundingClientRect = jest.fn(() => mockRect as any);
    mockSpinnerDiv.getBoundingClientRect = jest.fn(() => mockRect as any);
    
    // Initialize detector
    detector = new ChatGPTStateDetector(mockDocument);
  });
  
  afterEach(() => {
    detector.destroy();
    jest.clearAllMocks();
  });
  
  describe('Initialization', () => {
    it('should initialize with UNKNOWN state', () => {
      expect(detector.getState()).toBe(ChatGPTState.UNKNOWN);
    });
    
    it('should create MutationObserver on initialization', () => {
      detector.initialize();
      expect(MockMutationObserver).toHaveBeenCalled();
    });
    
    it('should observe document.body for mutations', () => {
      detector.initialize();
      const observer = MockMutationObserver.mock.results[0].value;
      expect(observer.observe).toHaveBeenCalledWith(
        mockDocument.body,
        expect.objectContaining({
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['disabled', 'style', 'class']
        })
      );
    });
  });
  
  describe('Textarea State Detection', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should detect IDLE when textarea is enabled and no spinner', () => {
      mockTextarea.disabled = false;
      mockSpinnerDiv.style.display = 'none';
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
    
    it('should detect BUSY when textarea is disabled', () => {
      mockTextarea.disabled = true;
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
    
    it('should handle readonly attribute changes', () => {
      mockTextarea.readOnly = true;
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'readonly'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
  });
  
  describe('Spinner Detection', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should detect BUSY when spinner is visible', () => {
      mockSpinnerDiv.style.display = 'block';
      
      const mutations = [{
        type: 'attributes',
        target: mockSpinnerDiv,
        attributeName: 'style'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
    
    it('should detect spinner with various display values', () => {
      ['flex', 'inline-block', 'inline-flex', 'grid'].forEach(displayValue => {
        mockSpinnerDiv.style.display = displayValue;
        
        const mutations = [{
          type: 'attributes',
          target: mockSpinnerDiv,
          attributeName: 'style'
        }];
        
        mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
        
        expect(detector.getState()).toBe(ChatGPTState.BUSY);
      });
    });
    
    it('should detect IDLE when spinner is hidden', () => {
      mockTextarea.disabled = false;
      mockSpinnerDiv.style.display = 'none';
      
      const mutations = [{
        type: 'attributes',
        target: mockSpinnerDiv,
        attributeName: 'style'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
    
    it('should detect spinner by className changes', () => {
      mockSpinnerDiv.classList.add('animate-spin');
      
      const mutations = [{
        type: 'attributes',
        target: mockSpinnerDiv,
        attributeName: 'class'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
  });
  
  describe('Send Button Detection', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should detect IDLE when send button is enabled', () => {
      mockTextarea.disabled = false;
      mockSendButton.disabled = false;
      mockSpinnerDiv.style.display = 'none';
      
      const mutations = [{
        type: 'attributes',
        target: mockSendButton,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
    
    it('should detect BUSY when send button is disabled', () => {
      mockSendButton.disabled = true;
      
      const mutations = [{
        type: 'attributes',
        target: mockSendButton,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
  });
  
  describe('Complex State Scenarios', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should handle multiple simultaneous mutations', () => {
      mockTextarea.disabled = false;
      mockSendButton.disabled = false;
      mockSpinnerDiv.style.display = 'none';
      
      const mutations = [
        { type: 'attributes', target: mockTextarea, attributeName: 'disabled' },
        { type: 'attributes', target: mockSendButton, attributeName: 'disabled' },
        { type: 'attributes', target: mockSpinnerDiv, attributeName: 'style' }
      ];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
    
    it('should prioritize spinner visibility over other indicators', () => {
      mockTextarea.disabled = false;
      mockSendButton.disabled = false;
      mockSpinnerDiv.style.display = 'block'; // Spinner visible
      
      const mutations = [
        { type: 'attributes', target: mockTextarea, attributeName: 'disabled' },
        { type: 'attributes', target: mockSpinnerDiv, attributeName: 'style' }
      ];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
    
    it('should handle DOM node additions for late-loading elements', () => {
      const newSpinner = mockDocument.createElement('div');
      newSpinner.className = 'result-streaming';
      mockDocument.body.appendChild(newSpinner);
      
      const mutations = [{
        type: 'childList',
        addedNodes: [newSpinner] as any,
        target: mockDocument.body
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
  });
  
  describe('State Change Callbacks', () => {
    let stateChangeCallback: jest.Mock;
    
    beforeEach(() => {
      stateChangeCallback = jest.fn();
      detector = new ChatGPTStateDetector(mockDocument, stateChangeCallback);
      detector.initialize();
    });
    
    it('should trigger callback on state change', () => {
      mockTextarea.disabled = true;
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(stateChangeCallback).toHaveBeenCalledWith(
        ChatGPTState.BUSY,
        ChatGPTState.UNKNOWN
      );
    });
    
    it('should not trigger callback if state unchanged', () => {
      // Set initial state to BUSY
      mockTextarea.disabled = true;
      const mutations1 = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      mockObserverCallback(mutations1, MockMutationObserver.mock.results[0].value);
      
      stateChangeCallback.mockClear();
      
      // Trigger another mutation that keeps state as BUSY
      mockSendButton.disabled = true;
      const mutations2 = [{
        type: 'attributes',
        target: mockSendButton,
        attributeName: 'disabled'
      }];
      mockObserverCallback(mutations2, MockMutationObserver.mock.results[0].value);
      
      expect(stateChangeCallback).not.toHaveBeenCalled();
    });
  });
  
  describe('Wait for Idle', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should resolve immediately if already idle', async () => {
      mockTextarea.disabled = false;
      mockSpinnerDiv.style.display = 'none';
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      const startTime = Date.now();
      await detector.waitForIdle();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(10);
    });
    
    it('should wait until idle state is reached', async () => {
      mockTextarea.disabled = true;
      
      const mutations1 = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      mockObserverCallback(mutations1, MockMutationObserver.mock.results[0].value);
      
      const idlePromise = detector.waitForIdle();
      
      // Simulate becoming idle after 100ms
      setTimeout(() => {
        mockTextarea.disabled = false;
        mockSpinnerDiv.style.display = 'none';
        
        const mutations2 = [{
          type: 'attributes',
          target: mockTextarea,
          attributeName: 'disabled'
        }];
        mockObserverCallback(mutations2, MockMutationObserver.mock.results[0].value);
      }, 100);
      
      await idlePromise;
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
    
    it('should timeout after specified duration', async () => {
      mockTextarea.disabled = true;
      
      const mutations = [{
        type: 'attributes',
        target: mockTextarea,
        attributeName: 'disabled'
      }];
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      await expect(detector.waitForIdle(100)).rejects.toThrow('Timeout waiting for idle state');
    });
  });
  
  describe('Cleanup', () => {
    it('should disconnect observer on destroy', () => {
      detector.initialize();
      const observer = MockMutationObserver.mock.results[0].value;
      
      detector.destroy();
      
      expect(observer.disconnect).toHaveBeenCalled();
    });
    
    it('should handle multiple destroy calls gracefully', () => {
      detector.initialize();
      
      expect(() => {
        detector.destroy();
        detector.destroy();
      }).not.toThrow();
    });
  });
  
  describe('Edge Cases', () => {
    beforeEach(() => {
      detector.initialize();
    });
    
    it('should handle missing elements gracefully', () => {
      mockDocument.body.removeChild(mockTextarea);
      
      const mutations = [{
        type: 'childList',
        removedNodes: [mockTextarea] as any,
        target: mockDocument.body
      }];
      
      expect(() => {
        mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      }).not.toThrow();
    });
    
    it('should detect alternative spinner selectors', () => {
      const altSpinner = mockDocument.createElement('div');
      altSpinner.setAttribute('data-testid', 'loading-spinner');
      mockDocument.body.appendChild(altSpinner);
      
      const mutations = [{
        type: 'childList',
        addedNodes: [altSpinner] as any,
        target: mockDocument.body
      }];
      
      mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      
      expect(detector.getState()).toBe(ChatGPTState.BUSY);
    });
    
    it('should handle rapid state changes', () => {
      const rapidChanges = [
        () => { mockTextarea.disabled = true; },
        () => { mockTextarea.disabled = false; },
        () => { mockSpinnerDiv.style.display = 'block'; },
        () => { mockSpinnerDiv.style.display = 'none'; },
        () => { mockSendButton.disabled = true; },
        () => { mockSendButton.disabled = false; }
      ];
      
      rapidChanges.forEach(change => {
        change();
        const mutations = [{
          type: 'attributes',
          target: mockTextarea,
          attributeName: 'disabled'
        }];
        mockObserverCallback(mutations, MockMutationObserver.mock.results[0].value);
      });
      
      // Final state should be IDLE
      expect(detector.getState()).toBe(ChatGPTState.IDLE);
    });
  });
});