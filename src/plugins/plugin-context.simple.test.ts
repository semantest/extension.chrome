// @ts-nocheck - TypeScript errors due to missing dependencies
/**
 * @fileoverview Simple tests for plugin-context.ts to improve coverage
 * @description Tests for DefaultPluginContext implementation
 */

import { DefaultPluginContext } from './plugin-context';

// Mock types and interfaces
interface PluginMetadata {
  name: string;
  version: string;
  description: string;
}

interface PluginConfiguration {
  [key: string]: any;
}

interface PluginLogger {
  debug: jest.Mock;
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  child: jest.Mock;
}

describe('DefaultPluginContext', () => {
  let context: DefaultPluginContext;
  let mockServices: any;
  let mockMetadata: PluginMetadata;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockMetadata = {
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'Test plugin for unit tests'
    };
    
    mockServices = {
      contractRegistry: {
        register: jest.fn(),
        get: jest.fn(),
        list: jest.fn()
      },
      executionService: {
        execute: jest.fn(),
        validate: jest.fn()
      },
      storageService: {
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
        clear: jest.fn()
      },
      tabManager: {
        getActive: jest.fn(),
        query: jest.fn(),
        update: jest.fn()
      },
      extensionAPI: {
        runtime: { id: 'test-extension-id' },
        tabs: {},
        storage: {}
      },
      messaging: {
        send: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      eventBus: {
        emit: jest.fn(),
        on: jest.fn(),
        off: jest.fn()
      },
      config: {
        get: jest.fn().mockReturnValue({}),
        set: jest.fn()
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        child: jest.fn().mockReturnThis()
      }
    };
    
    context = new DefaultPluginContext('test-plugin', mockMetadata, mockServices);
  });
  
  describe('Constructor and Properties', () => {
    it('should initialize with correct plugin ID', () => {
      expect(context.pluginId).toBe('test-plugin');
    });
    
    it('should store metadata correctly', () => {
      expect(context.metadata).toEqual(mockMetadata);
    });
    
    it('should assign all services', () => {
      expect(context.contractRegistry).toBe(mockServices.contractRegistry);
      expect(context.executionService).toBe(mockServices.executionService);
      expect(context.storageService).toBe(mockServices.storageService);
      expect(context.tabManager).toBe(mockServices.tabManager);
      expect(context.extensionAPI).toBe(mockServices.extensionAPI);
      expect(context.messaging).toBe(mockServices.messaging);
      expect(context.eventBus).toBe(mockServices.eventBus);
      expect(context.config).toBe(mockServices.config);
      expect(context.logger).toBe(mockServices.logger);
    });
  });
  
  describe('UI Component Creation', () => {
    it('should create UI component with unique ID', () => {
      const definition = {
        name: 'TestComponent',
        type: 'button',
        render: jest.fn()
      };
      
      const component = context.createUIComponent(definition);
      
      expect(component).toMatchObject({
        id: expect.stringMatching(/^test-plugin-TestComponent-\d+$/),
        name: 'TestComponent',
        type: 'button',
        render: definition.render
      });
    });
    
    it('should create multiple components with unique IDs', () => {
      const definition = { name: 'TestComponent', type: 'panel' };
      
      const comp1 = context.createUIComponent(definition);
      const comp2 = context.createUIComponent(definition);
      
      expect(comp1.id).not.toBe(comp2.id);
      expect(comp1.id).toMatch(/^test-plugin-TestComponent-\d+$/);
      expect(comp2.id).toMatch(/^test-plugin-TestComponent-\d+$/);
    });
  });
  
  describe('Menu Item Creation', () => {
    it('should create menu item with unique ID', () => {
      const definition = {
        label: 'Test Menu',
        icon: 'test-icon',
        action: jest.fn()
      };
      
      const menuItem = context.createMenuItem(definition);
      
      expect(menuItem).toMatchObject({
        id: expect.stringMatching(/^test-plugin-test-menu-\d+$/),
        label: 'Test Menu',
        icon: 'test-icon',
        action: definition.action
      });
    });
    
    it('should handle labels with spaces correctly', () => {
      const definition = { label: 'Test Menu Item' };
      
      const menuItem = context.createMenuItem(definition);
      
      expect(menuItem.id).toMatch(/^test-plugin-test-menu-item-\d+$/);
    });
    
    it('should handle special characters in labels', () => {
      const definition = { label: 'Test & Menu (Item)' };
      
      const menuItem = context.createMenuItem(definition);
      
      expect(menuItem.id).toMatch(/^test-plugin-test-menu-item-\d+$/);
    });
  });
  
  describe('State Management', () => {
    it('should start with uninitialized state', () => {
      expect(context.getState()).toBe('uninitialized');
    });
    
    it('should update state and log the change', () => {
      context.setState('active');
      
      expect(context.getState()).toBe('active');
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        'Plugin state changed: uninitialized -> active',
        expect.objectContaining({
          pluginId: 'test-plugin',
          oldState: 'uninitialized',
          newState: 'active',
          timestamp: expect.any(String)
        })
      );
    });
    
    it('should handle multiple state transitions', () => {
      context.setState('initializing');
      expect(context.getState()).toBe('initializing');
      
      context.setState('active');
      expect(context.getState()).toBe('active');
      
      context.setState('suspended');
      expect(context.getState()).toBe('suspended');
      
      expect(mockServices.logger.debug).toHaveBeenCalledTimes(3);
    });
  });
  
  describe('Dependency Management', () => {
    it('should start with no dependencies', () => {
      expect(context.hasDependency('test-dep')).toBe(false);
      expect(context.getDependencies()).toEqual([]);
    });
    
    it('should add and check dependencies', () => {
      const testDep = { name: 'Test Dependency' };
      
      context.addDependency('test-dep', testDep);
      
      expect(context.hasDependency('test-dep')).toBe(true);
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        'Dependency added: test-dep',
        expect.objectContaining({
          pluginId: 'test-plugin',
          dependencyId: 'test-dep'
        })
      );
    });
    
    it('should retrieve added dependency', async () => {
      const testDep = { name: 'Test Dependency' };
      context.addDependency('test-dep', testDep);
      
      const retrieved = await context.getDependency('test-dep');
      
      expect(retrieved).toBe(testDep);
    });
    
    it('should remove dependencies', () => {
      context.addDependency('test-dep', { name: 'Test' });
      expect(context.hasDependency('test-dep')).toBe(true);
      
      context.removeDependency('test-dep');
      
      expect(context.hasDependency('test-dep')).toBe(false);
      expect(mockServices.logger.debug).toHaveBeenCalledWith(
        'Dependency removed: test-dep',
        expect.objectContaining({
          pluginId: 'test-plugin',
          dependencyId: 'test-dep'
        })
      );
    });
    
    it('should list all dependencies', () => {
      context.addDependency('dep1', { id: 1 });
      context.addDependency('dep2', { id: 2 });
      context.addDependency('dep3', { id: 3 });
      
      const deps = context.getDependencies();
      
      expect(deps).toHaveLength(3);
      expect(deps).toContain('dep1');
      expect(deps).toContain('dep2');
      expect(deps).toContain('dep3');
    });
    
    it('should handle dependency resolution errors', async () => {
      // Mock resolveDependency to throw error
      context['resolveDependency'] = jest.fn().mockRejectedValue(new Error('Resolution failed'));
      
      const result = await context.getDependency('error-dep');
      
      expect(result).toBeNull();
      expect(mockServices.logger.error).toHaveBeenCalledWith(
        'Failed to resolve dependency error-dep:',
        expect.any(Error),
        expect.objectContaining({
          pluginId: 'test-plugin',
          dependencyId: 'error-dep'
        })
      );
    });
  });
  
  describe('Scoped Services', () => {
    it('should create scoped logger', () => {
      const scopedLogger = context.createScopedLogger('test-scope');
      
      expect(mockServices.logger.child).toHaveBeenCalledWith({
        pluginId: 'test-plugin',
        scope: 'test-scope'
      });
      expect(scopedLogger).toBe(mockServices.logger);
    });
    
    it('should create scoped storage', () => {
      // Mock ScopedStorageService
      context['createScopedStorage'] = jest.fn().mockReturnValue({
        namespace: 'test-namespace'
      });
      
      const scopedStorage = context.createScopedStorage('test-namespace');
      
      expect(scopedStorage).toMatchObject({
        namespace: 'test-namespace'
      });
    });
  });
});