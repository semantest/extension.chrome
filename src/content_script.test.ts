/**
 * @jest-environment jsdom
 */

// Mock dependencies before imports
jest.mock('./storage', () => ({
  webBuddyStorage: {
    saveAutomationPattern: jest.fn().mockResolvedValue('pattern-123'),
    getAutomationPatterns: jest.fn().mockResolvedValue([]),
    saveUserInteraction: jest.fn().mockResolvedValue('interaction-123'),
    getStorageStats: jest.fn().mockResolvedValue({
      automationPatterns: 10,
      userInteractions: 50,
      websiteConfigs: 5
    }),
    clearOldData: jest.fn().mockResolvedValue(undefined)
  },
  AutomationPattern: {},
  UserInteraction: {}
}));

jest.mock('./contracts/contract-discovery-adapter', () => ({
  contractDiscovery: {
    initialize: jest.fn().mockResolvedValue(undefined),
    discoverContracts: jest.fn().mockResolvedValue([
      { id: 'contract-1', name: 'Test Contract' }
    ])
  }
}));

jest.mock('./contracts/contract-execution-service', () => ({
  contractExecution: {
    executeWithContract: jest.fn(),
    checkContractAvailability: jest.fn().mockResolvedValue({
      available: true,
      contracts: ['contract-1']
    }),
    getAvailableActions: jest.fn().mockReturnValue(['click', 'fill', 'extract']),
    getContractRecommendations: jest.fn().mockReturnValue([
      { contractId: 'contract-1', confidence: 0.9 }
    ])
  }
}));

import './content_script';
import { webBuddyStorage } from './storage';
import { contractDiscovery } from './contracts/contract-discovery-adapter';
import { contractExecution } from './contracts/contract-execution-service';

// Mock chrome APIs
const mockRuntime = {
  onMessage: {
    addListener: jest.fn()
  },
  sendMessage: jest.fn()
};

global.chrome = {
  runtime: mockRuntime
} as any;

// Mock window properties
Object.defineProperty(window, 'location', {
  value: {
    hostname: 'example.com',
    href: 'https://example.com/test',
    pathname: '/test'
  },
  writable: true
});

describe('Content Script', () => {
  let messageListener: any;
  let sendResponse: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Capture message listener
    messageListener = mockRuntime.onMessage.addListener.mock.calls[0]?.[0];
    sendResponse = jest.fn();
    
    // Reset test data
    (window as any).extensionTestData = {
      lastReceivedMessage: null,
      lastResponse: null,
      webSocketMessages: []
    };

    // Set up DOM
    document.body.innerHTML = `
      <input id="test-input" type="text" />
      <textarea id="test-textarea"></textarea>
      <button id="test-button">Click me</button>
      <div id="test-div">Test content</div>
      <a id="test-link" href="https://example.com">Test link</a>
    `;

    // Mock document properties
    Object.defineProperty(document, 'title', {
      value: 'Test Page',
      writable: true
    });
  });

  describe('Initialization', () => {
    it('should initialize contract discovery system', () => {
      expect(contractDiscovery.initialize).toHaveBeenCalled();
    });

    it('should send content script ready message', () => {
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({
        type: 'CONTENT_SCRIPT_READY',
        url: 'https://example.com/test',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Automation Request Handling', () => {
    describe('fillInput action', () => {
      it('should fill input element successfully', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'test-123',
          payload: {
            action: 'fillInput',
            parameters: {
              selector: '#test-input',
              value: 'test value'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        const input = document.querySelector('#test-input') as HTMLInputElement;
        expect(input.value).toBe('test value');
        
        expect(sendResponse).toHaveBeenCalledWith({
          correlationId: 'test-123',
          status: 'success',
          data: {
            action: 'fillInput',
            selector: '#test-input',
            value: 'test value',
            elementTag: 'input',
            oldValue: ''
          },
          timestamp: expect.any(String)
        });

        expect(webBuddyStorage.saveUserInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'fillInput',
            success: true
          })
        );
      });

      it('should handle textarea elements', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'test-456',
          payload: {
            action: 'fillInput',
            parameters: {
              selector: '#test-textarea',
              value: 'multiline\ntext'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        const textarea = document.querySelector('#test-textarea') as HTMLTextAreaElement;
        expect(textarea.value).toBe('multiline\ntext');
        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'success'
          })
        );
      });

      it('should error when element not found', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'test-789',
          payload: {
            action: 'fillInput',
            parameters: {
              selector: '#non-existent',
              value: 'test'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith({
          correlationId: 'test-789',
          status: 'error',
          error: 'Element not found: #non-existent',
          timestamp: expect.any(String)
        });

        expect(webBuddyStorage.saveUserInteraction).toHaveBeenCalledWith(
          expect.objectContaining({
            eventType: 'fillInput',
            success: false,
            context: expect.objectContaining({
              error: 'Element not found'
            })
          })
        );
      });

      it('should error when element is not input or textarea', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'test-invalid',
          payload: {
            action: 'fillInput',
            parameters: {
              selector: '#test-div',
              value: 'test'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'error',
            error: 'Element is not an input or textarea: #test-div'
          })
        );
      });
    });

    describe('clickElement action', () => {
      it('should click element successfully', async () => {
        const button = document.querySelector('#test-button') as HTMLButtonElement;
        button.click = jest.fn();

        const message = {
          type: 'automationRequested',
          correlationId: 'click-123',
          payload: {
            action: 'clickElement',
            parameters: {
              selector: '#test-button'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(button.click).toHaveBeenCalled();
        expect(sendResponse).toHaveBeenCalledWith({
          correlationId: 'click-123',
          status: 'success',
          data: {
            action: 'clickElement',
            selector: '#test-button',
            elementTag: 'button',
            elementInfo: expect.objectContaining({
              tag: 'button',
              text: 'Click me'
            })
          },
          timestamp: expect.any(String)
        });
      });

      it('should capture link href when clicking anchor', async () => {
        const link = document.querySelector('#test-link') as HTMLAnchorElement;
        link.click = jest.fn();

        const message = {
          type: 'automationRequested',
          correlationId: 'click-link',
          payload: {
            action: 'clickElement',
            parameters: {
              selector: '#test-link'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              elementInfo: expect.objectContaining({
                href: 'https://example.com/'
              })
            })
          })
        );
      });
    });

    describe('getText action', () => {
      it('should get element text successfully', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'text-123',
          payload: {
            action: 'getText',
            parameters: {
              selector: '#test-div'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith({
          correlationId: 'text-123',
          status: 'success',
          data: {
            action: 'getText',
            selector: '#test-div',
            text: 'Test content',
            elementTag: 'div'
          },
          timestamp: expect.any(String)
        });
      });
    });

    describe('testAction', () => {
      it('should handle test action', async () => {
        const message = {
          type: 'automationRequested',
          correlationId: 'test-action',
          payload: {
            action: 'testAction',
            parameters: {
              message: 'Custom test message'
            }
          }
        };

        await messageListener(message, {}, sendResponse);

        expect(sendResponse).toHaveBeenCalledWith({
          correlationId: 'test-action',
          status: 'success',
          data: {
            action: 'testAction',
            message: 'Custom test message',
            timestamp: expect.any(String),
            url: 'https://example.com/test',
            title: 'Test Page'
          },
          timestamp: expect.any(String)
        });
      });
    });
  });

  describe('Contract-based Execution', () => {
    it('should try contract execution first', async () => {
      (contractExecution.executeWithContract as jest.Mock).mockResolvedValue({
        success: true,
        data: { result: 'contract success' },
        contractId: 'contract-1',
        capabilityName: 'click',
        timestamp: new Date().toISOString()
      });

      const message = {
        type: 'automationRequested',
        correlationId: 'contract-test',
        payload: {
          action: 'clickElement',
          parameters: { selector: '#test-button' }
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(contractExecution.executeWithContract).toHaveBeenCalledWith({
        action: 'clickElement',
        parameters: { selector: '#test-button' },
        domain: 'example.com'
      });

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            executionMethod: 'contract',
            contractId: 'contract-1'
          })
        })
      );
    });

    it('should fall back to patterns when contract fails', async () => {
      (contractExecution.executeWithContract as jest.Mock).mockResolvedValue({
        success: false,
        error: 'Contract failed'
      });

      const button = document.querySelector('#test-button') as HTMLButtonElement;
      button.click = jest.fn();

      const message = {
        type: 'automationRequested',
        correlationId: 'fallback-test',
        payload: {
          action: 'clickElement',
          parameters: { selector: '#test-button' }
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(button.click).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            action: 'clickElement'
          })
        })
      );
    });
  });

  describe('Contract Discovery', () => {
    it('should handle contract discovery request', async () => {
      const message = {
        type: 'contractDiscoveryRequested',
        correlationId: 'discovery-123'
      };

      await messageListener(message, {}, sendResponse);

      expect(contractDiscovery.discoverContracts).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'discovery-123',
        status: 'success',
        data: {
          contracts: [{ id: 'contract-1', name: 'Test Contract' }],
          availability: { available: true, contracts: ['contract-1'] },
          availableActions: ['click', 'fill', 'extract'],
          url: 'https://example.com/test',
          domain: 'example.com'
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle contract availability check', async () => {
      const message = {
        type: 'contractAvailabilityCheck',
        correlationId: 'availability-123'
      };

      await messageListener(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'availability-123',
        status: 'success',
        data: {
          availability: { available: true, contracts: ['contract-1'] },
          recommendations: [{ contractId: 'contract-1', confidence: 0.9 }],
          url: 'https://example.com/test',
          domain: 'example.com'
        },
        timestamp: expect.any(String)
      });
    });
  });

  describe('Storage Requests', () => {
    it('should handle getStorageStats request', async () => {
      const message = {
        type: 'storageRequest',
        action: 'getStorageStats',
        correlationId: 'storage-stats'
      };

      await messageListener(message, {}, sendResponse);

      expect(webBuddyStorage.getStorageStats).toHaveBeenCalled();
      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'storage-stats',
        success: true,
        stats: {
          automationPatterns: 10,
          userInteractions: 50,
          websiteConfigs: 5
        },
        timestamp: expect.any(String)
      });
    });

    it('should handle getAutomationPatterns request', async () => {
      (webBuddyStorage.getAutomationPatterns as jest.Mock).mockResolvedValue([
        { id: 'pattern-1', action: 'click' }
      ]);

      const message = {
        type: 'storageRequest',
        action: 'getAutomationPatterns',
        correlationId: 'get-patterns',
        payload: { limit: 5 }
      };

      await messageListener(message, {}, sendResponse);

      expect(webBuddyStorage.getAutomationPatterns).toHaveBeenCalledWith({
        domain: 'example.com',
        limit: 5
      });
    });

    it('should handle clearOldData request', async () => {
      const message = {
        type: 'storageRequest',
        action: 'clearOldData',
        correlationId: 'clear-data',
        payload: { days: 7 }
      };

      await messageListener(message, {}, sendResponse);

      expect(webBuddyStorage.clearOldData).toHaveBeenCalledWith(7);
      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'clear-data',
        success: true,
        message: 'Cleared data older than 7 days',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Other Message Types', () => {
    it('should handle ping message', async () => {
      const message = {
        type: 'ping',
        correlationId: 'ping-123',
        payload: 'test ping'
      };

      await messageListener(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        type: 'pong',
        correlationId: 'ping-123',
        payload: {
          originalMessage: 'test ping',
          url: 'https://example.com/test',
          title: 'Test Page',
          timestamp: expect.any(String)
        }
      });
    });

    it('should handle legacy actions', async () => {
      const message = {
        action: 'legacyAction',
        correlationId: 'legacy-123'
      };

      await messageListener(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'legacy-123',
        status: 'success',
        data: 'Legacy action legacyAction executed successfully (placeholder)',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Pattern Persistence', () => {
    it('should persist successful automation patterns', async () => {
      const button = document.querySelector('#test-button') as HTMLButtonElement;
      button.click = jest.fn();

      const message = {
        type: 'automationRequested',
        correlationId: 'persist-test',
        payload: {
          action: 'clickElement',
          parameters: { selector: '#test-button' }
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(webBuddyStorage.saveAutomationPattern).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/test',
          domain: 'example.com',
          action: 'clickElement',
          selector: '#test-button',
          success: true
        })
      );
    });

    it('should not persist failed automation patterns', async () => {
      const message = {
        type: 'automationRequested',
        correlationId: 'fail-persist',
        payload: {
          action: 'clickElement',
          parameters: { selector: '#non-existent' }
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(webBuddyStorage.saveAutomationPattern).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown automation action', async () => {
      const message = {
        type: 'automationRequested',
        correlationId: 'unknown-action',
        payload: {
          action: 'unknownAction',
          parameters: {}
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'unknown-action',
        status: 'error',
        error: 'Unknown automation action: unknownAction',
        timestamp: expect.any(String)
      });
    });

    it('should handle contract execution errors', async () => {
      (contractExecution.executeWithContract as jest.Mock).mockRejectedValue(
        new Error('Contract error')
      );

      const message = {
        type: 'contractExecutionRequested',
        correlationId: 'contract-error',
        payload: {
          action: 'test',
          parameters: {}
        }
      };

      await messageListener(message, {}, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({
        correlationId: 'contract-error',
        status: 'error',
        error: 'Contract error',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Test Data Storage', () => {
    it('should store received messages for E2E testing', async () => {
      const message = {
        type: 'ping',
        correlationId: 'e2e-test'
      };

      await messageListener(message, {}, sendResponse);

      expect((window as any).extensionTestData.lastReceivedMessage).toEqual(message);
      expect((window as any).extensionTestData.lastResponse).toBeDefined();
    });
  });
});