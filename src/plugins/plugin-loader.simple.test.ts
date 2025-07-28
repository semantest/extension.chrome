// @ts-nocheck - TypeScript errors due to missing dependencies
/**
 * @fileoverview Simple tests for plugin-loader.ts to improve coverage
 * @description Tests for PluginLoader implementation
 */

import { PluginLoader } from './plugin-loader';

// Mock types
interface PluginManifest {
  metadata: {
    id: string;
    name: string;
    version: string;
  };
  contract?: any;
  dependencies?: string[];
  source?: {
    type: string;
    url?: string;
    path?: string;
  };
}

interface PluginSecurityPolicy {
  allowedDomains: string[];
  allowedPermissions: string[];
  allowedAPIs: string[];
  sandboxed: boolean;
  trustedSource: boolean;
  maxMemoryUsage?: number;
  maxExecutionTime?: number;
}

interface WebBuddyPlugin {
  id: string;
  manifest: PluginManifest;
  initialize?: () => Promise<void>;
  activate?: () => Promise<void>;
  deactivate?: () => Promise<void>;
  unload?: () => Promise<void>;
}

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let mockManifest: PluginManifest;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock console.log
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    loader = new PluginLoader();
    
    // Mock setupSandboxGlobals
    loader['setupSandboxGlobals'] = jest.fn();
    
    mockManifest = {
      metadata: {
        id: 'test-plugin',
        name: 'Test Plugin',
        version: '1.0.0'
      },
      dependencies: []
    };
  });
  
  describe('Constructor', () => {
    it('should initialize with default security policy', () => {
      const loader = new PluginLoader();
      
      expect(loader['defaultSecurityPolicy']).toMatchObject({
        allowedDomains: ['*'],
        allowedPermissions: ['storage', 'tabs'],
        allowedAPIs: ['chrome.runtime', 'chrome.tabs', 'chrome.storage'],
        sandboxed: true,
        trustedSource: false,
        maxMemoryUsage: 10 * 1024 * 1024,
        maxExecutionTime: 5000
      });
    });
    
    it('should accept custom security policy', () => {
      const customPolicy: PluginSecurityPolicy = {
        allowedDomains: ['example.com'],
        allowedPermissions: ['storage'],
        allowedAPIs: ['chrome.storage'],
        sandboxed: false,
        trustedSource: true
      };
      
      const loader = new PluginLoader(customPolicy);
      
      expect(loader['defaultSecurityPolicy']).toMatchObject(customPolicy);
    });
    
    it('should initialize empty collections', () => {
      expect(loader['loadedPlugins'].size).toBe(0);
      expect(loader['dependencyCache'].size).toBe(0);
      expect(loader['sandboxGlobals'].size).toBe(0);
    });
    
    it('should setup sandbox globals', () => {
      expect(loader['setupSandboxGlobals']).toHaveBeenCalled();
    });
  });
  
  describe('Plugin Loading', () => {
    beforeEach(() => {
      // Mock validation methods
      loader['validateManifest'] = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        securityIssues: []
      });
      
      loader['checkDependencies'] = jest.fn().mockResolvedValue(undefined);
      loader['loadPluginCode'] = jest.fn().mockResolvedValue({
        default: class TestPlugin {
          constructor(manifest) {
            this.id = manifest.metadata.id;
            this.manifest = manifest;
          }
          initialize = jest.fn().mockResolvedValue(undefined);
          activate = jest.fn().mockResolvedValue(undefined);
        }
      });
      
      loader['createPluginInstance'] = jest.fn().mockImplementation((PluginClass, manifest) => {
        return new PluginClass(manifest);
      });
    });
    
    it('should load plugin from manifest', async () => {
      const result = await loader.loadFromManifest(mockManifest);
      
      expect(result).toMatchObject({
        plugin: expect.objectContaining({
          id: 'test-plugin',
          manifest: mockManifest
        }),
        manifest: mockManifest,
        loadTime: expect.any(Number),
        warnings: [],
        dependencies: []
      });
      
      expect(console.log).toHaveBeenCalledWith('🔄 Loading plugin: test-plugin');
    });
    
    it('should cache loaded plugins', async () => {
      const result = await loader.loadFromManifest(mockManifest);
      
      expect(loader['loadedPlugins'].has('test-plugin')).toBe(true);
      expect(loader['loadedPlugins'].get('test-plugin')).toBe(result);
    });
    
    it('should reject loading duplicate plugin without reload option', async () => {
      await loader.loadFromManifest(mockManifest);
      
      await expect(loader.loadFromManifest(mockManifest))
        .rejects.toThrow('Plugin test-plugin is already loaded');
    });
    
    it('should allow reload with option', async () => {
      await loader.loadFromManifest(mockManifest);
      
      const result = await loader.loadFromManifest(mockManifest, { allowReload: true });
      
      expect(result).toBeDefined();
      expect(result.plugin.id).toBe('test-plugin');
    });
    
    it('should skip validation when requested', async () => {
      await loader.loadFromManifest(mockManifest, { skipValidation: true });
      
      expect(loader['validateManifest']).not.toHaveBeenCalled();
    });
    
    it('should skip dependencies when requested', async () => {
      await loader.loadFromManifest(mockManifest, { skipDependencies: true });
      
      expect(loader['checkDependencies']).not.toHaveBeenCalled();
    });
  });
  
  describe('Plugin Validation', () => {
    it('should handle validation errors', async () => {
      loader['validateManifest'] = jest.fn().mockReturnValue({
        valid: false,
        errors: ['Invalid manifest structure'],
        warnings: [],
        securityIssues: []
      });
      
      await expect(loader.loadFromManifest(mockManifest))
        .rejects.toThrow();
    });
    
    it('should handle security issues', async () => {
      loader['validateManifest'] = jest.fn().mockReturnValue({
        valid: false,
        errors: [],
        warnings: [],
        securityIssues: ['Requesting dangerous permission']
      });
      
      await expect(loader.loadFromManifest(mockManifest))
        .rejects.toThrow();
    });
  });
  
  describe('Plugin Querying', () => {
    beforeEach(async () => {
      // Setup loader with mock methods
      loader['validateManifest'] = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        securityIssues: []
      });
      
      loader['checkDependencies'] = jest.fn().mockResolvedValue(undefined);
      loader['loadPluginCode'] = jest.fn().mockResolvedValue({
        default: class MockPlugin {
          constructor(manifest) {
            this.id = manifest.metadata.id;
            this.manifest = manifest;
          }
        }
      });
      
      loader['createPluginInstance'] = jest.fn().mockImplementation((PluginClass, manifest) => {
        return new PluginClass(manifest);
      });
      
      // Load a test plugin
      await loader.loadFromManifest(mockManifest);
    });
    
    it('should check if plugin is loaded', () => {
      expect(loader.isLoaded('test-plugin')).toBe(true);
      expect(loader.isLoaded('non-existent')).toBe(false);
    });
    
    it('should get loaded plugin', () => {
      const plugin = loader.getPlugin('test-plugin');
      expect(plugin).toBeDefined();
      expect(plugin?.id).toBe('test-plugin');
    });
    
    it('should return null for non-existent plugin', () => {
      const plugin = loader.getPlugin('non-existent');
      expect(plugin).toBeNull();
    });
    
    it('should get all loaded plugins', () => {
      const plugins = loader.getAllPlugins();
      expect(plugins).toHaveLength(1);
      expect(plugins[0].id).toBe('test-plugin');
    });
    
    it('should get load result', () => {
      const result = loader.getLoadResult('test-plugin');
      expect(result).toBeDefined();
      expect(result?.manifest.metadata.id).toBe('test-plugin');
    });
  });
  
  describe('Plugin Unloading', () => {
    beforeEach(async () => {
      // Setup and load a plugin
      loader['validateManifest'] = jest.fn().mockReturnValue({
        valid: true,
        errors: [],
        warnings: [],
        securityIssues: []
      });
      
      const mockUnload = jest.fn().mockResolvedValue(undefined);
      
      loader['loadPluginCode'] = jest.fn().mockResolvedValue({
        default: class MockPlugin {
          constructor(manifest) {
            this.id = manifest.metadata.id;
            this.manifest = manifest;
            this.unload = mockUnload;
          }
        }
      });
      
      loader['createPluginInstance'] = jest.fn().mockImplementation((PluginClass, manifest) => {
        return new PluginClass(manifest);
      });
      
      await loader.loadFromManifest(mockManifest);
    });
    
    it('should unload plugin', async () => {
      await loader.unloadPlugin('test-plugin');
      
      expect(loader.isLoaded('test-plugin')).toBe(false);
      expect(console.log).toHaveBeenCalledWith('🔚 Unloading plugin: test-plugin');
    });
    
    it('should handle unloading non-existent plugin', async () => {
      await expect(loader.unloadPlugin('non-existent'))
        .rejects.toThrow('Plugin non-existent is not loaded');
    });
  });
});