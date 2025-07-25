# Important Product Clarification

## Current Product: Browser Extension Only

The Semantest ChatGPT Extension v1.0.1 is a **Chrome browser extension** that enhances the ChatGPT web interface. It does NOT include CLI/SDK functionality.

### What It IS:
- ✅ Chrome browser extension
- ✅ Works within chat.openai.com interface
- ✅ GUI-based interaction via extension popup
- ✅ Automated features within the browser

### What It IS NOT:
- ❌ Command-line interface (CLI)
- ❌ Software Development Kit (SDK)
- ❌ Standalone API client
- ❌ Terminal/console application

## Example Use Case Clarification

### Expected (but NOT supported):
```bash
semantest-cli ImageRequested --prompt "blue cat"
```

### Actual Usage:
1. Open Chrome browser
2. Navigate to chat.openai.com
3. Use extension features via GUI
4. Request image through ChatGPT interface
5. Use extension to download generated images

## Future Roadmap Consideration

### Potential v2.0 Features:
- **CLI Companion Tool**: Command-line interface for power users
- **SDK/API**: Programmatic access to extension features
- **Hybrid Architecture**: Browser + CLI working together
- **Headless Mode**: Automation without GUI

### Why Browser-First?
1. Direct ChatGPT integration
2. No API key management
3. Visual feedback for users
4. Leverages existing ChatGPT auth

## Immediate Options

### Option 1: Explain Current Limitations
"The current version is a browser extension that enhances your ChatGPT web experience. CLI/SDK features are being considered for v2.0."

### Option 2: Pivot Roadmap
- Fast-track CLI development
- Create API wrapper
- Bridge browser ↔ CLI communication

### Option 3: Hybrid Approach
- Keep browser extension as-is
- Add companion CLI tool
- Share data via Chrome Native Messaging

## Recommendation

1. **Immediate**: Clear communication about browser-only nature
2. **Short-term**: Gauge user interest in CLI/SDK
3. **Long-term**: Consider v2.0 with expanded architecture

The product-market expectation gap suggests users want programmatic access to ChatGPT automation, not just browser enhancement.