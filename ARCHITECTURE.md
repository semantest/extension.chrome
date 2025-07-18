# Architecture Overview

## Domain-Driven Design

The Semantest Chrome Extension follows Domain-Driven Design (DDD) principles to create a maintainable, scalable, and testable architecture.

### Core Principles

1. **Separation of Concerns**: Each module handles a specific domain
2. **Dependency Inversion**: High-level modules don't depend on low-level modules
3. **Interface Segregation**: Clients depend only on interfaces they use
4. **Single Responsibility**: Each class has one reason to change

### Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Presentation Layer                     │
│                  (UI Components, Popup)                   │
├─────────────────────────────────────────────────────────┤
│                   Application Layer                       │
│              (Use Cases, Application Services)            │
├─────────────────────────────────────────────────────────┤
│                     Domain Layer                          │
│           (Entities, Value Objects, Domain Events)        │
├─────────────────────────────────────────────────────────┤
│                  Infrastructure Layer                     │
│        (Adapters, External Services, Persistence)         │
└─────────────────────────────────────────────────────────┘
```

## Module Structure

### Downloads Module

```
downloads/
├── domain/
│   ├── entities/
│   │   ├── file-download.ts       # Core download entity
│   │   └── google-images-downloader.ts
│   ├── events/
│   │   └── download-events.ts     # Domain events
│   └── value-objects/
│       └── download-options.ts
├── application/
│   └── download-service.ts        # Use cases
└── infrastructure/
    └── adapters/
        ├── chrome-downloads-adapter.ts
        └── google-images-content-adapter.ts
```

### Training Module

```
training/
├── domain/
│   ├── entities/
│   │   ├── training-session.ts
│   │   └── automation-pattern.ts
│   └── events/
│       └── training-events.ts
├── application/
│   └── training-application.ts
└── infrastructure/
    ├── pattern-storage-adapter.ts
    └── ui-overlay-adapter.ts
```

### Shared Module

```
shared/
├── patterns/
│   ├── event-handling.ts     # Type-safe events
│   ├── error-handling.ts     # Result types, error classes
│   ├── logging.ts           # Structured logging
│   └── configuration.ts     # Type-safe config
└── performance/
    └── index.ts             # Performance utilities
```

## Design Patterns

### 1. Repository Pattern

```typescript
interface IPatternRepository {
  save(pattern: AutomationPattern): Promise<void>;
  findById(id: string): Promise<AutomationPattern | null>;
  findAll(): Promise<AutomationPattern[]>;
}

class ChromeStoragePatternRepository implements IPatternRepository {
  // Implementation using chrome.storage
}
```

### 2. Adapter Pattern

```typescript
interface IDownloadAdapter {
  download(options: DownloadOptions): Promise<number>;
  pause(downloadId: number): Promise<void>;
  resume(downloadId: number): Promise<void>;
}

class ChromeDownloadsAdapter implements IDownloadAdapter {
  // Adapts Chrome API to our interface
}
```

### 3. Event Sourcing

```typescript
class TrainingSession {
  private events: DomainEvent[] = [];
  
  recordAction(action: UserAction): void {
    const event = new ActionRecordedEvent(action);
    this.apply(event);
    this.events.push(event);
  }
  
  getUncommittedEvents(): DomainEvent[] {
    return [...this.events];
  }
}
```

### 4. Command Pattern

```typescript
interface ICommand<T> {
  execute(): Promise<T>;
}

class DownloadImagesCommand implements ICommand<FileDownload[]> {
  constructor(
    private query: string,
    private options: DownloadOptions
  ) {}
  
  async execute(): Promise<FileDownload[]> {
    // Execute download logic
  }
}
```

## Communication Patterns

### Message Passing

```typescript
// Type-safe message routing
const router = new MessageRouter();

router.register('download.start', new DownloadHandler());
router.register('pattern.record', new PatternHandler());

router.listen(); // Start listening for Chrome messages
```

### Event Bus

```typescript
// Cross-module communication
const bus = EventBus.getInstance();

// Publisher
bus.publish('download.completed', { fileId: '123' });

// Subscriber
const unsubscribe = bus.subscribe('download.completed', (data) => {
  console.log('Download completed:', data.fileId);
});
```

## Error Handling Strategy

### Result Type

```typescript
// No exceptions for expected errors
async function downloadFile(url: string): Promise<Result<File>> {
  if (!isValidUrl(url)) {
    return Result.err(new ValidationError('Invalid URL'));
  }
  
  try {
    const file = await download(url);
    return Result.ok(file);
  } catch (error) {
    return Result.err(new NetworkError('Download failed'));
  }
}

// Usage
const result = await downloadFile(url);
if (Result.isOk(result)) {
  console.log('File:', result.value);
} else {
  console.error('Error:', result.error);
}
```

### Error Recovery

```typescript
// Automatic retry with exponential backoff
const file = await withRetry(
  () => downloadFile(url),
  {
    maxAttempts: 3,
    shouldRetry: (error) => error instanceof NetworkError
  }
);
```

## Testing Strategy

### Unit Tests

```typescript
describe('TrainingSession', () => {
  it('should record patterns', () => {
    const session = new TrainingSession('http://example.com');
    const pattern = new AutomationPattern(...);
    
    session.addPattern(pattern);
    
    expect(session.patterns).toContain(pattern);
  });
});
```

### Integration Tests

```typescript
describe('Download Module Integration', () => {
  it('should download images from Google', async () => {
    const downloader = new GoogleImagesDownloader(
      new ChromeDownloadsAdapter()
    );
    
    const results = await downloader.downloadImages('cats', {
      limit: 5
    });
    
    expect(results).toHaveLength(5);
  });
});
```

## Security Considerations

### Plugin Sandboxing

```typescript
class PluginSandbox {
  private permissions: Set<string>;
  
  async executePlugin(plugin: IPlugin, context: PluginContext) {
    const sandboxedContext = this.createSandbox(context);
    await plugin.activate(sandboxedContext);
  }
  
  private createSandbox(context: PluginContext) {
    return new Proxy(context, {
      get: (target, prop) => {
        if (!this.hasPermission(prop)) {
          throw new PermissionError(`Access denied: ${prop}`);
        }
        return target[prop];
      }
    });
  }
}
```

### Input Validation

```typescript
class ValidationService {
  validateUrl(url: string): Result<string> {
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        return Result.err(new ValidationError('Invalid protocol'));
      }
      return Result.ok(url);
    } catch {
      return Result.err(new ValidationError('Invalid URL'));
    }
  }
}
```

## Performance Optimization

### Lazy Loading

```typescript
// Load modules on demand
const PatternMatcher = await LazyLoader.load('pattern-matcher', () =>
  import('./pattern-matcher')
);
```

### Resource Pooling

```typescript
// Reuse expensive resources
const workerPool = new ResourcePool(
  () => new Worker('worker.js'),
  (worker) => worker.terminate(),
  navigator.hardwareConcurrency
);
```

### Caching Strategy

```typescript
class CachedPatternService {
  private cache = new Map<string, CacheEntry<Pattern>>();
  
  async getPattern(id: string): Promise<Pattern> {
    const cached = this.cache.get(id);
    if (cached && !cached.isExpired()) {
      return cached.value;
    }
    
    const pattern = await this.repository.findById(id);
    this.cache.set(id, new CacheEntry(pattern, 300000)); // 5 min TTL
    
    return pattern;
  }
}
```

## Future Considerations

### Scalability

- Implement CQRS for read/write separation
- Add event streaming for real-time updates
- Consider IndexedDB for large data sets

### Extensibility

- Plugin marketplace
- Theme system
- Custom automation languages

### Performance

- WebAssembly for compute-intensive tasks
- Service Worker for offline support
- Streaming APIs for large downloads