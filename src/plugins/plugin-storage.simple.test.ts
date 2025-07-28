/**
 * Unit Tests for Plugin Storage System - DefaultPluginStorageService
 * Tests basic plugin-scoped storage functionality
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
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('DefaultPluginStorageService', () => {
  let storage: DefaultPluginStorageService;
  const pluginId = 'test-plugin';

  beforeEach(() => {
    jest.clearAllMocks();
    Object.keys(mockStorageData).forEach(key => delete mockStorageData[key]);
    storage = new DefaultPluginStorageService(pluginId);
  });

  describe('Basic Storage Operations', () => {
    test('should set and get values', async () => {
      await storage.set('test-key', 'test-value');
      const value = await storage.get('test-key');
      
      expect(value).toBe('test-value');
    });

    test('should handle complex data types', async () => {
      const complexData = {
        string: 'hello',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        nested: { foo: 'bar' }
      };

      await storage.set('complex', complexData);
      const retrieved = await storage.get('complex');
      
      expect(retrieved).toEqual(complexData);
    });

    test('should return undefined for non-existent keys', async () => {
      const value = await storage.get('non-existent');
      
      expect(value).toBeUndefined();
    });

    test('should remove values', async () => {
      await storage.set('to-remove', 'value');
      await storage.remove('to-remove');
      const value = await storage.get('to-remove');
      
      expect(value).toBeUndefined();
    });

    test('should clear all storage', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      
      await storage.clear();
      
      const value1 = await storage.get('key1');
      const value2 = await storage.get('key2');
      
      expect(value1).toBeUndefined();
      expect(value2).toBeUndefined();
    });
  });

  describe('Plugin Isolation', () => {
    test('should isolate storage by plugin ID', async () => {
      await storage.set('key', 'value');
      
      const storageKey = Object.keys(mockStorageData)[0];
      expect(storageKey).toMatch(new RegExp(`^plugin:${pluginId}:`));
    });

    test('should not interfere with other plugins', async () => {
      const storage2 = new DefaultPluginStorageService('another-plugin');
      
      await storage.set('shared-key', 'plugin1-value');
      await storage2.set('shared-key', 'plugin2-value');
      
      const value1 = await storage.get('shared-key');
      const value2 = await storage2.get('shared-key');
      
      expect(value1).toBe('plugin1-value');
      expect(value2).toBe('plugin2-value');
    });
  });

  describe('Shared Storage', () => {
    test('should access shared storage namespace', async () => {
      await storage.setShared('global', 'shared-key', 'shared-value');
      const value = await storage.getShared('global', 'shared-key');
      
      expect(value).toBe('shared-value');
    });

    test('should allow cross-plugin shared storage access', async () => {
      const storage2 = new DefaultPluginStorageService('another-plugin');
      
      await storage.setShared('global', 'data', { message: 'hello' });
      const value = await storage2.getShared('global', 'data');
      
      expect(value).toEqual({ message: 'hello' });
    });

    test('should remove shared storage values', async () => {
      await storage.setShared('global', 'to-remove', 'value');
      await storage.removeShared('global', 'to-remove');
      const value = await storage.getShared('global', 'to-remove');
      
      expect(value).toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle chrome storage errors on set', async () => {
      mockChrome.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storage.set('key', 'value'))
        .rejects.toThrow(PluginError);
    });

    test('should handle chrome storage errors on get', async () => {
      mockChrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storage.get('key'))
        .rejects.toThrow(PluginError);
    });

    test('should handle chrome storage errors on remove', async () => {
      mockChrome.storage.local.remove.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storage.remove('key'))
        .rejects.toThrow(PluginError);
    });

    test('should handle chrome storage errors on clear', async () => {
      mockChrome.storage.local.clear.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storage.clear())
        .rejects.toThrow(PluginError);
    });
  });

  describe('Cache Management', () => {
    test('should cache values when enabled', async () => {
      const cacheEnabledStorage = new DefaultPluginStorageService(pluginId, {
        cacheEnabled: true
      });
      
      await cacheEnabledStorage.set('cached-key', 'cached-value');
      
      // Clear the actual storage to verify cache is working
      mockStorageData[`plugin:${pluginId}:cached-key`] = undefined;
      
      // Should still get value from cache
      const value = await cacheEnabledStorage.get('cached-key');
      expect(value).toBe('cached-value');
    });

    test('should not cache when disabled', async () => {
      const noCacheStorage = new DefaultPluginStorageService(pluginId, {
        cacheEnabled: false
      });
      
      await noCacheStorage.set('key', 'value');
      
      // Clear the actual storage
      mockStorageData[`plugin:${pluginId}:key`] = undefined;
      
      // Should not get value from cache
      const value = await noCacheStorage.get('key');
      expect(value).toBeUndefined();
    });
  });
});