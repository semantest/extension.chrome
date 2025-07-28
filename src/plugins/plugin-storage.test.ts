/**
 * Unit Tests for Plugin Storage System
 * Tests plugin-scoped storage, isolation, migrations, and shared storage capabilities
 */

import { DefaultPluginStorageService, StorageNamespace, StorageEventType } from './plugin-storage';
import {
  PluginStorageService,
  PluginConfiguration,
  PluginError
} from './plugin-interface';

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
        } else if (keys === null || keys === undefined) {
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
      }),
      getBytesInUse: jest.fn((keys, callback) => {
        const size = JSON.stringify(mockStorageData).length;
        if (callback) callback(size);
        return Promise.resolve(size);
      })
    },
    onChanged: {
      addListener: jest.fn()
    }
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock crypto for checksums
global.crypto = {
  subtle: {
    digest: jest.fn(async (algorithm, data) => {
      // Simple mock hash
      return new ArrayBuffer(32);
    })
  }
} as any;

describe('PluginStorage', () => {
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

    test('should return null for non-existent keys', async () => {
      const value = await storage.get('non-existent');
      
      expect(value).toBeUndefined();
    });

    test('should return undefined for non-existent keys', async () => {
      const value = await storage.get('non-existent');
      
      expect(value).toBeUndefined();
    });

    test('should remove values', async () => {
      await storage.set('to-remove', 'value');
      await storage.remove('to-remove');
      const value = await storage.get('to-remove');
      
      expect(value).toBeNull();
    });

    test('should verify key existence by getting value', async () => {
      await storage.set('exists', 'value');
      
      const exists = await storage.get('exists');
      const notExists = await storage.get('not-exists');
      
      expect(exists).toBe('value');
      expect(notExists).toBeUndefined();
    });
  });

  describe('Namespace Isolation', () => {
    test('should isolate plugin storage by default', async () => {
      await storage.set('key', 'value');
      
      const storageKey = Object.keys(mockStorageData)[0];
      expect(storageKey).toMatch(new RegExp(`^plugin:${pluginId}:`));
    });

    test('should support different namespaces', async () => {
      await storage.set('key1', 'value1', 'plugin');
      await storage.set('key2', 'value2', 'config');
      await storage.set('key3', 'value3', 'cache');
      
      expect(Object.keys(mockStorageData)).toHaveLength(3);
      expect(Object.keys(mockStorageData).some(k => k.includes(':plugin:'))).toBe(true);
      expect(Object.keys(mockStorageData).some(k => k.includes(':config:'))).toBe(true);
      expect(Object.keys(mockStorageData).some(k => k.includes(':cache:'))).toBe(true);
    });

    test('should get all values in namespace', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3', 'config');
      
      const pluginValues = await storage.getAll('plugin');
      
      expect(Object.keys(pluginValues)).toHaveLength(2);
      expect(pluginValues.key1).toBe('value1');
      expect(pluginValues.key2).toBe('value2');
    });

    test('should clear namespace', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2');
      await storage.set('key3', 'value3', 'config');
      
      await storage.clearNamespace('plugin');
      
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2')).toBeNull();
      expect(await storage.get('key3', null, 'config')).toBe('value3');
    });
  });

  describe('Shared Storage', () => {
    test('should access shared storage', async () => {
      await storage.setShared('shared-key', 'shared-value');
      const value = await storage.getShared('shared-key');
      
      expect(value).toBe('shared-value');
      expect(Object.keys(mockStorageData)[0]).toMatch(/^shared:/);
    });

    test('should allow cross-plugin shared storage access', async () => {
      const storage2 = new DefaultPluginStorageService('another-plugin');
      
      await storage.setShared('shared-data', { message: 'hello' });
      const value = await storage2.getShared('shared-data');
      
      expect(value).toEqual({ message: 'hello' });
    });

    test('should list shared keys', async () => {
      await storage.setShared('shared1', 'value1');
      await storage.setShared('shared2', 'value2');
      await storage.set('plugin-key', 'plugin-value');
      
      const sharedKeys = await storage.listSharedKeys();
      
      expect(sharedKeys).toHaveLength(2);
      expect(sharedKeys).toContain('shared1');
      expect(sharedKeys).toContain('shared2');
    });
  });

  describe('TTL and Expiration', () => {
    test('should set values with TTL', async () => {
      await storage.setWithTTL('ttl-key', 'ttl-value', 1000); // 1 second
      
      const value = await storage.get('ttl-key');
      expect(value).toBe('ttl-value');
    });

    test('should return null for expired values', async () => {
      jest.useFakeTimers();
      
      await storage.setWithTTL('ttl-key', 'ttl-value', 1000); // 1 second
      
      // Fast forward time
      jest.advanceTimersByTime(2000);
      
      const value = await storage.get('ttl-key');
      expect(value).toBeNull();
      
      jest.useRealTimers();
    });

    test('should clean expired entries', async () => {
      jest.useFakeTimers();
      
      await storage.setWithTTL('ttl1', 'value1', 1000);
      await storage.setWithTTL('ttl2', 'value2', 2000);
      await storage.set('permanent', 'value3');
      
      jest.advanceTimersByTime(1500);
      
      await storage.cleanExpired();
      
      expect(await storage.get('ttl1')).toBeNull();
      expect(await storage.get('ttl2')).toBe('value2');
      expect(await storage.get('permanent')).toBe('value3');
      
      jest.useRealTimers();
    });
  });

  describe('Configuration Storage', () => {
    test('should save and load plugin configuration', async () => {
      const config: PluginConfiguration = {
        enabled: true,
        settings: {
          theme: 'dark',
          maxItems: 10
        },
        domains: ['example.com'],
        permissions: ['storage'],
        uiPreferences: {
          theme: 'dark',
          language: 'en',
          notifications: true
        }
      };

      await storage.saveConfiguration(config);
      const loaded = await storage.loadConfiguration();
      
      expect(loaded).toEqual(config);
    });

    test('should merge configuration updates', async () => {
      const initial: PluginConfiguration = {
        enabled: true,
        settings: {
          theme: 'dark'
        },
        domains: [],
        permissions: [],
        uiPreferences: {}
      };

      const update: Partial<PluginConfiguration> = {
        settings: {
          theme: 'light',
          newOption: 'value'
        }
      };

      await storage.saveConfiguration(initial);
      await storage.updateConfiguration(update);
      
      const loaded = await storage.loadConfiguration();
      
      expect(loaded?.settings.theme).toBe('light');
      expect(loaded?.settings.enabled).toBe(true);
      expect(loaded?.settings.newOption).toBe('value');
    });

    test('should validate configuration', async () => {
      const config: PluginConfiguration = {
        enabled: true,
        settings: {
          maxItems: 10
        },
        domains: [],
        permissions: [],
        uiPreferences: {}
      };

      await storage.saveConfiguration(config);
      
      const validUpdate = { settings: { maxItems: 50 } };
      const invalidUpdate = { settings: { maxItems: 200 } };
      
      expect(await storage.validateConfiguration(validUpdate)).toBe(true);
      expect(await storage.validateConfiguration(invalidUpdate)).toBe(false);
    });
  });

  describe('Data Migration', () => {
    test('should migrate data with version change', async () => {
      // Set old data
      await storage.set('data', { version: 1, value: 'old' });
      
      // Define migration
      const migration = (oldData: any) => ({
        version: 2,
        value: oldData.value.toUpperCase(),
        migrated: true
      });
      
      await storage.migrate('data', '1.0.0', '2.0.0', migration);
      
      const migrated = await storage.get('data');
      expect(migrated).toEqual({
        version: 2,
        value: 'OLD',
        migrated: true
      });
    });

    test('should backup data before migration', async () => {
      await storage.set('data', { value: 'original' });
      
      await storage.migrate('data', '1.0.0', '2.0.0', (old: any) => ({ 
        value: 'migrated' 
      }));
      
      const backup = await storage.get('data_backup_1.0.0');
      expect(backup).toEqual({ value: 'original' });
    });

    test('should handle migration errors', async () => {
      await storage.set('data', { value: 'test' });
      
      const faultyMigration = () => {
        throw new Error('Migration failed');
      };
      
      await expect(storage.migrate('data', '1.0.0', '2.0.0', faultyMigration))
        .rejects.toThrow('Migration failed');
      
      // Original data should be intact
      const data = await storage.get('data');
      expect(data).toEqual({ value: 'test' });
    });
  });

  describe('Storage Statistics', () => {
    test('should get storage statistics', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2', 'config');
      await storage.setShared('shared', 'value3');
      
      const stats = await storage.getStatistics();
      
      expect(stats.totalEntries).toBe(3);
      expect(stats.namespaces['plugin']).toBe(1);
      expect(stats.namespaces['config']).toBe(1);
      expect(stats.namespaces['shared']).toBe(1);
    });

    test('should calculate storage size', async () => {
      await storage.set('data', { large: 'x'.repeat(1000) });
      
      const size = await storage.getSize();
      
      expect(size).toBeGreaterThan(1000);
    });

    test('should track oldest and newest entries', async () => {
      jest.useFakeTimers();
      const baseTime = new Date('2023-01-01').getTime();
      jest.setSystemTime(baseTime);
      
      await storage.set('old', 'value1');
      
      jest.advanceTimersByTime(60000); // 1 minute
      await storage.set('new', 'value2');
      
      const stats = await storage.getStatistics();
      
      expect(stats.oldestEntry?.getTime()).toBe(baseTime);
      expect(stats.newestEntry?.getTime()).toBe(baseTime + 60000);
      
      jest.useRealTimers();
    });
  });

  describe('Event Handling', () => {
    test('should emit storage events', async () => {
      const events: any[] = [];
      const listener = (event: any) => events.push(event);
      
      storage.on(StorageEventType.SET, listener);
      storage.on(StorageEventType.GET, listener);
      storage.on(StorageEventType.REMOVE, listener);
      
      await storage.set('key', 'value');
      await storage.get('key');
      await storage.remove('key');
      
      expect(events).toHaveLength(3);
      expect(events[0].type).toBe(StorageEventType.SET);
      expect(events[1].type).toBe(StorageEventType.GET);
      expect(events[2].type).toBe(StorageEventType.REMOVE);
    });

    test('should handle storage change events from chrome API', async () => {
      const changeListener = jest.fn();
      storage.onChanged(changeListener);
      
      // Simulate chrome storage change
      const mockChangeCallback = mockChrome.storage.onChanged.addListener.mock.calls[0][0];
      mockChangeCallback({
        [`plugin:${pluginId}:key`]: {
          oldValue: 'old',
          newValue: 'new'
        }
      }, 'local');
      
      expect(changeListener).toHaveBeenCalledWith(
        'key',
        'old',
        'new',
        'plugin'
      );
    });
  });

  describe('Quota Management', () => {
    test('should check quota usage', async () => {
      const quota = await storage.getQuotaUsage();
      
      expect(quota.used).toBeGreaterThanOrEqual(0);
      expect(quota.total).toBeGreaterThan(0);
      expect(quota.percentage).toBeGreaterThanOrEqual(0);
    });

    test('should warn when approaching quota', async () => {
      const warningSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock high quota usage
      jest.spyOn(storage as any, 'getQuotaUsage').mockResolvedValue({
        used: 9 * 1024 * 1024,
        total: 10 * 1024 * 1024,
        percentage: 90
      });
      
      await storage.set('key', 'value');
      
      expect(warningSpy).toHaveBeenCalledWith(
        expect.stringContaining('Storage quota warning')
      );
      
      warningSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    test('should handle chrome storage errors', async () => {
      mockChrome.storage.local.set.mockRejectedValueOnce(new Error('Storage error'));
      
      await expect(storage.set('key', 'value'))
        .rejects.toThrow('Storage error');
    });

    test('should handle invalid keys', async () => {
      await expect(storage.set('', 'value'))
        .rejects.toThrow('Invalid storage key');
      
      await expect(storage.set(null as any, 'value'))
        .rejects.toThrow('Invalid storage key');
    });

    test('should handle circular references', async () => {
      const circular: any = { a: 1 };
      circular.self = circular;
      
      await expect(storage.set('circular', circular))
        .rejects.toThrow();
    });
  });

  describe('Import/Export', () => {
    test('should export all data', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2', 'config');
      await storage.setShared('shared', 'value3');
      
      const exported = await storage.exportData();
      
      expect(exported.pluginId).toBe(pluginId);
      expect(exported.namespaces.plugin).toHaveProperty('key1', 'value1');
      expect(exported.namespaces.config).toHaveProperty('key2', 'value2');
      expect(exported.timestamp).toBeInstanceOf(Date);
    });

    test('should import data', async () => {
      const importData = {
        pluginId,
        namespaces: {
          plugin: { imported1: 'value1' },
          config: { imported2: 'value2' }
        },
        timestamp: new Date()
      };
      
      await storage.importData(importData);
      
      expect(await storage.get('imported1')).toBe('value1');
      expect(await storage.get('imported2', null, 'config')).toBe('value2');
    });

    test('should validate import data', async () => {
      const invalidData = {
        // Missing required fields
        namespaces: {}
      };
      
      await expect(storage.importData(invalidData as any))
        .rejects.toThrow('Invalid import data');
    });
  });

  describe('Cleanup', () => {
    test('should clear all plugin data', async () => {
      await storage.set('key1', 'value1');
      await storage.set('key2', 'value2', 'config');
      await storage.set('key3', 'value3', 'cache');
      
      await storage.clearAll();
      
      expect(await storage.get('key1')).toBeNull();
      expect(await storage.get('key2', null, 'config')).toBeNull();
      expect(await storage.get('key3', null, 'cache')).toBeNull();
    });

    test('should not clear shared storage by default', async () => {
      await storage.setShared('shared', 'value');
      await storage.set('plugin', 'value');
      
      await storage.clearAll();
      
      expect(await storage.getShared('shared')).toBe('value');
      expect(await storage.get('plugin')).toBeNull();
    });

    test('should clear shared storage when specified', async () => {
      await storage.setShared('shared', 'value');
      
      await storage.clearAll(true);
      
      expect(await storage.getShared('shared')).toBeNull();
    });
  });
});