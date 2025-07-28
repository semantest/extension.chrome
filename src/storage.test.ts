/**
 * Unit Tests for WebBuddyStorage
 * Tests IndexedDB storage layer for automation patterns, user interactions, and website configs
 */

import { webBuddyStorage } from './storage';
import type { AutomationPattern, UserInteraction, WebsiteConfig } from './storage';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
  deleteDatabase: jest.fn(),
};

const mockIDBDatabase = {
  createObjectStore: jest.fn(),
  transaction: jest.fn(),
  close: jest.fn(),
  objectStoreNames: {
    contains: jest.fn(),
  },
};

const mockIDBObjectStore = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
  count: jest.fn(),
  createIndex: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn(),
};

const mockIDBTransaction = {
  objectStore: jest.fn(() => mockIDBObjectStore),
  oncomplete: null,
  onerror: null,
};

const mockIDBRequest = {
  onsuccess: null,
  onerror: null,
  result: null,
  error: null,
};

const mockIDBIndex = {
  getAll: jest.fn(),
  openCursor: jest.fn(),
};

// Setup global mocks
global.indexedDB = mockIndexedDB as any;
global.IDBKeyRange = {
  upperBound: jest.fn(),
  lowerBound: jest.fn(),
  bound: jest.fn(),
  only: jest.fn(),
} as any;

describe('WebBuddyStorage', () => {
  let storage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock implementations
    mockIDBDatabase.transaction.mockReturnValue(mockIDBTransaction);
    mockIDBObjectStore.index.mockReturnValue(mockIDBIndex);
    
    // Mock successful database initialization
    mockIndexedDB.open.mockImplementation(() => {
      const request = { ...mockIDBRequest } as any;
      setTimeout(() => {
        request.result = mockIDBDatabase;
        if (request.onsuccess) request.onsuccess();
      }, 0);
      return request;
    });

    storage = webBuddyStorage;
  });

  describe('Database Initialization', () => {
    test('should initialize database successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await storage.init();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('WebBuddyDB', 1);
      expect(consoleSpy).toHaveBeenCalledWith('✅ IndexedDB initialized successfully');
      
      consoleSpy.mockRestore();
    });

    test('should handle database initialization error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Database initialization failed');
      
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.init()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to open IndexedDB:', error);
      
      consoleSpy.mockRestore();
    });

    test('should create object stores on upgrade', async () => {
      mockIDBDatabase.objectStoreNames.contains.mockReturnValue(false);
      
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockIDBDatabase;
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: request });
          }
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.init();

      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('automationPatterns', { keyPath: 'id' });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('userInteractions', { keyPath: 'id' });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('websiteConfigs', { keyPath: 'domain' });
    });
  });

  describe('Automation Patterns', () => {
    const mockPattern = {
      url: 'https://example.com',
      domain: 'example.com',
      action: 'click',
      selector: '#submit-button',
      parameters: { timeout: 5000 },
      success: true,
      contextHash: 'abc123',
      userConfirmed: true,
    };

    beforeEach(async () => {
      await storage.init();
    });

    test('should save automation pattern successfully', async () => {
      const mockId = 'pattern_1234567890_abc123def';
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockIDBObjectStore.add.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      // Mock Date.now and Math.random for predictable ID generation
      const originalDateNow = Date.now;
      const originalMathRandom = Math.random;
      Date.now = jest.fn(() => 1234567890);
      Math.random = jest.fn(() => 0.123456789);

      const result = await storage.saveAutomationPattern(mockPattern);

      expect(result).toMatch(/^pattern_\d+_\w+$/);
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockPattern,
          id: expect.stringMatching(/^pattern_\d+_\w+$/),
          timestamp: expect.any(Number),
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Automation pattern saved:', expect.any(String));

      // Restore original functions
      Date.now = originalDateNow;
      Math.random = originalMathRandom;
      consoleSpy.mockRestore();
    });

    test('should handle save automation pattern error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Add operation failed');
      
      mockIDBObjectStore.add.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.saveAutomationPattern(mockPattern)).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to save automation pattern:', error);
      
      consoleSpy.mockRestore();
    });

    test('should retrieve automation patterns without filters', async () => {
      const mockPatterns = [
        { ...mockPattern, id: 'pattern1', timestamp: 1000 },
        { ...mockPattern, id: 'pattern2', timestamp: 2000 },
      ];
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockPatterns;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getAutomationPatterns();

      expect(result).toEqual([
        { ...mockPattern, id: 'pattern2', timestamp: 2000 },
        { ...mockPattern, id: 'pattern1', timestamp: 1000 },
      ]); // Sorted by timestamp desc
      expect(mockIDBObjectStore.getAll).toHaveBeenCalled();
    });

    test('should retrieve automation patterns with domain filter', async () => {
      const mockPatterns = [
        { ...mockPattern, id: 'pattern1', domain: 'example.com' },
      ];
      
      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockPatterns;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getAutomationPatterns({ domain: 'example.com' });

      expect(result).toEqual(mockPatterns);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('domain');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('example.com');
    });

    test('should apply success filter and limit', async () => {
      const mockPatterns = [
        { ...mockPattern, id: 'pattern1', success: true, timestamp: 3000 },
        { ...mockPattern, id: 'pattern2', success: false, timestamp: 2000 },
        { ...mockPattern, id: 'pattern3', success: true, timestamp: 1000 },
      ];
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockPatterns;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getAutomationPatterns({ 
        successOnly: true, 
        limit: 1 
      });

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
      expect(result[0].id).toBe('pattern1'); // Latest successful pattern
    });

    test('should update automation pattern successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const existingPattern = { ...mockPattern, id: 'pattern1' };
      const updates = { success: false, userConfirmed: false };
      
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = existingPattern;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      mockIDBObjectStore.put.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.updateAutomationPattern('pattern1', updates);

      expect(mockIDBObjectStore.get).toHaveBeenCalledWith('pattern1');
      expect(mockIDBObjectStore.put).toHaveBeenCalledWith({
        ...existingPattern,
        ...updates,
      });
      expect(consoleSpy).toHaveBeenCalledWith('✅ Automation pattern updated:', 'pattern1');
      
      consoleSpy.mockRestore();
    });

    test('should handle update non-existent pattern', async () => {
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = null;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await expect(storage.updateAutomationPattern('nonexistent', {})).rejects.toThrow('Pattern not found');
    });
  });

  describe('User Interactions', () => {
    const mockInteraction = {
      sessionId: 'session123',
      url: 'https://example.com',
      domain: 'example.com',
      eventType: 'click',
      target: '#button',
      success: true,
      context: { page: 'homepage' },
    };

    beforeEach(async () => {
      await storage.init();
    });

    test('should save user interaction successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockIDBObjectStore.add.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.saveUserInteraction(mockInteraction);

      expect(result).toMatch(/^interaction_\d+_\w+$/);
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockInteraction,
          id: expect.stringMatching(/^interaction_\d+_\w+$/),
          timestamp: expect.any(Number),
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ User interaction saved:', expect.any(String));
      
      consoleSpy.mockRestore();
    });

    test('should retrieve user interactions with session filter', async () => {
      const mockInteractions = [
        { ...mockInteraction, id: 'interaction1', sessionId: 'session123' },
      ];
      
      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockInteractions;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getUserInteractions({ sessionId: 'session123' });

      expect(result).toEqual(mockInteractions);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('sessionId');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('session123');
    });

    test('should filter by event type and apply limit', async () => {
      const mockInteractions = [
        { ...mockInteraction, id: 'interaction1', eventType: 'click', timestamp: 3000 },
        { ...mockInteraction, id: 'interaction2', eventType: 'scroll', timestamp: 2000 },
        { ...mockInteraction, id: 'interaction3', eventType: 'click', timestamp: 1000 },
      ];
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockInteractions;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getUserInteractions({ 
        eventType: 'click', 
        limit: 1 
      });

      expect(result).toHaveLength(1);
      expect(result[0].eventType).toBe('click');
      expect(result[0].id).toBe('interaction1'); // Latest click interaction
    });
  });

  describe('Website Configuration', () => {
    const mockConfig: WebsiteConfig = {
      domain: 'example.com',
      preferences: { theme: 'dark' },
      customSelectors: { submitButton: '#submit' },
      lastAccessed: 1234567890,
      automationEnabled: true,
    };

    beforeEach(async () => {
      await storage.init();
    });

    test('should save website config successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      mockIDBObjectStore.put.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.saveWebsiteConfig(mockConfig);

      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...mockConfig,
          lastAccessed: expect.any(Number),
        })
      );
      expect(consoleSpy).toHaveBeenCalledWith('✅ Website config saved:', 'example.com');
      
      consoleSpy.mockRestore();
    });

    test('should retrieve website config successfully', async () => {
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockConfig;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getWebsiteConfig('example.com');

      expect(result).toEqual(mockConfig);
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith('example.com');
    });

    test('should return null for non-existent config', async () => {
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = null;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getWebsiteConfig('nonexistent.com');

      expect(result).toBeNull();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should clear old data successfully', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      const mockCursor = {
        delete: jest.fn(),
        continue: jest.fn(),
      };

      mockIDBIndex.openCursor.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockCursor;
          if (request.onsuccess) request.onsuccess({ target: request });
          // Simulate cursor ending
          setTimeout(() => {
            request.result = null;
            if (request.onsuccess) request.onsuccess({ target: request });
          }, 10);
        }, 0);
        return request;
      });

      const originalDateNow = Date.now;
      Date.now = jest.fn(() => 1000000);

      // Mock transaction completion
      setTimeout(() => {
        if (mockIDBTransaction.oncomplete) mockIDBTransaction.oncomplete();
      }, 20);

      await storage.clearOldData(30);

      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('timestamp');
      expect(mockCursor.delete).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('✅ Cleared data older than 30 days');

      Date.now = originalDateNow;
      consoleSpy.mockRestore();
    });

    test('should get storage statistics successfully', async () => {
      const mockStats = {
        automationPatterns: 10,
        userInteractions: 25,
        websiteConfigs: 5,
      };

      let requestCount = 0;
      mockIDBObjectStore.count.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          const results = [10, 25, 5];
          request.result = results[requestCount++];
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getStorageStats();

      expect(result).toEqual(mockStats);
      expect(mockIDBObjectStore.count).toHaveBeenCalledTimes(3);
    });

    test('should handle database not initialized error', async () => {
      const uninitializedStorage = new (storage.constructor as any)();
      uninitializedStorage.db = null;

      await expect(uninitializedStorage.saveAutomationPattern({})).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getAutomationPatterns()).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.saveUserInteraction({})).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getUserInteractions()).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.saveWebsiteConfig({})).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getWebsiteConfig('test')).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.clearOldData()).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getStorageStats()).rejects.toThrow('Database not initialized');
    });
  });

  describe('Advanced Filtering Tests', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should filter automation patterns by action', async () => {
      const mockPatterns = [
        { id: 'p1', action: 'click', timestamp: 1000 },
        { id: 'p2', action: 'submit', timestamp: 2000 },
        { id: 'p3', action: 'click', timestamp: 3000 },
      ];
      
      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockPatterns.filter(p => p.action === 'click');
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getAutomationPatterns({ action: 'click' });

      expect(result).toHaveLength(2);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('action');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('click');
    });

    test('should filter automation patterns by URL substring', async () => {
      const mockPatterns = [
        { id: 'p1', url: 'https://example.com/page1', timestamp: 1000 },
        { id: 'p2', url: 'https://other.com/page', timestamp: 2000 },
        { id: 'p3', url: 'https://example.com/page2', timestamp: 3000 },
      ];
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockPatterns;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getAutomationPatterns({ url: 'example.com' });

      expect(result).toHaveLength(2);
      expect(result[0].url).toContain('example.com');
      expect(result[1].url).toContain('example.com');
    });

    test('should filter user interactions by domain', async () => {
      const mockInteractions = [
        { id: 'i1', domain: 'example.com', timestamp: 1000 },
        { id: 'i2', domain: 'other.com', timestamp: 2000 },
      ];
      
      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockInteractions.filter(i => i.domain === 'example.com');
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const result = await storage.getUserInteractions({ domain: 'example.com' });

      expect(result).toHaveLength(1);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('domain');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('example.com');
    });
  });

  describe('Database Upgrade Scenarios', () => {
    test('should skip creating existing object stores', async () => {
      mockIDBDatabase.objectStoreNames.contains.mockImplementation((storeName) => {
        // Simulate that automationPatterns already exists
        return storeName === 'automationPatterns';
      });
      
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = mockIDBDatabase;
          if (request.onupgradeneeded) {
            request.onupgradeneeded({ target: request });
          }
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.init();

      // Should create only the missing stores
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('userInteractions', { keyPath: 'id' });
      expect(mockIDBDatabase.createObjectStore).toHaveBeenCalledWith('websiteConfigs', { keyPath: 'domain' });
      expect(mockIDBDatabase.createObjectStore).not.toHaveBeenCalledWith('automationPatterns', { keyPath: 'id' });
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should handle transaction errors', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Transaction failed');
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.getAutomationPatterns()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to get automation patterns:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle clear data transaction error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Clear operation failed');
      
      // Mock transaction error
      setTimeout(() => {
        mockIDBTransaction.error = error;
        if (mockIDBTransaction.onerror) mockIDBTransaction.onerror();
      }, 10);

      await expect(storage.clearOldData()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to clear old data:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle storage stats transaction error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Stats operation failed');
      
      // Mock transaction error
      setTimeout(() => {
        mockIDBTransaction.error = error;
        if (mockIDBTransaction.onerror) mockIDBTransaction.onerror();
      }, 10);

      await expect(storage.getStorageStats()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to get storage stats:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle update pattern get request error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Get request failed');
      
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.updateAutomationPattern('pattern1', {})).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to get automation pattern for update:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle update pattern put request error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Put request failed');
      const existingPattern = { id: 'pattern1', action: 'click' };
      
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.result = existingPattern;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      mockIDBObjectStore.put.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.updateAutomationPattern('pattern1', { action: 'submit' })).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to update automation pattern:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle save user interaction error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Save interaction failed');
      
      mockIDBObjectStore.add.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.saveUserInteraction({ eventType: 'click' })).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to save user interaction:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle get user interactions error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Get interactions failed');
      
      mockIDBObjectStore.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.getUserInteractions()).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to get user interactions:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle save website config error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Save config failed');
      
      mockIDBObjectStore.put.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.saveWebsiteConfig({ domain: 'test.com' })).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to save website config:', error);
      
      consoleSpy.mockRestore();
    });

    test('should handle get website config error', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Get config failed');
      
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest };
        setTimeout(() => {
          request.error = error;
          if (request.onerror) request.onerror();
        }, 0);
        return request;
      });

      await expect(storage.getWebsiteConfig('test.com')).rejects.toThrow(error);
      expect(consoleSpy).toHaveBeenCalledWith('❌ Failed to get website config:', error);
      
      consoleSpy.mockRestore();
    });
  });
});