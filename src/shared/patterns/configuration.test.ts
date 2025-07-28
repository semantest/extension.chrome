/**
 * @jest-environment jsdom
 */

// Mock error-handling module to avoid implementation issues
jest.mock('./error-handling', () => ({
  Result: {
    ok: jest.fn((value) => ({ success: true, value })),
    err: jest.fn((error) => ({ success: false, error })),
    isOk: jest.fn((result) => result.success),
    isErr: jest.fn((result) => !result.success)
  },
  ConfigurationError: jest.fn(function(message, context) {
    this.message = message;
    this.context = context;
    this.name = 'ConfigurationError';
  })
}));

import {
  ConfigSchema,
  ConfigurationManager,
  EnvironmentConfig,
  FeatureFlags,
  SEMANTEST_CONFIG_SCHEMA
} from './configuration';

// Mock chrome.storage API
const mockStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn()
  },
  local: {
    get: jest.fn(),
    set: jest.fn()
  }
};

// Mock chrome.runtime API
const mockRuntime = {
  getManifest: jest.fn()
};

// @ts-ignore
global.chrome = {
  storage: mockStorage,
  runtime: mockRuntime
};

describe('Configuration Patterns', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset static state
    (EnvironmentConfig as any)._isDevelopment = undefined;
    (EnvironmentConfig as any)._isProduction = undefined;
    (FeatureFlags as any).flags = new Map();
    (FeatureFlags as any).overrides = new Map();
  });
  
  describe('ConfigurationManager', () => {
    interface TestConfig {
      apiKey?: string;
      maxItems: number;
      enableFeature: boolean;
      settings?: object;
      tags?: string[];
    }
    
    const testSchema: ConfigSchema = {
      apiKey: {
        type: 'string',
        required: false,
        description: 'API key'
      },
      maxItems: {
        type: 'number',
        required: true,
        default: 10,
        validate: (v) => v > 0 && v <= 100
      },
      enableFeature: {
        type: 'boolean',
        required: true,
        default: false
      },
      settings: {
        type: 'object',
        required: false
      },
      tags: {
        type: 'array',
        required: false,
        default: []
      }
    };
    
    let manager: ConfigurationManager<TestConfig>;
    
    beforeEach(() => {
      manager = new ConfigurationManager<TestConfig>(testSchema, mockStorage.sync);
    });
    
    describe('load', () => {
      it('should load configuration with defaults', async () => {
        mockStorage.sync.get.mockResolvedValue({});
        
        const result = await manager.load();
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toEqual({
            maxItems: 10,
            enableFeature: false,
            tags: []
          });
        }
      });
      
      it('should load stored configuration', async () => {
        mockStorage.sync.get.mockResolvedValue({
          apiKey: 'test-key',
          maxItems: 50,
          enableFeature: true,
          settings: { theme: 'dark' },
          tags: ['test', 'demo']
        });
        
        const result = await manager.load();
        
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.value).toEqual({
            apiKey: 'test-key',
            maxItems: 50,
            enableFeature: true,
            settings: { theme: 'dark' },
            tags: ['test', 'demo']
          });
        }
      });
      
      it('should fail on missing required fields', async () => {
        mockStorage.sync.get.mockResolvedValue({
          apiKey: 'test-key'
          // Missing maxItems and enableFeature
        });
        
        const result = await manager.load();
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Missing required configuration');
        }
      });
      
      it('should fail on invalid type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 'not-a-number',
          enableFeature: false
        });
        
        const result = await manager.load();
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Invalid type for maxItems');
        }
      });
      
      it('should fail on validation error', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 150, // > 100
          enableFeature: false
        });
        
        const result = await manager.load();
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Invalid value for maxItems');
        }
      });
      
      it('should handle storage errors', async () => {
        mockStorage.sync.get.mockRejectedValue(new Error('Storage error'));
        
        const result = await manager.load();
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Failed to load configuration');
        }
      });
    });
    
    describe('save', () => {
      beforeEach(async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false
        });
        await manager.load();
      });
      
      it('should save valid updates', async () => {
        mockStorage.sync.set.mockResolvedValue(undefined);
        
        const result = await manager.save({
          apiKey: 'new-key',
          maxItems: 20
        });
        
        expect(result.success).toBe(true);
        expect(mockStorage.sync.set).toHaveBeenCalledWith({
          apiKey: 'new-key',
          maxItems: 20
        });
      });
      
      it('should fail on unknown key', async () => {
        const result = await manager.save({
          unknownKey: 'value'
        } as any);
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Unknown configuration key');
        }
      });
      
      it('should fail on invalid type', async () => {
        const result = await manager.save({
          maxItems: 'not-a-number' as any
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Invalid type for maxItems');
        }
      });
      
      it('should fail on validation error', async () => {
        const result = await manager.save({
          maxItems: 150 // > 100
        });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Invalid value for maxItems');
        }
      });
      
      it('should handle storage errors', async () => {
        mockStorage.sync.set.mockRejectedValue(new Error('Storage error'));
        
        const result = await manager.save({ maxItems: 20 });
        
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.message).toContain('Failed to save configuration');
        }
      });
      
      it('should notify listeners on successful save', async () => {
        mockStorage.sync.set.mockResolvedValue(undefined);
        const listener = jest.fn();
        manager.onChange(listener);
        
        await manager.save({ maxItems: 20 });
        
        expect(listener).toHaveBeenCalledWith(expect.objectContaining({
          maxItems: 20
        }));
      });
    });
    
    describe('get', () => {
      beforeEach(async () => {
        mockStorage.sync.get.mockResolvedValue({
          apiKey: 'test-key',
          maxItems: 10,
          enableFeature: true
        });
        await manager.load();
      });
      
      it('should get specific configuration value', () => {
        expect(manager.get('apiKey')).toBe('test-key');
        expect(manager.get('maxItems')).toBe(10);
        expect(manager.get('enableFeature')).toBe(true);
      });
      
      it('should return undefined for missing values', () => {
        expect(manager.get('settings')).toBeUndefined();
      });
    });
    
    describe('getAll', () => {
      beforeEach(async () => {
        mockStorage.sync.get.mockResolvedValue({
          apiKey: 'test-key',
          maxItems: 10,
          enableFeature: true
        });
        await manager.load();
      });
      
      it('should get all configuration values', () => {
        const all = manager.getAll();
        
        expect(all).toEqual({
          apiKey: 'test-key',
          maxItems: 10,
          enableFeature: true
        });
      });
      
      it('should return a copy of configuration', () => {
        const all1 = manager.getAll();
        const all2 = manager.getAll();
        
        expect(all1).not.toBe(all2);
        expect(all1).toEqual(all2);
      });
    });
    
    describe('onChange', () => {
      it('should add and remove listeners', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false
        });
        await manager.load();
        
        const listener = jest.fn();
        const unsubscribe = manager.onChange(listener);
        
        mockStorage.sync.set.mockResolvedValue(undefined);
        await manager.save({ maxItems: 20 });
        
        expect(listener).toHaveBeenCalledTimes(1);
        
        unsubscribe();
        
        await manager.save({ maxItems: 30 });
        
        expect(listener).toHaveBeenCalledTimes(1); // Not called again
      });
      
      it('should handle listener errors', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false
        });
        await manager.load();
        
        const errorListener = jest.fn(() => {
          throw new Error('Listener error');
        });
        const goodListener = jest.fn();
        
        manager.onChange(errorListener);
        manager.onChange(goodListener);
        
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        
        mockStorage.sync.set.mockResolvedValue(undefined);
        await manager.save({ maxItems: 20 });
        
        expect(consoleError).toHaveBeenCalled();
        expect(goodListener).toHaveBeenCalled(); // Other listeners still called
        
        consoleError.mockRestore();
      });
    });
    
    describe('validateType', () => {
      it('should validate string type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          apiKey: 'test',
          maxItems: 10,
          enableFeature: false
        });
        
        const result = await manager.load();
        expect(result.success).toBe(true);
      });
      
      it('should validate number type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 42,
          enableFeature: false
        });
        
        const result = await manager.load();
        expect(result.success).toBe(true);
      });
      
      it('should validate boolean type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: true
        });
        
        const result = await manager.load();
        expect(result.success).toBe(true);
      });
      
      it('should validate object type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false,
          settings: { theme: 'dark' }
        });
        
        const result = await manager.load();
        expect(result.success).toBe(true);
      });
      
      it('should validate array type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false,
          tags: ['test', 'demo']
        });
        
        const result = await manager.load();
        expect(result.success).toBe(true);
      });
      
      it('should reject null for object type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false,
          settings: null
        });
        
        const result = await manager.load();
        expect(result.success).toBe(false);
      });
      
      it('should reject arrays for object type', async () => {
        mockStorage.sync.get.mockResolvedValue({
          maxItems: 10,
          enableFeature: false,
          settings: []
        });
        
        const result = await manager.load();
        expect(result.success).toBe(false);
      });
    });
  });
  
  describe('EnvironmentConfig', () => {
    it('should detect development environment', () => {
      mockRuntime.getManifest.mockReturnValue({
        name: 'Test Extension',
        version: '1.0.0'
        // No update_url
      });
      
      expect(EnvironmentConfig.isDevelopment).toBe(true);
      expect(EnvironmentConfig.isProduction).toBe(false);
    });
    
    it('should detect production environment', () => {
      mockRuntime.getManifest.mockReturnValue({
        name: 'Test Extension',
        version: '1.0.0',
        update_url: 'https://clients2.google.com/service/update2/crx'
      });
      
      expect(EnvironmentConfig.isDevelopment).toBe(false);
      expect(EnvironmentConfig.isProduction).toBe(true);
    });
    
    it('should cache environment detection', () => {
      mockRuntime.getManifest.mockReturnValue({});
      
      // First call
      const isDev1 = EnvironmentConfig.isDevelopment;
      const isProd1 = EnvironmentConfig.isProduction;
      
      // Change mock value
      mockRuntime.getManifest.mockReturnValue({ update_url: 'test' });
      
      // Second call should return cached value
      const isDev2 = EnvironmentConfig.isDevelopment;
      const isProd2 = EnvironmentConfig.isProduction;
      
      expect(isDev1).toBe(isDev2);
      expect(isProd1).toBe(isProd2);
      expect(mockRuntime.getManifest).toHaveBeenCalledTimes(2); // Once for each property
    });
    
    it('should set log level based on environment', () => {
      mockRuntime.getManifest.mockReturnValue({});
      expect(EnvironmentConfig.logLevel).toBe('debug');
      
      // Reset cache
      (EnvironmentConfig as any)._isDevelopment = undefined;
      
      mockRuntime.getManifest.mockReturnValue({ update_url: 'test' });
      expect(EnvironmentConfig.logLevel).toBe('info');
    });
  });
  
  describe('FeatureFlags', () => {
    describe('load', () => {
      it('should load feature flags from storage', async () => {
        mockStorage.local.get.mockResolvedValue({
          featureFlags: {
            feature1: true,
            feature2: false,
            feature3: true
          }
        });
        
        await FeatureFlags.load();
        
        expect(FeatureFlags.isEnabled('feature1')).toBe(true);
        expect(FeatureFlags.isEnabled('feature2')).toBe(false);
        expect(FeatureFlags.isEnabled('feature3')).toBe(true);
      });
      
      it('should handle missing feature flags', async () => {
        mockStorage.local.get.mockResolvedValue({});
        
        await FeatureFlags.load();
        
        expect(FeatureFlags.isEnabled('feature1')).toBe(false);
      });
      
      it('should handle storage errors', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        mockStorage.local.get.mockRejectedValue(new Error('Storage error'));
        
        await FeatureFlags.load();
        
        expect(consoleError).toHaveBeenCalled();
        expect(FeatureFlags.isEnabled('feature1')).toBe(false);
        
        consoleError.mockRestore();
      });
    });
    
    describe('isEnabled', () => {
      beforeEach(async () => {
        mockStorage.local.get.mockResolvedValue({
          featureFlags: {
            enabledFeature: true,
            disabledFeature: false
          }
        });
        await FeatureFlags.load();
      });
      
      it('should return stored flag value', () => {
        expect(FeatureFlags.isEnabled('enabledFeature')).toBe(true);
        expect(FeatureFlags.isEnabled('disabledFeature')).toBe(false);
      });
      
      it('should return default value for unknown flags', () => {
        expect(FeatureFlags.isEnabled('unknownFeature')).toBe(false);
        expect(FeatureFlags.isEnabled('unknownFeature', true)).toBe(true);
      });
      
      it('should prioritize overrides', () => {
        FeatureFlags.override('enabledFeature', false);
        expect(FeatureFlags.isEnabled('enabledFeature')).toBe(false);
        
        FeatureFlags.override('unknownFeature', true);
        expect(FeatureFlags.isEnabled('unknownFeature')).toBe(true);
      });
    });
    
    describe('setFlag', () => {
      it('should save flag to storage', async () => {
        mockStorage.local.set.mockResolvedValue(undefined);
        
        await FeatureFlags.setFlag('newFeature', true);
        
        expect(mockStorage.local.set).toHaveBeenCalledWith({
          featureFlags: { newFeature: true }
        });
        expect(FeatureFlags.isEnabled('newFeature')).toBe(true);
      });
      
      it('should handle storage errors', async () => {
        const consoleError = jest.spyOn(console, 'error').mockImplementation();
        mockStorage.local.set.mockRejectedValue(new Error('Storage error'));
        
        await FeatureFlags.setFlag('newFeature', true);
        
        expect(consoleError).toHaveBeenCalled();
        expect(FeatureFlags.isEnabled('newFeature')).toBe(true); // Still set in memory
        
        consoleError.mockRestore();
      });
    });
    
    describe('override', () => {
      it('should override flag values', () => {
        FeatureFlags.override('testFeature', true);
        expect(FeatureFlags.isEnabled('testFeature')).toBe(true);
        
        FeatureFlags.override('testFeature', false);
        expect(FeatureFlags.isEnabled('testFeature')).toBe(false);
      });
    });
    
    describe('clearOverride', () => {
      beforeEach(async () => {
        mockStorage.local.get.mockResolvedValue({
          featureFlags: { testFeature: false }
        });
        await FeatureFlags.load();
      });
      
      it('should clear override and return to stored value', () => {
        FeatureFlags.override('testFeature', true);
        expect(FeatureFlags.isEnabled('testFeature')).toBe(true);
        
        FeatureFlags.clearOverride('testFeature');
        expect(FeatureFlags.isEnabled('testFeature')).toBe(false);
      });
    });
  });
  
  describe('SEMANTEST_CONFIG_SCHEMA', () => {
    it('should have valid schema definitions', () => {
      expect(SEMANTEST_CONFIG_SCHEMA.apiKey).toEqual({
        type: 'string',
        required: false,
        description: 'API key for external services'
      });
      
      expect(SEMANTEST_CONFIG_SCHEMA.maxPatterns).toEqual({
        type: 'number',
        default: 100,
        validate: expect.any(Function),
        description: 'Maximum number of patterns to store'
      });
      
      expect(SEMANTEST_CONFIG_SCHEMA.performance).toEqual({
        type: 'object',
        default: {
          enableOptimizations: true,
          cacheSize: 50,
          throttleDelay: 100
        },
        description: 'Performance optimization settings'
      });
    });
    
    it('should validate maxPatterns correctly', () => {
      const validate = SEMANTEST_CONFIG_SCHEMA.maxPatterns.validate!;
      
      expect(validate(0)).toBe(false);
      expect(validate(1)).toBe(true);
      expect(validate(100)).toBe(true);
      expect(validate(1000)).toBe(true);
      expect(validate(1001)).toBe(false);
    });
  });
});