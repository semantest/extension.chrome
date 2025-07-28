/**
 * Unit Tests for Plugin Security Manager
 * Tests security policies, permissions, and sandboxing
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
  permissions: {
    contains: jest.fn(),
    request: jest.fn()
  }
};

// @ts-ignore
global.chrome = mockChrome;

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

    securityManager = new PluginSecurityManager();
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
      contractDefinitions: [],
      requiredAPIs: ['chrome.storage'],
      ...overrides.capabilities
    },
    entry: {
      script: './plugin.js',
      className: 'TestPlugin'
    },
    dependencies: []
  });

  describe('Security Context Creation', () => {
    test('should create security context for plugin', () => {
      const manifest = createMockManifest();
      
      const context = securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      expect(context).toBeDefined();
      expect(context.pluginId).toBe('test-plugin');
      expect(context.policy).toEqual(defaultPolicy);
      expect(context.violations).toEqual([]);
    });

    test('should initialize resource usage tracking', () => {
      const manifest = createMockManifest();
      
      const context = securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      expect(context.resourceUsage).toBeDefined();
      expect(context.resourceUsage.memoryUsage).toBe(0);
      expect(context.resourceUsage.cpuTime).toBe(0);
      expect(context.resourceUsage.networkRequests).toBe(0);
    });

    test('should create sandbox config when policy requires sandboxing', () => {
      const manifest = createMockManifest();
      
      const context = securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      expect(context.sandbox).toBeDefined();
      expect(context.sandbox?.allowedGlobals).toContain('console');
      expect(context.sandbox?.restrictedAPIs).toBeDefined();
    });

    test('should determine default policy when not provided', () => {
      const manifest = createMockManifest();
      
      const context = securityManager.createSecurityContext('test-plugin', manifest);
      
      expect(context.policy).toBeDefined();
      expect(context.policy.sandboxed).toBe(true);
    });
  });

  describe('Permission Validation', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed permissions', () => {
      const result = securityManager.validatePermissions('test-plugin', ['storage', 'tabs']);
      
      expect(result.granted).toEqual(['storage', 'tabs']);
      expect(result.denied).toEqual([]);
      expect(result.violations).toHaveLength(0);
    });

    test('should deny unauthorized permissions', () => {
      const result = securityManager.validatePermissions('test-plugin', ['storage', 'downloads']);
      
      expect(result.granted).toEqual(['storage']);
      expect(result.denied).toEqual(['downloads']);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe(SecurityViolationType.PERMISSION_DENIED);
    });

    test('should record security violations', () => {
      securityManager.validatePermissions('test-plugin', ['debugger', 'management']);
      
      const violations = securityManager.getPluginViolations('test-plugin');
      
      expect(violations).toHaveLength(2);
      expect(violations[0].severity).toBeTruthy();
    });

    test('should throw error for unknown plugin', () => {
      expect(() => {
        securityManager.validatePermissions('unknown-plugin', ['storage']);
      }).toThrow(PluginSecurityError);
    });
  });

  describe('API Access Control', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed API access', () => {
      const result = securityManager.validateAPIAccess('test-plugin', 'chrome.storage.local.get');
      
      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    test('should deny unauthorized API access', () => {
      const result = securityManager.validateAPIAccess('test-plugin', 'chrome.downloads.download');
      
      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe(SecurityViolationType.UNAUTHORIZED_API_ACCESS);
    });

    test('should track API usage', () => {
      securityManager.trackAPIUsage('test-plugin', 'chrome.storage.local.get');
      securityManager.trackAPIUsage('test-plugin', 'chrome.storage.local.get');
      securityManager.trackAPIUsage('test-plugin', 'chrome.tabs.query');
      
      const context = securityManager.getSecurityContext('test-plugin');
      
      expect(context?.resourceUsage.apiCalls['chrome.storage.local.get']).toBe(2);
      expect(context?.resourceUsage.apiCalls['chrome.tabs.query']).toBe(1);
    });

    test('should classify API access levels', () => {
      expect(securityManager.getAPIAccessLevel('chrome.storage.local.get')).toBe(APIAccessLevel.LIMITED);
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
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
    });

    test('should validate allowed domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'example.com');
      
      expect(result.allowed).toBe(true);
      expect(result.violation).toBeUndefined();
    });

    test('should validate wildcard domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'sub.trusted.com');
      
      expect(result.allowed).toBe(true);
    });

    test('should deny unauthorized domains', () => {
      const result = securityManager.validateDomainAccess('test-plugin', 'evil.com');
      
      expect(result.allowed).toBe(false);
      expect(result.violation).toBeDefined();
      expect(result.violation?.type).toBe(SecurityViolationType.DOMAIN_RESTRICTION);
    });
  });

  describe('Resource Monitoring', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
    });

    test('should update resource usage', () => {
      securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 5 * 1024 * 1024,
        cpuTime: 1000
      });
      
      const context = securityManager.getSecurityContext('test-plugin');
      
      expect(context?.resourceUsage.memoryUsage).toBe(5 * 1024 * 1024);
      expect(context?.resourceUsage.cpuTime).toBe(1000);
    });

    test('should detect memory limit violations', () => {
      const result = securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 15 * 1024 * 1024 // 15MB exceeds 10MB limit
      });
      
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe(SecurityViolationType.RESOURCE_LIMIT_EXCEEDED);
    });

    test('should detect execution time violations', () => {
      const result = securityManager.updateResourceUsage('test-plugin', {
        cpuTime: 6000 // 6 seconds exceeds 5 second limit
      });
      
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe(SecurityViolationType.RESOURCE_LIMIT_EXCEEDED);
    });
  });

  describe('Sandbox Management', () => {
    test('should create sandbox configuration', () => {
      const config = securityManager.createSandboxConfig(defaultPolicy);
      
      expect(config.allowedGlobals).toContain('console');
      expect(config.restrictedAPIs).toContain('chrome.debugger');
      expect(config.resourceLimits.maxMemoryUsage).toBe(10 * 1024 * 1024);
      expect(config.cspDirectives).toContain("default-src 'none'");
    });

    test('should generate CSP directives', () => {
      const config = securityManager.createSandboxConfig(defaultPolicy);
      
      const csp = config.cspDirectives.join('; ');
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("script-src 'self'");
      expect(csp).toContain("connect-src");
    });
  });

  describe('Security Violations', () => {
    beforeEach(() => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
    });

    test('should record security violations', () => {
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Attempted to access downloads API',
        severity: 'medium'
      });
      
      const violations = securityManager.getPluginViolations('test-plugin');
      
      expect(violations).toHaveLength(1);
      expect(violations[0].type).toBe(SecurityViolationType.PERMISSION_DENIED);
    });

    test('should get all violations', () => {
      const manifest2 = createMockManifest({ metadata: { id: 'plugin2' } });
      securityManager.createSecurityContext('plugin2', manifest2, defaultPolicy);
      
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

    test('should emit violation events', async () => {
      const listener = jest.fn();
      securityManager.addViolationListener(listener);
      
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.PERMISSION_DENIED,
        description: 'Test violation',
        severity: 'low'
      });
      
      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({
          pluginId: 'test-plugin',
          type: SecurityViolationType.PERMISSION_DENIED
        })
      );
    });
  });

  describe('Security Reports', () => {
    test('should generate plugin security report', () => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      // Generate some activity
      securityManager.trackAPIUsage('test-plugin', 'chrome.storage.local.get');
      securityManager.validatePermissions('test-plugin', ['downloads']);
      securityManager.updateResourceUsage('test-plugin', {
        memoryUsage: 5 * 1024 * 1024
      });
      
      const report = securityManager.generatePluginReport('test-plugin');
      
      expect(report.pluginId).toBe('test-plugin');
      expect(report.violations).toHaveLength(1);
      expect(report.resourceUsage).toBeDefined();
      expect(report.riskScore).toBeGreaterThan(0);
    });

    test('should calculate risk scores', () => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      // Low risk activity
      securityManager.trackAPIUsage('test-plugin', 'chrome.storage.local.get');
      
      let report = securityManager.generatePluginReport('test-plugin');
      const lowRiskScore = report.riskScore;
      
      // High risk activity
      securityManager.recordViolation('test-plugin', {
        type: SecurityViolationType.SANDBOX_ESCAPE_ATTEMPT,
        description: 'Critical violation',
        severity: 'critical'
      });
      
      report = securityManager.generatePluginReport('test-plugin');
      const highRiskScore = report.riskScore;
      
      expect(highRiskScore).toBeGreaterThan(lowRiskScore);
    });
  });

  describe('Cleanup', () => {
    test('should remove security context', () => {
      const manifest = createMockManifest();
      securityManager.createSecurityContext('test-plugin', manifest, defaultPolicy);
      
      securityManager.removeSecurityContext('test-plugin');
      
      expect(securityManager.getSecurityContext('test-plugin')).toBeUndefined();
    });
  });
});