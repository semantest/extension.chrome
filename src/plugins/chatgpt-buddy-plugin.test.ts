/**
 * @jest-environment jsdom
 */

import { ChatGPTBuddyPlugin, ChatGPTPluginEvents } from './chatgpt-buddy-plugin';
import type {
  PluginContext,
  PluginState,
  ContractRegistry,
  PluginLogger,
  PluginEventBus,
  PluginStorageService,
  PluginConfiguration
} from './plugin-interface';

// Mock dependencies
jest.mock('./chatgpt-buddy-plugin', () => {
  const actualModule = jest.requireActual('./chatgpt-buddy-plugin');
  
  // Mock the internal manager classes
  class MockAIModelManager {
    constructor(context: any) {}
    async start() {}
    async stop() {}
    async destroy() {}
  }
  
  class MockTrainingManager {
    constructor(context: any) {}
    async start() {}
    async stop() {}
    async destroy() {}
  }
  
  class MockAutomationEngine {
    constructor(context: any) {}
    async start() {}
    async stop() {}
    async destroy() {}
  }
  
  class MockPerformanceTracker {
    constructor(context: any) {}
    async start() {}
    async stop() {}
    async destroy() {}
  }
  
  // Return the actual module with mocked internal classes
  return {
    ...actualModule,
    AIModelManager: MockAIModelManager,
    TrainingManager: MockTrainingManager,
    AutomationEngine: MockAutomationEngine,
    PerformanceTracker: MockPerformanceTracker
  };
});

describe('ChatGPTBuddyPlugin', () => {
  let plugin: ChatGPTBuddyPlugin;
  let mockContext: PluginContext;
  
  beforeEach(() => {
    // Create mock context
    mockContext = {
      pluginId: 'chatgpt-buddy',
      metadata: {
        id: 'chatgpt-buddy',
        name: 'ChatGPT Buddy',
        version: '2.0.0',
        description: 'AI-powered automation',
        author: 'rydnr'
      },
      contractRegistry: {
        register: jest.fn().mockResolvedValue(undefined),
        unregister: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        getByDomain: jest.fn(),
        getAll: jest.fn(),
        discover: jest.fn(),
        validate: jest.fn(),
        execute: jest.fn(),
        canExecute: jest.fn()
      } as unknown as ContractRegistry,
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        log: jest.fn(),
        time: jest.fn(),
        timeEnd: jest.fn(),
        child: jest.fn()
      } as unknown as PluginLogger,
      eventBus: {
        emit: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        off: jest.fn(),
        once: jest.fn(),
        filter: jest.fn(),
        pipe: jest.fn(),
        getHistory: jest.fn(),
        replay: jest.fn(),
        getStatistics: jest.fn()
      } as unknown as PluginEventBus,
      storageService: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue(undefined),
        remove: jest.fn().mockResolvedValue(undefined),
        clear: jest.fn().mockResolvedValue(undefined),
        keys: jest.fn().mockResolvedValue([]),
        setShared: jest.fn().mockResolvedValue(undefined),
        getShared: jest.fn().mockResolvedValue(null),
        removeShared: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockResolvedValue({
          enabled: true,
          settings: {
            preferredModel: 'gpt-4',
            enableTrainingMode: false,
            autoLearnPatterns: false,
            trainingConfidenceThreshold: 0.8,
            enablePatternRecognition: true,
            enableAIInsights: true,
            cacheResponses: true,
            maxResponseTime: 30000,
            showTrainingOverlay: false,
            enableKeyboardShortcuts: true,
            notificationLevel: 'normal',
            apiKeys: {},
            rateLimits: {
              requestsPerMinute: 60,
              maxDailyCost: 10
            }
          },
          domains: ['chat.openai.com'],
          permissions: ['storage', 'tabs'],
          uiPreferences: {
            theme: 'auto',
            notifications: true
          }
        }),
        setConfig: jest.fn().mockResolvedValue(undefined),
        migrate: jest.fn().mockResolvedValue(undefined)
      } as unknown as PluginStorageService,
      executionService: {} as any,
      tabManager: {} as any,
      extensionAPI: {} as any,
      messaging: {} as any,
      config: {} as any,
      createUIComponent: jest.fn(),
      createMenuItem: jest.fn(),
      getState: jest.fn(),
      setState: jest.fn(),
      getDependency: jest.fn(),
      hasDependency: jest.fn()
    };
    
    plugin = new ChatGPTBuddyPlugin();
  });
  
  describe('Metadata and Properties', () => {
    it('should have correct plugin metadata', () => {
      expect(plugin.id).toBe('chatgpt-buddy');
      expect(plugin.name).toBe('ChatGPT Buddy');
      expect(plugin.version).toBe('2.0.0');
      expect(plugin.description).toBe('AI-powered automation for ChatGPT and language models');
      expect(plugin.author).toBe('rydnr');
    });
    
    it('should have correct metadata object', () => {
      expect(plugin.metadata).toEqual({
        id: 'chatgpt-buddy',
        name: 'ChatGPT Buddy',
        version: '2.0.0',
        description: 'AI-powered automation for ChatGPT and language models',
        author: 'rydnr',
        license: 'MIT',
        repository: 'https://github.com/rydnr/chatgpt-buddy'
      });
    });
    
    it('should have correct capabilities', () => {
      expect(plugin.capabilities.supportedDomains).toEqual([
        'chat.openai.com',
        'chatgpt.com',
        'claude.ai',
        'beta.character.ai'
      ]);
      
      expect(plugin.capabilities.permissions).toEqual([
        'activeTab',
        'storage',
        'background',
        'webRequest'
      ]);
      
      expect(plugin.capabilities.requiredAPIs).toEqual([
        'chrome.tabs',
        'chrome.storage',
        'chrome.runtime',
        'chrome.webRequest'
      ]);
    });
    
    it('should start in uninitialized state', () => {
      expect(plugin.state).toBe('uninitialized');
    });
  });
  
  describe('Plugin Lifecycle', () => {
    describe('initialize', () => {
      it('should initialize successfully', async () => {
        await plugin.initialize(mockContext);
        
        expect(plugin.state).toBe('initialized');
        expect(mockContext.logger.info).toHaveBeenCalledWith(
          'ChatGPT Buddy Plugin initialized successfully'
        );
      });
      
      it('should handle initialization errors', async () => {
        const error = new Error('Init failed');
        mockContext.storageService.getConfig = jest.fn().mockRejectedValue(error);
        
        await expect(plugin.initialize(mockContext)).rejects.toThrow('Init failed');
        expect(plugin.state).toBe('error');
      });
    });
    
    describe('activate', () => {
      beforeEach(async () => {
        await plugin.initialize(mockContext);
      });
      
      it('should activate successfully', async () => {
        await plugin.activate();
        
        expect(plugin.state).toBe('active');
        expect(mockContext.contractRegistry.register).toHaveBeenCalledTimes(2); // For 2 contracts
        expect(mockContext.eventBus.emit).toHaveBeenCalledWith(
          expect.objectContaining({
            type: ChatGPTPluginEvents.AI_INTERACTION_REQUESTED,
            source: 'chatgpt-buddy'
          })
        );
        expect(mockContext.logger.info).toHaveBeenCalledWith(
          'ChatGPT Buddy Plugin activated successfully'
        );
      });
      
      it('should throw error if not initialized', async () => {
        const newPlugin = new ChatGPTBuddyPlugin();
        
        await expect(newPlugin.activate()).rejects.toThrow('Plugin not initialized');
      });
      
      it('should handle activation errors', async () => {
        const error = new Error('Activation failed');
        mockContext.contractRegistry.register = jest.fn().mockRejectedValue(error);
        
        await expect(plugin.activate()).rejects.toThrow('Activation failed');
        expect(plugin.state).toBe('error');
      });
    });
    
    describe('deactivate', () => {
      beforeEach(async () => {
        await plugin.initialize(mockContext);
        await plugin.activate();
      });
      
      it('should deactivate successfully', async () => {
        await plugin.deactivate();
        
        expect(plugin.state).toBe('inactive');
        expect(mockContext.contractRegistry.unregister).toHaveBeenCalledTimes(2);
        expect(mockContext.logger.info).toHaveBeenCalledWith(
          'ChatGPT Buddy Plugin deactivated'
        );
      });
      
      it('should handle deactivation when not initialized', async () => {
        const newPlugin = new ChatGPTBuddyPlugin();
        
        // Should not throw
        await expect(newPlugin.deactivate()).resolves.toBeUndefined();
      });
      
      it('should handle deactivation errors', async () => {
        const error = new Error('Deactivation failed');
        mockContext.contractRegistry.unregister = jest.fn().mockRejectedValue(error);
        
        await expect(plugin.deactivate()).rejects.toThrow('Deactivation failed');
      });
    });
    
    describe('destroy', () => {
      beforeEach(async () => {
        await plugin.initialize(mockContext);
      });
      
      it('should destroy successfully', async () => {
        await plugin.destroy();
        
        expect(plugin.state).toBe('destroyed');
      });
      
      it('should handle destroy when not initialized', async () => {
        const newPlugin = new ChatGPTBuddyPlugin();
        
        // Should not throw
        await expect(newPlugin.destroy()).resolves.toBeUndefined();
      });
      
      it('should handle destruction errors', async () => {
        // Mock console.error to test error logging
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        // Create a plugin with a mock that throws
        const errorPlugin = new ChatGPTBuddyPlugin();
        await errorPlugin.initialize(mockContext);
        
        // Force an error by making a mock throw
        const error = new Error('Destroy failed');
        
        // Override the destroy method to throw
        Object.defineProperty(errorPlugin, 'aiModelManager', {
          value: {
            destroy: jest.fn().mockRejectedValue(error)
          },
          writable: true
        });
        
        await expect(errorPlugin.destroy()).rejects.toThrow('Destroy failed');
        expect(consoleError).toHaveBeenCalledWith(
          'Error destroying ChatGPT Buddy Plugin:',
          error
        );
        
        consoleError.mockRestore();
      });
    });
  });
  
  describe('Contract Management', () => {
    it('should return contracts', () => {
      const contracts = plugin.getContracts();
      
      expect(contracts).toHaveLength(2);
      expect(contracts[0].domain).toBe('chat.openai.com');
      expect(contracts[1].domain).toBe('claude.ai');
    });
    
    it('should return a copy of contracts', () => {
      const contracts1 = plugin.getContracts();
      const contracts2 = plugin.getContracts();
      
      expect(contracts1).not.toBe(contracts2);
      expect(contracts1).toEqual(contracts2);
    });
  });
  
  describe('Capability Execution', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
    });
    
    it('should execute capability successfully', async () => {
      mockContext.executionService = {
        executeCapability: jest.fn().mockResolvedValue({ success: true }),
        validateParameters: jest.fn(),
        getExecutionHistory: jest.fn(),
        setExecutionContext: jest.fn(),
        getExecutionContext: jest.fn(),
        getExecutionStats: jest.fn(),
        clearExecutionHistory: jest.fn()
      };
      
      const result = await plugin.executeCapability('sendMessage', { message: 'Hello' });
      
      expect(result).toEqual({ success: true });
    });
    
    it('should validate capability successfully', async () => {
      const result = await plugin.validateCapability('sendMessage', { message: 'Hello' });
      
      expect(result).toEqual({ valid: true, errors: [] });
    });
    
    it('should invalidate capability with missing required params', async () => {
      const result = await plugin.validateCapability('sendMessage', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required parameter: message');
    });
    
    it('should invalidate unknown capability', async () => {
      const result = await plugin.validateCapability('unknownCapability', {});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Unknown capability: unknownCapability');
    });
  });
  
  describe('UI Components', () => {
    it('should return UI components', () => {
      const components = plugin.getUIComponents();
      
      expect(Array.isArray(components)).toBe(true);
      expect(components.length).toBeGreaterThan(0);
    });
  });
  
  describe('Menu Items', () => {
    it('should return menu items', () => {
      const menuItems = plugin.getMenuItems();
      
      expect(Array.isArray(menuItems)).toBe(true);
      expect(menuItems.length).toBeGreaterThan(0);
    });
  });
  
  describe('Event Handling', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });
    
    it('should handle events', async () => {
      const event = {
        type: 'test',
        source: 'test-source',
        data: { test: true },
        timestamp: new Date().toISOString()
      };
      
      await plugin.onEvent(event);
      
      expect(mockContext.logger.debug).toHaveBeenCalledWith(
        'Received event:',
        event.type
      );
    });
  });
  
  describe('Configuration', () => {
    it('should return default configuration', () => {
      const config = plugin.getDefaultConfig();
      
      expect(config.enabled).toBe(true);
      expect(config.settings).toBeDefined();
      expect(config.settings.preferredModel).toBe('gpt-4');
      expect(config.settings.enableTrainingMode).toBe(false);
    });
    
    it('should handle configuration changes', async () => {
      await plugin.initialize(mockContext);
      
      const newConfig = {
        enabled: false,
        settings: {
          preferredModel: 'gpt-3.5-turbo'
        },
        domains: [],
        permissions: [],
        uiPreferences: {}
      } as PluginConfiguration;
      
      await plugin.onConfigChange(newConfig);
      
      expect(mockContext.logger.info).toHaveBeenCalledWith(
        'Configuration updated'
      );
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy when inactive', async () => {
      const result = await plugin.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.issues).toEqual([]);
    });
    
    it('should check health when active', async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
      
      const result = await plugin.healthCheck();
      
      expect(result.healthy).toBe(true);
      expect(result.issues).toEqual([]);
    });
  });
  
  describe('Metrics', () => {
    it('should return metrics', async () => {
      const metrics = await plugin.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(typeof metrics).toBe('object');
    });
  });
  
  describe('ChatGPTPluginEvents', () => {
    it('should have all AI interaction events', () => {
      expect(ChatGPTPluginEvents.AI_INTERACTION_REQUESTED).toBe('chatgpt:interaction:requested');
      expect(ChatGPTPluginEvents.AI_RESPONSE_RECEIVED).toBe('chatgpt:response:received');
      expect(ChatGPTPluginEvents.AI_MODEL_SWITCHED).toBe('chatgpt:model:switched');
    });
    
    it('should have all training events', () => {
      expect(ChatGPTPluginEvents.TRAINING_MODE_ENABLED).toBe('chatgpt:training:enabled');
      expect(ChatGPTPluginEvents.TRAINING_PATTERN_LEARNED).toBe('chatgpt:training:pattern:learned');
      expect(ChatGPTPluginEvents.TRAINING_SESSION_COMPLETED).toBe('chatgpt:training:session:completed');
    });
    
    it('should have all automation events', () => {
      expect(ChatGPTPluginEvents.CHATGPT_MESSAGE_SENT).toBe('chatgpt:message:sent');
      expect(ChatGPTPluginEvents.CHATGPT_RESPONSE_EXTRACTED).toBe('chatgpt:response:extracted');
      expect(ChatGPTPluginEvents.CONVERSATION_STARTED).toBe('chatgpt:conversation:started');
    });
    
    it('should have all performance events', () => {
      expect(ChatGPTPluginEvents.AI_PERFORMANCE_UPDATED).toBe('chatgpt:performance:updated');
      expect(ChatGPTPluginEvents.OPTIMIZATION_SUGGESTED).toBe('chatgpt:optimization:suggested');
    });
  });
});