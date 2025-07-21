/**
 * @fileoverview Unit tests for Contract Execution Service
 * @description Tests for API integration and contract-based automation
 */

import { ContractExecutionService, contractExecution } from './contract-execution-service';
import { contractDiscovery } from './contract-discovery-adapter';

// Mock the contract discovery adapter
jest.mock('./contract-discovery-adapter', () => ({
  contractDiscovery: {
    getContractsByDomain: jest.fn(),
    executeCapability: jest.fn(),
    getDiscoveredContracts: jest.fn()
  }
}));

describe('ContractExecutionService', () => {
  let service: ContractExecutionService;
  let mockWindow: any;

  // Mock contract data
  const mockContract = {
    title: 'ChatGPT Automation',
    domain: 'chatgpt.com',
    version: '1.0.0',
    capabilities: {
      createProject: {
        description: 'Create a new project in ChatGPT',
        method: 'dom',
        parameters: [
          { name: 'projectName', type: 'string', required: true }
        ]
      },
      sendPrompt: {
        description: 'Send a prompt to ChatGPT',
        method: 'dom',
        parameters: [
          { name: 'text', type: 'string', required: true },
          { name: 'wait', type: 'boolean', required: false }
        ]
      }
    }
  };

  beforeEach(() => {
    service = new ContractExecutionService();
    
    // Mock window.location
    mockWindow = {
      location: {
        hostname: 'chatgpt.com'
      }
    };
    global.window = mockWindow as any;
    
    // Reset all mocks
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('executeWithContract', () => {
    test('executes action successfully with valid contract', async () => {
      // Mock finding contracts
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockResolvedValue({ success: true, projectId: '123' });

      const params = {
        action: 'createProject',
        parameters: { projectName: 'Test Project' }
      };

      const result = await service.executeWithContract(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, projectId: '123' });
      expect(result.contractId).toBeDefined();
      expect(result.capabilityName).toBe('createProject');
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();

      // Verify contract discovery was called correctly
      expect(contractDiscovery.executeCapability).toHaveBeenCalledWith(
        expect.any(String), // contractId
        'createProject',
        { projectName: 'Test Project' }
      );
    });

    test('returns error when no suitable contracts found', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([]);

      const params = {
        action: 'nonExistentAction',
        parameters: {}
      };

      const result = await service.executeWithContract(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('No suitable contracts found');
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('tries next contract when first fails', async () => {
      const secondContract = {
        ...mockContract,
        title: 'ChatGPT Automation v2'
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract, secondContract]);
      
      // First call fails, second succeeds
      (contractDiscovery.executeCapability as jest.Mock)
        .mockRejectedValueOnce(new Error('Contract v1 failed'))
        .mockResolvedValueOnce({ success: true, projectId: '456' });

      const params = {
        action: 'createProject',
        parameters: { projectName: 'Test Project' }
      };

      const result = await service.executeWithContract(params);

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, projectId: '456' });
      expect(contractDiscovery.executeCapability).toHaveBeenCalledTimes(2);
    });

    test('uses preferred contract when specified', async () => {
      const preferredContract = {
        ...mockContract,
        title: 'Preferred Contract'
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract, preferredContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockResolvedValue({ success: true });

      const params = {
        action: 'createProject',
        parameters: { projectName: 'Test' },
        preferredContract: 'Preferred Contract'
      };

      await service.executeWithContract(params);

      // Should try preferred contract first
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Using contract: Preferred Contract')
      );
    });

    test('matches capability by description when exact match not found', async () => {
      const contractWithDescription = {
        ...mockContract,
        capabilities: {
          projectCreation: {
            description: 'Create new project in ChatGPT interface',
            method: 'dom',
            parameters: []
          }
        }
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([contractWithDescription]);
      (contractDiscovery.executeCapability as jest.Mock).mockResolvedValue({ success: true });

      const params = {
        action: 'create project', // Partial match to description
        parameters: {}
      };

      const result = await service.executeWithContract(params);

      expect(result.success).toBe(true);
      expect(result.capabilityName).toBe('projectCreation');
    });

    test('handles execution timeout', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockRejectedValue(new Error('Timeout'));

      const params = {
        action: 'createProject',
        parameters: { projectName: 'Test' },
        timeout: 1000
      };

      const result = await service.executeWithContract(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain('All contract executions failed');
    });
  });

  describe('checkContractAvailability', () => {
    test('returns availability info for current domain', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);

      const availability = await service.checkContractAvailability();

      expect(availability).toEqual({
        available: true,
        contractCount: 1,
        capabilities: ['createProject', 'sendPrompt'],
        domain: 'chatgpt.com'
      });
    });

    test('returns empty capabilities when no contracts', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([]);

      const availability = await service.checkContractAvailability();

      expect(availability).toEqual({
        available: false,
        contractCount: 0,
        capabilities: [],
        domain: 'chatgpt.com'
      });
    });

    test('deduplicates capabilities from multiple contracts', async () => {
      const contract2 = {
        ...mockContract,
        title: 'Another Contract',
        capabilities: {
          createProject: { description: 'Also creates project' },
          deleteProject: { description: 'Delete project' }
        }
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract, contract2]);

      const availability = await service.checkContractAvailability();

      expect(availability.capabilities).toEqual(['createProject', 'sendPrompt', 'deleteProject']);
      expect(availability.contractCount).toBe(2);
    });
  });

  describe('getAvailableActions', () => {
    test('returns all actions with metadata', () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);

      const actions = service.getAvailableActions();

      expect(actions).toHaveLength(2);
      expect(actions[0]).toEqual({
        action: 'createProject',
        description: 'Create a new project in ChatGPT',
        contractTitle: 'ChatGPT Automation',
        parameters: ['projectName']
      });
      expect(actions[1]).toEqual({
        action: 'sendPrompt',
        description: 'Send a prompt to ChatGPT',
        contractTitle: 'ChatGPT Automation',
        parameters: ['text', 'wait']
      });
    });

    test('handles capabilities without parameters', () => {
      const contractNoParams = {
        ...mockContract,
        capabilities: {
          refresh: {
            description: 'Refresh the page',
            method: 'dom'
          }
        }
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([contractNoParams]);

      const actions = service.getAvailableActions();

      expect(actions[0].parameters).toEqual([]);
    });
  });

  describe('validateExecutionParams', () => {
    beforeEach(() => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
    });

    test('validates required parameters successfully', () => {
      const result = service.validateExecutionParams('createProject', {
        projectName: 'Test Project'
      });

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('detects missing required parameters', () => {
      const result = service.validateExecutionParams('createProject', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Required parameter missing: projectName');
    });

    test('validates parameter types', () => {
      const result = service.validateExecutionParams('createProject', {
        projectName: 123 // Should be string
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid type for parameter projectName: expected string');
    });

    test('validates optional parameters', () => {
      const result = service.validateExecutionParams('sendPrompt', {
        text: 'Hello',
        wait: 'not-a-boolean' // Should be boolean
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid type for parameter wait: expected boolean');
    });

    test('handles unknown actions', () => {
      const result = service.validateExecutionParams('unknownAction', {});

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('No capability found for action: unknownAction');
    });

    test('validates complex parameter types', () => {
      const complexContract = {
        ...mockContract,
        capabilities: {
          complexAction: {
            description: 'Complex action',
            parameters: [
              { name: 'data', type: 'object', required: true },
              { name: 'items', type: 'array', required: true },
              { name: 'file', type: 'file', required: false }
            ]
          }
        }
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([complexContract]);

      const validResult = service.validateExecutionParams('complexAction', {
        data: { key: 'value' },
        items: [1, 2, 3],
        file: 'path/to/file.txt'
      });

      expect(validResult.valid).toBe(true);

      const invalidResult = service.validateExecutionParams('complexAction', {
        data: 'not-an-object',
        items: 'not-an-array'
      });

      expect(invalidResult.valid).toBe(false);
      expect(invalidResult.errors).toHaveLength(2);
    });
  });

  describe('getContractRecommendations', () => {
    test('prioritizes exact domain matches', () => {
      const contracts = [
        { ...mockContract, domain: 'other.com', title: 'Other Contract' },
        { ...mockContract, domain: 'chatgpt.com', title: 'Exact Match' },
        { ...mockContract, domain: '*.openai.com', title: 'Pattern Match' }
      ];

      (contractDiscovery.getDiscoveredContracts as jest.Mock).mockReturnValue(contracts);

      const recommendations = service.getContractRecommendations();

      expect(recommendations[0].recommendation).toBe('Perfect match for current domain');
      expect(recommendations[0].contractTitle).toBe('Exact Match');
    });

    test('identifies pattern matches', () => {
      mockWindow.location.hostname = 'api.openai.com';

      const contracts = [
        { ...mockContract, domain: '*.openai.com', title: 'Pattern Contract' }
      ];

      (contractDiscovery.getDiscoveredContracts as jest.Mock).mockReturnValue(contracts);

      const recommendations = service.getContractRecommendations();

      expect(recommendations[0].recommendation).toBe('Compatible with current domain pattern');
    });

    test('sorts by capability count', () => {
      const contracts = [
        { 
          title: 'Basic',
          domain: 'test.com',
          capabilities: { action1: {} }
        },
        {
          title: 'Advanced',
          domain: 'test.com',
          capabilities: { action1: {}, action2: {}, action3: {} }
        },
        {
          title: 'Medium',
          domain: 'test.com',
          capabilities: { action1: {}, action2: {} }
        }
      ];

      (contractDiscovery.getDiscoveredContracts as jest.Mock).mockReturnValue(contracts);

      const recommendations = service.getContractRecommendations();

      expect(recommendations[0].contractTitle).toBe('Advanced');
      expect(recommendations[0].capabilities).toBe(3);
      expect(recommendations[1].contractTitle).toBe('Medium');
      expect(recommendations[2].contractTitle).toBe('Basic');
    });
  });

  describe('exportExecutionStats', () => {
    test('returns execution statistics structure', async () => {
      const stats = await service.exportExecutionStats();

      expect(stats).toHaveProperty('totalExecutions');
      expect(stats).toHaveProperty('successRate');
      expect(stats).toHaveProperty('averageExecutionTime');
      expect(stats).toHaveProperty('contractUsage');
      expect(stats).toHaveProperty('capabilityUsage');
    });
  });

  describe('private method behavior', () => {
    test('domain matching handles wildcards correctly', () => {
      const wildcardContract = {
        ...mockContract,
        domain: '*.google.com'
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([]);
      (contractDiscovery.getDiscoveredContracts as jest.Mock).mockReturnValue([wildcardContract]);

      // Test various domain patterns
      mockWindow.location.hostname = 'docs.google.com';
      const recommendations = service.getContractRecommendations();
      
      expect(recommendations[0].recommendation).toBe('Compatible with current domain pattern');
    });

    test('generates unique contract IDs', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockResolvedValue({ success: true });

      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await service.executeWithContract({
          action: 'createProject',
          parameters: { projectName: `Project ${i}` }
        });
        results.push(result.contractId);
      }

      // All contract IDs should be unique
      const uniqueIds = new Set(results);
      expect(uniqueIds.size).toBe(3);
    });
  });

  describe('error handling', () => {
    test('handles contract discovery errors gracefully', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockImplementation(() => {
        throw new Error('Discovery service unavailable');
      });

      const result = await service.executeWithContract({
        action: 'test',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Discovery service unavailable');
    });

    test('handles null/undefined parameters', () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);

      const result = service.validateExecutionParams('createProject', {
        projectName: null as any
      });

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Invalid type for parameter projectName: expected string');
    });

    test('handles malformed contracts gracefully', async () => {
      const malformedContract = {
        title: 'Broken Contract',
        domain: 'test.com',
        capabilities: null // Invalid structure
      };

      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([malformedContract]);

      const result = await service.executeWithContract({
        action: 'test',
        parameters: {}
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('integration scenarios', () => {
    test('full execution flow with validation', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockResolvedValue({
        success: true,
        projectId: 'proj-123',
        message: 'Project created successfully'
      });

      // Step 1: Check availability
      const availability = await service.checkContractAvailability();
      expect(availability.available).toBe(true);

      // Step 2: Get available actions
      const actions = service.getAvailableActions();
      expect(actions.length).toBeGreaterThan(0);

      // Step 3: Validate parameters
      const params = { projectName: 'Integration Test' };
      const validation = service.validateExecutionParams('createProject', params);
      expect(validation.valid).toBe(true);

      // Step 4: Execute
      const result = await service.executeWithContract({
        action: 'createProject',
        parameters: params
      });

      expect(result.success).toBe(true);
      expect(result.data.projectId).toBe('proj-123');
    });

    test('handles concurrent executions', async () => {
      (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([mockContract]);
      (contractDiscovery.executeCapability as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ success: true }), 10))
      );

      // Execute multiple actions concurrently
      const executions = Promise.all([
        service.executeWithContract({ action: 'createProject', parameters: { projectName: 'Test1' } }),
        service.executeWithContract({ action: 'sendPrompt', parameters: { text: 'Hello' } }),
        service.executeWithContract({ action: 'createProject', parameters: { projectName: 'Test2' } })
      ]);

      const results = await executions;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(contractDiscovery.executeCapability).toHaveBeenCalledTimes(3);
    });
  });
});

describe('Global contractExecution instance', () => {
  test('is properly initialized', () => {
    expect(contractExecution).toBeInstanceOf(ContractExecutionService);
  });

  test('shares same discovery adapter', async () => {
    (contractDiscovery.getContractsByDomain as jest.Mock).mockReturnValue([]);

    await contractExecution.checkContractAvailability();

    expect(contractDiscovery.getContractsByDomain).toHaveBeenCalled();
  });
});