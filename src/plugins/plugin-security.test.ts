/**
 * Unit Tests for Plugin Security System
 * Tests security policies, permissions, sandboxing, and violation tracking
 */

import { PluginSecurityManager, PermissionType, APIAccessLevel, SecurityViolationType } from './plugin-security';
import {
  PluginSecurityPolicy,
  PluginManifest,
  PluginSecurityError
} from './plugin-interface';

// Mock chrome APIs
const mockChrome = {
  runtime: {
    id: 'test-extension-id',
    sendMessage: jest.fn()
  },
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  permissions: {
    contains: jest.fn(),
    request: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 5000000,
    jsHeapSizeLimit: 10000000
  }
} as any;

describe('PluginSecurityManager', () => {
  let securityManager: PluginSecurityManager;
  let defaultPolicy: PluginSecurityPolicy;

  beforeEach(() => {
    jest.clearAllMocks();
    
    defaultPolicy = {
      allowedDomains: ['example.com', '*.trusted.com'],
      allowedPermissions: ['storage', 'tabs'],
      allowedAPIs: ['chrome.storage', 'chrome.tabs'],
      sandboxed: true,
      trustedSource: false,
      maxMemoryUsage: 10 * 1024 * 1024, // 10MB
      maxExecutionTime: 5000 // 5 seconds
    };

    securityManager = new PluginSecurityManager(defaultPolicy);
  });

  const createMockManifest = (overrides: Partial<PluginManifest> = {}): PluginManifest => ({
    metadata: {
      id: 'test-plugin',
      name: 'Test Plugin',
      version: '1.0.0',
      description: 'A test plugin',
      author: 'Test Author',
      ...overrides.metadata
    },
    capabilities: {
      supportedDomains: ['*'],
      permissions: ['storage'],
      contracts: [],
      ui: { components: [], menuItems: [] },
      ...overrides.capabilities
    },
    dependencies: [],
    configuration: {
      settings: {},
      validation: {}
    }
  });

  describe('Security Policy Management', () => {
    test('should register plugin security context', () => {
      const manifest = createMockManifest();
      
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      const context = securityManager.getPluginContext('test-plugin');
      expect(context).toBeDefined();
      expect(context?.policy).toEqual(defaultPolicy);
    });

    test('should update plugin security policy', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      const updatedPolicy: PluginSecurityPolicy = {
        ...defaultPolicy,
        allowedPermissions: ['storage', 'tabs', 'downloads']
      };
      
      securityManager.updatePolicy('test-plugin', updatedPolicy);
      
      const context = securityManager.getPluginContext('test-plugin');
      expect(context?.policy.allowedPermissions).toContain('downloads');
    });

    test('should throw error for unregistered plugin', () => {
      expect(() => securityManager.updatePolicy('unknown-plugin', defaultPolicy))
        .toThrow(PluginSecurityError);
    });

    test('should unregister plugin', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      securityManager.unregisterPlugin('test-plugin');
      
      expect(securityManager.getPluginContext('test-plugin')).toBeUndefined();
    });
  });

  describe('Permission Validation', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed permissions', () => {
      const result = securityManager.validatePermission('test-plugin', PermissionType.STORAGE);
      
      expect(result.allowed).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    test('should deny unauthorized permissions', () => {
      const result = securityManager.validatePermission('test-plugin', PermissionType.DOWNLOADS);
      
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('should check multiple permissions', () => {
      const result = securityManager.checkPermissions('test-plugin', [
        PermissionType.STORAGE,
        PermissionType.TABS,
        PermissionType.DOWNLOADS
      ]);
      
      expect(result.allowed).toEqual([
        PermissionType.STORAGE,
        PermissionType.TABS
      ]);
      expect(result.denied).toEqual([PermissionType.DOWNLOADS]);
    });

    test('should handle dangerous permissions', () => {
      const dangerousPolicy: PluginSecurityPolicy = {
        ...defaultPolicy,
        allowedPermissions: ['debugger', 'management']
      };
      
      securityManager.updatePolicy('test-plugin', dangerousPolicy);
      
      const result = securityManager.validatePermission('test-plugin', PermissionType.DEBUGGER);
      
      expect(result.allowed).toBe(true);
      expect(result.warning).toContain('dangerous permission');
    });
  });

  describe('API Access Control', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed API access', () => {
      const result = securityManager.validateAPIAccess('test-plugin', 'chrome.storage.local.get');
      
      expect(result.allowed).toBe(true);
      expect(result.level).toBe(APIAccessLevel.LIMITED);
    });

    test('should deny unauthorized API access', () => {
      const result = securityManager.validateAPIAccess('test-plugin', 'chrome.downloads.download');
      
      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
    });

    test('should track API usage', () => {
      securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      securityManager.trackAPICall('test-plugin', 'chrome.tabs.query');
      
      const usage = securityManager.getResourceUsage('test-plugin');
      
      expect(usage?.apiCalls['chrome.storage.local.get']).toBe(2);
      expect(usage?.apiCalls['chrome.tabs.query']).toBe(1);
    });

    test('should classify API access levels', () => {
      expect(securityManager.getAPIAccessLevel('chrome.storage.local.get')).toBe(APIAccessLevel.LIMITED);
      expect(securityManager.getAPIAccessLevel('chrome.storage.local.set')).toBe(APIAccessLevel.LIMITED);
      expect(securityManager.getAPIAccessLevel('chrome.debugger.attach')).toBe(APIAccessLevel.DANGEROUS);
      expect(securityManager.getAPIAccessLevel('chrome.runtime.id')).toBe(APIAccessLevel.READ_ONLY);
    });
  });

  describe('Domain Restrictions', () => {
    beforeEach(() => {
      const manifest = createMockManifest({
        capabilities: {
          supportedDomains: ['example.com', '*.test.com']
        }
      });
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'example.com');
      
      expect(result.allowed).toBe(true);
    });

    test('should validate wildcard domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'sub.trusted.com');
      
      expect(result.allowed).toBe(true);
    });

    test('should deny unauthorized domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'evil.com');
      
      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
    });

    test('should handle universal access', () => {
      const manifest = createMockManifest({
        metadata: { id: 'universal-plugin' },
        capabilities: {
          supportedDomains: ['*']
        }
      });
      
      securityManager.registerPlugin('universal-plugin', manifest, defaultPolicy);
      
      const result = securityManager.validateDomainAccess('universal-plugin', 'any-domain.com');
      
      expect(result.allowed).toBe(true);
    });
  });

  describe('Resource Monitoring', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should track memory usage', () => {
      securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 5 * 1024 * 1024 // 5MB
      });
      
      const usage = securityManager.getResourceUsage('test-plugin');
      
      expect(usage?.memoryUsage).toBe(5 * 1024 * 1024);
    });

    test('should detect memory limit violations', () => {
      securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 15 * 1024 * 1024 // 15MB (exceeds 10MB limit)
      });
      
      const violations = securityManager.getViolations('test-plugin');
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(SecurityViolationType.RESOURCE_LIMIT_EXCEEDED);
    });

    test('should track CPU time', () => {
      securityManager.updateResourceUsage('test-plugin', {
        cpuTime: 1000 // 1 second
      });
      
      const usage = securityManager.getResourceUsage('test-plugin');
      
      expect(usage?.cpuTime).toBe(1000);
    });

    test('should detect execution time violations', () => {
      securityManager.updateResourceUsage('test-plugin', {
        cpuTime: 6000 // 6 seconds (exceeds 5 second limit)
      });
      
      const violations = securityManager.getViolations('test-plugin');
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(SecurityViolationType.RESOURCE_LIMIT_EXCEEDED);
    });

    test('should track network requests', () => {
      securityManager.trackNetworkRequest('test-plugin', 'https://api.example.com');
      securityManager.trackNetworkRequest('test-plugin', 'https://api.example.com');
      
      const usage = securityManager.getResourceUsage('test-plugin');
      
      expect(usage?.networkRequests).toBe(2);
    });
  });

  describe('Sandbox Management', () => {
    test('should create sandbox configuration', () => {
      const config = securityManager.createSandboxConfig(defaultPolicy);
      
      expect(config.allowedGlobals).toContain('console');
      expect(config.restrictedAPIs).toContain('chrome.debugger');
      expect(config.resourceLimits.maxMemoryUsage).toBe(10 * 1024 * 1024);
    });

    test('should generate CSP directives', () => {
      const config = securityManager.createSandboxConfig(defaultPolicy);
      
      expect(config.cspDirectives).toContain("default-src 'none'");
      expect(config.cspDirectives).toContain("script-src 'self'");
    });

    test('should validate sandbox escape attempts', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      const violation = securityManager.reportSandboxEscape('test-plugin', {
        attempt: 'eval("malicious code")',
        context: 'plugin initialization'
      });
      
      expect(violation.type).toBe(SecurityViolationType.SANDBOX_ESCAPE_ATTEMPT);
      expect(violation.severity).toBe('critical');
    });

    test('should block repeated sandbox violations', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      // Report multiple violations
      for (let i = 0; i < 5; i++) {
        securityManager.reportSandboxEscape('test-plugin', {
          attempt: `violation ${i}`
        });
      }
      
      const context = securityManager.getPluginContext('test-plugin');
      expect(context?.blocked).toBe(true);
    });
  });

  describe('Security Violations', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should record security violations', () => {
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Attempted to access downloads API',
        severity: 'medium'
      });
      
      const violations = securityManager.getViolations('test-plugin');
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(SecurityViolationType.PERMISSION_DENIED);
    });

    test('should track violation history', () => {
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.UNAUTHORIZED_API_ACCESS,
        description: 'First violation',
        severity: 'low'
      });
      
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.DOMAIN_RESTRICTION,
        description: 'Second violation',
        severity: 'medium'
      });
      
      const violations = securityManager.getViolations('test-plugin');
      
      expect(violations).toHaveLength(2);
      expect(violations[0].timestamp).toBeLessThan(violations[1].timestamp);
    });

    test('should clear violations', () => {
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Test violation',
        severity: 'low'
      });
      
      securityManager.clearViolations('test-plugin');
      
      const violations = securityManager.getViolations('test-plugin');
      expect(violations).toHaveLength(0);
    });

    test('should get all plugin violations', () => {
      const manifest2 = createMockManifest({ metadata: { id: 'plugin2' } });
      securityManager.registerPlugin('plugin2', manifest2, defaultPolicy);
      
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Plugin 1 violation',
        severity: 'low'
      });
      
      securityManager.recordViolation('plugin2', {
        type: SecurityViolationType.DOMAIN_RESTRICTION,
        description: 'Plugin 2 violation',
        severity: 'medium'
      });
      
      const allViolations = securityManager.getAllViolations();
      
      expect(allViolations).toHaveLength(2);
      expect(allViolations.map(v => v.pluginId)).toContain('test-plugin');
      expect(allViolations.map(v => v.pluginId)).toContain('plugin2');
    });
  });

  describe('Malicious Behavior Detection', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
    });

    test('should detect rapid API calls', () => {
      // Simulate rapid API calls
      for (let i = 0; i < 100; i++) {
        securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      }
      
      const violations = securityManager.getViolations('test-plugin');
      const maliciousViolation = violations.find(v => 
        v.type === SecurityViolationType.MALICIOUS_BEHAVIOR
      );
      
      expect(maliciousViolation).toBeDefined();
      expect(maliciousViolation?.description).toContain('excessive API calls');
    });

    test('should detect data exfiltration patterns', () => {
      // Simulate suspicious network activity
      const suspiciousUrls = [
        'http://evil.com/steal',
        'http://malicious.net/data',
        'http://attacker.org/collect'
      ];
      
      suspiciousUrls.forEach(url => {
        securityManager.trackNetworkRequest('test-plugin', url);
      });
      
      const violations = securityManager.getViolations('test-plugin');
      const maliciousViolation = violations.find(v => 
        v.description.includes('suspicious network')
      );
      
      expect(maliciousViolation).toBeDefined();
    });

    test('should detect permission escalation attempts', () => {
      // Attempt to access multiple denied permissions
      const deniedPermissions = [
        PermissionType.DEBUGGER,
        PermissionType.MANAGEMENT,
        PermissionType.PROXY
      ];
      
      deniedPermissions.forEach(permission => {
        securityManager.validatePermission('test-plugin', permission);
      });
      
      const violations = securityManager.getViolations('test-plugin');
      
      expect(violations.length).toBeGreaterThan(0);
    });
  });

  describe('Security Reports', () => {
    test('should generate security report for plugin', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      // Generate some activity
      securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      securityManager.validatePermission('test-plugin', PermissionType.DOWNLOADS);
      securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 5 * 1024 * 1024
      });
      
      const report = securityManager.generateSecurityReport('test-plugin');
      
      expect(report.pluginId).toBe('test-plugin');
      expect(report.violations).toHaveLength(1);
      expect(report.resourceUsage).toBeDefined();
      expect(report.riskScore).toBeGreaterThan(0);
    });

    test('should calculate risk scores', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      // Low risk activity
      securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      
      let report = securityManager.generateSecurityReport('test-plugin');
      const lowRiskScore = report.riskScore;
      
      // High risk activity
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.SANDBOX_ESCAPE_ATTEMPT,
        description: 'Critical violation',
        severity: 'critical'
      });
      
      report = securityManager.generateSecurityReport('test-plugin');
      const highRiskScore = report.riskScore;
      
      expect(highRiskScore).toBeGreaterThan(lowRiskScore);
    });

    test('should generate summary report for all plugins', () => {
      const manifest1 = createMockManifest();
      const manifest2 = createMockManifest({ metadata: { id: 'plugin2' } });
      
      securityManager.registerPlugin('test-plugin', manifest1, defaultPolicy);
      securityManager.registerPlugin('plugin2', manifest2, defaultPolicy);
      
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Test violation',
        severity: 'low'
      });
      
      const summary = securityManager.generateSummaryReport();
      
      expect(summary.totalPlugins).toBe(2);
      expect(summary.totalViolations).toBe(1);
      expect(summary.pluginReports).toHaveLength(2);
    });
  });

  describe('Cleanup', () => {
    test('should clean up resources on plugin unregister', () => {
      const manifest = createMockManifest();
      securityManager.registerPlugin('test-plugin', manifest, defaultPolicy);
      
      // Generate some data
      securityManager.trackAPICall('test-plugin', 'chrome.storage.local.get');
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Test violation',
        severity: 'low'
      });
      
      securityManager.unregisterPlugin('test-plugin');
      
      expect(securityManager.getPluginContext('test-plugin')).toBeUndefined();
      expect(securityManager.getViolations('test-plugin')).toHaveLength(0);
      expect(securityManager.getResourceUsage('test-plugin')).toBeUndefined();
    });
  });
});