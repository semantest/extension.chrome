/**
 * Unit Tests for Plugin Registry
 * Tests plugin lifecycle management, discovery, and registration system
 */
import { PluginRegistry } from './plugin-registry';
import { PluginEvents, PluginError, PluginLoadError, PluginInitializationError, PluginDependencyError } from './plugin-interface';
// Mock plugin implementation
class MockPlugin {
    constructor(id, name = 'Test Plugin', version = '1.0.0') {
        this._initialized = false;
        this._active = false;
        this._destroyed = false;
        this.id = id;
        this.name = name;
        this.version = version;
        this.metadata = { id, name, version };
        this.capabilities = {
            supportedDomains: ['*'],
            permissions: ['activeTab']
        };
    }
    async initialize(context) {
        if (this._initialized)
            throw new Error('Already initialized');
        this._initialized = true;
    }
    async activate() {
        if (!this._initialized)
            throw new Error('Not initialized');
        if (this._active)
            throw new Error('Already active');
        this._active = true;
    }
    async deactivate() {
        if (!this._active)
            throw new Error('Not active');
        this._active = false;
    }
    async destroy() {
        if (this._destroyed)
            throw new Error('Already destroyed');
        this._destroyed = true;
        this._active = false;
        this._initialized = false;
    }
    getContracts() {
        return [];
    }
    async executeCapability(capability, params) {
        return { success: true };
    }
    getUIComponents() {
        return [];
    }
    getMenuItems() {
        return [];
    }
    async onEvent(event) {
        // Mock event handling
    }
    // Test helpers
    get isInitialized() { return this._initialized; }
    get isActive() { return this._active; }
    get isDestroyed() { return this._destroyed; }
}
// Mock faulty plugin that throws errors
class FaultyPlugin extends MockPlugin {
    constructor(id, failOn = 'initialize') {
        super(id, 'Faulty Plugin');
        this.failOn = failOn;
    }
    async initialize(context) {
        if (this.failOn === 'initialize')
            throw new Error('Initialization failed');
        await super.initialize(context);
    }
    async activate() {
        if (this.failOn === 'activate')
            throw new Error('Activation failed');
        await super.activate();
    }
    async deactivate() {
        if (this.failOn === 'deactivate')
            throw new Error('Deactivation failed');
        await super.deactivate();
    }
    async destroy() {
        if (this.failOn === 'destroy')
            throw new Error('Destruction failed');
        await super.destroy();
    }
}
// Mock event bus
class MockEventBus {
    constructor() {
        this.listeners = new Map();
        this.emittedEvents = [];
    }
    async emit(event) {
        this.emittedEvents.push(event);
        const handlers = this.listeners.get(event.type) || [];
        await Promise.all(handlers.map(handler => handler(event)));
    }
    on(eventType, handler) {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, []);
        }
        this.listeners.get(eventType).push(handler);
    }
    off(eventType, handler) {
        const handlers = this.listeners.get(eventType);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
        }
    }
    getEmittedEvents() {
        return [...this.emittedEvents];
    }
    clearEmittedEvents() {
        this.emittedEvents = [];
    }
}
describe('PluginRegistry', () => {
    let registry;
    let eventBus;
    let mockContext;
    let consoleSpy;
    beforeEach(() => {
        eventBus = new MockEventBus();
        registry = new PluginRegistry(eventBus);
        mockContext = {
            storage: {},
            ui: {},
            communication: {},
            security: {},
            capabilities: []
        };
        consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        jest.spyOn(console, 'error').mockImplementation();
    });
    afterEach(() => {
        consoleSpy.mockRestore();
        jest.restoreAllMocks();
    });
    const createMockManifest = (id, dependencies = []) => ({
        metadata: {
            id,
            name: `Plugin ${id}`,
            version: '1.0.0',
            description: 'Test plugin',
            author: 'Test Author'
        },
        capabilities: {
            supportedDomains: ['*'],
            permissions: ['activeTab'],
            contracts: [],
            ui: { components: [], menuItems: [] }
        },
        dependencies,
        configuration: {
            settings: {},
            validation: {}
        }
    });
    describe('Plugin Registration', () => {
        test('should register a valid plugin successfully', async () => {
            const plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            await registry.register(plugin, manifest, mockContext);
            expect(registry.getPlugin('test-plugin')).toBe(plugin);
            expect(registry.getAllPlugins()).toHaveLength(1);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_LOADED }));
        });
        test('should throw error for duplicate plugin registration', async () => {
            const plugin1 = new MockPlugin('test-plugin');
            const plugin2 = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            await registry.register(plugin1, manifest, mockContext);
            await expect(registry.register(plugin2, manifest, mockContext))
                .rejects.toThrow(PluginLoadError);
        });
        test('should validate plugin structure', async () => {
            const invalidPlugin = { id: 'invalid' };
            const manifest = createMockManifest('invalid');
            await expect(registry.register(invalidPlugin, manifest, mockContext))
                .rejects.toThrow(PluginLoadError);
        });
        test('should check plugin-manifest ID consistency', async () => {
            const plugin = new MockPlugin('plugin-id');
            const manifest = createMockManifest('different-id');
            await expect(registry.register(plugin, manifest, mockContext))
                .rejects.toThrow(PluginLoadError);
        });
        test('should validate required plugin methods', async () => {
            const incompletePlugin = {
                id: 'incomplete',
                name: 'Incomplete Plugin',
                version: '1.0.0',
                metadata: {},
                capabilities: {}
                // Missing required methods
            };
            const manifest = createMockManifest('incomplete');
            await expect(registry.register(incompletePlugin, manifest, mockContext))
                .rejects.toThrow(PluginLoadError);
        });
        test('should check dependencies before registration', async () => {
            const plugin = new MockPlugin('dependent-plugin');
            const manifest = createMockManifest('dependent-plugin', ['missing-dependency']);
            await expect(registry.register(plugin, manifest, mockContext))
                .rejects.toThrow(PluginDependencyError);
        });
        test('should register plugins with dependencies in correct order', async () => {
            const dependencyPlugin = new MockPlugin('dependency');
            const dependentPlugin = new MockPlugin('dependent');
            const dependencyManifest = createMockManifest('dependency');
            const dependentManifest = createMockManifest('dependent', ['dependency']);
            // Register dependency first
            await registry.register(dependencyPlugin, dependencyManifest, mockContext);
            await registry.register(dependentPlugin, dependentManifest, mockContext);
            const stats = registry.getStatistics();
            expect(stats.total).toBe(2);
            expect(stats.loadOrder).toEqual(['dependency', 'dependent']);
        });
    });
    describe('Plugin Unregistration', () => {
        test('should unregister a plugin successfully', async () => {
            const plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            await registry.register(plugin, manifest, mockContext);
            await registry.unregister('test-plugin');
            expect(registry.getPlugin('test-plugin')).toBeNull();
            expect(registry.getAllPlugins()).toHaveLength(0);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_DESTROYED }));
        });
        test('should throw error for unregistering non-existent plugin', async () => {
            await expect(registry.unregister('non-existent'))
                .rejects.toThrow(PluginError);
        });
        test('should prevent unregistering plugin with dependents', async () => {
            const dependencyPlugin = new MockPlugin('dependency');
            const dependentPlugin = new MockPlugin('dependent');
            const dependencyManifest = createMockManifest('dependency');
            const dependentManifest = createMockManifest('dependent', ['dependency']);
            await registry.register(dependencyPlugin, dependencyManifest, mockContext);
            await registry.register(dependentPlugin, dependentManifest, mockContext);
            await expect(registry.unregister('dependency'))
                .rejects.toThrow(PluginDependencyError);
        });
        test('should deactivate plugin before unregistering if active', async () => {
            const plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            await registry.register(plugin, manifest, mockContext);
            await registry.initialize('test-plugin');
            await registry.activate('test-plugin');
            expect(plugin.isActive).toBe(true);
            await registry.unregister('test-plugin');
            expect(plugin.isActive).toBe(false);
            expect(plugin.isDestroyed).toBe(true);
        });
    });
    describe('Plugin Lifecycle', () => {
        let plugin;
        let manifest;
        beforeEach(async () => {
            plugin = new MockPlugin('test-plugin');
            manifest = createMockManifest('test-plugin');
            await registry.register(plugin, manifest, mockContext);
        });
        test('should initialize plugin successfully', async () => {
            await registry.initialize('test-plugin');
            expect(plugin.isInitialized).toBe(true);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_INITIALIZED }));
        });
        test('should activate initialized plugin successfully', async () => {
            await registry.initialize('test-plugin');
            await registry.activate('test-plugin');
            expect(plugin.isActive).toBe(true);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_ACTIVATED }));
        });
        test('should deactivate active plugin successfully', async () => {
            await registry.initialize('test-plugin');
            await registry.activate('test-plugin');
            await registry.deactivate('test-plugin');
            expect(plugin.isActive).toBe(false);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_DEACTIVATED }));
        });
        test('should handle initialization errors', async () => {
            const faultyPlugin = new FaultyPlugin('faulty-plugin', 'initialize');
            const faultyManifest = createMockManifest('faulty-plugin');
            await registry.register(faultyPlugin, faultyManifest, mockContext);
            await expect(registry.initialize('faulty-plugin'))
                .rejects.toThrow(PluginInitializationError);
            const registration = registry.getPluginRegistration('faulty-plugin');
            expect(registration?.state).toBe('error');
            expect(registration?.errorCount).toBe(1);
        });
        test('should handle activation errors', async () => {
            const faultyPlugin = new FaultyPlugin('faulty-plugin', 'activate');
            const faultyManifest = createMockManifest('faulty-plugin');
            await registry.register(faultyPlugin, faultyManifest, mockContext);
            await registry.initialize('faulty-plugin');
            await expect(registry.activate('faulty-plugin'))
                .rejects.toThrow(PluginError);
            const registration = registry.getPluginRegistration('faulty-plugin');
            expect(registration?.state).toBe('error');
        });
        test('should handle deactivation errors', async () => {
            const faultyPlugin = new FaultyPlugin('faulty-plugin', 'deactivate');
            const faultyManifest = createMockManifest('faulty-plugin');
            await registry.register(faultyPlugin, faultyManifest, mockContext);
            await registry.initialize('faulty-plugin');
            await faultyPlugin.activate(); // Bypass registry to set up for deactivation test
            await expect(registry.deactivate('faulty-plugin'))
                .rejects.toThrow(PluginError);
        });
        test('should prevent invalid state transitions', async () => {
            // Try to activate without initializing
            await expect(registry.activate('test-plugin'))
                .rejects.toThrow(PluginError);
            // Try to initialize twice
            await registry.initialize('test-plugin');
            await expect(registry.initialize('test-plugin'))
                .rejects.toThrow(PluginError);
        });
        test('should handle dependencies during lifecycle operations', async () => {
            const dependencyPlugin = new MockPlugin('dependency');
            const dependentPlugin = new MockPlugin('dependent');
            const dependencyManifest = createMockManifest('dependency');
            const dependentManifest = createMockManifest('dependent', ['dependency']);
            await registry.register(dependencyPlugin, dependencyManifest, mockContext);
            await registry.register(dependentPlugin, dependentManifest, mockContext);
            // Activating dependent should activate dependency first
            await registry.initialize('dependent');
            await registry.activate('dependent');
            expect(dependencyPlugin.isInitialized).toBe(true);
            expect(dependencyPlugin.isActive).toBe(true);
            expect(dependentPlugin.isActive).toBe(true);
        });
        test('should handle dependents during deactivation', async () => {
            const dependencyPlugin = new MockPlugin('dependency');
            const dependentPlugin = new MockPlugin('dependent');
            const dependencyManifest = createMockManifest('dependency');
            const dependentManifest = createMockManifest('dependent', ['dependency']);
            await registry.register(dependencyPlugin, dependencyManifest, mockContext);
            await registry.register(dependentPlugin, dependentManifest, mockContext);
            await registry.initialize('dependency');
            await registry.activate('dependency');
            await registry.initialize('dependent');
            await registry.activate('dependent');
            // Deactivating dependency should deactivate dependent first
            await registry.deactivate('dependency');
            expect(dependentPlugin.isActive).toBe(false);
            expect(dependencyPlugin.isActive).toBe(false);
        });
    });
    describe('Plugin Queries', () => {
        beforeEach(async () => {
            const plugin1 = new MockPlugin('plugin1');
            plugin1.capabilities.supportedDomains = ['example.com'];
            const plugin2 = new MockPlugin('plugin2');
            plugin2.capabilities.supportedDomains = ['*.google.com'];
            const plugin3 = new MockPlugin('plugin3');
            await registry.register(plugin1, createMockManifest('plugin1'), mockContext);
            await registry.register(plugin2, createMockManifest('plugin2'), mockContext);
            await registry.register(plugin3, createMockManifest('plugin3'), mockContext);
            await registry.initialize('plugin1');
            await registry.activate('plugin1');
            await registry.initialize('plugin2');
        });
        test('should get plugins by domain', () => {
            const examplePlugins = registry.getPluginsByDomain('example.com');
            expect(examplePlugins).toHaveLength(1);
            expect(examplePlugins[0].id).toBe('plugin1');
            const googlePlugins = registry.getPluginsByDomain('mail.google.com');
            expect(googlePlugins).toHaveLength(1);
            expect(googlePlugins[0].id).toBe('plugin2');
            const allDomainPlugins = registry.getPluginsByDomain('any-domain.com');
            expect(allDomainPlugins).toHaveLength(1);
            expect(allDomainPlugins[0].id).toBe('plugin3');
        });
        test('should get plugins by state', () => {
            const activePlugins = registry.getPluginsByState('active');
            expect(activePlugins).toHaveLength(1);
            expect(activePlugins[0].id).toBe('plugin1');
            const initializedPlugins = registry.getPluginsByState('initialized');
            expect(initializedPlugins).toHaveLength(1);
            expect(initializedPlugins[0].id).toBe('plugin2');
            const uninitializedPlugins = registry.getPluginsByState('uninitialized');
            expect(uninitializedPlugins).toHaveLength(1);
            expect(uninitializedPlugins[0].id).toBe('plugin3');
        });
        test('should get plugin registration information', () => {
            const registration = registry.getPluginRegistration('plugin1');
            expect(registration).toBeTruthy();
            expect(registration?.state).toBe('active');
            expect(registration?.loadedAt).toBeInstanceOf(Date);
            expect(registration?.activatedAt).toBeInstanceOf(Date);
        });
        test('should return null for non-existent plugin', () => {
            expect(registry.getPlugin('non-existent')).toBeNull();
            expect(registry.getPluginRegistration('non-existent')).toBeNull();
        });
    });
    describe('Plugin Communication', () => {
        let plugin;
        beforeEach(async () => {
            plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            await registry.register(plugin, manifest, mockContext);
            await registry.initialize('test-plugin');
            await registry.activate('test-plugin');
            jest.spyOn(plugin, 'onEvent');
        });
        test('should send message to specific plugin', async () => {
            const message = { type: 'test', data: 'hello' };
            const result = await registry.sendMessageToPlugin('test-plugin', message);
            expect(result.success).toBe(true);
            expect(plugin.onEvent).toHaveBeenCalledWith(expect.objectContaining({
                type: 'message',
                source: 'system',
                target: 'test-plugin',
                data: message
            }));
        });
        test('should throw error when sending message to inactive plugin', async () => {
            await registry.deactivate('test-plugin');
            await expect(registry.sendMessageToPlugin('test-plugin', {}))
                .rejects.toThrow(PluginError);
        });
        test('should broadcast event to all active plugins', async () => {
            const plugin2 = new MockPlugin('plugin2');
            await registry.register(plugin2, createMockManifest('plugin2'), mockContext);
            await registry.initialize('plugin2');
            await registry.activate('plugin2');
            jest.spyOn(plugin2, 'onEvent');
            const event = {
                type: 'broadcast-test',
                source: 'system',
                target: 'all',
                data: { message: 'hello all' },
                timestamp: new Date().toISOString()
            };
            await registry.broadcastEvent(event);
            expect(plugin.onEvent).toHaveBeenCalledWith(event);
            expect(plugin2.onEvent).toHaveBeenCalledWith(event);
        });
        test('should handle errors during event broadcasting gracefully', async () => {
            const faultyPlugin = {
                ...new MockPlugin('faulty'),
                onEvent: jest.fn().mockRejectedValue(new Error('Event handling failed'))
            };
            await registry.register(faultyPlugin, createMockManifest('faulty'), mockContext);
            await registry.initialize('faulty');
            await registry.activate('faulty');
            const event = {
                type: 'test-event',
                source: 'system',
                target: 'all',
                data: {},
                timestamp: new Date().toISOString()
            };
            // Should not throw despite one plugin failing
            await expect(registry.broadcastEvent(event)).resolves.not.toThrow();
        });
    });
    describe('Plugin Discovery', () => {
        test('should discover plugins from all sources by default', async () => {
            const manifests = await registry.discoverPlugins();
            expect(manifests).toBeInstanceOf(Array);
            // Since discovery methods are placeholder implementations, should return empty array
            expect(manifests).toHaveLength(0);
        });
        test('should filter discovered plugins by domain', async () => {
            const manifests = await registry.discoverPlugins({ domain: 'example.com' });
            expect(manifests).toBeInstanceOf(Array);
        });
        test('should discover from specific source', async () => {
            const manifests = await registry.discoverPlugins({ source: 'manifest' });
            expect(manifests).toBeInstanceOf(Array);
        });
        test('should handle discovery errors', async () => {
            // Mock discovery method to throw error
            jest.spyOn(registry, 'discoverFromManifest')
                .mockRejectedValue(new Error('Discovery failed'));
            await expect(registry.discoverPlugins({ source: 'manifest' }))
                .rejects.toThrow(PluginError);
        });
    });
    describe('Registry Shutdown', () => {
        test('should shutdown all plugins in reverse load order', async () => {
            const plugin1 = new MockPlugin('plugin1');
            const plugin2 = new MockPlugin('plugin2');
            const plugin3 = new MockPlugin('plugin3');
            await registry.register(plugin1, createMockManifest('plugin1'), mockContext);
            await registry.register(plugin2, createMockManifest('plugin2'), mockContext);
            await registry.register(plugin3, createMockManifest('plugin3'), mockContext);
            await registry.initialize('plugin1');
            await registry.activate('plugin1');
            await registry.initialize('plugin2');
            await registry.activate('plugin2');
            jest.spyOn(plugin1, 'deactivate');
            jest.spyOn(plugin1, 'destroy');
            jest.spyOn(plugin2, 'deactivate');
            jest.spyOn(plugin2, 'destroy');
            jest.spyOn(plugin3, 'destroy');
            await registry.shutdown();
            expect(plugin1.deactivate).toHaveBeenCalled();
            expect(plugin2.deactivate).toHaveBeenCalled();
            expect(plugin1.destroy).toHaveBeenCalled();
            expect(plugin2.destroy).toHaveBeenCalled();
            expect(plugin3.destroy).toHaveBeenCalled();
            expect(registry.getAllPlugins()).toHaveLength(0);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.SYSTEM_SHUTDOWN }));
        });
        test('should handle shutdown errors gracefully', async () => {
            const faultyPlugin = new FaultyPlugin('faulty', 'destroy');
            await registry.register(faultyPlugin, createMockManifest('faulty'), mockContext);
            // Should not throw despite destruction error
            await expect(registry.shutdown()).resolves.not.toThrow();
        });
        test('should prevent concurrent shutdowns', async () => {
            const plugin = new MockPlugin('test-plugin');
            await registry.register(plugin, createMockManifest('test-plugin'), mockContext);
            // Start two shutdowns concurrently
            const shutdown1 = registry.shutdown();
            const shutdown2 = registry.shutdown();
            await Promise.all([shutdown1, shutdown2]);
            // Should only destroy once
            expect(plugin.isDestroyed).toBe(true);
        });
    });
    describe('Registry Statistics', () => {
        test('should provide accurate plugin statistics', async () => {
            const plugin1 = new MockPlugin('plugin1');
            const plugin2 = new MockPlugin('plugin2');
            const plugin3 = new FaultyPlugin('plugin3', 'initialize');
            await registry.register(plugin1, createMockManifest('plugin1'), mockContext);
            await registry.register(plugin2, createMockManifest('plugin2'), mockContext);
            await registry.register(plugin3, createMockManifest('plugin3'), mockContext);
            await registry.initialize('plugin1');
            await registry.activate('plugin1');
            await registry.initialize('plugin2');
            try {
                await registry.initialize('plugin3');
            }
            catch {
                // Expected to fail
            }
            const stats = registry.getStatistics();
            expect(stats.total).toBe(3);
            expect(stats.byState.active).toBe(1);
            expect(stats.byState.initialized).toBe(1);
            expect(stats.byState.error).toBe(1);
            expect(stats.errors).toBe(1);
            expect(stats.loadOrder).toEqual(['plugin1', 'plugin2', 'plugin3']);
        });
        test('should count active contracts', async () => {
            const plugin = new MockPlugin('plugin1');
            jest.spyOn(plugin, 'getContracts').mockReturnValue([
                { id: 'contract1' }, { id: 'contract2' }
            ]);
            await registry.register(plugin, createMockManifest('plugin1'), mockContext);
            await registry.initialize('plugin1');
            await registry.activate('plugin1');
            const stats = registry.getStatistics();
            expect(stats.activeContracts).toBe(2);
        });
    });
    describe('Error Handling', () => {
        test('should emit error events for plugin failures', async () => {
            const plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            // Mock plugin validation to fail
            jest.spyOn(registry, 'validatePlugin')
                .mockImplementation(() => {
                throw new Error('Validation failed');
            });
            await expect(registry.register(plugin, manifest, mockContext))
                .rejects.toThrow(PluginLoadError);
            expect(eventBus.getEmittedEvents()).toContainEqual(expect.objectContaining({ type: PluginEvents.PLUGIN_ERROR }));
        });
        test('should track error counts in plugin registrations', async () => {
            const faultyPlugin = new FaultyPlugin('faulty', 'initialize');
            await registry.register(faultyPlugin, createMockManifest('faulty'), mockContext);
            try {
                await registry.initialize('faulty');
            }
            catch {
                // Expected to fail
            }
            const registration = registry.getPluginRegistration('faulty');
            expect(registration?.errorCount).toBe(1);
            expect(registration?.lastError).toBeInstanceOf(Error);
        });
        test('should handle event bus errors gracefully', async () => {
            const faultyEventBus = {
                emit: jest.fn().mockRejectedValue(new Error('Event bus error')),
                on: jest.fn(),
                off: jest.fn()
            };
            const registryWithFaultyBus = new PluginRegistry(faultyEventBus);
            const plugin = new MockPlugin('test-plugin');
            const manifest = createMockManifest('test-plugin');
            // Should not throw despite event bus error
            await expect(registryWithFaultyBus.register(plugin, manifest, mockContext))
                .resolves.not.toThrow();
        });
    });
});
