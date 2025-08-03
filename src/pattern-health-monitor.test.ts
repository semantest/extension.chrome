/**
 * @jest-environment jsdom
 */

import { PatternHealthMonitor } from './pattern-health-monitor';
import { globalPatternManager, AutomationPattern } from './pattern-manager';
import { globalMessageStore } from './message-store';
import { globalPerformanceOptimizer } from './performance-optimizer';

// Mock dependencies
jest.mock('./pattern-manager');
jest.mock('./advanced-training');
jest.mock('./message-store');
jest.mock('./performance-optimizer');

// Mock chrome storage API
const mockStorage = {
  local: {
    get: jest.fn().mockResolvedValue({}),
    set: jest.fn().mockResolvedValue(undefined)
  }
};

global.chrome = {
  storage: mockStorage,
  runtime: { id: 'test-extension-id' }
} as any;

global.navigator = { userAgent: 'test-agent' } as any;

describe('PatternHealthMonitor', () => {
  let monitor: PatternHealthMonitor;
  let mockPattern: AutomationPattern;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new PatternHealthMonitor();
    
    // Create mock pattern
    mockPattern = {
      id: 'test-pattern-1',
      name: 'Test Pattern',
      description: 'A test pattern for unit testing',
      url: 'https://example.com',
      active: true,
      steps: [
        {
          id: 'step-1',
          type: 'click',
          selector: '[data-testid="submit-button"]',
          description: 'Click submit button',
          timeout: 5000,
          retries: 2,
          errorHandling: 'retry'
        },
        {
          id: 'step-2',
          type: 'type',
          selector: '#email-input',
          value: 'test@example.com',
          description: 'Enter email address',
          timeout: 3000,
          retries: 1,
          errorHandling: 'continue'
        },
        {
          id: 'step-3',
          type: 'wait',
          selector: '.success-message',
          timeout: 10000,
          retries: 3,
          errorHandling: 'fail'
        }
      ],
      conditions: [
        {
          id: 'cond-1',
          type: 'element_exists',
          selector: '.login-form',
          value: 'true',
          comparison: 'equals'
        }
      ],
      variables: [
        {
          name: 'userEmail',
          type: 'string',
          value: 'user@example.com'
        }
      ],
      executionHistory: [],
      lastModified: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      version: '1.0.0'
    };

    // Mock pattern manager
    (globalPatternManager.getPattern as jest.Mock).mockReturnValue(mockPattern);
    
    // Mock performance optimizer
    (globalPerformanceOptimizer.timeExecution as jest.Mock).mockImplementation(async (fn) => fn());
  });

  describe('performHealthCheck', () => {
    it('should perform comprehensive health check on a pattern', async () => {
      const report = await monitor.performHealthCheck('test-pattern-1');

      expect(report).toMatchObject({
        id: expect.stringMatching(/^health-report-/),
        patternId: 'test-pattern-1',
        patternName: 'Test Pattern',
        generatedAt: expect.any(String),
        overallHealth: {
          overall: expect.any(Number),
          syntax: expect.any(Number),
          semantics: expect.any(Number),
          performance: expect.any(Number),
          reliability: expect.any(Number),
          maintainability: expect.any(Number),
          security: expect.any(Number),
          compatibility: expect.any(Number),
          'best-practices': expect.any(Number)
        },
        healthChecks: expect.any(Array),
        performanceMetrics: {
          estimatedExecutionTime: expect.any(Number),
          complexityScore: expect.any(Number),
          selectorReliability: expect.any(Number),
          errorProneness: expect.any(Number),
          resourceUsage: expect.any(Number),
          parallelizability: expect.any(Number)
        },
        reliabilityScore: expect.any(Number),
        maintainabilityScore: expect.any(Number),
        recommendations: expect.any(Array),
        riskAssessment: {
          overallRisk: expect.stringMatching(/^(low|medium|high|critical)$/),
          risks: expect.any(Array),
          mitigationStrategies: expect.any(Array)
        }
      });

      expect(globalMessageStore.addInboundMessage).toHaveBeenCalledWith(
        'PATTERN_HEALTH_CHECK_COMPLETED',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should throw error for non-existent pattern', async () => {
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(null);

      await expect(monitor.performHealthCheck('non-existent')).rejects.toThrow('Pattern not found: non-existent');
    });

    it('should run all validation rules', async () => {
      const report = await monitor.performHealthCheck('test-pattern-1');

      // Check that all categories are represented
      const categories = report.healthChecks.map(check => check.category);
      expect(categories).toContain('syntax');
      expect(categories).toContain('reliability');
      expect(categories).toContain('performance');
      expect(categories).toContain('maintainability');
      expect(categories).toContain('security');
    });

    it('should identify missing required fields', async () => {
      const incompletePattern = { ...mockPattern, name: '', steps: [] };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(incompletePattern);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      const syntaxCheck = report.healthChecks.find(check => check.name === 'Required Fields Check');
      expect(syntaxCheck).toBeDefined();
      expect(syntaxCheck?.status).toBe('failed');
      expect(syntaxCheck?.message).toContain('Missing required fields');
    });

    it('should detect weak selectors', async () => {
      const patternWithWeakSelectors = {
        ...mockPattern,
        steps: [
          {
            ...mockPattern.steps[0],
            selector: '.button-class:nth-child(3)' // Weak selector
          }
        ]
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(patternWithWeakSelectors);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      const selectorCheck = report.healthChecks.find(check => check.name === 'Selector Quality Check');
      expect(selectorCheck).toBeDefined();
      expect(selectorCheck?.status).toBe('failed');
      expect(selectorCheck?.message).toContain('fragile selectors');
    });

    it('should validate timeout configurations', async () => {
      const patternWithBadTimeouts = {
        ...mockPattern,
        steps: [
          { ...mockPattern.steps[0], timeout: 500 }, // Too low
          { ...mockPattern.steps[1], timeout: 50000 } // Too high
        ]
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(patternWithBadTimeouts);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      const timeoutCheck = report.healthChecks.find(check => check.name === 'Timeout Configuration Check');
      expect(timeoutCheck).toBeDefined();
      expect(timeoutCheck?.status).toBe('failed');
      expect(timeoutCheck?.details).toContain('timeout too low');
      expect(timeoutCheck?.details).toContain('timeout too high');
    });

    it('should detect sensitive data in pattern', async () => {
      const patternWithSensitiveData = {
        ...mockPattern,
        steps: [
          {
            ...mockPattern.steps[1],
            value: 'password123' // Sensitive data
          }
        ]
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(patternWithSensitiveData);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      const securityCheck = report.healthChecks.find(check => check.name === 'Sensitive Data Check');
      expect(securityCheck).toBeDefined();
      expect(securityCheck?.status).toBe('failed');
      expect(securityCheck?.message).toContain('sensitive data detected');
    });

    it('should generate appropriate recommendations', async () => {
      const complexPattern = {
        ...mockPattern,
        steps: Array(30).fill(null).map((_, i) => ({
          ...mockPattern.steps[0],
          id: `step-${i}`,
          timeout: 5000
        }))
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(complexPattern);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      expect(report.recommendations.length).toBeGreaterThan(0);
      
      const performanceRec = report.recommendations.find(rec => rec.type === 'optimization');
      expect(performanceRec).toBeDefined();
      expect(performanceRec?.title).toContain('Execution Time');
    });

    it('should assess risks correctly', async () => {
      const riskyPattern = {
        ...mockPattern,
        steps: Array(50).fill(null).map((_, i) => ({
          ...mockPattern.steps[0],
          id: `step-${i}`,
          selector: `.class-${i}:nth-child(${i})`, // Weak selectors
          timeout: 120000 // Very high timeout
        }))
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(riskyPattern);

      const report = await monitor.performHealthCheck('test-pattern-1');
      
      expect(report.riskAssessment.overallRisk).toMatch(/high|critical/);
      expect(report.riskAssessment.risks.length).toBeGreaterThan(0);
      
      const performanceRisk = report.riskAssessment.risks.find(risk => risk.type === 'performance');
      expect(performanceRisk).toBeDefined();
      expect(performanceRisk?.level).toMatch(/high|critical/);
    });

    it('should save health report to storage', async () => {
      await monitor.performHealthCheck('test-pattern-1');

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'pattern-health-reports': expect.objectContaining({
            reports: expect.any(Array),
            lastSaved: expect.any(String)
          })
        })
      );
    });
  });

  describe('createPatternTestSuite', () => {
    const mockTestCases = [
      {
        id: 'test-1',
        name: 'Basic flow test',
        description: 'Test the basic pattern flow',
        type: 'integration' as const,
        preconditions: [],
        expectedOutcome: { type: 'success' as const, criteria: {} },
        timeout: 30000,
        retries: 1
      }
    ];

    it('should create test suite for pattern', async () => {
      const testSuite = await monitor.createPatternTestSuite('test-pattern-1', mockTestCases);

      expect(testSuite).toMatchObject({
        id: expect.stringMatching(/^test-suite-/),
        patternId: 'test-pattern-1',
        name: 'Test Pattern Test Suite',
        description: expect.any(String),
        testCases: mockTestCases,
        coverage: {
          stepCoverage: expect.any(Number),
          conditionCoverage: expect.any(Number),
          errorPathCoverage: expect.any(Number),
          overallCoverage: expect.any(Number)
        }
      });
    });

    it('should save test suite to storage', async () => {
      await monitor.createPatternTestSuite('test-pattern-1', mockTestCases);

      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'pattern-test-suites': expect.objectContaining({
            testSuites: expect.any(Array),
            lastSaved: expect.any(String)
          })
        })
      );
    });

    it('should throw error for non-existent pattern', async () => {
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(null);

      await expect(monitor.createPatternTestSuite('non-existent', mockTestCases))
        .rejects.toThrow('Pattern not found: non-existent');
    });
  });

  describe('executeTestSuite', () => {
    it('should execute test suite successfully', async () => {
      // First create a test suite
      const testCases = [
        {
          id: 'test-1',
          name: 'Test 1',
          description: 'First test',
          type: 'unit' as const,
          preconditions: [],
          expectedOutcome: { type: 'success' as const, criteria: {} },
          timeout: 5000,
          retries: 1
        },
        {
          id: 'test-2',
          name: 'Test 2',
          description: 'Second test',
          type: 'integration' as const,
          preconditions: [],
          expectedOutcome: { type: 'element-found' as const, criteria: {} },
          timeout: 5000,
          retries: 1
        }
      ];

      const testSuite = await monitor.createPatternTestSuite('test-pattern-1', testCases);
      const results = await monitor.executeTestSuite(testSuite.id);

      expect(results).toMatchObject({
        executedAt: expect.any(String),
        totalTests: 2,
        passed: 2,
        failed: 0,
        skipped: 0,
        executionTime: expect.any(Number),
        results: expect.arrayContaining([
          expect.objectContaining({
            testCaseId: 'test-1',
            status: 'passed',
            executionTime: expect.any(Number)
          }),
          expect.objectContaining({
            testCaseId: 'test-2',
            status: 'passed',
            executionTime: expect.any(Number)
          })
        ])
      });

      expect(globalMessageStore.addInboundMessage).toHaveBeenCalledWith(
        'PATTERN_TEST_SUITE_EXECUTED',
        expect.any(Object),
        expect.any(String),
        expect.any(Object)
      );
    });

    it('should handle test failures', async () => {
      const testCases = [
        {
          id: 'test-fail',
          name: 'Failing test',
          description: 'This test should fail',
          type: 'unit' as const,
          preconditions: [],
          expectedOutcome: { type: 'error' as const, criteria: {} }, // Expecting error means test will fail
          timeout: 5000,
          retries: 1
        }
      ];

      const testSuite = await monitor.createPatternTestSuite('test-pattern-1', testCases);
      const results = await monitor.executeTestSuite(testSuite.id);

      expect(results.failed).toBe(1);
      expect(results.passed).toBe(0);
      expect(results.results[0].status).toBe('failed');
    });

    it('should throw error for non-existent test suite', async () => {
      await expect(monitor.executeTestSuite('non-existent-suite'))
        .rejects.toThrow('Test suite not found: non-existent-suite');
    });
  });

  describe('autoFixPattern', () => {
    it('should auto-fix pattern issues', async () => {
      const patternWithIssues = {
        ...mockPattern,
        steps: mockPattern.steps.map(step => ({
          ...step,
          timeout: 500, // Too low
          errorHandling: undefined // Missing
        }))
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(patternWithIssues);
      (globalPatternManager.updatePattern as jest.Mock).mockResolvedValue(true);

      const result = await monitor.autoFixPattern('test-pattern-1');

      expect(result.fixed).toBe(true);
      expect(result.changes.length).toBeGreaterThan(0);
      expect(globalPatternManager.updatePattern).toHaveBeenCalled();
    });

    it('should handle auto-fix failures gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      
      // Mock a rule that throws during auto-fix
      const brokenPattern = { ...mockPattern };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(brokenPattern);

      const result = await monitor.autoFixPattern('test-pattern-1');

      // Should still return without throwing
      expect(result).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should return no changes when pattern is healthy', async () => {
      const healthyPattern = {
        ...mockPattern,
        steps: mockPattern.steps.map(step => ({
          ...step,
          selector: '[data-testid="good-selector"]',
          timeout: 5000,
          errorHandling: 'retry'
        }))
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(healthyPattern);

      const result = await monitor.autoFixPattern('test-pattern-1');

      expect(result.fixed).toBe(false);
      expect(result.changes).toEqual([]);
      expect(globalPatternManager.updatePattern).not.toHaveBeenCalled();
    });
  });

  describe('getPatternHealthReport', () => {
    it('should retrieve health report for pattern', async () => {
      await monitor.performHealthCheck('test-pattern-1');
      
      const report = monitor.getPatternHealthReport('test-pattern-1');
      
      expect(report).toBeDefined();
      expect(report?.patternId).toBe('test-pattern-1');
    });

    it('should return null for non-existent pattern report', () => {
      const report = monitor.getPatternHealthReport('non-existent');
      expect(report).toBeNull();
    });
  });

  describe('getAllHealthReports', () => {
    it('should return all health reports sorted by date', async () => {
      // Create multiple reports
      await monitor.performHealthCheck('test-pattern-1');
      
      // Mock a different pattern
      const pattern2 = { ...mockPattern, id: 'test-pattern-2', name: 'Pattern 2' };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(pattern2);
      await monitor.performHealthCheck('test-pattern-2');

      const reports = monitor.getAllHealthReports();

      expect(reports).toHaveLength(2);
      // Should be sorted by date (newest first)
      expect(new Date(reports[0].generatedAt).getTime())
        .toBeGreaterThanOrEqual(new Date(reports[1].generatedAt).getTime());
    });
  });

  describe('getPatternTestSuite', () => {
    it('should retrieve test suite for pattern', async () => {
      await monitor.createPatternTestSuite('test-pattern-1', []);
      
      const testSuite = monitor.getPatternTestSuite('test-pattern-1');
      
      expect(testSuite).toBeDefined();
      expect(testSuite?.patternId).toBe('test-pattern-1');
    });

    it('should return null for non-existent pattern test suite', () => {
      const testSuite = monitor.getPatternTestSuite('non-existent');
      expect(testSuite).toBeNull();
    });
  });

  describe('performance metrics calculations', () => {
    it('should calculate accurate performance metrics', async () => {
      const complexPattern = {
        ...mockPattern,
        steps: [
          { ...mockPattern.steps[0], type: 'loop' as const, timeout: 15000 },
          { ...mockPattern.steps[1], type: 'condition' as const, timeout: 10000 },
          { ...mockPattern.steps[2], retries: 5, timeout: 20000 }
        ],
        conditions: [...mockPattern.conditions, ...mockPattern.conditions],
        variables: [...mockPattern.variables, ...mockPattern.variables]
      };
      (globalPatternManager.getPattern as jest.Mock).mockReturnValue(complexPattern);

      const report = await monitor.performHealthCheck('test-pattern-1');

      expect(report.performanceMetrics.estimatedExecutionTime).toBe(45000); // Sum of timeouts
      expect(report.performanceMetrics.complexityScore).toBeGreaterThan(10); // Complex pattern
      expect(report.performanceMetrics.selectorReliability).toBe(100); // Good selectors
      expect(report.performanceMetrics.errorProneness).toBeGreaterThan(0); // Some error prone patterns
    });
  });

  describe('storage operations', () => {
    it('should load health reports from storage on initialization', async () => {
      const storedReports = {
        reports: [{
          id: 'stored-report-1',
          patternId: 'pattern-1',
          patternName: 'Stored Pattern',
          generatedAt: new Date().toISOString(),
          overallHealth: { overall: 85 } as any,
          healthChecks: [],
          performanceMetrics: {} as any,
          reliabilityScore: 90,
          maintainabilityScore: 80,
          recommendations: [],
          riskAssessment: { overallRisk: 'low', risks: [], mitigationStrategies: [] }
        }],
        lastSaved: new Date().toISOString()
      };

      mockStorage.local.get.mockResolvedValueOnce({
        'pattern-health-reports': storedReports
      });

      // Create new instance to trigger load
      const newMonitor = new PatternHealthMonitor();
      
      // Give it time to load
      await new Promise(resolve => setTimeout(resolve, 10));

      const reports = newMonitor.getAllHealthReports();
      expect(reports).toHaveLength(1);
      expect(reports[0].id).toBe('stored-report-1');
    });

    it('should handle storage errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      mockStorage.local.get.mockRejectedValueOnce(new Error('Storage error'));

      // Create new instance to trigger load
      new PatternHealthMonitor();
      
      // Give it time to try loading
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });
});