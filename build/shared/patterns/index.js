/**
 * @fileoverview Shared patterns index - unified imports for all patterns
 * @module shared/patterns
 */
// Event handling patterns
export { TypedEventEmitter, EventBus, MessageRouter } from './event-handling';
// Error handling patterns
export { SemantestError, ValidationError, NetworkError, StorageError, PermissionError, ConfigurationError, Result, withErrorBoundary, withRetry, GlobalErrorHandler } from './error-handling';
// Logging patterns
export { LogLevel, Logger, ModuleLogger, PerformanceLogger, ChromeLogHandler } from './logging';
// Configuration patterns
export { ConfigurationManager, EnvironmentConfig, FeatureFlags, SEMANTEST_CONFIG_SCHEMA } from './configuration';
