/**
 * @fileoverview Shared configuration patterns for Semantest
 * @module shared/patterns/configuration
 */
import { Result, ConfigurationError } from './error-handling';
/**
 * Type-safe configuration manager
 */
export class ConfigurationManager {
    constructor(schema, storage = chrome.storage.sync) {
        this.schema = schema;
        this.storage = storage;
        this.config = {};
        this.listeners = [];
    }
    async load() {
        try {
            const stored = await this.storage.get(Object.keys(this.schema));
            const config = {};
            // Apply defaults and validate
            for (const [key, schema] of Object.entries(this.schema)) {
                const value = stored[key] ?? schema.default;
                if (schema.required && value === undefined) {
                    return Result.err(new ConfigurationError(`Missing required configuration: ${key}`));
                }
                if (value !== undefined) {
                    if (!this.validateType(value, schema.type)) {
                        return Result.err(new ConfigurationError(`Invalid type for ${key}: expected ${schema.type}, got ${typeof value}`));
                    }
                    if (schema.validate && !schema.validate(value)) {
                        return Result.err(new ConfigurationError(`Invalid value for ${key}: ${value}`));
                    }
                    config[key] = value;
                }
            }
            this.config = config;
            return Result.ok(config);
        }
        catch (error) {
            return Result.err(new ConfigurationError('Failed to load configuration', { error }));
        }
    }
    async save(updates) {
        try {
            // Validate updates
            for (const [key, value] of Object.entries(updates)) {
                const schema = this.schema[key];
                if (!schema) {
                    return Result.err(new ConfigurationError(`Unknown configuration key: ${key}`));
                }
                if (value !== undefined) {
                    if (!this.validateType(value, schema.type)) {
                        return Result.err(new ConfigurationError(`Invalid type for ${key}: expected ${schema.type}, got ${typeof value}`));
                    }
                    if (schema.validate && !schema.validate(value)) {
                        return Result.err(new ConfigurationError(`Invalid value for ${key}: ${value}`));
                    }
                }
            }
            await this.storage.set(updates);
            this.config = { ...this.config, ...updates };
            this.notifyListeners();
            return Result.ok(undefined);
        }
        catch (error) {
            return Result.err(new ConfigurationError('Failed to save configuration', { error }));
        }
    }
    get(key) {
        return this.config[key];
    }
    getAll() {
        return { ...this.config };
    }
    onChange(listener) {
        this.listeners.push(listener);
        return () => {
            const index = this.listeners.indexOf(listener);
            if (index >= 0) {
                this.listeners.splice(index, 1);
            }
        };
    }
    validateType(value, type) {
        switch (type) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'object':
                return typeof value === 'object' && value !== null && !Array.isArray(value);
            case 'array':
                return Array.isArray(value);
            default:
                return false;
        }
    }
    notifyListeners() {
        const config = this.config;
        this.listeners.forEach(listener => {
            try {
                listener(config);
            }
            catch (error) {
                console.error('Configuration listener error:', error);
            }
        });
    }
}
/**
 * Environment-specific configuration
 */
export class EnvironmentConfig {
    static get isDevelopment() {
        if (this._isDevelopment === undefined) {
            this._isDevelopment = !('update_url' in chrome.runtime.getManifest());
        }
        return this._isDevelopment;
    }
    static get isProduction() {
        if (this._isProduction === undefined) {
            this._isProduction = 'update_url' in chrome.runtime.getManifest();
        }
        return this._isProduction;
    }
    static get logLevel() {
        return this.isDevelopment ? 'debug' : 'info';
    }
}
/**
 * Feature flags configuration
 */
export class FeatureFlags {
    static async load() {
        try {
            const stored = await chrome.storage.local.get('featureFlags');
            if (stored.featureFlags) {
                Object.entries(stored.featureFlags).forEach(([key, value]) => {
                    this.flags.set(key, value);
                });
            }
        }
        catch (error) {
            console.error('Failed to load feature flags:', error);
        }
    }
    static isEnabled(flag, defaultValue = false) {
        // Check overrides first
        if (this.overrides.has(flag)) {
            return this.overrides.get(flag);
        }
        // Then check stored flags
        if (this.flags.has(flag)) {
            return this.flags.get(flag);
        }
        return defaultValue;
    }
    static async setFlag(flag, enabled) {
        this.flags.set(flag, enabled);
        try {
            const allFlags = Object.fromEntries(this.flags);
            await chrome.storage.local.set({ featureFlags: allFlags });
        }
        catch (error) {
            console.error('Failed to save feature flags:', error);
        }
    }
    static override(flag, enabled) {
        this.overrides.set(flag, enabled);
    }
    static clearOverride(flag) {
        this.overrides.delete(flag);
    }
}
FeatureFlags.flags = new Map();
FeatureFlags.overrides = new Map();
/**
 * Semantest-specific configuration schema
 */
export const SEMANTEST_CONFIG_SCHEMA = {
    apiKey: {
        type: 'string',
        required: false,
        description: 'API key for external services'
    },
    maxPatterns: {
        type: 'number',
        default: 100,
        validate: (v) => v > 0 && v <= 1000,
        description: 'Maximum number of patterns to store'
    },
    autoTraining: {
        type: 'boolean',
        default: true,
        description: 'Enable automatic pattern training'
    },
    debugMode: {
        type: 'boolean',
        default: false,
        description: 'Enable debug logging'
    },
    syncSettings: {
        type: 'boolean',
        default: true,
        description: 'Sync settings across devices'
    },
    performance: {
        type: 'object',
        default: {
            enableOptimizations: true,
            cacheSize: 50,
            throttleDelay: 100
        },
        description: 'Performance optimization settings'
    }
};
