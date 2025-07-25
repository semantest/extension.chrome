# Browser Extension Migration to Semantest SDK

## Overview

This document outlines the migration of the browser extension from the legacy WebSocket implementation to the new Semantest SDK client library.

## Migration Goals

1. Replace custom WebSocket handling with `@semantest/client`
2. Leverage the SDK's EventEmitter interface for event handling
3. Use the SDK's reconnection and error handling features
4. Maintain backward compatibility with existing message formats
5. Improve type safety and maintainability

## Key Changes

### 1. Background Script
- Replace manual WebSocket management with `SemantestClient`
- Use SDK's event subscription methods
- Leverage automatic reconnection features

### 2. Content Scripts
- Update to use SDK event types
- Migrate from custom message passing to SDK events

### 3. Popup UI
- Integrate React components from SDK
- Use SDK hooks for state management

## Migration Steps

### Phase 1: Add SDK Dependency
```json
{
  "dependencies": {
    "@semantest/client": "^0.1.0"
  }
}
```

### Phase 2: Update Background Script
- Import `SemantestClient` from SDK
- Replace WebSocket connection logic
- Migrate message handlers to event subscriptions

### Phase 3: Update Content Scripts
- Use SDK event types
- Update message passing to use SDK methods

### Phase 4: Enhance Popup UI
- Add React support
- Integrate SDK components
- Use hooks for real-time updates

## Benefits

1. **Reduced Code**: Remove ~200 lines of WebSocket handling
2. **Better Reliability**: Automatic reconnection and error recovery
3. **Type Safety**: Full TypeScript support with SDK types
4. **Reusability**: Share code between extension and other clients
5. **Real-time UI**: React components with live updates

## Compatibility

The migration maintains compatibility with:
- Existing server WebSocket protocol
- Current message formats
- Chrome Extension Manifest V3
- All current features

## Timeline

- Phase 1: ✅ Complete (SDK created)
- Phase 2: In Progress (Background script migration)
- Phase 3: Pending
- Phase 4: Pending