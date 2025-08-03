/**
 * @jest-environment jsdom
 */

import { webBuddyStorage, AutomationPattern, UserInteraction, WebsiteConfig } from './storage';

// Mock IndexedDB using fake-indexeddb
require('fake-indexeddb/auto');

describe('WebBuddyStorage', () => {
  // Clear database before each test
  beforeEach(async () => {
    // Delete existing database
    await new Promise<void>((resolve) => {
      const deleteReq = indexedDB.deleteDatabase('WebBuddyDB');
      deleteReq.onsuccess = () => resolve();
      deleteReq.onerror = () => resolve();
    });
    
    // Re-initialize storage
    await webBuddyStorage.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('init', () => {
    it('should initialize database successfully', async () => {
      // Already initialized in beforeEach, verify it worked
      const databases = await indexedDB.databases();
      expect(databases).toContainEqual(expect.objectContaining({ name: 'WebBuddyDB' }));
    });

    it('should create all required object stores', async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('WebBuddyDB');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      expect(db.objectStoreNames.contains('automationPatterns')).toBe(true);
      expect(db.objectStoreNames.contains('userInteractions')).toBe(true);
      expect(db.objectStoreNames.contains('websiteConfigs')).toBe(true);

      db.close();
    });
  });

  describe('Automation Patterns', () => {
    describe('saveAutomationPattern', () => {
      it('should save automation pattern with generated ID and timestamp', async () => {
        const pattern = {
          url: 'https://example.com',
          domain: 'example.com',
          action: 'click',
          selector: '#submit-button',
          parameters: { delay: 100 },
          success: true,
          contextHash: 'abc123',
          userConfirmed: true
        };

        const id = await webBuddyStorage.saveAutomationPattern(pattern);

        expect(id).toMatch(/^pattern_\d+_[a-z0-9]+$/);

        // Verify it was saved
        const patterns = await webBuddyStorage.getAutomationPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0]).toMatchObject({
          ...pattern,
          id,
          timestamp: expect.any(Number)
        });
      });
    });

    describe('getAutomationPatterns', () => {
      beforeEach(async () => {
        // Add test patterns
        await webBuddyStorage.saveAutomationPattern({
          url: 'https://example.com/page1',
          domain: 'example.com',
          action: 'click',
          selector: '.button',
          parameters: {},
          success: true,
          contextHash: 'hash1',
          userConfirmed: true
        });

        await webBuddyStorage.saveAutomationPattern({
          url: 'https://example.com/page2',
          domain: 'example.com',
          action: 'type',
          selector: '#input',
          parameters: { value: 'test' },
          success: false,
          contextHash: 'hash2',
          userConfirmed: false
        });

        await webBuddyStorage.saveAutomationPattern({
          url: 'https://test.com/page',
          domain: 'test.com',
          action: 'click',
          selector: '.submit',
          parameters: {},
          success: true,
          contextHash: 'hash3',
          userConfirmed: true
        });
      });

      it('should get all patterns sorted by timestamp', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns();
        
        expect(patterns).toHaveLength(3);
        // Verify sorted by timestamp (newest first)
        expect(patterns[0].timestamp).toBeGreaterThanOrEqual(patterns[1].timestamp);
        expect(patterns[1].timestamp).toBeGreaterThanOrEqual(patterns[2].timestamp);
      });

      it('should filter by domain', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns({ domain: 'example.com' });
        
        expect(patterns).toHaveLength(2);
        expect(patterns.every(p => p.domain === 'example.com')).toBe(true);
      });

      it('should filter by action', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns({ action: 'click' });
        
        expect(patterns).toHaveLength(2);
        expect(patterns.every(p => p.action === 'click')).toBe(true);
      });

      it('should filter by URL partial match', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns({ url: 'page1' });
        
        expect(patterns).toHaveLength(1);
        expect(patterns[0].url).toContain('page1');
      });

      it('should filter by success status', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns({ successOnly: true });
        
        expect(patterns).toHaveLength(2);
        expect(patterns.every(p => p.success)).toBe(true);
      });

      it('should limit results', async () => {
        const patterns = await webBuddyStorage.getAutomationPatterns({ limit: 2 });
        
        expect(patterns).toHaveLength(2);
      });
    });

    describe('updateAutomationPattern', () => {
      it('should update existing pattern', async () => {
        const id = await webBuddyStorage.saveAutomationPattern({
          url: 'https://example.com',
          domain: 'example.com',
          action: 'click',
          selector: '.button',
          parameters: {},
          success: false,
          contextHash: 'hash1',
          userConfirmed: false
        });

        await webBuddyStorage.updateAutomationPattern(id, {
          success: true,
          userConfirmed: true
        });

        const patterns = await webBuddyStorage.getAutomationPatterns();
        expect(patterns[0].success).toBe(true);
        expect(patterns[0].userConfirmed).toBe(true);
      });

      it('should throw error for non-existent pattern', async () => {
        await expect(
          webBuddyStorage.updateAutomationPattern('non-existent-id', { success: true })
        ).rejects.toThrow('Pattern not found');
      });
    });
  });

  describe('User Interactions', () => {
    describe('saveUserInteraction', () => {
      it('should save user interaction with generated ID and timestamp', async () => {
        const interaction = {
          sessionId: 'session-123',
          url: 'https://example.com',
          domain: 'example.com',
          eventType: 'click',
          target: '#button',
          success: true,
          context: { x: 100, y: 200 }
        };

        const id = await webBuddyStorage.saveUserInteraction(interaction);

        expect(id).toMatch(/^interaction_\d+_[a-z0-9]+$/);

        // Verify it was saved
        const interactions = await webBuddyStorage.getUserInteractions();
        expect(interactions).toHaveLength(1);
        expect(interactions[0]).toMatchObject({
          ...interaction,
          id,
          timestamp: expect.any(Number)
        });
      });
    });

    describe('getUserInteractions', () => {
      beforeEach(async () => {
        // Add test interactions
        await webBuddyStorage.saveUserInteraction({
          sessionId: 'session-1',
          url: 'https://example.com/page1',
          domain: 'example.com',
          eventType: 'click',
          target: '.button',
          success: true,
          context: {}
        });

        await webBuddyStorage.saveUserInteraction({
          sessionId: 'session-1',
          url: 'https://example.com/page2',
          domain: 'example.com',
          eventType: 'type',
          target: '#input',
          success: true,
          context: {}
        });

        await webBuddyStorage.saveUserInteraction({
          sessionId: 'session-2',
          url: 'https://test.com/page',
          domain: 'test.com',
          eventType: 'click',
          target: '.submit',
          success: false,
          context: {}
        });
      });

      it('should get all interactions sorted by timestamp', async () => {
        const interactions = await webBuddyStorage.getUserInteractions();
        
        expect(interactions).toHaveLength(3);
        // Verify sorted by timestamp (newest first)
        expect(interactions[0].timestamp).toBeGreaterThanOrEqual(interactions[1].timestamp);
        expect(interactions[1].timestamp).toBeGreaterThanOrEqual(interactions[2].timestamp);
      });

      it('should filter by sessionId', async () => {
        const interactions = await webBuddyStorage.getUserInteractions({ sessionId: 'session-1' });
        
        expect(interactions).toHaveLength(2);
        expect(interactions.every(i => i.sessionId === 'session-1')).toBe(true);
      });

      it('should filter by domain', async () => {
        const interactions = await webBuddyStorage.getUserInteractions({ domain: 'example.com' });
        
        expect(interactions).toHaveLength(2);
        expect(interactions.every(i => i.domain === 'example.com')).toBe(true);
      });

      it('should filter by eventType', async () => {
        const interactions = await webBuddyStorage.getUserInteractions({ eventType: 'click' });
        
        expect(interactions).toHaveLength(2);
        expect(interactions.every(i => i.eventType === 'click')).toBe(true);
      });

      it('should limit results', async () => {
        const interactions = await webBuddyStorage.getUserInteractions({ limit: 2 });
        
        expect(interactions).toHaveLength(2);
      });
    });
  });

  describe('Website Configurations', () => {
    describe('saveWebsiteConfig', () => {
      it('should save website config with updated lastAccessed', async () => {
        const config: WebsiteConfig = {
          domain: 'example.com',
          preferences: { theme: 'dark' },
          customSelectors: { submit: '#custom-submit' },
          lastAccessed: 0,
          automationEnabled: true
        };

        const startTime = Date.now();
        await webBuddyStorage.saveWebsiteConfig(config);

        const savedConfig = await webBuddyStorage.getWebsiteConfig('example.com');
        expect(savedConfig).toMatchObject({
          ...config,
          lastAccessed: expect.any(Number)
        });
        expect(savedConfig!.lastAccessed).toBeGreaterThanOrEqual(startTime);
      });

      it('should update existing config', async () => {
        await webBuddyStorage.saveWebsiteConfig({
          domain: 'example.com',
          preferences: { theme: 'light' },
          customSelectors: {},
          lastAccessed: 0,
          automationEnabled: false
        });

        await webBuddyStorage.saveWebsiteConfig({
          domain: 'example.com',
          preferences: { theme: 'dark', fontSize: 'large' },
          customSelectors: { submit: '#btn' },
          lastAccessed: 0,
          automationEnabled: true
        });

        const config = await webBuddyStorage.getWebsiteConfig('example.com');
        expect(config?.preferences).toEqual({ theme: 'dark', fontSize: 'large' });
        expect(config?.automationEnabled).toBe(true);
      });
    });

    describe('getWebsiteConfig', () => {
      it('should return null for non-existent domain', async () => {
        const config = await webBuddyStorage.getWebsiteConfig('non-existent.com');
        expect(config).toBeNull();
      });

      it('should return saved config', async () => {
        const testConfig: WebsiteConfig = {
          domain: 'test.com',
          preferences: { language: 'en' },
          customSelectors: {},
          lastAccessed: 0,
          automationEnabled: true
        };

        await webBuddyStorage.saveWebsiteConfig(testConfig);
        const config = await webBuddyStorage.getWebsiteConfig('test.com');

        expect(config).toMatchObject({
          domain: 'test.com',
          preferences: { language: 'en' },
          automationEnabled: true
        });
      });
    });
  });

  describe('Utility Methods', () => {
    describe('clearOldData', () => {
      it('should clear data older than specified days', async () => {
        const now = Date.now();
        const oldTimestamp = now - (35 * 24 * 60 * 60 * 1000); // 35 days ago
        const recentTimestamp = now - (5 * 24 * 60 * 60 * 1000); // 5 days ago

        // Save old and recent patterns
        const oldPatternId = await webBuddyStorage.saveAutomationPattern({
          url: 'old-url',
          domain: 'old.com',
          action: 'click',
          selector: '.old',
          parameters: {},
          success: true,
          contextHash: 'old',
          userConfirmed: true
        });

        const recentPatternId = await webBuddyStorage.saveAutomationPattern({
          url: 'recent-url',
          domain: 'recent.com',
          action: 'click',
          selector: '.recent',
          parameters: {},
          success: true,
          contextHash: 'recent',
          userConfirmed: true
        });

        // Manually update timestamps (IndexedDB doesn't allow direct timestamp manipulation in fake-indexeddb)
        // This is a workaround for testing
        const db = await new Promise<IDBDatabase>((resolve) => {
          const request = indexedDB.open('WebBuddyDB');
          request.onsuccess = () => resolve(request.result);
        });

        await new Promise<void>((resolve, reject) => {
          const transaction = db.transaction(['automationPatterns'], 'readwrite');
          const store = transaction.objectStore('automationPatterns');
          
          // Update old pattern timestamp
          const getOldReq = store.get(oldPatternId);
          getOldReq.onsuccess = () => {
            const oldPattern = getOldReq.result;
            oldPattern.timestamp = oldTimestamp;
            store.put(oldPattern);
          };

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error);
        });

        db.close();

        // Clear old data
        await webBuddyStorage.clearOldData(30);

        // Verify results
        const patterns = await webBuddyStorage.getAutomationPatterns();
        expect(patterns).toHaveLength(1);
        expect(patterns[0].id).toBe(recentPatternId);
      });
    });

    describe('getStorageStats', () => {
      it('should return correct counts for all stores', async () => {
        // Add test data
        await webBuddyStorage.saveAutomationPattern({
          url: 'url1',
          domain: 'domain1',
          action: 'click',
          selector: '.btn',
          parameters: {},
          success: true,
          contextHash: 'hash1',
          userConfirmed: true
        });

        await webBuddyStorage.saveAutomationPattern({
          url: 'url2',
          domain: 'domain2',
          action: 'type',
          selector: '#input',
          parameters: {},
          success: true,
          contextHash: 'hash2',
          userConfirmed: true
        });

        await webBuddyStorage.saveUserInteraction({
          sessionId: 'session1',
          url: 'url1',
          domain: 'domain1',
          eventType: 'click',
          target: '.btn',
          success: true,
          context: {}
        });

        await webBuddyStorage.saveWebsiteConfig({
          domain: 'domain1',
          preferences: {},
          customSelectors: {},
          lastAccessed: 0,
          automationEnabled: true
        });

        const stats = await webBuddyStorage.getStorageStats();

        expect(stats).toEqual({
          automationPatterns: 2,
          userInteractions: 1,
          websiteConfigs: 1
        });
      });

      it('should return zero counts for empty database', async () => {
        const stats = await webBuddyStorage.getStorageStats();

        expect(stats).toEqual({
          automationPatterns: 0,
          userInteractions: 0,
          websiteConfigs: 0
        });
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when database not initialized', async () => {
      // Create a new instance without initializing
      const uninitializedStorage = new (webBuddyStorage.constructor as any)();
      
      await expect(uninitializedStorage.getAutomationPatterns()).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getUserInteractions()).rejects.toThrow('Database not initialized');
      await expect(uninitializedStorage.getWebsiteConfig('test')).rejects.toThrow('Database not initialized');
    });
  });
});