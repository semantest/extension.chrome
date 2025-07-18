# Migration Guide

This guide helps you migrate from the legacy architecture to the new modular, domain-driven architecture.

## Overview of Changes

### Architectural Shift
- **From**: Monolithic file-based structure
- **To**: Domain-driven modular architecture with clear boundaries

### Key Improvements
1. **Type Safety**: Full TypeScript with strict typing
2. **Error Handling**: Centralized error handling with Result types
3. **Event System**: Type-safe event emitters replacing loose coupling
4. **Performance**: Built-in monitoring and optimization
5. **Testing**: Comprehensive test coverage (80%+)

## Module Migration

### 1. Pattern Management → Training Module

**Old Structure:**
```typescript
// pattern-manager.ts
export class PatternManager {
  async savePattern(pattern: any): Promise<void> { }
  async loadPatterns(): Promise<any[]> { }
}
```

**New Structure:**
```typescript
// Import from domain entities
import { TrainingSession, AutomationPattern } from '@training/domain/entities';
import { TrainingApplication } from '@training/application';

// Use the application service
const trainingApp = new TrainingApplication();
const session = await trainingApp.startSession(url);
await trainingApp.recordPattern(session.id, pattern);
```

### 2. Download Management

**Old Structure:**
```typescript
// Scattered download logic in background.ts
chrome.downloads.download({ url, filename });
```

**New Structure:**
```typescript
import { GoogleImagesDownloader } from '@downloads/domain/entities';
import { ChromeDownloadsAdapter } from '@downloads/infrastructure/adapters';

const downloader = new GoogleImagesDownloader(new ChromeDownloadsAdapter());
await downloader.downloadImages(searchQuery, options);
```

### 3. Storage Access

**Old Structure:**
```typescript
// Direct chrome.storage access
chrome.storage.local.set({ patterns });
chrome.storage.local.get('patterns', (result) => { });
```

**New Structure:**
```typescript
import { ConfigurationManager } from '@shared/patterns';

// Type-safe configuration
const config = new ConfigurationManager(schema);
await config.load();
const value = config.get('patterns');
```

### 4. Error Handling

**Old Structure:**
```typescript
try {
  // operation
} catch (error) {
  console.error(error);
  throw error;
}
```

**New Structure:**
```typescript
import { Result, withErrorBoundary, withRetry } from '@shared/patterns';

// Result-based error handling
const result = await withErrorBoundary(async () => {
  return await operation();
});

if (Result.isErr(result)) {
  // Handle error
}

// With retry logic
const data = await withRetry(
  () => fetchData(),
  { maxAttempts: 3, initialDelay: 1000 }
);
```

### 5. Event Handling

**Old Structure:**
```typescript
// Loose event handling
document.addEventListener('customEvent', (e) => { });
window.postMessage({ type: 'event' }, '*');
```

**New Structure:**
```typescript
import { EventBus, TypedEventEmitter } from '@shared/patterns';

// Type-safe events
interface AppEvents {
  patternRecorded: (pattern: AutomationPattern) => void;
  downloadComplete: (file: FileDownload) => void;
}

const emitter = new TypedEventEmitter<AppEvents>();
emitter.on('patternRecorded', (pattern) => {
  // Type-safe handler
});

// Or use the event bus
const bus = EventBus.getInstance();
const unsubscribe = bus.subscribe('event', handler);
```

### 6. Message Passing

**Old Structure:**
```typescript
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'download') {
    // Handle download
  }
});
```

**New Structure:**
```typescript
import { MessageRouter, MessageHandler } from '@shared/patterns';

class DownloadHandler implements MessageHandler {
  async handle(request: any, sender: chrome.runtime.MessageSender) {
    // Handle with proper typing
  }
}

const router = new MessageRouter();
router.register('download', new DownloadHandler());
router.listen();
```

## Performance Optimization

### Old Approach
- No systematic performance monitoring
- Ad-hoc optimizations
- Manual memory management

### New Approach
```typescript
import { 
  PerformanceMonitor, 
  debounce, 
  throttle, 
  LazyLoader,
  ResourcePool 
} from '@shared/performance';

// Monitor performance
PerformanceMonitor.record('operation', duration);
const stats = PerformanceMonitor.getStats('operation');

// Optimize function calls
const debouncedSave = debounce(saveData, 500);
const throttledUpdate = throttle(updateUI, 100);

// Lazy load modules
const module = await LazyLoader.load('heavyModule', () => import('./heavy'));

// Reuse resources
const pool = new ResourcePool(
  () => new Worker('worker.js'),
  (worker) => worker.postMessage({ cmd: 'reset' }),
  5
);
```

## Testing Migration

### Old Testing
```javascript
// Basic Jest tests
test('pattern saves', () => {
  // Test implementation
});
```

### New Testing
```typescript
// Comprehensive testing with proper setup
import { TestingModule } from '@testing/utils';

describe('TrainingSession', () => {
  let module: TestingModule;

  beforeEach(() => {
    module = TestingModule.create({
      providers: [TrainingApplication]
    });
  });

  it('should handle pattern recording', async () => {
    const app = module.get(TrainingApplication);
    const session = await app.startSession('http://example.com');
    
    expect(session).toBeDefined();
    expect(session.isActive).toBe(true);
  });
});
```

## Configuration Migration

### Old Configuration
```javascript
// Hardcoded values
const MAX_PATTERNS = 100;
const API_TIMEOUT = 5000;
```

### New Configuration
```typescript
import { ConfigurationManager, SEMANTEST_CONFIG_SCHEMA } from '@shared/patterns';

const config = new ConfigurationManager(SEMANTEST_CONFIG_SCHEMA);
await config.load();

// Type-safe access
const maxPatterns = config.get('maxPatterns') ?? 100;
const apiTimeout = config.get('apiTimeout') ?? 5000;

// Listen for changes
config.onChange((newConfig) => {
  // React to configuration changes
});
```

## Plugin System Migration

### Creating Plugins
```typescript
import { IPlugin, PluginContext } from '@plugins/interfaces';

export class MigratedPlugin implements IPlugin {
  name = 'migrated-plugin';
  version = '2.0.0';
  
  async activate(context: PluginContext): Promise<void> {
    // New plugin API
    context.subscriptions.push(
      context.events.on('download.complete', this.handleDownload)
    );
  }
  
  async deactivate(): Promise<void> {
    // Cleanup is now automatic via subscriptions
  }
}
```

## Common Pitfalls

### 1. Direct Chrome API Access
**Don't:**
```typescript
chrome.storage.local.set({ data });
```

**Do:**
```typescript
import { StorageAdapter } from '@shared/infrastructure';
await storageAdapter.set('data', data);
```

### 2. Untyped Events
**Don't:**
```typescript
emitter.emit('event', data);
```

**Do:**
```typescript
emitter.emit('specificEvent', typedData);
```

### 3. Synchronous Heavy Operations
**Don't:**
```typescript
const results = heavyComputation();
```

**Do:**
```typescript
const results = await BatchProcessor.process(data);
```

## Rollback Plan

If you need to rollback:

1. **Feature Flags**: Use feature flags to toggle between old and new implementations
```typescript
if (FeatureFlags.isEnabled('newArchitecture')) {
  // New implementation
} else {
  // Legacy implementation
}
```

2. **Gradual Migration**: Migrate module by module
3. **Data Compatibility**: Ensure data formats are compatible both ways

## Support

For migration support:
1. Check the [FAQ](FAQ.md)
2. Review the [Architecture Guide](ARCHITECTURE.md)
3. Submit issues with the `migration` label