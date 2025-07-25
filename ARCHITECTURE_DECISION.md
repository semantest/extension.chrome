# Architecture Decision: Hybrid D-Bus/WebSocket Approach

## Decision Summary

User has confirmed a **hybrid architecture** approach for the distributed testing framework:

- **Linux**: D-Bus for system-level IPC (when available)
- **All Other Systems**: WebSocket for cross-platform compatibility (Windows, macOS, remote)
- **No Alternative Research Needed**: WebSocket is the chosen fallback for non-Linux systems

## Implementation Priority Order

### 1. CLI Tool Implementation (semantest-cli)
- Command-line interface for sending events
- WebSocket client to connect to server
- Event command structure: `semantest-cli <EventType> --param value`
- Initial focus on core event sending/receiving

### 2. SDK Libraries
- Type-safe domain event definitions
- npm package for developers
- Event contracts and interfaces
- Client libraries for WebSocket communication

### 3. Generic Extension + Plugin System
- Browser extension that works on ANY website
- Plugin architecture for site-specific handlers
- WebSocket client for server communication
- Event routing and handling framework

### 4. Website Contracts
- Standard interface for websites to implement
- Event handler registration system
- ChatGPT as reference implementation
- Documentation for third-party integration

### 5. D-Bus Integration (Linux Only)
- Conditional D-Bus support for Linux systems
- System-level event integration
- Desktop application communication
- Fallback to WebSocket when D-Bus unavailable

## Technical Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   CLI Tool      │     │  Browser Extension│     │   SDK/Apps      │
│ (semantest-cli) │     │    (Generic)      │     │  (Type-safe)    │
└────────┬────────┘     └─────────┬────────┘     └────────┬────────┘
         │                        │                         │
         │                        │                         │
         └────────────────────────┴─────────────────────────┘
                                  │
                          ┌───────▼────────┐
                          │                │
                          │  Node.js Server│
                          │   (WebSocket)  │
                          │                │
                          └───────┬────────┘
                                  │
                      ┌───────────┴───────────┐
                      │                       │
              ┌───────▼────────┐     ┌────────▼───────┐
              │   WebSocket     │     │    D-Bus       │
              │  (All Systems)  │     │ (Linux Only)   │
              └────────────────┘     └────────────────┘
```

## Next Steps

1. **Create CLI project structure**
   - Initialize Node.js project for semantest-cli
   - Set up TypeScript configuration
   - Design command structure

2. **Design event system**
   - Define core event types
   - Create type-safe interfaces
   - Plan SDK architecture

3. **WebSocket server setup**
   - Basic Node.js WebSocket server
   - Event routing logic
   - Client management

## Key Decisions

- **WebSocket First**: Primary transport mechanism for all platforms
- **D-Bus Optional**: Enhanced Linux integration when available
- **TypeScript**: For type safety across CLI, SDK, and server
- **Event-Driven**: All communication via domain events
- **Plugin Architecture**: Extensible design for new websites/platforms