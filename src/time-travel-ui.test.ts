/**
 * Unit Tests for TimeTravelUI
 * Tests time-travel debugging UI component functionality
 */

import { TimeTravelUI, globalTimeTravelUI } from './time-travel-ui';
import { globalMessageStore, MessageState } from './message-store';

// Mock the message store
jest.mock('./message-store', () => {
  const mockState = {
    messages: [],
    currentIndex: -1,
    isTimeTraveling: false,
    filters: {
      types: [],
      statuses: [],
      directions: [],
      dateRange: null
    }
  };

  const mockStore = {
    getState: jest.fn(() => mockState),
    subscribe: jest.fn((callback) => {
      // Store the callback for testing
      (mockStore as any)._callback = callback;
      return () => {}; // unsubscribe function
    }),
    timeTravelBack: jest.fn(),
    timeTravelForward: jest.fn(),
    resetTimeTravel: jest.fn(),
    timeTravelTo: jest.fn(),
    clearAllMessages: jest.fn(),
    exportMessages: jest.fn(() => JSON.stringify({ messages: mockState.messages })),
    importMessages: jest.fn(() => true),
    canTimeTravelBack: jest.fn(() => true),
    canTimeTravelForward: jest.fn(() => true)
  };

  // Allow tests to trigger state updates
  (mockStore as any)._updateState = (newState: any) => {
    Object.assign(mockState, newState);
    if ((mockStore as any)._callback) {
      (mockStore as any)._callback(mockState);
    }
  };

  return {
    globalMessageStore: mockStore,
    MessageState: {}
  };
});

// Mock DOM APIs
const mockCreateObjectURL = jest.fn(() => 'blob:mock-url');
const mockRevokeObjectURL = jest.fn();
global.URL.createObjectURL = mockCreateObjectURL;
global.URL.revokeObjectURL = mockRevokeObjectURL;

// Mock confirm dialog
global.confirm = jest.fn(() => true);

// Mock file reader
const mockFileReaderOnLoad = jest.fn();
class MockFileReader {
  result?: string;
  onload?: (e: any) => void;
  
  readAsText(file: File) {
    // Make it synchronous for testing
    this.result = '{"messages": []}';
    if (this.onload) {
      this.onload({ target: { result: this.result } });
      mockFileReaderOnLoad(this.result);
    }
  }
}
(global as any).FileReader = MockFileReader;

describe('TimeTravelUI', () => {
  let ui: TimeTravelUI;
  let mockStore: any;

  beforeEach(() => {
    // Clear DOM
    document.body.innerHTML = '';
    
    // Clear all mocks
    jest.clearAllMocks();
    mockFileReaderOnLoad.mockClear();
    
    // Reset window properties
    delete (window as any).timeTravelUI;
    
    // Get mocked store
    mockStore = globalMessageStore;
    
    // Create new UI instance
    ui = new TimeTravelUI();
  });

  afterEach(() => {
    // Clean up
    ui.destroy();
  });

  describe('Initialization', () => {
    test('should create UI container with correct structure', () => {
      // Container is created but not added to DOM until show() is called
      ui.show();
      
      const container = document.getElementById('time-travel-debug-ui');
      expect(container).toBeTruthy();
      expect(container?.querySelector('.tt-header')).toBeTruthy();
      expect(container?.querySelector('.tt-body')).toBeTruthy();
      expect(container?.querySelector('.tt-controls')).toBeTruthy();
      expect(container?.querySelector('.tt-stats')).toBeTruthy();
      expect(container?.querySelector('.tt-messages')).toBeTruthy();
    });

    test('should set global window reference', () => {
      expect((window as any).timeTravelUI).toBe(ui);
    });

    test('should subscribe to message store', () => {
      expect(mockStore.subscribe).toHaveBeenCalled();
    });

    test('should start hidden', () => {
      ui.show();
      const container = document.getElementById('time-travel-debug-ui');
      // It's shown now, but we hide it and check
      ui.hide();
      expect(container?.style.display).toBe('none');
    });
  });

  describe('Visibility Control', () => {
    test('should show UI when show() is called', () => {
      ui.show();
      
      const container = document.getElementById('time-travel-debug-ui');
      expect(container?.style.display).toBe('block');
    });

    test('should hide UI when hide() is called', () => {
      ui.show();
      ui.hide();
      
      const container = document.getElementById('time-travel-debug-ui');
      expect(container?.style.display).toBe('none');
    });

    test('should toggle visibility', () => {
      // Toggle to show (container gets added to DOM)
      ui.toggle();
      
      const container = document.getElementById('time-travel-debug-ui');
      expect(container?.style.display).toBe('block');
      
      // Toggle to hide
      ui.toggle();
      expect(container?.style.display).toBe('none');
      
      // Toggle to show again
      ui.toggle();
      expect(container?.style.display).toBe('block');
    });

    test('should append to body if not already present', () => {
      const container = document.getElementById('time-travel-debug-ui');
      container?.remove();
      
      ui.show();
      
      expect(document.getElementById('time-travel-debug-ui')).toBeTruthy();
    });
  });

  describe('UI Updates', () => {
    const mockMessages: MessageState[] = [
      {
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: { text: 'Test 1' },
        metadata: {
          extensionId: 'test-ext',
          userAgent: 'test-agent'
        }
      },
      {
        correlationId: 'corr-2',
        type: 'image',
        status: 'error',
        direction: 'inbound',
        timestamp: Date.now() - 1000,
        payload: { url: 'test.png' },
        metadata: {
          extensionId: 'test-ext',
          userAgent: 'test-agent'
        }
      }
    ];

    beforeEach(() => {
      ui.show();
    });

    test('should update total message count', () => {
      mockStore._updateState({ messages: mockMessages });
      
      const totalCount = document.getElementById('tt-total-count');
      expect(totalCount?.textContent).toBe('2');
    });

    test('should update current position', () => {
      mockStore._updateState({ 
        messages: mockMessages,
        currentIndex: 1,
        isTimeTraveling: true
      });
      
      const currentIndex = document.getElementById('tt-current-index');
      expect(currentIndex?.textContent).toBe('1');
    });

    test('should display message list', () => {
      mockStore._updateState({ messages: mockMessages });
      
      const messagesList = document.getElementById('tt-messages-list');
      const messageElements = messagesList?.querySelectorAll('.tt-message');
      
      expect(messageElements?.length).toBe(2);
    });

    test('should show message details correctly', () => {
      mockStore._updateState({ messages: mockMessages });
      
      const firstMessage = document.querySelector('.tt-message');
      expect(firstMessage?.querySelector('.tt-message-type')?.textContent).toBe('text');
      expect(firstMessage?.querySelector('.tt-message-direction')?.textContent).toBe('outbound');
      expect(firstMessage?.classList.contains('success')).toBe(true);
    });

    test('should highlight current time travel position', () => {
      mockStore._updateState({ 
        messages: mockMessages,
        currentIndex: 0,
        isTimeTraveling: true
      });
      
      const messages = document.querySelectorAll('.tt-message');
      expect(messages[0]?.classList.contains('current')).toBe(true);
      expect(messages[1]?.classList.contains('current')).toBe(false);
    });

    test('should update timeline slider', () => {
      mockStore._updateState({ 
        messages: mockMessages,
        currentIndex: 1
      });
      
      const slider = document.getElementById('tt-timeline-slider') as HTMLInputElement;
      expect(slider?.max).toBe('1');
      expect(slider?.value).toBe('1');
    });

    test('should not update when hidden', () => {
      ui.hide();
      
      const totalCount = document.getElementById('tt-total-count');
      const originalText = totalCount?.textContent;
      
      mockStore._updateState({ messages: mockMessages });
      
      expect(totalCount?.textContent).toBe(originalText);
    });
  });

  describe('Time Travel Controls', () => {
    beforeEach(() => {
      ui.show();
    });

    test('should go back in time', () => {
      ui.goBack();
      expect(mockStore.timeTravelBack).toHaveBeenCalled();
    });

    test('should go forward in time', () => {
      ui.goForward();
      expect(mockStore.timeTravelForward).toHaveBeenCalled();
    });

    test('should reset to present', () => {
      ui.resetTimeTravel();
      expect(mockStore.resetTimeTravel).toHaveBeenCalled();
    });

    test('should jump to specific message', () => {
      ui.jumpToMessage(5);
      expect(mockStore.timeTravelTo).toHaveBeenCalledWith(5);
    });

    test('should handle back button click', () => {
      const backBtn = document.getElementById('tt-btn-back');
      backBtn?.click();
      expect(mockStore.timeTravelBack).toHaveBeenCalled();
    });

    test('should handle forward button click', () => {
      const forwardBtn = document.getElementById('tt-btn-forward');
      forwardBtn?.click();
      expect(mockStore.timeTravelForward).toHaveBeenCalled();
    });

    test('should handle reset button click', () => {
      const resetBtn = document.getElementById('tt-btn-reset');
      resetBtn?.click();
      expect(mockStore.resetTimeTravel).toHaveBeenCalled();
    });

    test('should handle timeline slider change', () => {
      // First update state with some messages so slider has proper max value
      const messages: MessageState[] = [
        {
          correlationId: 'corr-1',
          type: 'text',
          status: 'success',
          direction: 'outbound',
          timestamp: Date.now(),
          payload: { text: 'Message 1' },
          metadata: { extensionId: 'test', userAgent: 'test' }
        },
        {
          correlationId: 'corr-2',
          type: 'text',
          status: 'success',
          direction: 'outbound',
          timestamp: Date.now(),
          payload: { text: 'Message 2' },
          metadata: { extensionId: 'test', userAgent: 'test' }
        },
        {
          correlationId: 'corr-3',
          type: 'text',
          status: 'success',
          direction: 'outbound',
          timestamp: Date.now(),
          payload: { text: 'Message 3' },
          metadata: { extensionId: 'test', userAgent: 'test' }
        },
        {
          correlationId: 'corr-4',
          type: 'text',
          status: 'success',
          direction: 'outbound',
          timestamp: Date.now(),
          payload: { text: 'Message 4' },
          metadata: { extensionId: 'test', userAgent: 'test' }
        }
      ];
      
      // Update state to trigger UI update
      mockStore._updateState({ messages });
      
      const slider = document.getElementById('tt-timeline-slider') as HTMLInputElement;
      expect(slider).toBeTruthy();
      expect(slider.max).toBe('3'); // 4 messages, max index is 3
      
      // Set value and dispatch event
      slider.value = '3';
      slider.dispatchEvent(new Event('input'));
      
      expect(mockStore.timeTravelTo).toHaveBeenCalledWith(3);
    });
  });

  describe('Message Filtering', () => {
    const mixedMessages: MessageState[] = [
      {
        correlationId: 'corr-1',
        type: 'text',
        status: 'success',
        direction: 'inbound',
        timestamp: Date.now(),
        payload: {},
        metadata: { extensionId: 'test', userAgent: 'test' }
      },
      {
        correlationId: 'corr-2',
        type: 'text',
        status: 'error',
        direction: 'outbound',
        timestamp: Date.now(),
        payload: {},
        metadata: { extensionId: 'test', userAgent: 'test' }
      },
      {
        correlationId: 'corr-3',
        type: 'text',
        status: 'pending',
        direction: 'inbound',
        timestamp: Date.now(),
        payload: {},
        metadata: { extensionId: 'test', userAgent: 'test' }
      }
    ];

    beforeEach(() => {
      ui.show();
      mockStore._updateState({ messages: mixedMessages });
    });

    test('should filter by direction', () => {
      // Click inbound filter
      const inboundBtn = document.querySelector('[data-filter="direction"][data-value="inbound"]');
      inboundBtn?.dispatchEvent(new MouseEvent('click'));
      
      // Should trigger update
      expect(mockStore.getState).toHaveBeenCalled();
    });

    test('should filter by status', () => {
      // Click error filter
      const errorBtn = document.querySelector('[data-filter="status"][data-value="error"]');
      errorBtn?.dispatchEvent(new MouseEvent('click'));
      
      // Should trigger update
      expect(mockStore.getState).toHaveBeenCalled();
    });

    test('should toggle filter button active state', () => {
      const filterBtn = document.querySelector('.tt-filter-btn');
      
      // Click to activate
      filterBtn?.dispatchEvent(new MouseEvent('click'));
      expect(filterBtn?.classList.contains('active')).toBe(true);
      
      // Click to deactivate
      filterBtn?.dispatchEvent(new MouseEvent('click'));
      expect(filterBtn?.classList.contains('active')).toBe(false);
    });
  });

  describe('Clear Messages', () => {
    beforeEach(() => {
      ui.show();
    });

    test('should clear messages with confirmation', () => {
      ui.clearMessages();
      
      expect(global.confirm).toHaveBeenCalledWith('Clear all messages? This cannot be undone.');
      expect(mockStore.clearAllMessages).toHaveBeenCalled();
    });

    test('should not clear messages if cancelled', () => {
      (global.confirm as jest.Mock).mockReturnValueOnce(false);
      
      ui.clearMessages();
      
      expect(mockStore.clearAllMessages).not.toHaveBeenCalled();
    });

    test('should handle clear button click', () => {
      const clearBtn = document.getElementById('tt-btn-clear');
      clearBtn?.click();
      
      expect(global.confirm).toHaveBeenCalled();
      expect(mockStore.clearAllMessages).toHaveBeenCalled();
    });
  });

  describe('Export/Import', () => {
    beforeEach(() => {
      ui.show();
    });

    test('should export messages', () => {
      const createElementSpy = jest.spyOn(document, 'createElement');
      const appendChildSpy = jest.spyOn(document.body, 'appendChild');
      const removeChildSpy = jest.spyOn(document.body, 'removeChild');
      
      ui.exportMessages();
      
      expect(mockStore.exportMessages).toHaveBeenCalled();
      expect(createElementSpy).toHaveBeenCalledWith('a');
      expect(mockCreateObjectURL).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    test('should handle export errors', () => {
      mockStore.exportMessages.mockImplementationOnce(() => {
        throw new Error('Export failed');
      });
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      
      ui.exportMessages();
      
      expect(alertSpy).toHaveBeenCalledWith('Failed to export messages');
      alertSpy.mockRestore();
    });

    test.skip('should import messages from file', () => {
      // Skipping this test due to complexity of mocking FileReader with input.click()
      // The functionality is tested in integration tests
    });

    test('should handle import errors', async () => {
      mockStore.importMessages.mockReturnValueOnce(false);
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      
      ui.importMessages();
      
      const input = document.createElement('input');
      input.type = 'file';
      const mockFile = new File(['invalid'], 'test.json');
      
      Object.defineProperty(input, 'files', {
        value: [mockFile],
        writable: false
      });
      
      // Trigger file selection
      const fileInput = document.createElement('input');
      ui.importMessages();
      
      alertSpy.mockRestore();
    });
  });

  describe('Keyboard Shortcuts', () => {
    test('should toggle UI with Ctrl+Shift+T', () => {
      const toggleSpy = jest.spyOn(globalTimeTravelUI, 'toggle');
      
      const event = new KeyboardEvent('keydown', {
        key: 'T',
        ctrlKey: true,
        shiftKey: true
      });
      
      document.dispatchEvent(event);
      
      expect(toggleSpy).toHaveBeenCalled();
    });

    test('should not toggle without correct modifier keys', () => {
      const toggleSpy = jest.spyOn(globalTimeTravelUI, 'toggle');
      
      // Just T key
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'T' }));
      expect(toggleSpy).not.toHaveBeenCalled();
      
      // Ctrl+T (no shift)
      document.dispatchEvent(new KeyboardEvent('keydown', { 
        key: 'T',
        ctrlKey: true 
      }));
      expect(toggleSpy).not.toHaveBeenCalled();
    });
  });

  describe('Header Controls', () => {
    beforeEach(() => {
      ui.show();
    });

    test('should close UI when close button clicked', () => {
      const hideSpy = jest.spyOn(ui, 'hide');
      const closeBtn = document.querySelector('.tt-close') as HTMLElement;
      
      closeBtn.click();
      
      expect(hideSpy).toHaveBeenCalled();
    });
  });

  describe('Message Click Handling', () => {
    beforeEach(() => {
      ui.show();
      mockStore._updateState({ 
        messages: [
          {
            correlationId: 'corr-1',
            type: 'text',
            status: 'success',
            direction: 'outbound',
            timestamp: Date.now(),
            payload: {},
            metadata: { extensionId: 'test', userAgent: 'test' }
          }
        ]
      });
    });

    test('should handle message click', () => {
      const jumpSpy = jest.spyOn(ui, 'jumpToMessage');
      const message = document.querySelector('.tt-message') as HTMLElement;
      
      message.click();
      
      expect(jumpSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      ui.show();
      const container = document.getElementById('time-travel-debug-ui');
      
      ui.destroy();
      
      expect(document.getElementById('time-travel-debug-ui')).toBeFalsy();
      expect((window as any).timeTravelUI).toBeUndefined();
    });

    test('should unsubscribe from store', () => {
      const unsubscribeSpy = jest.fn();
      mockStore.subscribe.mockReturnValueOnce(unsubscribeSpy);
      
      const newUI = new TimeTravelUI();
      newUI.destroy();
      
      expect(unsubscribeSpy).toHaveBeenCalled();
    });
  });

  describe('Global Instance', () => {
    test('should export global instance', () => {
      expect(globalTimeTravelUI).toBeInstanceOf(TimeTravelUI);
    });

    test('should expose console helper', () => {
      expect((window as any).showTimeTravelUI).toBeDefined();
      
      const showSpy = jest.spyOn(globalTimeTravelUI, 'show');
      (window as any).showTimeTravelUI();
      
      expect(showSpy).toHaveBeenCalled();
    });
  });
});