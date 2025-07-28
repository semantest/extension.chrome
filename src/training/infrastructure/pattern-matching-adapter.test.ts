import { PatternMatchingAdapter } from './pattern-matching-adapter';
import { PatternStorageAdapter, PatternStoragePort } from './pattern-storage-adapter';
import {
  AutomationRequest,
  AutomationPatternData,
  ExecutionContext,
  ExecutionResult,
  AutomationPatternMatched
} from '../domain/events/training-events';

// Mock the pattern storage adapter
jest.mock('./pattern-storage-adapter');

// Mock TypeScript-EDA
jest.mock('typescript-eda', () => ({
  PrimaryAdapter: class PrimaryAdapter {}
}));

describe('PatternMatchingAdapter', () => {
  let adapter: PatternMatchingAdapter;
  let mockStorageAdapter: jest.Mocked<PatternStoragePort>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorageAdapter = {
      storePattern: jest.fn(),
      retrievePattern: jest.fn(),
      retrievePatternsByType: jest.fn(),
      retrievePatternsByContext: jest.fn(),
      updatePatternUsage: jest.fn(),
      updatePatternConfidence: jest.fn(),
      deletePattern: jest.fn(),
      exportPatterns: jest.fn(),
      importPatterns: jest.fn(),
      clearAllPatterns: jest.fn()
    } as jest.Mocked<PatternStoragePort>;
    adapter = new PatternMatchingAdapter(mockStorageAdapter);
  });
  
  describe('handleAutomationRequest', () => {
    const mockRequest: AutomationRequest = {
      messageType: 'click',
      payload: { element: 'button' },
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example Page',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      }
    };
    
    const mockPattern: AutomationPatternData = {
      id: 'pattern-1',
      messageType: 'click',
      payload: { element: 'button' },
      selector: 'button.submit',
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      },
      confidence: 0.9,
      usageCount: 10,
      successfulExecutions: 9
    };
    
    it('should return AutomationPatternMatched for acceptable match', async () => {
      // Mock internal methods
      jest.spyOn(adapter, 'findMatchingPatterns').mockResolvedValue([
        {
          pattern: mockPattern,
          confidence: 0.85,
          contextScore: 0.9,
          payloadSimilarity: 0.95,
          overallScore: 0.88,
          recommendationLevel: 'high'
        }
      ]);
      
      const result = await adapter.handleAutomationRequest(mockRequest);
      
      expect(result).toBeInstanceOf(AutomationPatternMatched);
      expect(result?.pattern).toEqual(mockPattern);
      expect(result?.request).toEqual(mockRequest);
    });
    
    it('should return null for no matches', async () => {
      jest.spyOn(adapter, 'findMatchingPatterns').mockResolvedValue([]);
      
      const result = await adapter.handleAutomationRequest(mockRequest);
      
      expect(result).toBeNull();
    });
    
    it('should return null for unacceptable matches', async () => {
      jest.spyOn(adapter, 'findMatchingPatterns').mockResolvedValue([
        {
          pattern: mockPattern,
          confidence: 0.2,
          contextScore: 0.3,
          payloadSimilarity: 0.4,
          overallScore: 0.25,
          recommendationLevel: 'risky'
        }
      ]);
      
      const result = await adapter.handleAutomationRequest(mockRequest);
      
      expect(result).toBeNull();
    });
  });
  
  describe('findMatchingPatterns', () => {
    const mockRequest: AutomationRequest = {
      messageType: 'click',
      payload: { element: 'button' },
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example Page',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      }
    };
    
    it('should return sorted matches above threshold', async () => {
      const patterns: AutomationPatternData[] = [
        {
          id: 'pattern-1',
          messageType: 'click',
          payload: { element: 'button' },
          selector: 'button.submit',
          context: {
            url: 'https://example.com',
            hostname: 'example.com',
            pathname: '/',
            title: 'Example',
            timestamp: new Date(),
            pageStructureHash: 'abc123'
          },
          confidence: 0.9,
          usageCount: 10,
          successfulExecutions: 9
        },
        {
          id: 'pattern-2',
          messageType: 'click',
          payload: { element: 'link' },
          selector: 'a.nav',
          context: {
            url: 'https://example.com',
            hostname: 'example.com',
            pathname: '/',
            title: 'Example',
            timestamp: new Date(),
            pageStructureHash: 'abc123'
          },
          confidence: 0.7,
          usageCount: 5,
          successfulExecutions: 4
        }
      ];
      
      // Mock getPatternsByType
      jest.spyOn(adapter as any, 'getPatternsByType').mockResolvedValue(patterns);
      
      const matches = await adapter.findMatchingPatterns(mockRequest);
      
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].overallScore).toBeGreaterThanOrEqual(0.3);
      
      // Check sorting (highest score first)
      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].overallScore).toBeGreaterThanOrEqual(matches[i].overallScore);
      }
    });
    
    it('should filter out low-score matches', async () => {
      const lowScorePattern: AutomationPatternData = {
        id: 'pattern-low',
        messageType: 'type',
        payload: { text: 'hello' },
        selector: 'input',
        context: {
          url: 'https://different.com',
          hostname: 'different.com',
          pathname: '/',
          title: 'Different',
          timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days old
          pageStructureHash: 'xyz789'
        },
        confidence: 0.1,
        usageCount: 1,
        successfulExecutions: 0
      };
      
      jest.spyOn(adapter as any, 'getPatternsByType').mockResolvedValue([lowScorePattern]);
      
      const matches = await adapter.findMatchingPatterns(mockRequest);
      
      expect(matches).toEqual([]);
    });
  });
  
  describe('selectBestPattern', () => {
    it('should prefer high confidence matches', () => {
      const matches = [
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.7,
          contextScore: 0.7,
          payloadSimilarity: 0.7,
          overallScore: 0.7,
          recommendationLevel: 'medium' as const
        },
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.9,
          contextScore: 0.9,
          payloadSimilarity: 0.9,
          overallScore: 0.9,
          recommendationLevel: 'high' as const
        },
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.5,
          contextScore: 0.5,
          payloadSimilarity: 0.5,
          overallScore: 0.5,
          recommendationLevel: 'low' as const
        }
      ];
      
      const result = adapter.selectBestPattern(matches);
      
      expect(result?.recommendationLevel).toBe('high');
      expect(result?.overallScore).toBe(0.9);
    });
    
    it('should fall back to medium confidence if no high confidence', () => {
      const matches = [
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.7,
          contextScore: 0.7,
          payloadSimilarity: 0.7,
          overallScore: 0.7,
          recommendationLevel: 'medium' as const
        },
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.5,
          contextScore: 0.5,
          payloadSimilarity: 0.5,
          overallScore: 0.5,
          recommendationLevel: 'low' as const
        }
      ];
      
      const result = adapter.selectBestPattern(matches);
      
      expect(result?.recommendationLevel).toBe('medium');
    });
    
    it('should only use low confidence with high score', () => {
      const matches = [
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.85,
          contextScore: 0.85,
          payloadSimilarity: 0.85,
          overallScore: 0.85,
          recommendationLevel: 'low' as const
        },
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.6,
          contextScore: 0.6,
          payloadSimilarity: 0.6,
          overallScore: 0.6,
          recommendationLevel: 'low' as const
        }
      ];
      
      const result = adapter.selectBestPattern(matches);
      
      expect(result?.overallScore).toBe(0.85);
    });
    
    it('should return null for empty matches', () => {
      const result = adapter.selectBestPattern([]);
      expect(result).toBeNull();
    });
    
    it('should not use risky patterns', () => {
      const matches = [
        {
          pattern: {} as AutomationPatternData,
          confidence: 0.95,
          contextScore: 0.95,
          payloadSimilarity: 0.95,
          overallScore: 0.95,
          recommendationLevel: 'risky' as const
        }
      ];
      
      const result = adapter.selectBestPattern(matches);
      
      expect(result).toBeNull();
    });
  });
  
  describe('executePattern', () => {
    const mockPattern: AutomationPatternData = {
      id: 'pattern-1',
      messageType: 'click',
      payload: { element: 'button' },
      selector: 'button.submit',
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      },
      confidence: 0.9,
      usageCount: 10,
      successfulExecutions: 9
    };
    
    const mockRequest: AutomationRequest = {
      messageType: 'click',
      payload: { element: 'button' },
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example Page',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      }
    };
    
    beforeEach(() => {
      // Mock DOM
      document.body.innerHTML = '<button class="submit">Submit</button>';
    });
    
    it('should execute pattern successfully', async () => {
      // Mock validation methods
      jest.spyOn(adapter as any, 'isContextValid').mockReturnValue(true);
      jest.spyOn(adapter as any, 'isElementActionable').mockReturnValue(true);
      jest.spyOn(adapter as any, 'performPatternAction').mockResolvedValue(undefined);
      
      const result = await adapter.executePattern(mockPattern, mockRequest);
      
      expect(result.success).toBe(true);
      expect(result.data?.patternId).toBe('pattern-1');
      expect(result.data?.selector).toBe('button.submit');
      expect(result.data?.actionType).toBe('click');
      expect(result.data?.executionTime).toBeGreaterThanOrEqual(0);
    });
    
    it('should fail if context is invalid', async () => {
      jest.spyOn(adapter as any, 'isContextValid').mockReturnValue(false);
      
      const result = await adapter.executePattern(mockPattern, mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('context is no longer valid');
    });
    
    it('should fail if element not found', async () => {
      document.body.innerHTML = ''; // No element
      jest.spyOn(adapter as any, 'isContextValid').mockReturnValue(true);
      
      const result = await adapter.executePattern(mockPattern, mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Element not found');
    });
    
    it('should fail if element not actionable', async () => {
      jest.spyOn(adapter as any, 'isContextValid').mockReturnValue(true);
      jest.spyOn(adapter as any, 'isElementActionable').mockReturnValue(false);
      
      const result = await adapter.executePattern(mockPattern, mockRequest);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not in an actionable state');
    });
  });
  
  describe('updatePatternStatistics', () => {
    const mockPattern: AutomationPatternData = {
      id: 'pattern-1',
      messageType: 'click',
      payload: { element: 'button' },
      selector: 'button.submit',
      context: {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      },
      confidence: 0.8,
      usageCount: 10,
      successfulExecutions: 8
    };
    
    it('should update statistics for successful execution', async () => {
      mockStorageAdapter.retrievePattern.mockResolvedValue(mockPattern);
      mockStorageAdapter.updatePatternUsage.mockResolvedValue();
      mockStorageAdapter.updatePatternConfidence.mockResolvedValue();
      jest.spyOn(adapter as any, 'calculateUpdatedConfidence').mockReturnValue(0.85);
      jest.spyOn(adapter as any, 'invalidateCacheForType').mockImplementation();
      
      const result: ExecutionResult = {
        success: true,
        data: { patternId: 'pattern-1' },
        timestamp: new Date()
      };
      
      await adapter.updatePatternStatistics('pattern-1', result);
      
      expect(mockStorageAdapter.updatePatternUsage).toHaveBeenCalledWith('pattern-1', 11, 9);
      expect(mockStorageAdapter.updatePatternConfidence).toHaveBeenCalledWith('pattern-1', 0.85);
    });
    
    it('should update statistics for failed execution', async () => {
      mockStorageAdapter.retrievePattern.mockResolvedValue(mockPattern);
      mockStorageAdapter.updatePatternUsage.mockResolvedValue();
      mockStorageAdapter.updatePatternConfidence.mockResolvedValue();
      jest.spyOn(adapter as any, 'calculateUpdatedConfidence').mockReturnValue(0.75);
      jest.spyOn(adapter as any, 'invalidateCacheForType').mockImplementation();
      
      const result: ExecutionResult = {
        success: false,
        error: 'Failed',
        timestamp: new Date()
      };
      
      await adapter.updatePatternStatistics('pattern-1', result);
      
      expect(mockStorageAdapter.updatePatternUsage).toHaveBeenCalledWith('pattern-1', 11, 8);
      expect(mockStorageAdapter.updatePatternConfidence).toHaveBeenCalledWith('pattern-1', 0.75);
    });
    
    it('should handle pattern not found', async () => {
      mockStorageAdapter.retrievePattern.mockResolvedValue(null);
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await adapter.updatePatternStatistics('non-existent', { success: true, timestamp: new Date() });
      
      expect(consoleSpy).toHaveBeenCalled();
      expect(mockStorageAdapter.updatePatternUsage).not.toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
  
  describe('analyzePatternPerformance', () => {
    it('should analyze pattern performance', async () => {
      const mockPattern: AutomationPatternData = {
        id: 'pattern-1',
        messageType: 'click',
        payload: { element: 'button' },
        selector: 'button.submit',
        context: {
          url: 'https://example.com',
          hostname: 'example.com',
          pathname: '/',
          title: 'Example',
          timestamp: new Date(),
          pageStructureHash: 'abc123'
        },
        confidence: 0.9,
        usageCount: 100,
        successfulExecutions: 90
      };
      
      mockStorageAdapter.retrievePattern.mockResolvedValue(mockPattern);
      jest.spyOn(adapter as any, 'calculateReliabilityLevel').mockReturnValue('high');
      jest.spyOn(adapter as any, 'getRecommendedAction').mockReturnValue('keep');
      
      const result = await adapter.analyzePatternPerformance('pattern-1');
      
      expect(result).not.toBeNull();
      expect(result?.performance.successRate).toBe(0.9);
      expect(result?.performance.reliability).toBe('high');
      expect(result?.performance.recommendedAction).toBe('keep');
    });
    
    it('should return null for non-existent pattern', async () => {
      mockStorageAdapter.retrievePattern.mockResolvedValue(null);
      
      const result = await adapter.analyzePatternPerformance('non-existent');
      
      expect(result).toBeNull();
    });
  });
  
  describe('getPatternRecommendations', () => {
    it('should get pattern recommendations for context', async () => {
      const context: ExecutionContext = {
        url: 'https://example.com',
        hostname: 'example.com',
        pathname: '/',
        title: 'Example Page',
        timestamp: new Date(),
        pageStructureHash: 'abc123'
      };
      
      const mockPatterns: AutomationPatternData[] = [
        {
          id: 'pattern-1',
          messageType: 'click',
          payload: { element: 'button' },
          selector: 'button',
          context: {
            url: 'https://example.com',
            hostname: 'example.com',
            pathname: '/',
            title: 'Example',
            timestamp: new Date(),
            pageStructureHash: 'abc123'
          },
          confidence: 0.9,
          usageCount: 10,
          successfulExecutions: 9
        }
      ];
      
      mockStorageAdapter.retrievePatternsByContext.mockResolvedValue(mockPatterns);
      jest.spyOn(adapter as any, 'shouldRetrain').mockReturnValue(false);
      jest.spyOn(adapter as any, 'isPatternStale').mockReturnValue(false);
      
      const result = await adapter.getPatternRecommendations(context);
      
      expect(result.suggestionsByType).toHaveProperty('click');
      expect(result.overallHealth).toBeGreaterThan(0);
      expect(result.needsTraining).toEqual([]);
      expect(result.stalePatterns).toEqual([]);
    });
  });
});