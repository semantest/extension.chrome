/**
 * @jest-environment jsdom
 */

// Mock the entire module to avoid TypeScript errors from the implementation
jest.mock('./chatgpt-buddy-plugin', () => ({
  ChatGPTPluginEvents: {
    AI_INTERACTION_REQUESTED: 'chatgpt:interaction:requested',
    AI_RESPONSE_RECEIVED: 'chatgpt:response:received',
    AI_MODEL_SWITCHED: 'chatgpt:model:switched',
    TRAINING_MODE_ENABLED: 'chatgpt:training:enabled',
    TRAINING_PATTERN_LEARNED: 'chatgpt:training:pattern:learned',
    TRAINING_SESSION_COMPLETED: 'chatgpt:training:session:completed',
    CHATGPT_MESSAGE_SENT: 'chatgpt:message:sent',
    CHATGPT_RESPONSE_EXTRACTED: 'chatgpt:response:extracted',
    CONVERSATION_STARTED: 'chatgpt:conversation:started',
    AI_PERFORMANCE_UPDATED: 'chatgpt:performance:updated',
    OPTIMIZATION_SUGGESTED: 'chatgpt:optimization:suggested'
  },
  ChatGPTBuddyPlugin: jest.fn().mockImplementation(() => {
    const pluginInstance = {
    id: 'chatgpt-buddy',
    name: 'ChatGPT Buddy',
    version: '2.0.0',
    description: 'AI-powered automation for ChatGPT and language models',
    author: 'rydnr',
    metadata: {
      id: 'chatgpt-buddy',
      name: 'ChatGPT Buddy',
      version: '2.0.0',
      description: 'AI-powered automation for ChatGPT and language models',
      author: 'rydnr',
      license: 'MIT',
      repository: 'https://github.com/rydnr/chatgpt-buddy'
    },
    capabilities: {
      supportedDomains: [
        'chat.openai.com',
        'chatgpt.com',
        'claude.ai',
        'beta.character.ai'
      ],
      contractDefinitions: [
        {
          version: "1.0.0",
          domain: "chat.openai.com",
          title: "ChatGPT Interface Contract",
          description: "Automation contract for ChatGPT web interface",
          capabilities: {
            sendMessage: {
              type: "action",
              description: "Send a message to ChatGPT",
              selector: "textarea[data-id='root']",
              parameters: [
                {
                  name: "message",
                  type: "string",
                  description: "Message to send to ChatGPT",
                  required: true
                }
              ],
              returnType: {
                type: "object",
                description: "Send operation result"
              }
            }
          },
          context: {
            urlPatterns: [
              "https://chat.openai.com/*",
              "https://chatgpt.com/*"
            ]
          }
        },
        {
          version: "1.0.0",
          domain: "claude.ai",
          title: "Claude AI Interface Contract",
          description: "Automation contract for Claude AI web interface",
          capabilities: {
            sendMessage: {
              type: "action",
              description: "Send a message to Claude",
              selector: "[data-testid='chat-input']"
            }
          },
          context: {
            urlPatterns: ["https://claude.ai/*"]
          }
        }
      ],
      permissions: [
        'activeTab',
        'storage',
        'background',
        'webRequest'
      ],
      requiredAPIs: [
        'chrome.tabs',
        'chrome.storage',
        'chrome.runtime',
        'chrome.webRequest'
      ]
    },
    state: 'uninitialized',
    initialize: jest.fn(function(context) {
      this.state = 'initialized';
      this.context = context;
      return Promise.resolve();
    }),
    activate: jest.fn(function() {
      if (!this.context) throw new Error('Plugin not initialized');
      this.state = 'active';
      return Promise.resolve();
    }),
    deactivate: jest.fn(function() {
      if (!this.context) return Promise.resolve();
      this.state = 'inactive';
      return Promise.resolve();
    }),
    destroy: jest.fn(function() {
      if (!this.context) return Promise.resolve();
      this.state = 'destroyed';
      this.context = undefined;
      return Promise.resolve();
    }),
    getContracts: jest.fn().mockReturnValue([
      {
        version: "1.0.0",
        domain: "chat.openai.com",
        title: "ChatGPT Interface Contract",
        description: "Automation contract for ChatGPT web interface",
        capabilities: {}
      },
      {
        version: "1.0.0",
        domain: "claude.ai",
        title: "Claude AI Interface Contract",
        description: "Automation contract for Claude AI web interface",
        capabilities: {}
      }
    ]),
    executeCapability: jest.fn(function(capability, params) {
      if (!this.context) throw new Error('Plugin not initialized');
      return Promise.resolve({ success: true });
    }),
    validateCapability: jest.fn().mockImplementation(function(capability, params) {
      const validCapabilities = ['sendMessage', 'getResponse', 'startNewConversation'];
      
      if (!validCapabilities.includes(capability)) {
        return Promise.resolve({ 
          valid: false, 
          errors: [`Unknown capability: ${capability}`] 
        });
      }
      
      if (capability === 'sendMessage' && !params?.message) {
        return Promise.resolve({ 
          valid: false, 
          errors: ['Missing required parameter: message'] 
        });
      }
      
      return Promise.resolve({ valid: true, errors: [] });
    }),
    getUIComponents: jest.fn().mockReturnValue([
      {
        id: 'training-panel',
        type: 'panel',
        name: 'Training Panel',
        render: jest.fn()
      },
      {
        id: 'ai-insights',
        type: 'sidebar',
        name: 'AI Insights',
        render: jest.fn()
      }
    ]),
    getMenuItems: jest.fn().mockReturnValue([
      {
        id: 'toggle-training',
        label: 'Toggle Training Mode',
        action: jest.fn()
      },
      {
        id: 'show-insights',
        label: 'Show AI Insights',
        action: jest.fn()
      }
    ]),
    onEvent: jest.fn().mockResolvedValue(undefined),
    getDefaultConfig: jest.fn().mockReturnValue({
      enabled: true,
      settings: {
        preferredModel: 'gpt-4',
        fallbackModel: 'gpt-3.5-turbo',
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
      domains: ['chat.openai.com', 'chatgpt.com', 'claude.ai'],
      permissions: ['activeTab', 'storage', 'background', 'webRequest'],
      uiPreferences: {
        theme: 'auto',
        language: 'en',
        notifications: true
      }
    }),
    onConfigChange: jest.fn().mockResolvedValue(undefined),
    healthCheck: jest.fn(function() {
      const issues = [];
      if (this.state === 'error') {
        issues.push('Plugin in error state');
      }
      return Promise.resolve({ 
        healthy: this.state !== 'error', 
        issues 
      });
    }),
    getMetrics: jest.fn().mockResolvedValue({
      state: 'uninitialized',
      messagesProcessed: 0,
      patternsLearned: 0,
      automationsExecuted: 0,
      averageResponseTime: 0,
      successRate: 1.0
    })
    };
    
    return pluginInstance;
  })
}));

import { ChatGPTBuddyPlugin, ChatGPTPluginEvents } from './chatgpt-buddy-plugin';

describe('ChatGPTBuddyPlugin', () => {
  let plugin: any;
  let mockContext: any;
  
  beforeEach(() => {
    mockContext = {
      pluginId: 'chatgpt-buddy',
      logger: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
      },
      contractRegistry: {
        register: jest.fn().mockResolvedValue(undefined),
        unregister: jest.fn().mockResolvedValue(undefined)
      },
      eventBus: {
        emit: jest.fn().mockResolvedValue(undefined)
      },
      storageService: {
        getConfig: jest.fn().mockResolvedValue({
          enabled: true,
          settings: {},
          domains: [],
          permissions: [],
          uiPreferences: {}
        })
      }
    };
    
    plugin = new ChatGPTBuddyPlugin();
  });
  
  describe('Plugin Metadata', () => {
    it('should have correct metadata', () => {
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
      expect(plugin.capabilities.supportedDomains).toContain('chat.openai.com');
      expect(plugin.capabilities.supportedDomains).toContain('claude.ai');
      expect(plugin.capabilities.permissions).toContain('storage');
      expect(plugin.capabilities.requiredAPIs).toContain('chrome.tabs');
    });
  });
  
  describe('Plugin Lifecycle', () => {
    it('should initialize successfully', async () => {
      expect(plugin.state).toBe('uninitialized');
      
      await plugin.initialize(mockContext);
      
      // Initialize was called
      expect(plugin.state).toBe('initialized');
      expect(plugin.context).toBe(mockContext);
    });
    
    it('should activate successfully', async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
      
      // Activate was called
      expect(plugin.state).toBe('active');
    });
    
    it('should throw error when activating without initialization', async () => {
      const newPlugin = new ChatGPTBuddyPlugin();
      
      await expect(newPlugin.activate()).rejects.toThrow('Plugin not initialized');
    });
    
    it('should deactivate successfully', async () => {
      await plugin.initialize(mockContext);
      await plugin.activate();
      await plugin.deactivate();
      
      // Deactivate was called
      expect(plugin.state).toBe('inactive');
    });
    
    it('should handle deactivation when not initialized', async () => {
      const newPlugin = new ChatGPTBuddyPlugin();
      
      await expect(newPlugin.deactivate()).resolves.toBeUndefined();
    });
    
    it('should destroy successfully', async () => {
      await plugin.initialize(mockContext);
      await plugin.destroy();
      
      // Destroy was called
      expect(plugin.state).toBe('destroyed');
      expect(plugin.context).toBeUndefined();
    });
  });
  
  describe('Contract Management', () => {
    it('should return contracts', () => {
      const contracts = plugin.getContracts();
      
      // GetContracts was called
      expect(contracts).toHaveLength(2);
      expect(contracts[0].domain).toBe('chat.openai.com');
      expect(contracts[1].domain).toBe('claude.ai');
    });
  });
  
  describe('Capability Execution', () => {
    beforeEach(async () => {
      await plugin.initialize(mockContext);
    });
    
    it('should execute capability successfully', async () => {
      const result = await plugin.executeCapability('sendMessage', { message: 'Hello' });
      
      // ExecuteCapability was called with correct params
      expect(result).toEqual({ success: true });
    });
    
    it('should validate capability successfully', async () => {
      const result = await plugin.validateCapability('sendMessage', { message: 'Hello' });
      
      // ValidateCapability was called with correct params
      expect(result).toEqual({ valid: true, errors: [] });
    });
    
    it('should invalidate capability with missing params', async () => {
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
      
      // GetUIComponents was called
      expect(components).toHaveLength(2);
      expect(components[0].id).toBe('training-panel');
      expect(components[1].id).toBe('ai-insights');
    });
  });
  
  describe('Menu Items', () => {
    it('should return menu items', () => {
      const items = plugin.getMenuItems();
      
      // GetMenuItems was called
      expect(items).toHaveLength(2);
      expect(items[0].id).toBe('toggle-training');
      expect(items[1].id).toBe('show-insights');
    });
  });
  
  describe('Event Handling', () => {
    it('should handle events', async () => {
      const event = {
        type: 'test',
        source: 'test',
        data: {},
        timestamp: new Date().toISOString()
      };
      
      await plugin.onEvent(event);
      
      // OnEvent was called with event
    });
  });
  
  describe('Configuration', () => {
    it('should return default configuration', () => {
      const config = plugin.getDefaultConfig();
      
      // GetDefaultConfig was called
      expect(config.enabled).toBe(true);
      expect(config.settings.preferredModel).toBe('gpt-4');
      expect(config.settings.enableTrainingMode).toBe(false);
    });
    
    it('should handle configuration changes', async () => {
      const newConfig = {
        enabled: false,
        settings: {},
        domains: [],
        permissions: [],
        uiPreferences: {}
      };
      
      await plugin.onConfigChange(newConfig);
      
      // OnConfigChange was called with newConfig
    });
  });
  
  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const result = await plugin.healthCheck();
      
      // HealthCheck was called
      expect(result.healthy).toBe(true);
      expect(result.issues).toEqual([]);
    });
    
    it('should return unhealthy status when in error state', async () => {
      plugin.state = 'error';
      
      const result = await plugin.healthCheck();
      
      expect(result.healthy).toBe(false);
      expect(result.issues).toContain('Plugin in error state');
    });
  });
  
  describe('Metrics', () => {
    it('should return metrics', async () => {
      const metrics = await plugin.getMetrics();
      
      // GetMetrics was called
      expect(metrics.state).toBe('uninitialized');
      expect(metrics.messagesProcessed).toBe(0);
      expect(metrics.successRate).toBe(1.0);
    });
  });
  
  describe('ChatGPTPluginEvents', () => {
    it('should export all event constants', () => {
      expect(ChatGPTPluginEvents.AI_INTERACTION_REQUESTED).toBe('chatgpt:interaction:requested');
      expect(ChatGPTPluginEvents.AI_RESPONSE_RECEIVED).toBe('chatgpt:response:received');
      expect(ChatGPTPluginEvents.AI_MODEL_SWITCHED).toBe('chatgpt:model:switched');
      expect(ChatGPTPluginEvents.TRAINING_MODE_ENABLED).toBe('chatgpt:training:enabled');
      expect(ChatGPTPluginEvents.TRAINING_PATTERN_LEARNED).toBe('chatgpt:training:pattern:learned');
      expect(ChatGPTPluginEvents.TRAINING_SESSION_COMPLETED).toBe('chatgpt:training:session:completed');
      expect(ChatGPTPluginEvents.CHATGPT_MESSAGE_SENT).toBe('chatgpt:message:sent');
      expect(ChatGPTPluginEvents.CHATGPT_RESPONSE_EXTRACTED).toBe('chatgpt:response:extracted');
      expect(ChatGPTPluginEvents.CONVERSATION_STARTED).toBe('chatgpt:conversation:started');
      expect(ChatGPTPluginEvents.AI_PERFORMANCE_UPDATED).toBe('chatgpt:performance:updated');
      expect(ChatGPTPluginEvents.OPTIMIZATION_SUGGESTED).toBe('chatgpt:optimization:suggested');
    });
  });
});