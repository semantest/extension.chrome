import { PatternManager, AutomationPattern, PatternStep } from './pattern-manager';
import { globalMessageStore } from './message-store';
import { globalPerformanceOptimizer } from './performance-optimizer';

// Mock dependencies
jest.mock('./message-store', () => ({
  globalMessageStore: {
    addInboundMessage: jest.fn()
  }
}));

jest.mock('./performance-optimizer', () => ({
  globalPerformanceOptimizer: {}
}));

// Mock Chrome API
global.chrome = {
  runtime: {
    id: 'test-extension-id',
    lastError: null
  },
  storage: {
    local: {
      get: jest.fn((keys, callback) => {
        callback({});
      }),
      set: jest.fn((items, callback) => {
        if (callback) callback();
      })
    }
  }
} as any;

// Mock navigator
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'test-user-agent',
  writable: true
});

describe('PatternManager', () => {
  let patternManager: PatternManager;
  
  beforeEach(() => {
    jest.clearAllMocks();
    patternManager = new PatternManager();
  });
  
  describe('createPattern', () => {
    const basicSteps: PatternStep[] = [
      {
        id: 'step1',
        type: 'click',
        selector: '#button',
        description: 'Click the button',
        timeout: 5000,
        retries: 3,
        errorHandling: 'retry'
      }
    ];
    
    it('should create a new pattern', async () => {
      const pattern = await patternManager.createPattern(
        'Test Pattern',
        'A test pattern',
        basicSteps
      );
      
      expect(pattern.name).toBe('Test Pattern');
      expect(pattern.description).toBe('A test pattern');
      expect(pattern.steps).toEqual(basicSteps);
      expect(pattern.version).toBe('1.0.0');
      expect(pattern.id).toBeTruthy();
    });
    
    it('should assign default values', async () => {
      const pattern = await patternManager.createPattern(
        'Test Pattern',
        'A test pattern',
        basicSteps
      );
      
      expect(pattern.author).toBe('Anonymous');
      expect(pattern.category).toBe('web-automation');
      expect(pattern.tags).toEqual([]);
      expect(pattern.metadata.difficulty).toBe('beginner');
      expect(pattern.metadata.successRate).toBe(1.0);
    });
    
    it('should accept custom options', async () => {
      const pattern = await patternManager.createPattern(
        'Test Pattern',
        'A test pattern',
        basicSteps,
        {
          author: 'TestUser',
          category: 'testing',
          tags: ['automated', 'test']
        }
      );
      
      expect(pattern.author).toBe('TestUser');
      expect(pattern.category).toBe('testing');
      expect(pattern.tags).toEqual(['automated', 'test']);
    });
    
    it('should track pattern creation', async () => {
      await patternManager.createPattern('Test Pattern', 'A test pattern', basicSteps);
      
      expect(globalMessageStore.addInboundMessage).toHaveBeenCalledWith(
        'PATTERN_CREATED',
        expect.objectContaining({
          name: 'Test Pattern',
          category: 'web-automation'
        }),
        expect.stringContaining('pattern-created-'),
        expect.any(Object)
      );
    });
  });
  
  describe('getPattern', () => {
    it('should return pattern by ID', async () => {
      const created = await patternManager.createPattern(
        'Test Pattern',
        'A test pattern',
        []
      );
      
      const retrieved = patternManager.getPattern(created.id);
      expect(retrieved).toEqual(created);
    });
    
    it('should return null for non-existent pattern', () => {
      const pattern = patternManager.getPattern('non-existent');
      expect(pattern).toBeNull();
    });
  });
  
  describe('getPatterns', () => {
    beforeEach(async () => {
      // Create test patterns
      await patternManager.createPattern('Pattern 1', 'First pattern', [], {
        category: 'web-automation',
        tags: ['tag1', 'tag2'],
        author: 'Author1'
      });
      
      await patternManager.createPattern('Pattern 2', 'Second pattern', [], {
        category: 'testing',
        tags: ['tag2', 'tag3'],
        author: 'Author2'
      });
      
      await patternManager.createPattern('Pattern 3', 'Third pattern', [], {
        category: 'web-automation',
        tags: ['tag1'],
        author: 'Author1',
        metadata: { difficulty: 'advanced' as const }
      });
    });
    
    it('should return all patterns without filter', () => {
      const patterns = patternManager.getPatterns();
      expect(patterns.length).toBe(3);
    });
    
    it('should filter by category', () => {
      const patterns = patternManager.getPatterns({ category: 'web-automation' });
      expect(patterns.length).toBe(2);
      expect(patterns.every(p => p.category === 'web-automation')).toBe(true);
    });
    
    it('should filter by tags', () => {
      const patterns = patternManager.getPatterns({ tags: ['tag1'] });
      expect(patterns.length).toBe(2);
    });
    
    it('should filter by author', () => {
      const patterns = patternManager.getPatterns({ author: 'Author1' });
      expect(patterns.length).toBe(2);
      expect(patterns.every(p => p.author === 'Author1')).toBe(true);
    });
    
    it('should filter by difficulty', () => {
      const patterns = patternManager.getPatterns({ difficulty: 'advanced' });
      expect(patterns.length).toBe(1);
      expect(patterns[0].metadata.difficulty).toBe('advanced');
    });
    
    it('should filter by search text', () => {
      const patterns = patternManager.getPatterns({ searchText: 'First' });
      expect(patterns.length).toBe(1);
      expect(patterns[0].name).toBe('Pattern 1');
    });
    
    it('should sort by last modified date', () => {
      const patterns = patternManager.getPatterns();
      const dates = patterns.map(p => new Date(p.lastModified).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
      expect(dates[1]).toBeGreaterThanOrEqual(dates[2]);
    });
  });
  
  describe('updatePattern', () => {
    let pattern: AutomationPattern;
    
    beforeEach(async () => {
      pattern = await patternManager.createPattern('Original', 'Original description', []);
    });
    
    it('should update pattern fields', async () => {
      const updated = await patternManager.updatePattern(pattern.id, {
        name: 'Updated',
        description: 'Updated description'
      });
      
      expect(updated.name).toBe('Updated');
      expect(updated.description).toBe('Updated description');
      expect(updated.id).toBe(pattern.id); // ID should not change
    });
    
    it('should increment version', async () => {
      const updated = await patternManager.updatePattern(pattern.id, {
        name: 'Updated'
      });
      
      expect(updated.version).toBe('1.0.1');
    });
    
    it('should update last modified date', async () => {
      const originalDate = pattern.lastModified;
      
      // Wait a bit to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updated = await patternManager.updatePattern(pattern.id, {
        name: 'Updated'
      });
      
      expect(new Date(updated.lastModified).getTime()).toBeGreaterThan(
        new Date(originalDate).getTime()
      );
    });
    
    it('should throw error for non-existent pattern', async () => {
      await expect(
        patternManager.updatePattern('non-existent', { name: 'Updated' })
      ).rejects.toThrow('Pattern not found');
    });
    
    it('should track pattern update', async () => {
      await patternManager.updatePattern(pattern.id, { name: 'Updated' });
      
      expect(globalMessageStore.addInboundMessage).toHaveBeenCalledWith(
        'PATTERN_UPDATED',
        expect.objectContaining({
          patternId: pattern.id,
          version: '1.0.1'
        }),
        expect.stringContaining('pattern-updated-'),
        expect.any(Object)
      );
    });
  });
  
  describe('deletePattern', () => {
    let pattern: AutomationPattern;
    
    beforeEach(async () => {
      pattern = await patternManager.createPattern('To Delete', 'Will be deleted', []);
    });
    
    it('should delete pattern', async () => {
      await patternManager.deletePattern(pattern.id);
      
      const retrieved = patternManager.getPattern(pattern.id);
      expect(retrieved).toBeNull();
    });
    
    it('should throw error for non-existent pattern', async () => {
      await expect(
        patternManager.deletePattern('non-existent')
      ).rejects.toThrow('Pattern not found');
    });
    
    it('should track pattern deletion', async () => {
      await patternManager.deletePattern(pattern.id);
      
      expect(globalMessageStore.addInboundMessage).toHaveBeenCalledWith(
        'PATTERN_DELETED',
        expect.objectContaining({
          patternId: pattern.id
        }),
        expect.stringContaining('pattern-deleted-'),
        expect.any(Object)
      );
    });
  });
  
  describe('exportPatterns', () => {
    beforeEach(async () => {
      await patternManager.createPattern('Export 1', 'First export', []);
      await patternManager.createPattern('Export 2', 'Second export', []);
    });
    
    it('should export all patterns', () => {
      const exported = patternManager.exportPatterns();
      
      expect(exported.version).toBe('1.0.0');
      expect(exported.format).toBe('json');
      expect(exported.patterns.length).toBe(2);
      expect(exported.exportedAt).toBeTruthy();
      expect(exported.checksum).toBeTruthy();
    });
    
    it('should filter patterns by IDs', () => {
      const patterns = patternManager.getPatterns();
      const exported = patternManager.exportPatterns([patterns[0].id]);
      
      expect(exported.patterns.length).toBe(1);
      expect(exported.patterns[0].id).toBe(patterns[0].id);
    });
    
    it('should set metadata', () => {
      const exported = patternManager.exportPatterns([], {
        exportedBy: 'TestUser',
        format: 'yaml',
        compression: true,
        encryption: true
      });
      
      expect(exported.exportedBy).toBe('TestUser');
      expect(exported.format).toBe('yaml');
      expect(exported.compression).toBe(true);
      expect(exported.encryption).toBe(true);
    });
  });
  
  describe('importPatterns', () => {
    it('should import patterns from export', async () => {
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'TestUser',
        format: 'json' as const,
        compression: false,
        encryption: false,
        patterns: [
          {
            id: 'import-1',
            name: 'Imported Pattern',
            description: 'An imported pattern',
            version: '1.0.0',
            author: 'ImportAuthor',
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            tags: ['imported'],
            category: 'testing',
            steps: [],
            conditions: [],
            variables: [],
            metadata: {
              compatibility: ['chrome'],
              requirements: [],
              permissions: [],
              language: 'en',
              difficulty: 'beginner' as const,
              estimatedDuration: 0,
              successRate: 1.0,
              popularity: 0,
              domains: []
            },
            statistics: {
              executions: 0,
              successes: 0,
              failures: 0,
              averageExecutionTime: 0,
              errorTypes: {},
              performanceMetrics: {
                fastestExecution: 0,
                slowestExecution: 0,
                memoryUsage: []
              }
            }
          }
        ],
        dependencies: [],
        checksum: 'test-checksum'
      };
      
      const result = await patternManager.importPatterns(exportData);
      
      expect(result.imported).toBe(1);
      expect(result.failed).toBe(0);
      expect(result.skipped).toBe(0);
      
      const imported = patternManager.getPattern('import-1');
      expect(imported).toBeTruthy();
      expect(imported?.name).toBe('Imported Pattern');
    });
    
    it('should handle duplicate patterns', async () => {
      const pattern = await patternManager.createPattern('Existing', 'Already exists', []);
      
      const exportData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'TestUser',
        format: 'json' as const,
        compression: false,
        encryption: false,
        patterns: [pattern],
        dependencies: [],
        checksum: 'test-checksum'
      };
      
      const result = await patternManager.importPatterns(exportData, { overwrite: false });
      
      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
  
  describe('getPatternAnalytics', () => {
    it('should return empty analytics for no patterns', () => {
      const analytics = patternManager.getPatternAnalytics();
      
      expect(analytics.totalPatterns).toBe(0);
      expect(analytics.totalExecutions).toBe(0);
      expect(analytics.averageSuccessRate).toBe(0);
      expect(analytics.mostPopular).toEqual([]);
      expect(analytics.recentlyCreated).toEqual([]);
    });
    
    it('should calculate analytics for patterns', async () => {
      await patternManager.createPattern('Pattern 1', 'First', [], {
        category: 'web-automation',
        metadata: { difficulty: 'beginner' as const }
      });
      
      await patternManager.createPattern('Pattern 2', 'Second', [], {
        category: 'testing',
        metadata: { difficulty: 'advanced' as const }
      });
      
      const analytics = patternManager.getPatternAnalytics();
      
      expect(analytics.totalPatterns).toBe(2);
      expect(analytics.categoriesBreakdown['web-automation']).toBe(1);
      expect(analytics.categoriesBreakdown['testing']).toBe(1);
      expect(analytics.difficultiesBreakdown['beginner']).toBe(1);
      expect(analytics.difficultiesBreakdown['advanced']).toBe(1);
      expect(analytics.recentlyCreated.length).toBe(2);
    });
  });
});