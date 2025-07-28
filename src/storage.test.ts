/**
 * Unit tests for storage.ts
 */

import { webBuddyStorage, AutomationPattern, UserInteraction, WebsiteConfig } from './storage';

// Mock IndexedDB
const mockIndexedDB = {
  open: jest.fn(),
};

const mockObjectStore = {
  add: jest.fn(),
  get: jest.fn(),
  getAll: jest.fn(),
  put: jest.fn(),
  count: jest.fn(),
  index: jest.fn(),
  openCursor: jest.fn(),
  delete: jest.fn(),
};

const mockIndex = {
  getAll: jest.fn(),
  openCursor: jest.fn(),
};

const mockTransaction = {
  objectStore: jest.fn(() => mockObjectStore),
  oncomplete: null as any,
  onerror: null as any,
  error: null as any,
};

const mockDB = {
  transaction: jest.fn(() => mockTransaction),
  objectStoreNames: {
    contains: jest.fn(),
  },
  createObjectStore: jest.fn(),
};

const mockRequest = {
  result: null as any,
  error: null as any,
  onsuccess: null as any,
  onerror: null as any,
};

const mockCursor = {
  value: null as any,
  delete: jest.fn(),
  continue: jest.fn(),
};

// Set up global mocks
global.indexedDB = mockIndexedDB as any;

describe('WebBuddyStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockObjectStore.index.mockReturnValue(mockIndex);
  });

  describe('initialization', () => {
    test('should initialize IndexedDB successfully', async () => {
      const openRequest = {
        result: mockDB,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
      };

      mockIndexedDB.open.mockReturnValue(openRequest);

      // Trigger initialization
      const initPromise = webBuddyStorage.init();

      // Simulate successful open
      setTimeout(() => {
        if (openRequest.onsuccess) {
          openRequest.onsuccess();
        }
      }, 0);

      await initPromise;

      expect(mockIndexedDB.open).toHaveBeenCalledWith('WebBuddyDB', 1);
    });

    test('should handle IndexedDB initialization error', async () => {
      const openRequest = {
        result: null,
        error: new Error('Failed to open'),
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
      };

      mockIndexedDB.open.mockReturnValue(openRequest);

      const initPromise = webBuddyStorage.init();

      // Simulate error
      setTimeout(() => {
        if (openRequest.onerror) {
          openRequest.onerror();
        }
      }, 0);

      await expect(initPromise).rejects.toEqual(new Error('Failed to open'));
    });

    test('should create object stores on upgrade', async () => {
      const openRequest = {
        result: mockDB,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
        onupgradeneeded: null as any,
      };

      mockIndexedDB.open.mockReturnValue(openRequest);
      mockDB.objectStoreNames.contains.mockReturnValue(false);

      const mockStore = {
        createIndex: jest.fn(),
      };
      mockDB.createObjectStore.mockReturnValue(mockStore);

      const initPromise = webBuddyStorage.init();

      // Simulate upgrade
      setTimeout(() => {
        if (openRequest.onupgradeneeded) {
          const event = {
            target: { result: mockDB },
          };
          openRequest.onupgradeneeded(event as any);
        }
        if (openRequest.onsuccess) {
          openRequest.onsuccess();
        }
      }, 0);

      await initPromise;

      expect(mockDB.createObjectStore).toHaveBeenCalledWith('automationPatterns', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('userInteractions', { keyPath: 'id' });
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('websiteConfigs', { keyPath: 'domain' });
    });
  });

  describe('saveAutomationPattern', () => {
    test('should save automation pattern successfully', async () => {
      const pattern = {
        url: 'https://example.com',
        domain: 'example.com',
        action: 'click',
        selector: '#button',
        parameters: {},
        success: true,
        contextHash: 'abc123',
        userConfirmed: true,
      };

      const addRequest = {
        result: 'pattern_123',
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.add.mockReturnValue(addRequest);

      const savePromise = webBuddyStorage.saveAutomationPattern(pattern);

      // Simulate successful add
      setTimeout(() => {
        if (addRequest.onsuccess) {
          addRequest.onsuccess();
        }
      }, 0);

      const id = await savePromise;

      expect(id).toMatch(/^pattern_\d+_[a-z0-9]+$/);
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...pattern,
          id: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });

    test('should handle save error', async () => {
      const pattern = {
        url: 'https://example.com',
        domain: 'example.com',
        action: 'click',
        selector: '#button',
        parameters: {},
        success: true,
        contextHash: 'abc123',
        userConfirmed: true,
      };

      const addRequest = {
        result: null,
        error: new Error('Save failed'),
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.add.mockReturnValue(addRequest);

      const savePromise = webBuddyStorage.saveAutomationPattern(pattern);

      // Simulate error
      setTimeout(() => {
        if (addRequest.onerror) {
          addRequest.onerror();
        }
      }, 0);

      await expect(savePromise).rejects.toEqual(new Error('Save failed'));
    });
  });

  describe('getAutomationPatterns', () => {
    test('should get all automation patterns', async () => {
      const patterns = [
        {
          id: 'pattern_1',
          url: 'https://example.com',
          domain: 'example.com',
          action: 'click',
          selector: '#button',
          parameters: {},
          success: true,
          timestamp: Date.now(),
          contextHash: 'abc123',
          userConfirmed: true,
        },
        {
          id: 'pattern_2',
          url: 'https://example.com/page',
          domain: 'example.com',
          action: 'fill',
          selector: 'input',
          parameters: { value: 'test' },
          success: false,
          timestamp: Date.now() - 1000,
          contextHash: 'def456',
          userConfirmed: false,
        },
      ];

      const getAllRequest = {
        result: patterns,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getPromise = webBuddyStorage.getAutomationPatterns();

      // Simulate successful get
      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toEqual(patterns);
      expect(mockObjectStore.getAll).toHaveBeenCalled();
    });

    test('should filter patterns by domain', async () => {
      const patterns = [
        {
          id: 'pattern_1',
          url: 'https://example.com',
          domain: 'example.com',
          action: 'click',
          selector: '#button',
          parameters: {},
          success: true,
          timestamp: Date.now(),
          contextHash: 'abc123',
          userConfirmed: true,
        },
      ];

      const getAllRequest = {
        result: patterns,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = webBuddyStorage.getAutomationPatterns({ domain: 'example.com' });

      // Simulate successful get
      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toEqual(patterns);
      expect(mockObjectStore.index).toHaveBeenCalledWith('domain');
      expect(mockIndex.getAll).toHaveBeenCalledWith('example.com');
    });

    test('should filter patterns by success only', async () => {
      const patterns = [
        {
          id: 'pattern_1',
          url: 'https://example.com',
          domain: 'example.com',
          action: 'click',
          selector: '#button',
          parameters: {},
          success: true,
          timestamp: Date.now(),
          contextHash: 'abc123',
          userConfirmed: true,
        },
        {
          id: 'pattern_2',
          url: 'https://example.com/page',
          domain: 'example.com',
          action: 'fill',
          selector: 'input',
          parameters: { value: 'test' },
          success: false,
          timestamp: Date.now() - 1000,
          contextHash: 'def456',
          userConfirmed: false,
        },
      ];

      const getAllRequest = {
        result: patterns,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.getAll.mockReturnValue(getAllRequest);

      const getPromise = webBuddyStorage.getAutomationPatterns({ successOnly: true });

      // Simulate successful get
      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toHaveLength(1);
      expect(result[0].success).toBe(true);
    });
  });

  describe('updateAutomationPattern', () => {
    test('should update automation pattern successfully', async () => {
      const existingPattern = {
        id: 'pattern_1',
        url: 'https://example.com',
        domain: 'example.com',
        action: 'click',
        selector: '#button',
        parameters: {},
        success: false,
        timestamp: Date.now(),
        contextHash: 'abc123',
        userConfirmed: false,
      };

      const getRequest = {
        result: existingPattern,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      const putRequest = {
        result: null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.get.mockReturnValue(getRequest);
      mockObjectStore.put.mockReturnValue(putRequest);

      const updatePromise = webBuddyStorage.updateAutomationPattern('pattern_1', {
        success: true,
        userConfirmed: true,
      });

      // Simulate successful get
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      // Simulate successful put
      setTimeout(() => {
        if (putRequest.onsuccess) {
          putRequest.onsuccess();
        }
      }, 10);

      await updatePromise;

      expect(mockObjectStore.put).toHaveBeenCalledWith({
        ...existingPattern,
        success: true,
        userConfirmed: true,
      });
    });

    test('should handle pattern not found', async () => {
      const getRequest = {
        result: null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const updatePromise = webBuddyStorage.updateAutomationPattern('pattern_1', {
        success: true,
      });

      // Simulate successful get with no result
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      await expect(updatePromise).rejects.toThrow('Pattern not found');
    });
  });

  describe('saveUserInteraction', () => {
    test('should save user interaction successfully', async () => {
      const interaction = {
        sessionId: 'session_123',
        url: 'https://example.com',
        domain: 'example.com',
        eventType: 'click',
        target: '#button',
        success: true,
        context: { x: 100, y: 200 },
      };

      const addRequest = {
        result: 'interaction_123',
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.add.mockReturnValue(addRequest);

      const savePromise = webBuddyStorage.saveUserInteraction(interaction);

      // Simulate successful add
      setTimeout(() => {
        if (addRequest.onsuccess) {
          addRequest.onsuccess();
        }
      }, 0);

      const id = await savePromise;

      expect(id).toMatch(/^interaction_\d+_[a-z0-9]+$/);
      expect(mockObjectStore.add).toHaveBeenCalledWith(
        expect.objectContaining({
          ...interaction,
          id: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('getUserInteractions', () => {
    test('should get user interactions by session ID', async () => {
      const interactions = [
        {
          id: 'interaction_1',
          sessionId: 'session_123',
          url: 'https://example.com',
          domain: 'example.com',
          eventType: 'click',
          target: '#button',
          timestamp: Date.now(),
          success: true,
          context: {},
        },
      ];

      const getAllRequest = {
        result: interactions,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockIndex.getAll.mockReturnValue(getAllRequest);

      const getPromise = webBuddyStorage.getUserInteractions({ sessionId: 'session_123' });

      // Simulate successful get
      setTimeout(() => {
        if (getAllRequest.onsuccess) {
          getAllRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toEqual(interactions);
      expect(mockObjectStore.index).toHaveBeenCalledWith('sessionId');
      expect(mockIndex.getAll).toHaveBeenCalledWith('session_123');
    });
  });

  describe('saveWebsiteConfig', () => {
    test('should save website config successfully', async () => {
      const config: WebsiteConfig = {
        domain: 'example.com',
        preferences: { theme: 'dark' },
        customSelectors: { button: '.custom-button' },
        lastAccessed: 0,
        automationEnabled: true,
      };

      const putRequest = {
        result: null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.put.mockReturnValue(putRequest);

      const savePromise = webBuddyStorage.saveWebsiteConfig(config);

      // Simulate successful put
      setTimeout(() => {
        if (putRequest.onsuccess) {
          putRequest.onsuccess();
        }
      }, 0);

      await savePromise;

      expect(mockObjectStore.put).toHaveBeenCalledWith(
        expect.objectContaining({
          ...config,
          lastAccessed: expect.any(Number),
        })
      );
    });
  });

  describe('getWebsiteConfig', () => {
    test('should get website config successfully', async () => {
      const config: WebsiteConfig = {
        domain: 'example.com',
        preferences: { theme: 'dark' },
        customSelectors: { button: '.custom-button' },
        lastAccessed: Date.now(),
        automationEnabled: true,
      };

      const getRequest = {
        result: config,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = webBuddyStorage.getWebsiteConfig('example.com');

      // Simulate successful get
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toEqual(config);
      expect(mockObjectStore.get).toHaveBeenCalledWith('example.com');
    });

    test('should return null for non-existent config', async () => {
      const getRequest = {
        result: null,
        error: null,
        onsuccess: null as any,
        onerror: null as any,
      };

      mockObjectStore.get.mockReturnValue(getRequest);

      const getPromise = webBuddyStorage.getWebsiteConfig('unknown.com');

      // Simulate successful get
      setTimeout(() => {
        if (getRequest.onsuccess) {
          getRequest.onsuccess();
        }
      }, 0);

      const result = await getPromise;

      expect(result).toBeNull();
    });
  });

  describe('clearOldData', () => {
    test('should clear old data successfully', async () => {
      const cursorRequest = {
        result: null,
        onsuccess: null as any,
      };

      mockIndex.openCursor.mockReturnValue(cursorRequest);

      const clearPromise = webBuddyStorage.clearOldData(30);

      // Simulate transaction complete
      setTimeout(() => {
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete();
        }
      }, 0);

      await clearPromise;

      expect(mockIndex.openCursor).toHaveBeenCalled();
    });

    test('should delete old records through cursor', async () => {
      const cursor1 = {
        value: { id: 'old_1', timestamp: Date.now() - 40 * 24 * 60 * 60 * 1000 },
        delete: jest.fn(),
        continue: jest.fn(),
      };

      const cursorRequest = {
        result: cursor1,
        onsuccess: null as any,
      };

      mockIndex.openCursor.mockReturnValue(cursorRequest);

      const clearPromise = webBuddyStorage.clearOldData(30);

      // Simulate cursor iteration
      setTimeout(() => {
        if (cursorRequest.onsuccess) {
          cursorRequest.onsuccess({ target: { result: cursor1 } } as any);
          // Second call returns null to end iteration
          cursorRequest.onsuccess({ target: { result: null } } as any);
        }
      }, 0);

      // Simulate transaction complete
      setTimeout(() => {
        if (mockTransaction.oncomplete) {
          mockTransaction.oncomplete();
        }
      }, 10);

      await clearPromise;

      expect(cursor1.delete).toHaveBeenCalled();
      expect(cursor1.continue).toHaveBeenCalled();
    });
  });

  describe('getStorageStats', () => {
    test('should get storage statistics successfully', async () => {
      const countRequests = [
        { result: 10, onsuccess: null as any }, // automation patterns
        { result: 20, onsuccess: null as any }, // user interactions
        { result: 5, onsuccess: null as any },  // website configs
      ];

      mockObjectStore.count.mockReturnValueOnce(countRequests[0])
        .mockReturnValueOnce(countRequests[1])
        .mockReturnValueOnce(countRequests[2]);

      const statsPromise = webBuddyStorage.getStorageStats();

      // Simulate successful counts
      setTimeout(() => {
        countRequests.forEach(request => {
          if (request.onsuccess) {
            request.onsuccess();
          }
        });
      }, 0);

      const stats = await statsPromise;

      expect(stats).toEqual({
        automationPatterns: 10,
        userInteractions: 20,
        websiteConfigs: 5,
      });
    });
  });
});