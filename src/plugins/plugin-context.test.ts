/**
 * Unit Tests for Plugin Context System
 * Tests plugin context creation, lifecycle management, and dependency injection
 */

import { PluginContextManager } from './plugin-context';
import {
  PluginContext,
  PluginManifest,
  PluginStorageService,
  PluginUIService,
  PluginCommunicationService,
  PluginSecurityService,
  PluginCapability,
  PluginError
} from './plugin-interface';

// Mock implementations
class MockStorageService implements PluginStorageService {
  private storage: Map<string, any> = new Map();

  async set(key: string, value: any): Promise<void> {
    this.storage.set(key, value);
  }

  async get(key: string): Promise<any> {
    return this.storage.get(key);
  }

  async remove(key: string): Promise<void> {
    this.storage.delete(key);
  }

  async clear(): Promise<void> {
    this.storage.clear();
  }

  async setShared(namespace: string, key: string, value: any): Promise<void> {
    this.storage.set(`shared:${namespace}:${key}`, value);
  }

  async getShared(namespace: string, key: string): Promise<any> {
    return this.storage.get(`shared:${namespace}:${key}`);
  }

  async removeShared(namespace: string, key: string): Promise<void> {
    this.storage.delete(`shared:${namespace}:${key}`);
  }
}

class MockUIService implements PluginUIService {
  mountComponent = jest.fn();
  unmountComponent = jest.fn();
  updateComponent = jest.fn();
  registerMenuItem = jest.fn();
  unregisterMenuItem = jest.fn();
  showNotification = jest.fn();
  showModal = jest.fn();
  getTheme = jest.fn(() => 'light' as const);
}

class MockCommunicationService implements PluginCommunicationService {
  sendMessage = jest.fn();
  onMessage = jest.fn(() => () => {});
  broadcast = jest.fn();
  sendToExtension = jest.fn();
  onExtensionMessage = jest.fn(() => () => {});
}

class MockSecurityService implements PluginSecurityService {
  validatePermission = jest.fn(() => true);
  validateAPIAccess = jest.fn(() => true);
  validateDomainAccess = jest.fn(() => true);
  reportViolation = jest.fn();
  getSandboxRestrictions = jest.fn(() => ({
    allowedAPIs: [],
    blockedGlobals: [],
    maxMemoryUsage: 10485760,
    maxExecutionTime: 5000
  }));
}

describe('PluginContextManager', () => {
  let contextManager: PluginContextManager;
  let mockServices: {
    storage: MockStorageService;
    ui: MockUIService;
    communication: MockCommunicationService;
    security: MockSecurityService;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockServices = {
      storage: new MockStorageService(),
      ui: new MockUIService(),
      communication: new MockCommunicationService(),
      security: new MockSecurityService()
    };

    contextManager = new PluginContextManager(
      mockServices.storage,
      mockServices.ui,
      mockServices.communication,
      mockServices.security
    );
  });

  const createMockManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    metadata: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      ...overrides.metadata
    },
    capabilities: {
      supportedDomains: ['*'],
      permissions: ['storage', 'tabs'],
      contractDefinitions: [],
      requiredAPIs: ['chrome.storage'],
      ...overrides.capabilities
    },
    entry: {
      script: './plugin.js',
      className: 'TestPlugin'
    },
    dependencies: []
  });

  describe('Context Creation', () => {
    test('should create plugin context', () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.manifest).toEqual(manifest);
      expect(context.storage).toBeDefined();
      expect(context.ui).toBeDefined();
      expect(context.communication).toBeDefined();
      expect(context.security).toBeDefined();
    });

    test('should provide scoped services', () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      // Services should be scoped to the plugin
      expect(context.storage).not.toBe(mockServices.storage);
      expect(context.ui).not.toBe(mockServices.ui);
    });

    test('should include capabilities from manifest', () => {
      const mockCapability: PluginCapability = {
        id: 'custom-capability',
        name: 'Custom Capability',
        execute: jest.fn(),
        validate: jest.fn(() => ({ valid: true, errors: [] }))
      };

      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest, [mockCapability]);
      
      expect(context.capabilities).toContain(mockCapability);
    });

    test('should validate permissions on context creation', () => {
      const manifest = createMockManifest({
        capabilities: {
          permissions: ['storage', 'debugger'] // debugger might be restricted
        }
      });

      contextManager.createContext('test-plugin', manifest);
      
      expect(mockServices.security.validatePermission).toHaveBeenCalledWith('storage');
      expect(mockServices.security.validatePermission).toHaveBeenCalledWith('debugger');
    });

    test('should throw error for denied permissions', () => {
      mockServices.security.validatePermission.mockReturnValue(false);
      
      const manifest = createMockManifest({
        capabilities: {
          permissions: ['debugger']
        }
      });

      expect(() => {
        contextManager.createContext('test-plugin', manifest);
      }).toThrow(PluginError);
    });
  });

  describe('Context Lifecycle', () => {
    test('should initialize context', async () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      await contextManager.initializeContext('test-plugin');
      
      const state = contextManager.getContextState('test-plugin');
      expect(state).toBe('initialized');
    });

    test('should activate context', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      await contextManager.initializeContext('test-plugin');
      await contextManager.activateContext('test-plugin');
      
      const state = contextManager.getContextState('test-plugin');
      expect(state).toBe('active');
    });

    test('should deactivate context', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      await contextManager.initializeContext('test-plugin');
      await contextManager.activateContext('test-plugin');
      await contextManager.deactivateContext('test-plugin');
      
      const state = contextManager.getContextState('test-plugin');
      expect(state).toBe('inactive');
    });

    test('should destroy context', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      await contextManager.destroyContext('test-plugin');
      
      expect(contextManager.getContext('test-plugin')).toBeNull();
    });

    test('should enforce lifecycle order', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      // Cannot activate before initializing
      await expect(contextManager.activateContext('test-plugin'))
        .rejects.toThrow('Context must be initialized before activation');
      
      await contextManager.initializeContext('test-plugin');
      await contextManager.activateContext('test-plugin');
      
      // Cannot initialize when already active
      await expect(contextManager.initializeContext('test-plugin'))
        .rejects.toThrow('Context is already initialized');
    });
  });

  describe('Service Scoping', () => {
    test('should scope storage service to plugin', async () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      await context.storage.set('key', 'value');
      const value = await context.storage.get('key');
      
      expect(value).toBe('value');
      
      // Verify it's scoped
      const rawValue = await mockServices.storage.get('key');
      expect(rawValue).toBeUndefined(); // Should be prefixed in actual storage
    });

    test('should scope UI service to plugin', () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      const component = { id: 'test-component', render: () => {} };
      context.ui.mountComponent(component as any, document.body);
      
      expect(mockServices.ui.mountComponent).toHaveBeenCalledWith(
        expect.objectContaining({ pluginId: 'test-plugin' }),
        expect.any(Object),
        expect.any(Object)
      );
    });

    test('should scope communication service to plugin', async () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      await context.communication.sendMessage('target', { type: 'test', data: {} });
      
      expect(mockServices.communication.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'test-plugin' }),
        'target',
        expect.any(Object)
      );
    });
  });

  describe('Capability Management', () => {
    test('should register custom capabilities', () => {
      const capability: PluginCapability = {
        id: 'custom',
        name: 'Custom Capability',
        execute: jest.fn(),
        validate: jest.fn(() => ({ valid: true, errors: [] }))
      };

      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest, [capability]);
      
      const registeredCapability = context.capabilities.find(c => c.id === 'custom');
      expect(registeredCapability).toBe(capability);
    });

    test('should execute capabilities with security validation', async () => {
      const capability: PluginCapability = {
        id: 'test-action',
        name: 'Test Action',
        execute: jest.fn(async () => ({ success: true })),
        validate: jest.fn(() => ({ valid: true, errors: [] }))
      };

      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest, [capability]);
      
      const result = await contextManager.executeCapability(
        'test-plugin',
        'test-action',
        { param: 'value' }
      );
      
      expect(capability.validate).toHaveBeenCalledWith({ param: 'value' });
      expect(capability.execute).toHaveBeenCalledWith(
        { param: 'value' },
        context
      );
      expect(result).toEqual({ success: true });
    });

    test('should reject invalid capability execution', async () => {
      const capability: PluginCapability = {
        id: 'test-action',
        name: 'Test Action',
        execute: jest.fn(),
        validate: jest.fn(() => ({ valid: false, errors: ['Invalid param'] }))
      };

      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest, [capability]);
      
      await expect(contextManager.executeCapability(
        'test-plugin',
        'test-action',
        {}
      )).rejects.toThrow('Capability validation failed');
      
      expect(capability.execute).not.toHaveBeenCalled();
    });
  });

  describe('Context Queries', () => {
    beforeEach(() => {
      const manifests = [
        createMockManifest({ metadata: { id: 'plugin1' } }),
        createMockManifest({ metadata: { id: 'plugin2' } }),
        createMockManifest({ metadata: { id: 'plugin3' } })
      ];

      manifests.forEach(manifest => {
        contextManager.createContext(manifest.metadata.id, manifest);
      });
    });

    test('should get context by plugin ID', () => {
      const context = contextManager.getContext('plugin1');
      
      expect(context).toBeDefined();
      expect(context?.pluginId).toBe('plugin1');
    });

    test('should get all contexts', () => {
      const contexts = contextManager.getAllContexts();
      
      expect(contexts).toHaveLength(3);
      expect(contexts.map(c => c.pluginId)).toContain('plugin1');
      expect(contexts.map(c => c.pluginId)).toContain('plugin2');
      expect(contexts.map(c => c.pluginId)).toContain('plugin3');
    });

    test('should get contexts by state', async () => {
      await contextManager.initializeContext('plugin1');
      await contextManager.initializeContext('plugin2');
      await contextManager.activateContext('plugin2');
      
      const initializedContexts = contextManager.getContextsByState('initialized');
      const activeContexts = contextManager.getContextsByState('active');
      
      expect(initializedContexts).toHaveLength(1);
      expect(activeContexts).toHaveLength(1);
      expect(activeContexts[0].pluginId).toBe('plugin2');
    });
  });

  describe('Error Handling', () => {
    test('should handle initialization errors', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      // Mock storage service to throw error
      mockServices.storage.set = jest.fn().mockRejectedValue(new Error('Storage error'));
      
      await expect(contextManager.initializeContext('test-plugin'))
        .rejects.toThrow('Storage error');
      
      const state = contextManager.getContextState('test-plugin');
      expect(state).toBe('error');
    });

    test('should cleanup on destroy even with errors', async () => {
      const manifest = createMockManifest();
      contextManager.createContext('test-plugin', manifest);
      
      mockServices.ui.unmountComponent.mockRejectedValue(new Error('UI error'));
      
      // Should not throw
      await contextManager.destroyContext('test-plugin');
      
      expect(contextManager.getContext('test-plugin')).toBeNull();
    });
  });

  describe('Security Integration', () => {
    test('should enforce API access restrictions', () => {
      mockServices.security.validateAPIAccess.mockReturnValue(false);
      
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      // Context should have restricted API access
      expect(context.security.getSandboxRestrictions()).toBeDefined();
    });

    test('should report security violations', async () => {
      const manifest = createMockManifest();
      const context = contextManager.createContext('test-plugin', manifest);
      
      context.security.reportViolation({
        type: 'permission-denied',
        description: 'Attempted to access restricted API',
        severity: 'medium'
      });
      
      expect(mockServices.security.reportViolation).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        type: 'permission-denied',
        description: 'Attempted to access restricted API',
        severity: 'medium'
      });
    });
  });

  describe('Cleanup', () => {
    test('should cleanup all contexts on shutdown', async () => {
      const manifests = [
        createMockManifest({ metadata: { id: 'plugin1' } }),
        createMockManifest({ metadata: { id: 'plugin2' } })
      ];

      manifests.forEach(manifest => {
        contextManager.createContext(manifest.metadata.id, manifest);
      });

      await contextManager.shutdown();
      
      expect(contextManager.getAllContexts()).toHaveLength(0);
    });
  });
});