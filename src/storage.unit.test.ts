/**
 * @fileoverview Unit tests for WebBuddyStorage
 */

import { webBuddyStorage } from './storage';

// Mock IndexedDB
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

const mockIDBCursor = {
  value: null,
  continue: jest.fn(),
};

// Setup global mocks
const mockIndexedDB = {
  open: jest.fn(),
};

global.indexedDB = mockIndexedDB as any;
global.IDBKeyRange = {
  upperBound: jest.fn(),
  lowerBound: jest.fn(),
  bound: jest.fn(),
} as any;

describe('WebBuddyStorage Unit Tests', () => {
  let storage: typeof webBuddyStorage;
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
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

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize database successfully', async () => {
      await storage.init();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('WebBuddyDB', 1);
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ IndexedDB initialized successfully');
    });

    test('should handle database initialization error', async () => {
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
      expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to open IndexedDB:', error);
    });

    test('should create object stores on upgrade', async () => {
      mockIndexedDB.open.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        
        // Simulate upgrade needed
        setTimeout(() => {
          mockIDBDatabase.objectStoreNames.contains.mockReturnValue(false);
          
          if (request.onupgradeneeded) {
            request.onupgradeneeded({
              target: { result: mockIDBDatabase }
            });
          }
          
          request.result = mockIDBDatabase;
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
    beforeEach(async () => {
      await storage.init();
    });

    test('should save automation pattern', async () => {
      const pattern = {
        url: 'https://example.com',
        domain: 'example.com',
        action: 'click',
        selector: '.button',
        parameters: { text: 'Submit' },
        success: true,
        contextHash: 'abc123',
        userConfirmed: true,
      };

      mockIDBObjectStore.add.mockImplementation((data) => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = data.id;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const id = await storage.saveAutomationPattern(pattern);

      expect(id).toContain('pattern_');
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...pattern,
          id: expect.stringContaining('pattern_'),
          timestamp: expect.any(Number),
        })
      );
    });

    test('should get automation patterns with filters', async () => {
      const mockPatterns = [
        { id: '1', domain: 'example.com', action: 'click' },
        { id: '2', domain: 'example.com', action: 'type' },
      ];

      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = mockPatterns;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const patterns = await storage.getAutomationPatterns({ domain: 'example.com' });

      expect(patterns).toEqual(mockPatterns);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('domain');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('example.com');
    });

    test('should handle error when saving pattern without database', async () => {
      // @ts-ignore - accessing private property for testing
      storage.db = null;

      await expect(
        storage.saveAutomationPattern({
          url: 'test',
          domain: 'test',
          action: 'test',
          selector: 'test',
          parameters: {},
          success: true,
          contextHash: 'test',
          userConfirmed: true,
        })
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('User Interactions', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should save user interaction', async () => {
      const interaction = {
        sessionId: 'session123',
        url: 'https://example.com',
        domain: 'example.com',
        eventType: 'click',
        target: '.button',
        success: true,
        context: { page: 'home' },
      };

      mockIDBObjectStore.add.mockImplementation((data) => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = data.id;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const id = await storage.saveUserInteraction(interaction);

      expect(id).toContain('interaction_');
      expect(mockIDBObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...interaction,
          id: expect.stringContaining('interaction_'),
          timestamp: expect.any(Number),
        })
      );
    });

    test('should get user interactions by session', async () => {
      const mockInteractions = [
        { id: '1', sessionId: 'session123', eventType: 'click' },
        { id: '2', sessionId: 'session123', eventType: 'type' },
      ];

      mockIDBIndex.getAll.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = mockInteractions;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const interactions = await storage.getUserInteractions({ sessionId: 'session123' });

      expect(interactions).toEqual(mockInteractions);
      expect(mockIDBObjectStore.index).toHaveBeenCalledWith('sessionId');
      expect(mockIDBIndex.getAll).toHaveBeenCalledWith('session123');
    });
  });

  describe('Website Configuration', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should save website config', async () => {
      const config = {
        domain: 'example.com',
        preferences: { theme: 'dark' },
        customSelectors: { submit: '.custom-submit' },
        automationEnabled: true,
        lastAccessed: Date.now(),
      };

      mockIDBObjectStore.put.mockImplementation((data) => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.saveWebsiteConfig(config);

      expect(mockIDBObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...config,
          lastAccessed: expect.any(Number),
        })
      );
    });

    test('should get website config', async () => {
      const mockConfig = {
        domain: 'example.com',
        preferences: { theme: 'dark' },
        customSelectors: {},
        automationEnabled: true,
        lastAccessed: Date.now(),
      };

      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = mockConfig;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const config = await storage.getWebsiteConfig('example.com');

      expect(config).toEqual(mockConfig);
      expect(mockIDBObjectStore.get).toHaveBeenCalledWith('example.com');
    });

    test('should return null for non-existent config', async () => {
      mockIDBObjectStore.get.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = undefined;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const config = await storage.getWebsiteConfig('nonexistent.com');

      expect(config).toBeNull();
    });
  });

  describe('Storage Management', () => {
    beforeEach(async () => {
      await storage.init();
    });

    test('should get storage stats', async () => {
      mockIDBObjectStore.count.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          request.result = 10;
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      const stats = await storage.getStorageStats();

      expect(stats).toEqual({
        automationPatterns: 10,
        userInteractions: 10,
        websiteConfigs: 10,
      });

      expect(mockIDBObjectStore.count).toHaveBeenCalledTimes(3);
    });

    test('should clear all data', async () => {
      mockIDBObjectStore.openCursor.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        let cursorCalled = false;
        
        setTimeout(() => {
          if (!cursorCalled) {
            request.result = mockIDBCursor;
            (mockIDBCursor as any).value = { id: '1' };
            cursorCalled = true;
          } else {
            request.result = null;
          }
          if (request.onsuccess) request.onsuccess();
        }, 0);
        
        return request;
      });

      mockIDBObjectStore.delete.mockImplementation(() => {
        const request = { ...mockIDBRequest } as any;
        setTimeout(() => {
          if (request.onsuccess) request.onsuccess();
        }, 0);
        return request;
      });

      await storage.clearOldData(0); // Clear all data by setting 0 days

      expect(mockIDBObjectStore.openCursor).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith('✅ Cleared data older than 0 days');
    });

  });
});