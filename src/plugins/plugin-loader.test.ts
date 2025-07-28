/**
 * Unit Tests for Plugin Loader
 * Tests plugin loading, validation, sandboxing, and dependency management
 */

import { PluginLoader } from './plugin-loader';
import {
  PluginManifest,
  PluginLoadError,
  PluginSecurityError,
  PluginDependencyError,
  PluginSecurityPolicy,
  WebBuddyPlugin
} from './plugin-interface';

// Mock chrome APIs
const mockChrome = {
  runtime: {
    getURL: jest.fn((path: string) => `chrome-extension://extension-id/${path}`),
    id: 'test-extension-id'
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock plugin implementation
const mockPluginCode = `
  class TestPlugin {
    constructor() {
      this.id = 'test-plugin';
      this.name = 'Test Plugin';
      this.version = '1.0.0';
      this.description = 'A test plugin';
      this.author = 'Test Author';
      this.metadata = {
        id: this.id,
        name: this.name,
        version: this.version
      };
      this.capabilities = {
        supportedDomains: ['*'],
        permissions: ['storage']
      };
    }

    async initialize(context) {
      this.context = context;
      return true;
    }

    async activate() {
      this.active = true;
    }

    async deactivate() {
      this.active = false;
    }

    async destroy() {
      this.destroyed = true;
    }

    getContracts() {
      return [];
    }

    async executeCapability(capability, params) {
      return { success: true };
    }

    async validateCapability(capability, params) {
      return { valid: true, errors: [] };
    }

    getUIComponents() {
      return [];
    }

    getMenuItems() {
      return [];
    }

    async onEvent(event) {
      // Handle event
    }
  }

  // Export the plugin class
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TestPlugin;
  }
`;

// Mock file system operations
jest.mock('fs/promises', () => ({
  readFile: jest.fn(),
  access: jest.fn(),
  stat: jest.fn()
}));

import * as fs from 'fs/promises';

describe('PluginLoader', () => {
  let loader: PluginLoader;
  let defaultSecurityPolicy: PluginSecurityPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    defaultSecurityPolicy = {
      allowedDomains: ['*'],
      allowedPermissions: ['storage', 'tabs'],
      allowedAPIs: ['chrome.runtime', 'chrome.tabs', 'chrome.storage'],
      sandboxed: true,
      trustedSource: false,
      maxMemoryUsage: 10 * 1024 * 1024,
      maxExecutionTime: 5000
    };

    loader = new PluginLoader(defaultSecurityPolicy);
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
      permissions: ['storage'],
      contractDefinitions: [],
      requiredAPIs: ['chrome.storage'],
      ...overrides.capabilities
    },
    entry: {
      script: './plugins/test-plugin.js',
      className: 'TestPlugin',
      ...overrides.entry
    },
    dependencies: overrides.dependencies || []
  });

  describe('Plugin Loading', () => {
    test('should load a valid plugin from manifest', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest);

      expect(result.plugin).toBeDefined();
      expect(result.plugin.id).toBe('test-plugin');
      expect(result.manifest).toBe(manifest);
      expect(result.loadTime).toBeGreaterThan(0);
      expect(result.warnings).toEqual([]);
    });

    test('should prevent duplicate plugin loading', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await loader.loadFromManifest(manifest);

      await expect(loader.loadFromManifest(manifest))
        .rejects.toThrow(PluginLoadError);
    });

    test('should allow plugin reload with option', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await loader.loadFromManifest(manifest);
      
      const result = await loader.loadFromManifest(manifest, { allowReload: true });
      
      expect(result.plugin).toBeDefined();
    });

    test('should handle missing plugin file', async () => {
      const manifest = createMockManifest();
      
      (fs.access as jest.Mock).mockRejectedValue(new Error('File not found'));

      await expect(loader.loadFromManifest(manifest))
        .rejects.toThrow(PluginLoadError);
    });

    test('should handle malformed plugin code', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue('invalid javascript code {');
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(loader.loadFromManifest(manifest))
        .rejects.toThrow(PluginLoadError);
    });

    test('should load plugin from URL', async () => {
      const pluginUrl = 'https://example.com/plugin.js';
      const manifest = createMockManifest({
        entry: {
          script: pluginUrl,
          className: 'TestPlugin'
        }
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockPluginCode)
      });

      const result = await loader.loadFromURL(pluginUrl, manifest);

      expect(result.plugin).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(pluginUrl);
    });

    test('should handle URL loading errors', async () => {
      const pluginUrl = 'https://example.com/plugin.js';
      const manifest = createMockManifest({
        entry: {
          script: pluginUrl,
          className: 'TestPlugin'
        }
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404
      });

      await expect(loader.loadFromURL(pluginUrl, manifest))
        .rejects.toThrow(PluginLoadError);
    });

    test('should load inline plugin', async () => {
      const manifest = createMockManifest({
        entry: {
          script: 'inline',
          className: 'TestPlugin'
        }
      });

      const result = await loader.loadFromInline(mockPluginCode, manifest);

      expect(result.plugin).toBeDefined();
    });
  });

  describe('Plugin Validation', () => {
    test('should validate plugin structure', () => {
      const mockPlugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        metadata: {},
        capabilities: {},
        initialize: jest.fn(),
        activate: jest.fn(),
        deactivate: jest.fn(),
        destroy: jest.fn(),
        getContracts: jest.fn(),
        executeCapability: jest.fn(),
        validateCapability: jest.fn(),
        getUIComponents: jest.fn(),
        getMenuItems: jest.fn(),
        onEvent: jest.fn()
      };

      const result = loader.validatePlugin(mockPlugin as any, createMockManifest());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect missing required properties', () => {
      const invalidPlugin = {
        id: 'test',
        name: 'Test'
        // Missing required properties
      };

      const result = loader.validatePlugin(invalidPlugin as any, createMockManifest());

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should detect missing required methods', () => {
      const invalidPlugin = {
        id: 'test',
        name: 'Test',
        version: '1.0.0',
        metadata: {},
        capabilities: {},
        // Missing required methods
      };

      const result = loader.validatePlugin(invalidPlugin as any, createMockManifest());

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required method: initialize');
    });

    test('should validate manifest structure', () => {
      const result = loader.validateManifest(createMockManifest());

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should detect invalid manifest', () => {
      const invalidManifest = {
        metadata: {
          // Missing required fields
        }
      } as any;

      const result = loader.validateManifest(invalidManifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should validate security constraints', () => {
      const manifest = createMockManifest({
        capabilities: {
          permissions: ['storage', 'tabs'],
          allowedAPIs: ['chrome.storage', 'chrome.tabs']
        }
      });

      const result = loader.validateSecurity(manifest, defaultSecurityPolicy);

      expect(result.valid).toBe(true);
      expect(result.securityIssues).toHaveLength(0);
    });

    test('should detect security violations', () => {
      const manifest = createMockManifest({
        capabilities: {
          permissions: ['storage', 'tabs', 'webRequest', 'proxy'],
          allowedAPIs: ['chrome.storage', 'chrome.tabs', 'chrome.webRequest']
        }
      });

      const result = loader.validateSecurity(manifest, defaultSecurityPolicy);

      expect(result.valid).toBe(false);
      expect(result.securityIssues.length).toBeGreaterThan(0);
    });
  });

  describe('Dependency Management', () => {
    test('should load plugin dependencies', async () => {
      const dependencyCode = mockPluginCode.replace('test-plugin', 'dependency-plugin');
      
      const dependencyManifest = createMockManifest({
        metadata: { id: 'dependency-plugin' }
      });
      
      const mainManifest = createMockManifest({
        dependencies: ['dependency-plugin']
      });

      (fs.readFile as jest.Mock)
        .mockResolvedValueOnce(dependencyCode)
        .mockResolvedValueOnce(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      // Mock dependency resolution
      jest.spyOn(loader as any, 'resolveDependency')
        .mockResolvedValue({ manifest: dependencyManifest, path: './dependency.js' });

      const result = await loader.loadFromManifest(mainManifest);

      expect(result.dependencies).toContain('dependency-plugin');
    });

    test('should handle missing dependencies', async () => {
      const manifest = createMockManifest({
        dependencies: ['missing-plugin']
      });

      jest.spyOn(loader as any, 'resolveDependency')
        .mockRejectedValue(new Error('Dependency not found'));

      await expect(loader.loadFromManifest(manifest))
        .rejects.toThrow(PluginDependencyError);
    });

    test('should detect circular dependencies', async () => {
      const manifest1 = createMockManifest({
        metadata: { id: 'plugin1' },
        dependencies: ['plugin2']
      });

      const manifest2 = createMockManifest({
        metadata: { id: 'plugin2' },
        dependencies: ['plugin1']
      });

      jest.spyOn(loader as any, 'resolveDependency')
        .mockImplementation((depId) => {
          if (depId === 'plugin2') return { manifest: manifest2, path: './plugin2.js' };
          if (depId === 'plugin1') return { manifest: manifest1, path: './plugin1.js' };
        });

      await expect(loader.loadFromManifest(manifest1))
        .rejects.toThrow(PluginDependencyError);
    });

    test('should skip dependency loading with option', async () => {
      const manifest = createMockManifest({
        dependencies: ['some-plugin']
      });

      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest, { skipDependencies: true });

      expect(result.plugin).toBeDefined();
      expect(result.dependencies).toHaveLength(0);
    });
  });

  describe('Plugin Sandboxing', () => {
    test('should create sandboxed plugin instance', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest, { sandboxed: true });

      expect(result.plugin).toBeDefined();
      // Sandboxed plugins should have restricted global access
    });

    test('should enforce memory limits', async () => {
      const manifest = createMockManifest();
      const memoryIntensiveCode = `
        class MemoryPlugin {
          constructor() {
            this.data = new Array(1000000).fill('x'.repeat(100)); // Large memory usage
            Object.assign(this, ${JSON.stringify({
              id: 'memory-plugin',
              name: 'Memory Plugin',
              version: '1.0.0',
              metadata: {},
              capabilities: {}
            })});
          }
          ${mockPluginCode.match(/async \w+\([^)]*\)[^{]*{[^}]*}/g)?.join('\n')}
        }
        module.exports = MemoryPlugin;
      `;

      (fs.readFile as jest.Mock).mockResolvedValue(memoryIntensiveCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      // Should handle memory-intensive plugins gracefully
      const result = await loader.loadFromManifest(manifest, { 
        sandboxed: true,
        securityPolicy: { ...defaultSecurityPolicy, maxMemoryUsage: 1024 } // 1KB limit
      });

      expect(result.warnings.length).toBeGreaterThan(0);
    });

    test('should enforce execution time limits', async () => {
      const manifest = createMockManifest();
      const slowPluginCode = `
        class SlowPlugin {
          constructor() {
            Object.assign(this, ${JSON.stringify({
              id: 'slow-plugin',
              name: 'Slow Plugin',
              version: '1.0.0',
              metadata: {},
              capabilities: {}
            })});
          }
          async initialize(context) {
            // Simulate slow initialization
            const start = Date.now();
            while (Date.now() - start < 10000) {} // 10 second loop
          }
          ${mockPluginCode.match(/async \w+\([^)]*\)[^{]*{[^}]*}/g)?.slice(1).join('\n')}
        }
        module.exports = SlowPlugin;
      `;

      (fs.readFile as jest.Mock).mockResolvedValue(slowPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest, {
        sandboxed: true,
        timeout: 100 // 100ms timeout
      });

      expect(result.warnings).toContain(expect.stringContaining('execution time'));
    });

    test('should restrict API access in sandbox', async () => {
      const manifest = createMockManifest({
        capabilities: {
          allowedAPIs: ['chrome.storage']
        }
      });

      const restrictedPluginCode = `
        class RestrictedPlugin {
          constructor() {
            Object.assign(this, ${JSON.stringify({
              id: 'restricted-plugin',
              name: 'Restricted Plugin',
              version: '1.0.0',
              metadata: {},
              capabilities: {}
            })});
          }
          async initialize(context) {
            // Try to access restricted API
            chrome.tabs.create({ url: 'https://evil.com' });
          }
          ${mockPluginCode.match(/async \w+\([^)]*\)[^{]*{[^}]*}/g)?.slice(1).join('\n')}
        }
        module.exports = RestrictedPlugin;
      `;

      (fs.readFile as jest.Mock).mockResolvedValue(restrictedPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest, { sandboxed: true });

      expect(result.warnings).toContain(expect.stringContaining('API access'));
    });
  });

  describe('Plugin Unloading', () => {
    test('should unload plugin successfully', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await loader.loadFromManifest(manifest);
      
      const result = await loader.unload('test-plugin');

      expect(result).toBe(true);
      expect(loader.getLoadedPlugin('test-plugin')).toBeNull();
    });

    test('should handle unloading non-existent plugin', async () => {
      const result = await loader.unload('non-existent');

      expect(result).toBe(false);
    });

    test('should clean up resources on unload', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const loadResult = await loader.loadFromManifest(manifest);
      
      jest.spyOn(loadResult.plugin, 'destroy');

      await loader.unload('test-plugin');

      expect(loadResult.plugin.destroy).toHaveBeenCalled();
    });
  });

  describe('Plugin Queries', () => {
    beforeEach(async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(mockPluginCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await loader.loadFromManifest(createMockManifest({ 
        metadata: { id: 'plugin1' } 
      }));
      
      await loader.loadFromManifest(createMockManifest({ 
        metadata: { id: 'plugin2' },
        capabilities: { supportedDomains: ['example.com'] }
      }), { allowReload: true });
    });

    test('should get loaded plugin by ID', () => {
      const result = loader.getLoadedPlugin('plugin1');

      expect(result).toBeDefined();
      expect(result?.plugin.id).toBe('plugin1');
    });

    test('should get all loaded plugins', () => {
      const plugins = loader.getAllLoadedPlugins();

      expect(plugins).toHaveLength(2);
      expect(plugins.map(p => p.plugin.id)).toContain('plugin1');
      expect(plugins.map(p => p.plugin.id)).toContain('plugin2');
    });

    test('should check if plugin is loaded', () => {
      expect(loader.isLoaded('plugin1')).toBe(true);
      expect(loader.isLoaded('plugin3')).toBe(false);
    });

    test('should get plugin load statistics', () => {
      const stats = loader.getLoadStatistics();

      expect(stats.totalLoaded).toBe(2);
      expect(stats.totalErrors).toBe(0);
      expect(stats.averageLoadTime).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    test('should handle plugin constructor errors', async () => {
      const faultyCode = `
        class FaultyPlugin {
          constructor() {
            throw new Error('Constructor error');
          }
        }
        module.exports = FaultyPlugin;
      `;

      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(faultyCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(loader.loadFromManifest(manifest))
        .rejects.toThrow(PluginLoadError);
    });

    test('should handle timeout during loading', async () => {
      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(mockPluginCode), 1000))
      );
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      await expect(loader.loadFromManifest(manifest, { timeout: 100 }))
        .rejects.toThrow(PluginLoadError);
    });

    test('should collect and report warnings', async () => {
      const warningPlugin = mockPluginCode.replace(
        'permissions: [\'storage\']',
        'permissions: [\'storage\', \'unlimitedStorage\', \'notifications\']'
      );

      const manifest = createMockManifest({
        capabilities: {
          permissions: ['storage', 'unlimitedStorage', 'notifications']
        }
      });
      
      (fs.readFile as jest.Mock).mockResolvedValue(warningPlugin);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('Security Features', () => {
    test('should validate trusted sources', async () => {
      const pluginUrl = 'https://trusted.example.com/plugin.js';
      const manifest = createMockManifest({
        entry: {
          script: pluginUrl,
          className: 'TestPlugin'
        }
      });

      const trustedPolicy: PluginSecurityPolicy = {
        ...defaultSecurityPolicy,
        trustedSource: true,
        trustedDomains: ['trusted.example.com']
      };

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: jest.fn().mockResolvedValue(mockPluginCode)
      });

      jest.spyOn(loader as any, 'verifySignature').mockResolvedValue(true);

      const result = await loader.loadFromURL(
        pluginUrl,
        manifest,
        { securityPolicy: trustedPolicy }
      );

      expect(result.plugin).toBeDefined();
    });

    test('should reject untrusted sources', async () => {
      const pluginUrl = 'https://untrusted.example.com/plugin.js';
      const manifest = createMockManifest({
        entry: {
          script: pluginUrl,
          className: 'TestPlugin'
        }
      });

      const trustedPolicy: PluginSecurityPolicy = {
        ...defaultSecurityPolicy,
        trustedSource: true,
        trustedDomains: ['trusted.example.com']
      };

      await expect(loader.loadFromURL(
        pluginUrl,
        manifest,
        { securityPolicy: trustedPolicy }
      )).rejects.toThrow(PluginSecurityError);
    });

    test('should sanitize plugin code', async () => {
      const maliciousCode = `
        // Attempt to access global scope
        window.location = 'https://evil.com';
        eval('malicious code');
        Function('return this')().alert('XSS');
        
        ${mockPluginCode}
      `;

      const manifest = createMockManifest();
      
      (fs.readFile as jest.Mock).mockResolvedValue(maliciousCode);
      (fs.access as jest.Mock).mockResolvedValue(undefined);

      const result = await loader.loadFromManifest(manifest, { sandboxed: true });

      expect(result.warnings).toContain(expect.stringContaining('potentially unsafe'));
    });
  });
});