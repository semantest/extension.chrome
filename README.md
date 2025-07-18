# Semantest Chrome Extension

A powerful browser automation and testing extension with advanced pattern recognition, modular architecture, and extensible plugin system.

## 🏗️ Architecture Overview

The extension follows Domain-Driven Design (DDD) principles with a clean, modular architecture:

```
src/
├── shared/              # Shared patterns and utilities
│   ├── patterns/       # Event handling, error handling, logging, configuration
│   └── performance/    # Performance optimization utilities
├── downloads/          # Download management module
│   ├── domain/        # Entities, events, value objects
│   ├── application/   # Use cases and services
│   └── infrastructure/# Chrome API adapters
├── training/          # Pattern training module
│   ├── domain/        # Training entities and events
│   ├── application/   # Training logic
│   └── infrastructure/# Storage and UI adapters
├── plugins/           # Plugin system
│   ├── interfaces/    # Plugin contracts
│   └── security/      # Sandboxing and validation
└── contracts/         # Smart contract integration
```

## 🚀 Features

### Core Capabilities
- **Pattern Training**: Record and replay browser automation patterns
- **Smart Downloads**: Intelligent file download management with retry logic
- **Plugin System**: Extensible architecture for third-party integrations
- **Contract Discovery**: Blockchain smart contract interaction
- **Performance Optimization**: Built-in monitoring and optimization

### Technical Features
- **Type-Safe Event System**: Strongly typed event emitters and message routing
- **Robust Error Handling**: Comprehensive error recovery with retry mechanisms
- **Structured Logging**: Context-aware logging with performance metrics
- **Configuration Management**: Type-safe, schema-validated configuration
- **Memory Efficient**: Resource pooling and batch processing

## 📦 Installation

### Development Setup
```bash
# Install dependencies
npm install

# Build the extension
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Analyze bundle size
npm run build:analyze
```

### Loading in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `dist` directory

## 🧪 Testing

The project maintains 80%+ test coverage across all modules:

```bash
# Run all tests
npm test

# Run specific module tests
npm test -- downloads
npm test -- training
npm test -- shared

# Run with coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e
```

## 🎯 Performance

### Optimization Targets
- **Bundle Size**: < 500KB per entry point
- **Startup Time**: < 2 seconds
- **Memory Usage**: < 100MB baseline
- **API Response**: < 200ms p95

### Monitoring
```javascript
import { PerformanceMonitor, MemoryMonitor } from '@shared/performance';

// Set performance thresholds
PerformanceMonitor.setThreshold('api.call', 200);

// Record metrics
PerformanceMonitor.record('api.call', responseTime);

// Monitor memory usage
const stopMonitoring = MemoryMonitor.startMonitoring(5000);
```

## 🔌 Plugin Development

### Creating a Plugin
```typescript
import { IPlugin, PluginContext } from '@plugins/interfaces';

export class MyPlugin implements IPlugin {
  name = 'my-plugin';
  version = '1.0.0';

  async activate(context: PluginContext): Promise<void> {
    // Plugin initialization
  }

  async deactivate(): Promise<void> {
    // Cleanup
  }
}
```

### Plugin API
- **Event System**: Subscribe to extension events
- **Storage Access**: Sandboxed storage per plugin
- **UI Integration**: Add custom UI components
- **Message Passing**: Communicate with other plugins

## 🛡️ Security

### Built-in Protections
- **Plugin Sandboxing**: Isolated execution environments
- **Permission System**: Granular permission controls
- **Input Validation**: Comprehensive input sanitization
- **Error Boundaries**: Graceful error recovery

### Best Practices
1. Always validate external input
2. Use the provided error handling patterns
3. Follow the principle of least privilege
4. Implement proper cleanup in deactivate

## 📊 Architecture Decisions

### Why DDD?
- Clear separation of concerns
- Business logic isolation
- Testable architecture
- Scalable module structure

### Why TypeScript?
- Type safety catches errors early
- Better IDE support
- Self-documenting code
- Easier refactoring

### Why Event-Driven?
- Loose coupling between modules
- Extensible architecture
- Better performance characteristics
- Natural fit for browser extensions

## 🔄 Migration Guide

### From Legacy Architecture
1. **Update imports**: Use new module paths
   ```typescript
   // Old
   import { PatternManager } from '../pattern-manager';
   
   // New
   import { TrainingSession } from '@training/domain/entities';
   ```

2. **Use shared patterns**: Leverage common functionality
   ```typescript
   import { Logger, withRetry, Result } from '@shared/patterns';
   ```

3. **Follow module boundaries**: Respect domain isolation
   - Domain layer: Pure business logic
   - Application layer: Use cases
   - Infrastructure layer: External integrations

## 🚧 Roadmap

### Near Term (Q1 2024)
- [ ] WebAssembly support for performance-critical paths
- [ ] Advanced pattern matching with ML
- [ ] Cloud sync for patterns
- [ ] Multi-browser support

### Long Term
- [ ] Visual pattern builder
- [ ] Collaborative testing features
- [ ] API marketplace for plugins
- [ ] Native mobile companion app

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

Built with:
- Chrome Extension APIs
- TypeScript
- Jest
- Webpack
- Domain-Driven Design principles