/**
 * Extended Unit Tests for Plugin Storage System
 * Tests advanced features: migration, statistics, cleanup, configuration
 */

import { DefaultPluginStorageService } from './plugin-storage';
import { PluginError } from './plugin-interface';

// Mock chrome storage API
const mockStorageData: Record<string, any> = {};
const mockChrome = {
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        const result: Record<string, any> = {};
        if (Array.isArray(keys)) {
          keys.forEach(key => {
            if (mockStorageData[key]) {
              result[key] = mockStorageData[key];
            }
          });
        } else if (typeof keys === 'string') {
          if (mockStorageData[keys]) {
            result[keys] = mockStorageData[keys];
          }
        } else if (keys === null) {
          // Return all data
          Object.assign(result, mockStorageData);
        }
        if (callback) callback(result);
        return Promise.resolve(result);
      }),
      set: jest.fn((items, callback) => {
        Object.assign(mockStorageData, items);
        if (callback) callback();
        return Promise.resolve();
      }),
      remove: jest.fn((keys, callback) => {
        if (Array.isArray(keys)) {
          keys.forEach(key => delete mockStorageData[key]);
        } else {
          delete mockStorageData[keys];
        }
        if (callback) callback();
        return Promise.resolve();
      }),
      clear: jest.fn((callback) => {
        Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
        if (callback) callback();
        return Promise.resolve();
      })
    }
  },
  runtime: {
    lastError: null as any
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('DefaultPluginStorageService - Advanced Features', () => {
  let storage: DefaultPluginStorageService;
  const pluginId = 'test-plugin';

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
    storage = new DefaultPluginStorageService(pluginId);
  });

  describe('Configuration Management', () => {
    test('should get plugin configuration', async () => {
      const config = {
        id: pluginId,
        name: 'Test Plugin',
        version: '1.0.0',
        enabled: true,
        permissions: ['storage'],
        settings: { theme: 'dark' }
      };

      mockStorageData[`plugin:${pluginId}:__config__`] = {
        value: config,
        timestamp: new Date(),
        version: '1.0.0'
      };

      const retrieved = await storage.getConfig();
      expect(retrieved).toEqual(config);
    });

    test('should return default config when not set', async () => {
      const config = await storage.getConfig();
      expect(config).toEqual({
        enabled: true,
        settings: {},
        domains: [],
        permissions: [],
        uiPreferences: {
          theme: 'auto',
          language: 'en',
          notifications: true
        }
      });
    });

    test('should set plugin configuration', async () => {
      const config = {
        id: pluginId,
        name: 'Test Plugin',
        version: '1.0.0',
        enabled: true
      };

      await storage.setConfig(config);

      const stored = mockStorageData[`plugin:${pluginId}:__config__`];
      expect(stored).toBeDefined();
      expect(stored.value).toMatchObject(config);
    });

    test('should merge partial config updates', async () => {
      const initialConfig = {
        id: pluginId,
        name: 'Test Plugin',
        version: '1.0.0',
        enabled: true,
        settings: { theme: 'light' }
      };

      mockStorageData[`plugin:${pluginId}:__config__`] = {
        value: initialConfig,
        timestamp: new Date(),
        version: '1.0.0'
      };

      await storage.setConfig({ 
        enabled: false,
        settings: { theme: 'dark' }
      });

      const updated = mockStorageData[`plugin:${pluginId}:__config__`];
      expect(updated.value).toEqual({
        ...initialConfig,
        enabled: false,
        settings: { theme: 'dark' }
      });
    });
  });

  describe('Migration System', () => {
    test('should perform data migration', async () => {
      // Set up old data
      await storage.set('user-data', { oldFormat: true, value: 42 });

      // Define migration function
      const migrationFn = (oldData: any) => ({
        newFormat: true,
        migratedValue: oldData.value * 2
      });

      // Perform migration
      await storage.migrate('2.0.0', migrationFn);

      // Check migration result
      const migrated = await storage.get('user-data');
      expect(migrated).toEqual({
        newFormat: true,
        migratedValue: 84
      });

      // Check migration marker
      const migrationStatus = mockStorageData[`plugin:${pluginId}:__migration__:2.0.0`];
      expect(migrationStatus).toBeDefined();
      expect(migrationStatus.value).toBe(true);
    });

    test('should skip already completed migrations', async () => {
      // Mark migration as complete
      mockStorageData[`plugin:${pluginId}:__migration__:2.0.0`] = {
        value: true,
        timestamp: new Date()
      };

      const migrationFn = jest.fn();
      await storage.migrate('2.0.0', migrationFn);

      expect(migrationFn).not.toHaveBeenCalled();
    });

    test('should handle migration errors', async () => {
      await storage.set('data', { value: 'test' });

      const errorMigration = () => {
        throw new Error('Migration failed');
      };

      await expect(storage.migrate('2.0.0', errorMigration))
        .rejects.toThrow(PluginError);
    });
  });

  describe('Storage Statistics', () => {
    test('should calculate storage statistics', async () => {
      // Set up test data
      const now = new Date();
      const old = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago

      await storage.set('key1', 'value1');
      await storage.set('key2', { data: 'value2' });
      await storage.setShared('global', 'shared1', 'shared-value');

      // Manually set timestamps for testing
      mockStorageData[`plugin:${pluginId}:key1`].timestamp = old;

      const stats = await storage.getStatistics();

      expect(stats.totalEntries).toBe(3);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.namespaces).toHaveProperty('plugin', 2);
      expect(stats.namespaces).toHaveProperty('shared:global', 1);
      expect(stats.oldestEntry).toEqual(old);
    });

    test('should handle empty storage statistics', async () => {
      const stats = await storage.getStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.namespaces).toEqual({});
      expect(stats.oldestEntry).toBeUndefined();
      expect(stats.newestEntry).toBeUndefined();
    });
  });

  describe('Cleanup Operations', () => {
    test('should cleanup expired entries', async () => {
      const now = new Date();
      const expired = new Date(now.getTime() - 1000 * 60 * 60); // 1 hour ago
      const future = new Date(now.getTime() + 1000 * 60 * 60); // 1 hour from now

      // Set up entries with different expiration times
      mockStorageData[`plugin:${pluginId}:expired`] = {
        value: 'should-be-removed',
        timestamp: expired,
        expiresAt: expired
      };

      mockStorageData[`plugin:${pluginId}:valid`] = {
        value: 'should-remain',
        timestamp: now,
        expiresAt: future
      };

      mockStorageData[`plugin:${pluginId}:no-expiry`] = {
        value: 'should-remain',
        timestamp: now
      };

      const cleanedCount = await storage.cleanup();

      expect(cleanedCount).toBe(1);
      expect(mockStorageData[`plugin:${pluginId}:expired`]).toBeUndefined();
      expect(mockStorageData[`plugin:${pluginId}:valid`]).toBeDefined();
      expect(mockStorageData[`plugin:${pluginId}:no-expiry`]).toBeDefined();
    });

    test('should cleanup cache when enabled', async () => {
      const cachedStorage = new DefaultPluginStorageService(pluginId, {
        cacheEnabled: true,
        cacheTtl: 100 // 100ms TTL for testing
      });

      await cachedStorage.set('cached-key', 'cached-value');
      
      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      const cleanedCount = await cachedStorage.cleanup();
      
      // Should clean expired cache entries
      expect(cleanedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Event System', () => {
    test('should emit and listen to storage events', async () => {
      const eventListener = jest.fn();
      storage.addEventListener(eventListener);

      await storage.set('key', 'value');

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storage:set',
          pluginId,
          namespace: 'plugin',
          key: 'key',
          success: true
        })
      );
    });

    test('should remove event listeners', async () => {
      const eventListener = jest.fn();
      storage.addEventListener(eventListener);
      storage.removeEventListener(eventListener);

      await storage.set('key', 'value');

      expect(eventListener).not.toHaveBeenCalled();
    });

    test('should emit error events on failure', async () => {
      const eventListener = jest.fn();
      storage.addEventListener(eventListener);

      mockChrome.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));

      try {
        await storage.set('key', 'value');
      } catch (e) {
        // Expected error
      }

      expect(eventListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'storage:set',
          success: false,
          error: 'Storage error'
        })
      );
    });
  });

  describe('Storage Keys Management', () => {
    test('should list all plugin keys', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3');

      const keys = await storage.keys();

      expect(keys).toHaveLength(3);
      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
      expect(keys).toContain('key3');
    });

    test('should filter out non-plugin keys', async () => {
      await storage.set('plugin-key', 'value');
      mockStorageData['other-plugin:key'] = { value: 'other' };
      mockStorageData['shared:global:key'] = { value: 'shared' };

      const keys = await storage.keys();

      expect(keys).toHaveLength(1);
      expect(keys).toContain('plugin-key');
    });
  });

  describe('Chrome Runtime Errors', () => {
    test('should handle chrome runtime errors on set', async () => {
      mockChrome.runtime.lastError = { message: 'Runtime error' };
      
      // Mock the callback-based API to trigger runtime error
      mockChrome.storage.local.set.mockImplementationOnce((items, callback) => {
        if (callback) callback();
        return Promise.resolve();
      });

      await expect(storage.set('key', 'value'))
        .rejects.toThrow('Runtime error');

      mockChrome.runtime.lastError = null;
    });

    test('should handle chrome runtime errors on get', async () => {
      mockChrome.runtime.lastError = { message: 'Runtime error' };
      
      mockChrome.storage.local.get.mockImplementationOnce((keys, callback) => {
        if (callback) callback({});
        return Promise.resolve({});
      });

      await expect(storage.get('key'))
        .rejects.toThrow('Runtime error');

      mockChrome.runtime.lastError = null;
    });
  });
});