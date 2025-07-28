/**
 * @jest-environment jsdom
 */

import {
  PluginError,
  PluginLoadError,
  PluginInitializationError,
  PluginExecutionError,
  PluginSecurityError,
  PluginDependencyError,
  PluginEvents,
  type PluginMetadata,
  type PluginCapabilities,
  type PluginState,
  type PluginLifecycleEvent,
  type WebBuddyContract,
  type ContractCapability,
  type ContractParameter,
  type ContractReturnType,
  type ContractValidation,
  type ContractContext,
  type PluginUIComponent,
  type PluginMenuItem,
  type PluginEvent,
  type PluginEventHandler,
  type PluginConfiguration,
  type PluginStorageService,
  type PluginMessaging,
  type PluginEventBus,
  type PluginLogger,
  type WebBuddyTab,
  type TabManager,
  type ExtensionAPI,
  type ContractRegistry,
  type ContractExecutionService,
  type PluginContext,
  type WebBuddyPlugin,
  type PluginManifest,
  type PluginPackage,
  type PluginSecurityPolicy
} from './plugin-interface';

describe('Plugin Interface', () => {
  describe('Plugin Error Classes', () => {
    describe('PluginError', () => {
      it('should create a PluginError with all properties', () => {
        const error = new PluginError('Test error', 'test-plugin', 'TEST_ERROR', { foo: 'bar' });
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(PluginError);
        expect(error.message).toBe('Test error');
        expect(error.pluginId).toBe('test-plugin');
        expect(error.code).toBe('TEST_ERROR');
        expect(error.details).toEqual({ foo: 'bar' });
        expect(error.name).toBe('PluginError');
      });

      it('should create a PluginError without details', () => {
        const error = new PluginError('Test error', 'test-plugin', 'TEST_ERROR');
        
        expect(error.details).toBeUndefined();
      });
    });

    describe('PluginLoadError', () => {
      it('should create a PluginLoadError', () => {
        const error = new PluginLoadError('Load failed', 'test-plugin', { reason: 'not found' });
        
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginLoadError);
        expect(error.message).toBe('Load failed');
        expect(error.pluginId).toBe('test-plugin');
        expect(error.code).toBe('PLUGIN_LOAD_ERROR');
        expect(error.details).toEqual({ reason: 'not found' });
        expect(error.name).toBe('PluginLoadError');
      });
    });

    describe('PluginInitializationError', () => {
      it('should create a PluginInitializationError', () => {
        const error = new PluginInitializationError('Init failed', 'test-plugin');
        
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginInitializationError);
        expect(error.code).toBe('PLUGIN_INITIALIZATION_ERROR');
        expect(error.name).toBe('PluginInitializationError');
      });
    });

    describe('PluginExecutionError', () => {
      it('should create a PluginExecutionError', () => {
        const error = new PluginExecutionError('Execution failed', 'test-plugin');
        
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginExecutionError);
        expect(error.code).toBe('PLUGIN_EXECUTION_ERROR');
        expect(error.name).toBe('PluginExecutionError');
      });
    });

    describe('PluginSecurityError', () => {
      it('should create a PluginSecurityError', () => {
        const error = new PluginSecurityError('Security violation', 'test-plugin');
        
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginSecurityError);
        expect(error.code).toBe('PLUGIN_SECURITY_ERROR');
        expect(error.name).toBe('PluginSecurityError');
      });
    });

    describe('PluginDependencyError', () => {
      it('should create a PluginDependencyError', () => {
        const error = new PluginDependencyError('Missing dependency', 'test-plugin');
        
        expect(error).toBeInstanceOf(PluginError);
        expect(error).toBeInstanceOf(PluginDependencyError);
        expect(error.code).toBe('PLUGIN_DEPENDENCY_ERROR');
        expect(error.name).toBe('PluginDependencyError');
      });
    });
  });

  describe('PluginEvents Constants', () => {
    it('should have all lifecycle events', () => {
      expect(PluginEvents.PLUGIN_LOADED).toBe('plugin:loaded');
      expect(PluginEvents.PLUGIN_INITIALIZED).toBe('plugin:initialized');
      expect(PluginEvents.PLUGIN_ACTIVATED).toBe('plugin:activated');
      expect(PluginEvents.PLUGIN_DEACTIVATED).toBe('plugin:deactivated');
      expect(PluginEvents.PLUGIN_DESTROYED).toBe('plugin:destroyed');
      expect(PluginEvents.PLUGIN_ERROR).toBe('plugin:error');
    });

    it('should have all contract events', () => {
      expect(PluginEvents.CONTRACT_DISCOVERED).toBe('contract:discovered');
      expect(PluginEvents.CONTRACT_REGISTERED).toBe('contract:registered');
      expect(PluginEvents.CONTRACT_EXECUTED).toBe('contract:executed');
      expect(PluginEvents.CONTRACT_FAILED).toBe('contract:failed');
    });

    it('should have all automation events', () => {
      expect(PluginEvents.AUTOMATION_STARTED).toBe('automation:started');
      expect(PluginEvents.AUTOMATION_COMPLETED).toBe('automation:completed');
      expect(PluginEvents.AUTOMATION_FAILED).toBe('automation:failed');
    });

    it('should have all UI events', () => {
      expect(PluginEvents.UI_COMPONENT_MOUNTED).toBe('ui:component:mounted');
      expect(PluginEvents.UI_COMPONENT_UNMOUNTED).toBe('ui:component:unmounted');
      expect(PluginEvents.UI_INTERACTION).toBe('ui:interaction');
    });

    it('should have all system events', () => {
      expect(PluginEvents.SYSTEM_READY).toBe('system:ready');
      expect(PluginEvents.SYSTEM_SHUTDOWN).toBe('system:shutdown');
      expect(PluginEvents.ERROR_OCCURRED).toBe('error:occurred');
    });
  });

  describe('Type Safety Tests', () => {
    it('should allow valid PluginState values', () => {
      const states: PluginState[] = [
        'uninitialized',
        'initialized',
        'active',
        'inactive',
        'error',
        'destroyed'
      ];
      
      expect(states).toHaveLength(6);
    });

    it('should allow valid ContractCapability types', () => {
      const capability: ContractCapability = {
        type: 'action',
        description: 'Test action',
        selector: '#test'
      };
      
      expect(capability.type).toBe('action');
      
      // Test other valid types
      const types: ContractCapability['type'][] = ['action', 'form', 'query', 'navigation'];
      expect(types).toHaveLength(4);
    });

    it('should allow valid parameter types', () => {
      const parameter: ContractParameter = {
        name: 'testParam',
        type: 'string',
        required: true
      };
      
      expect(parameter.type).toBe('string');
      
      // Test other valid types
      const types: ContractParameter['type'][] = ['string', 'number', 'boolean', 'object', 'array'];
      expect(types).toHaveLength(5);
    });

    it('should allow valid UI component types', () => {
      const types: PluginUIComponent['type'][] = [
        'panel',
        'toolbar',
        'modal',
        'sidebar',
        'popup',
        'overlay'
      ];
      
      expect(types).toHaveLength(6);
    });

    it('should allow valid event priorities', () => {
      const event: PluginEvent = {
        type: 'test',
        source: 'test-plugin',
        data: {},
        timestamp: new Date().toISOString(),
        priority: 'high'
      };
      
      expect(event.priority).toBe('high');
      
      // Test other valid priorities
      const priorities: NonNullable<PluginEvent['priority']>[] = ['low', 'medium', 'high', 'critical'];
      expect(priorities).toHaveLength(4);
    });
  });

  describe('Interface Implementation Tests', () => {
    it('should create a valid PluginMetadata object', () => {
      const metadata: PluginMetadata = {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0',
        description: 'A test plugin',
        author: 'Test Author',
        license: 'MIT',
        homepage: 'https://example.com',
        repository: 'https://github.com/example/plugin'
      };
      
      expect(metadata.id).toBe('test-plugin');
      expect(metadata.name).toBe('Test Plugin');
    });

    it('should create a valid WebBuddyContract', () => {
      const contract: WebBuddyContract = {
        version: '1.0',
        domain: 'example.com',
        title: 'Example Contract',
        description: 'Test contract',
        capabilities: {
          search: {
            type: 'query',
            description: 'Search functionality',
            selector: '#search-input'
          }
        },
        context: {
          urlPatterns: ['https://example.com/*'],
          accessibility: {
            ariaCompliant: true,
            keyboardNavigation: true
          }
        }
      };
      
      expect(contract.domain).toBe('example.com');
      expect(contract.capabilities.search.type).toBe('query');
    });

    it('should create a valid PluginConfiguration', () => {
      const config: PluginConfiguration = {
        enabled: true,
        settings: {
          apiKey: 'test-key',
          timeout: 5000
        },
        domains: ['example.com'],
        permissions: ['storage', 'tabs'],
        uiPreferences: {
          theme: 'dark',
          language: 'en',
          notifications: true
        }
      };
      
      expect(config.enabled).toBe(true);
      expect(config.uiPreferences.theme).toBe('dark');
    });

    it('should create a valid PluginManifest', () => {
      const manifest: PluginManifest = {
        metadata: {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'Test',
          author: 'Test'
        },
        capabilities: {
          supportedDomains: ['example.com'],
          contractDefinitions: [],
          permissions: ['storage'],
          requiredAPIs: ['chrome.tabs']
        },
        entry: {
          script: 'plugin.js',
          className: 'TestPlugin',
          exports: 'default'
        },
        dependencies: ['other-plugin'],
        minimumWebBuddyVersion: '1.0.0'
      };
      
      expect(manifest.entry.script).toBe('plugin.js');
      expect(manifest.dependencies).toContain('other-plugin');
    });

    it('should create a valid PluginSecurityPolicy', () => {
      const policy: PluginSecurityPolicy = {
        allowedDomains: ['example.com', '*.example.com'],
        allowedPermissions: ['storage', 'tabs'],
        allowedAPIs: ['chrome.tabs', 'chrome.storage'],
        sandboxed: true,
        trustedSource: false,
        maxMemoryUsage: 50 * 1024 * 1024, // 50MB
        maxExecutionTime: 5000 // 5 seconds
      };
      
      expect(policy.sandboxed).toBe(true);
      expect(policy.maxMemoryUsage).toBe(52428800);
    });
  });

  describe('Mock Service Implementation Tests', () => {
    describe('PluginStorageService', () => {
      it('should implement storage service interface', async () => {
        const mockStorage: PluginStorageService = {
          set: jest.fn().mockResolvedValue(undefined),
          get: jest.fn().mockResolvedValue('value'),
          remove: jest.fn().mockResolvedValue(undefined),
          clear: jest.fn().mockResolvedValue(undefined),
          keys: jest.fn().mockResolvedValue(['key1', 'key2']),
          setShared: jest.fn().mockResolvedValue(undefined),
          getShared: jest.fn().mockResolvedValue('shared-value'),
          removeShared: jest.fn().mockResolvedValue(undefined),
          getConfig: jest.fn().mockResolvedValue({
            enabled: true,
            settings: {},
            domains: [],
            permissions: [],
            uiPreferences: {}
          }),
          setConfig: jest.fn().mockResolvedValue(undefined),
          migrate: jest.fn().mockResolvedValue(undefined)
        };
        
        await mockStorage.set('key', 'value');
        expect(mockStorage.set).toHaveBeenCalledWith('key', 'value');
        
        const value = await mockStorage.get('key');
        expect(value).toBe('value');
        
        const keys = await mockStorage.keys();
        expect(keys).toEqual(['key1', 'key2']);
      });
    });

    describe('PluginLogger', () => {
      it('should implement logger interface', () => {
        const mockLogger: PluginLogger = {
          debug: jest.fn(),
          info: jest.fn(),
          warn: jest.fn(),
          error: jest.fn(),
          log: jest.fn(),
          time: jest.fn(),
          timeEnd: jest.fn(),
          child: jest.fn().mockReturnThis()
        };
        
        mockLogger.debug('Debug message');
        expect(mockLogger.debug).toHaveBeenCalledWith('Debug message');
        
        mockLogger.error('Error message', new Error('Test'));
        expect(mockLogger.error).toHaveBeenCalledWith('Error message', expect.any(Error));
        
        const childLogger = mockLogger.child({ module: 'test' });
        expect(childLogger).toBe(mockLogger);
      });
    });

    describe('TabManager', () => {
      it('should implement tab manager interface', async () => {
        const mockTabManager: TabManager = {
          getCurrentTab: jest.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
          getAllTabs: jest.fn().mockResolvedValue([
            { id: 1, url: 'https://example.com' },
            { id: 2, url: 'https://test.com' }
          ]),
          switchToTab: jest.fn().mockResolvedValue(undefined),
          findTabByTitle: jest.fn().mockResolvedValue({ id: 1, title: 'Example' }),
          findTabByUrl: jest.fn().mockResolvedValue({ id: 1, url: 'https://example.com' }),
          onTabCreated: jest.fn(),
          onTabUpdated: jest.fn(),
          onTabRemoved: jest.fn(),
          onTabActivated: jest.fn()
        };
        
        const currentTab = await mockTabManager.getCurrentTab();
        expect(currentTab).toEqual({ id: 1, url: 'https://example.com' });
        
        const allTabs = await mockTabManager.getAllTabs();
        expect(allTabs).toHaveLength(2);
        
        await mockTabManager.switchToTab(2);
        expect(mockTabManager.switchToTab).toHaveBeenCalledWith(2);
      });
    });

    describe('PluginEventBus', () => {
      it('should implement event bus interface', async () => {
        const handlers: PluginEventHandler[] = [];
        
        const mockEventBus: PluginEventBus = {
          emit: jest.fn().mockResolvedValue(undefined),
          on: jest.fn((type, handler) => handlers.push(handler)),
          off: jest.fn(),
          once: jest.fn(),
          filter: jest.fn().mockReturnThis(),
          pipe: jest.fn().mockReturnThis(),
          getHistory: jest.fn().mockReturnValue([]),
          replay: jest.fn().mockResolvedValue(undefined),
          getStatistics: jest.fn().mockReturnValue({ events: 0 })
        };
        
        const testEvent: PluginEvent = {
          type: 'test',
          source: 'test-plugin',
          data: { message: 'Hello' },
          timestamp: new Date().toISOString()
        };
        
        await mockEventBus.emit(testEvent);
        expect(mockEventBus.emit).toHaveBeenCalledWith(testEvent);
        
        const handler = jest.fn();
        mockEventBus.on('test', handler);
        expect(handlers).toContain(handler);
        
        const filtered = mockEventBus.filter(event => event.type === 'test');
        expect(filtered).toBe(mockEventBus);
      });
    });

    describe('WebBuddyPlugin', () => {
      it('should implement plugin interface', async () => {
        const mockPlugin: WebBuddyPlugin = {
          id: 'test-plugin',
          name: 'Test Plugin',
          version: '1.0.0',
          description: 'Test plugin',
          author: 'Test Author',
          metadata: {
            id: 'test-plugin',
            name: 'Test Plugin',
            version: '1.0.0',
            description: 'Test plugin',
            author: 'Test Author'
          },
          capabilities: {
            supportedDomains: ['example.com'],
            contractDefinitions: [],
            permissions: ['storage'],
            requiredAPIs: []
          },
          state: 'uninitialized',
          initialize: jest.fn().mockResolvedValue(undefined),
          activate: jest.fn().mockResolvedValue(undefined),
          deactivate: jest.fn().mockResolvedValue(undefined),
          destroy: jest.fn().mockResolvedValue(undefined),
          getContracts: jest.fn().mockReturnValue([]),
          executeCapability: jest.fn().mockResolvedValue({ result: 'success' }),
          validateCapability: jest.fn().mockResolvedValue({ valid: true, errors: [] }),
          getUIComponents: jest.fn().mockReturnValue([]),
          getMenuItems: jest.fn().mockReturnValue([]),
          onEvent: jest.fn().mockResolvedValue(undefined),
          getDefaultConfig: jest.fn().mockReturnValue({
            enabled: true,
            settings: {},
            domains: [],
            permissions: [],
            uiPreferences: {}
          }),
          onConfigChange: jest.fn().mockResolvedValue(undefined),
          healthCheck: jest.fn().mockResolvedValue({ healthy: true, issues: [] }),
          getMetrics: jest.fn().mockResolvedValue({ calls: 0 })
        };
        
        expect(mockPlugin.id).toBe('test-plugin');
        expect(mockPlugin.state).toBe('uninitialized');
        
        await mockPlugin.initialize({} as PluginContext);
        expect(mockPlugin.initialize).toHaveBeenCalled();
        
        const result = await mockPlugin.executeCapability('test', {});
        expect(result).toEqual({ result: 'success' });
        
        const health = await mockPlugin.healthCheck();
        expect(health.healthy).toBe(true);
      });
    });
  });

  describe('Contract Validation Tests', () => {
    it('should validate contract parameters', () => {
      const validation: ContractValidation = {
        pattern: '^[a-z]+$',
        minLength: 3,
        maxLength: 10,
        custom: (value) => value !== 'forbidden'
      };
      
      expect(validation.pattern).toBe('^[a-z]+$');
      expect(validation.minLength).toBe(3);
      expect(validation.custom?.('allowed')).toBe(true);
      expect(validation.custom?.('forbidden')).toBe(false);
    });

    it('should validate numeric constraints', () => {
      const validation: ContractValidation = {
        min: 0,
        max: 100,
        enum: [10, 20, 30, 40, 50]
      };
      
      expect(validation.min).toBe(0);
      expect(validation.max).toBe(100);
      expect(validation.enum).toContain(30);
    });
  });

  describe('UI Component Tests', () => {
    it('should create a valid UI component', async () => {
      const component: PluginUIComponent = {
        id: 'test-component',
        type: 'panel',
        name: 'Test Panel',
        description: 'A test panel',
        icon: 'test-icon.svg',
        render: jest.fn().mockResolvedValue(document.createElement('div')),
        onMount: jest.fn(),
        onUnmount: jest.fn(),
        onUpdate: jest.fn(),
        onShow: jest.fn(),
        onHide: jest.fn(),
        onResize: jest.fn()
      };
      
      const element = await component.render();
      expect(element).toBeInstanceOf(HTMLElement);
      
      component.onResize?.({ width: 100, height: 200 });
      expect(component.onResize).toHaveBeenCalledWith({ width: 100, height: 200 });
    });

    it('should create a valid menu item', () => {
      const menuItem: PluginMenuItem = {
        id: 'test-menu',
        label: 'Test Menu',
        description: 'A test menu item',
        icon: 'menu-icon.svg',
        shortcut: 'Ctrl+T',
        action: jest.fn(),
        enabled: jest.fn().mockReturnValue(true),
        visible: jest.fn().mockReturnValue(true),
        submenu: [
          {
            id: 'submenu-1',
            label: 'Submenu Item',
            action: jest.fn()
          }
        ]
      };
      
      expect(menuItem.label).toBe('Test Menu');
      expect(menuItem.enabled?.()).toBe(true);
      expect(menuItem.submenu).toHaveLength(1);
    });
  });
});