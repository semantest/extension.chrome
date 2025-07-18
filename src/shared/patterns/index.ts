/**
 * @fileoverview Shared patterns index - unified imports for all patterns
 * @module shared/patterns
 */

// Event handling patterns
export {
  TypedEventEmitter,
  EventBus,
  MessageHandler,
  MessageRouter
} from './event-handling';

// Error handling patterns
export {
  SemantestError,
  ValidationError,
  NetworkError,
  StorageError,
  PermissionError,
  ConfigurationError,
  Result,
  withErrorBoundary,
  withRetry,
  GlobalErrorHandler
} from './error-handling';

// Logging patterns
export {
  LogLevel,
  LogContext,
  LogEntry,
  Logger,
  ModuleLogger,
  PerformanceLogger,
  ChromeLogHandler
} from './logging';

// Configuration patterns
export {
  ConfigSchema,
  ConfigurationManager,
  EnvironmentConfig,
  FeatureFlags,
  SEMANTEST_CONFIG_SCHEMA
} from './configuration';

// Re-export types
export type { Result as ResultType } from './error-handling';