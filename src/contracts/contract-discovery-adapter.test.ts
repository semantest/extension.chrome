/**
 * @fileoverview Unit tests for Contract Discovery Adapter
 * @description Tests for contract discovery and management API integration
 */

import { ContractDiscoveryAdapter, ContractsDiscoveredEvent } from './contract-discovery-adapter';
import { webBuddyStorage } from '../storage';

// Mock dependencies
jest.mock('../storage', () => ({
  webBuddyStorage: {
    saveDomainContract: jest.fn(),
    getDomainContracts: jest.fn()
  }
}));

// Mock Chrome APIs
const mockChrome = {
  runtime: {
    sendMessage: jest.fn(),
    onMessage: {
      addListener: jest.fn()
    }
  }
};
(global as any).chrome = mockChrome;

describe('ContractDiscoveryAdapter', () => {
  let adapter: ContractDiscoveryAdapter;
  let mockDocument: any;
  let mockWindow: any;

  // Mock contract for testing
  const mockContract = {
    version: '1.0.0',
    domain: 'example.com',
    title: 'Example Contract',
    description: 'Test contract',
    capabilities: {
      login: {
        type: 'action' as const,
        description: 'Login to the application',
        selector: '#login-button',
        parameters: [
          { name: 'username', type: 'string' as const, required: true },
          { name: 'password', type: 'string' as const, required: true }
        ]
      },
      search: {
        type: 'action' as const,
        description: 'Search for content',
        selector: 'input[type="search"]',
        parameters: [
          { name: 'query', type: 'string' as const, required: true }
        ]
      }
    }
  };

  beforeEach(() => {
    adapter = new ContractDiscoveryAdapter();
    
    // Mock DOM elements
    mockDocument = {
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      head: {
        querySelector: jest.fn(),
        querySelectorAll: jest.fn()
      }
    };
    
    // Mock window
    mockWindow = {
      location: {
        hostname: 'example.com',
        href: 'https://example.com/page'
      },
      dispatchEvent: jest.fn(),
      addEventListener: jest.fn(),
      postMessage: jest.fn(),
      MutationObserver: jest.fn(() => ({
        observe: jest.fn(),
        disconnect: jest.fn()
      }))
    };
    
    global.document = mockDocument as any;
    global.window = mockWindow as any;
    global.MutationObserver = mockWindow.MutationObserver;
    
    // Reset mocks
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('initialize', () => {
    test('initializes adapter successfully', async () => {
      await adapter.initialize();

      expect(console.log).toHaveBeenCalledWith('🔍 Initializing contract discovery adapter...');
      expect(console.log).toHaveBeenCalledWith('✅ Contract discovery adapter initialized');
      expect(mockWindow.MutationObserver).toHaveBeenCalled();
    });

    test('prevents double initialization', async () => {
      await adapter.initialize();
      jest.clearAllMocks();
      
      await adapter.initialize();
      
      expect(console.log).not.toHaveBeenCalledWith('🔍 Initializing contract discovery adapter...');
    });

    test('sets up DOM observer', async () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      mockWindow.MutationObserver.mockReturnValue(mockObserver);

      await adapter.initialize();

      expect(mockObserver.observe).toHaveBeenCalledWith(
        document,
        expect.objectContaining({
          childList: true,
          subtree: true,
          attributes: true
        })
      );
    });
  });

  describe('discoverContracts', () => {
    test('discovers contracts from meta tags', async () => {
      const mockMetaTag = {
        getAttribute: jest.fn((attr) => {
          if (attr === 'content') return JSON.stringify(mockContract);
          if (attr === 'name') return 'web-buddy:contract';
        })
      };
      
      mockDocument.head.querySelectorAll.mockReturnValue([mockMetaTag]);

      const contracts = await adapter.discoverContracts();

      expect(contracts).toHaveLength(1);
      expect(contracts[0]).toMatchObject(mockContract);
      expect(mockDocument.head.querySelectorAll).toHaveBeenCalledWith('meta[name^="web-buddy:"]');
    });

    test('discovers contracts from JSON-LD scripts', async () => {
      const mockScript = {
        type: 'application/ld+json',
        textContent: JSON.stringify({
          '@context': 'https://webbuddy.io/contract',
          '@type': 'WebBuddyContract',
          ...mockContract
        })
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockScript]);

      const contracts = await adapter.discoverContracts();

      expect(contracts.length).toBeGreaterThan(0);
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('script[type="application/ld+json"]');
    });

    test('discovers contracts from custom elements', async () => {
      const mockElement = {
        tagName: 'WEB-BUDDY-CONTRACT',
        getAttribute: jest.fn((attr) => {
          if (attr === 'contract') return JSON.stringify(mockContract);
        })
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);

      const contracts = await adapter.discoverContracts();

      expect(contracts.length).toBeGreaterThan(0);
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('web-buddy-contract');
    });

    test('discovers contracts from data attributes', async () => {
      const mockElement = {
        dataset: {
          webBuddyContract: JSON.stringify(mockContract)
        }
      };
      
      mockDocument.querySelectorAll.mockReturnValue([mockElement]);

      const contracts = await adapter.discoverContracts();

      expect(contracts.length).toBeGreaterThan(0);
      expect(mockDocument.querySelectorAll).toHaveBeenCalledWith('[data-web-buddy-contract]');
    });

    test('emits discovery event when contracts found', async () => {
      mockDocument.head.querySelectorAll.mockReturnValue([{
        getAttribute: jest.fn(() => JSON.stringify(mockContract))
      }]);

      await adapter.discoverContracts();

      expect(mockWindow.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'web-buddy:contracts-discovered'
        })
      );
    });

    test('notifies background script of discovered contracts', async () => {
      mockDocument.head.querySelectorAll.mockReturnValue([{
        getAttribute: jest.fn(() => JSON.stringify(mockContract))
      }]);

      await adapter.discoverContracts();

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'contracts:discovered',
        contracts: expect.arrayContaining([expect.objectContaining(mockContract)]),
        url: 'https://example.com/page',
        timestamp: expect.any(String)
      });
    });

    test('handles discovery errors gracefully', async () => {
      mockDocument.head.querySelectorAll.mockImplementation(() => {
        throw new Error('DOM error');
      });

      const contracts = await adapter.discoverContracts();

      expect(contracts).toEqual([]);
      expect(console.error).toHaveBeenCalledWith('❌ Contract discovery failed:', expect.any(Error));
    });
  });

  describe('registerContract', () => {
    test('registers valid contract successfully', async () => {
      await adapter.registerContract(mockContract);

      expect(webBuddyStorage.saveDomainContract).toHaveBeenCalledWith(
        'example.com',
        expect.objectContaining({
          contractId: expect.any(String),
          contract: mockContract,
          discoveredAt: expect.any(String)
        })
      );
    });

    test('rejects invalid contracts', async () => {
      const invalidContract = {
        ...mockContract,
        version: undefined // Missing required field
      };

      await adapter.registerContract(invalidContract as any);

      expect(console.warn).toHaveBeenCalledWith(
        '⚠️ Contract validation failed:',
        expect.any(Array)
      );
      expect(webBuddyStorage.saveDomainContract).not.toHaveBeenCalled();
    });

    test('stores contract in memory cache', async () => {
      await adapter.registerContract(mockContract);

      const contracts = adapter.getContractsByDomain('example.com');
      expect(contracts).toHaveLength(1);
      expect(contracts[0]).toMatchObject(mockContract);
    });
  });

  describe('executeCapability', () => {
    beforeEach(() => {
      // Register contract first
      adapter['discoveredContracts'].set('test-contract-id', mockContract);
    });

    test('executes action capability successfully', async () => {
      const mockElement = {
        click: jest.fn(),
        value: '',
        dispatchEvent: jest.fn()
      };
      mockDocument.querySelector.mockReturnValue(mockElement);

      const result = await adapter.executeCapability('test-contract-id', 'login', {
        username: 'testuser',
        password: 'testpass'
      });

      expect(result).toBeDefined();
      expect(mockDocument.querySelector).toHaveBeenCalledWith('#login-button');
    });

    test('executes query capability', async () => {
      const mockSearchInput = {
        value: '',
        dispatchEvent: jest.fn()
      };
      mockDocument.querySelector.mockReturnValue(mockSearchInput);

      await adapter.executeCapability('test-contract-id', 'search', {
        query: 'test search'
      });

      expect(mockSearchInput.value).toBe('test search');
      expect(mockSearchInput.dispatchEvent).toHaveBeenCalled();
    });

    test('handles missing capability', async () => {
      await expect(
        adapter.executeCapability('test-contract-id', 'nonexistent', {})
      ).rejects.toThrow('Capability not found: nonexistent');
    });

    test('handles missing contract', async () => {
      await expect(
        adapter.executeCapability('invalid-contract-id', 'login', {})
      ).rejects.toThrow('Contract not found: invalid-contract-id');
    });

    test('validates required parameters', async () => {
      await expect(
        adapter.executeCapability('test-contract-id', 'login', {
          username: 'testuser'
          // Missing required 'password' parameter
        })
      ).rejects.toThrow('Missing required parameter: password');
    });

    test('applies timeout to capability execution', async () => {
      const slowContract = {
        ...mockContract,
        capabilities: {
          slowAction: {
            type: 'action' as const,
            description: 'Slow action',
            selector: '#slow-button',
            timeout: 100 // 100ms timeout
          }
        }
      };
      
      adapter['discoveredContracts'].set('slow-contract', slowContract);
      
      // Mock element that never appears
      mockDocument.querySelector.mockReturnValue(null);

      await expect(
        adapter.executeCapability('slow-contract', 'slowAction', {})
      ).rejects.toThrow(expect.stringContaining('timeout'));
    });
  });

  describe('getContractsByDomain', () => {
    beforeEach(() => {
      adapter['discoveredContracts'].set('contract1', mockContract);
      adapter['discoveredContracts'].set('contract2', {
        ...mockContract,
        domain: 'other.com'
      });
      adapter['discoveredContracts'].set('contract3', {
        ...mockContract,
        domain: '*.example.com'
      });
    });

    test('returns contracts for exact domain match', () => {
      const contracts = adapter.getContractsByDomain('example.com');
      
      expect(contracts).toHaveLength(2); // Exact match + wildcard match
      expect(contracts[0].domain).toBe('example.com');
    });

    test('returns contracts for wildcard domain match', () => {
      const contracts = adapter.getContractsByDomain('sub.example.com');
      
      expect(contracts).toHaveLength(1);
      expect(contracts[0].domain).toBe('*.example.com');
    });

    test('returns empty array for no matches', () => {
      const contracts = adapter.getContractsByDomain('nomatch.com');
      
      expect(contracts).toEqual([]);
    });
  });

  describe('validateContract', () => {
    test('validates correct contract', () => {
      const result = adapter['validateContract'](mockContract);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    test('detects missing required fields', () => {
      const invalidContract = {
        domain: 'example.com',
        capabilities: {}
        // Missing version and title
      };

      const result = adapter['validateContract'](invalidContract as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: version');
      expect(result.errors).toContain('Missing required field: title');
    });

    test('validates capability structure', () => {
      const contractWithInvalidCapability = {
        ...mockContract,
        capabilities: {
          invalid: {
            // Missing required 'type' and 'description'
            selector: '#button'
          }
        }
      };

      const result = adapter['validateContract'](contractWithInvalidCapability as any);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid capability'));
    });

    test('validates parameter definitions', () => {
      const contractWithInvalidParam = {
        ...mockContract,
        capabilities: {
          action: {
            type: 'action' as const,
            description: 'Test action',
            selector: '#button',
            parameters: [
              {
                name: 'param1',
                type: 'invalid-type' as any,
                required: true
              }
            ]
          }
        }
      };

      const result = adapter['validateContract'](contractWithInvalidParam);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(expect.stringContaining('Invalid parameter type'));
    });
  });

  describe('message handling', () => {
    test('handles contract request messages', async () => {
      adapter['discoveredContracts'].set('contract1', mockContract);
      
      const mockSendResponse = jest.fn();
      const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      handler(
        { type: 'contracts:get', domain: 'example.com' },
        {},
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        contracts: [mockContract]
      });
    });

    test('handles capability execution messages', async () => {
      adapter['discoveredContracts'].set('contract1', mockContract);
      mockDocument.querySelector.mockReturnValue({ click: jest.fn() });
      
      const mockSendResponse = jest.fn();
      const handler = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];
      
      await handler(
        {
          type: 'contracts:execute',
          contractId: 'contract1',
          capability: 'login',
          parameters: { username: 'test', password: 'pass' }
        },
        {},
        mockSendResponse
      );

      expect(mockSendResponse).toHaveBeenCalledWith({
        success: true,
        result: expect.any(Object)
      });
    });
  });

  describe('DOM observation', () => {
    test('re-discovers contracts on DOM changes', async () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };
      mockWindow.MutationObserver.mockReturnValue(mockObserver);
      
      await adapter.initialize();
      
      // Get the mutation callback
      const mutationCallback = mockWindow.MutationObserver.mock.calls[0][0];
      
      // Simulate DOM mutation
      const mutations = [{
        type: 'childList',
        addedNodes: [{ nodeType: 1 }] // Element node
      }];
      
      jest.spyOn(adapter, 'discoverContracts');
      mutationCallback(mutations);
      
      // Should trigger contract discovery after debounce
      await new Promise(resolve => setTimeout(resolve, 600));
      
      expect(adapter.discoverContracts).toHaveBeenCalled();
    });
  });

  describe('getDiscoveredContracts', () => {
    test('returns all discovered contracts', () => {
      adapter['discoveredContracts'].set('contract1', mockContract);
      adapter['discoveredContracts'].set('contract2', {
        ...mockContract,
        domain: 'other.com'
      });

      const contracts = adapter.getDiscoveredContracts();
      
      expect(contracts).toHaveLength(2);
      expect(contracts).toContainEqual(mockContract);
    });
  });

  describe('ContractsDiscoveredEvent', () => {
    test('creates event with correct structure', () => {
      const contracts = [mockContract];
      const event = new ContractsDiscoveredEvent(contracts);

      expect(event.type).toBe('web-buddy:contracts-discovered');
      expect(event.detail).toEqual(contracts);
      expect(event.bubbles).toBe(true);
      expect(event.cancelable).toBe(false);
    });
  });
});