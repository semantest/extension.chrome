# Chrome DevTools Protocol for CLI Integration

## Overview
Chrome DevTools Protocol (CDP) allows external tools to inspect, debug, and control Chrome/Chromium browsers.

## CLI Integration Approach

### 1. Launch Chrome with Remote Debugging
```bash
# Start Chrome with debugging port
google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-profile

# Or headless mode
google-chrome --headless --remote-debugging-port=9222
```

### 2. Connect CLI to Chrome
```javascript
const CDP = require('chrome-remote-interface');

async function connectToChrome() {
  const client = await CDP({ port: 9222 });
  const { Network, Page, Runtime } = client;
  
  await Network.enable();
  await Page.enable();
  
  return client;
}
```

### 3. Control Extension from CLI

#### Method A: Extension Message Passing
```javascript
// CLI sends message to extension via CDP
async function sendToExtension(client, extensionId, message) {
  const result = await client.Runtime.evaluate({
    expression: `
      chrome.runtime.sendMessage(
        '${extensionId}',
        ${JSON.stringify(message)},
        response => console.log(response)
      )
    `
  });
  return result;
}

// Usage
const response = await sendToExtension(client, 'extension-id', {
  action: 'CREATE_PROJECT',
  data: { name: 'CLI Project' }
});
```

#### Method B: Direct DOM Manipulation
```javascript
// CLI controls ChatGPT page directly
async function requestImage(client, prompt) {
  await client.Page.navigate({ url: 'https://chat.openai.com' });
  
  // Wait for page load
  await client.Page.loadEventFired();
  
  // Find and fill input
  await client.Runtime.evaluate({
    expression: `
      const input = document.querySelector('textarea[data-id="root"]');
      input.value = "Create an image: ${prompt}";
      input.dispatchEvent(new Event('input', { bubbles: true }));
    `
  });
  
  // Click send button
  await client.Runtime.evaluate({
    expression: `
      const sendBtn = document.querySelector('button[data-testid="send-button"]');
      sendBtn.click();
    `
  });
}
```

### 4. Extension API Exposure

#### Native Messaging Host
```json
// com.semantest.cli.json (Native messaging manifest)
{
  "name": "com.semantest.cli",
  "description": "Semantest CLI Native Host",
  "path": "/usr/local/bin/semantest-cli-host",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://YOUR_EXTENSION_ID/"
  ]
}
```

```javascript
// Extension side - expose APIs
chrome.runtime.onMessageExternal.addListener(
  (request, sender, sendResponse) => {
    if (sender.id === 'TRUSTED_CLI_ID') {
      // Process CLI commands
      switch (request.command) {
        case 'createProject':
          return handleCreateProject(request.data);
        case 'requestImage':
          return handleImageRequest(request.data);
      }
    }
  }
);
```

### 5. WebSocket Bridge Approach
```javascript
// Extension creates WebSocket server
class ExtensionBridge {
  constructor() {
    this.ws = new WebSocket('ws://localhost:8765');
    
    this.ws.onmessage = async (event) => {
      const command = JSON.parse(event.data);
      const result = await this.executeCommand(command);
      this.ws.send(JSON.stringify(result));
    };
  }
  
  async executeCommand(cmd) {
    // Forward to extension APIs
    return await chrome.runtime.sendMessage(cmd);
  }
}

// CLI connects to WebSocket
const ws = new WebSocket('ws://localhost:8765');
ws.send(JSON.stringify({
  action: 'REQUEST_IMAGE',
  data: { prompt: 'blue cat' }
}));
```

## Prototype Implementation

### semantest-cli MVP
```javascript
#!/usr/bin/env node

const CDP = require('chrome-remote-interface');
const { program } = require('commander');

program
  .name('semantest-cli')
  .description('CLI for ChatGPT Extension')
  .version('0.1.0');

program
  .command('image <prompt>')
  .description('Request an image from ChatGPT')
  .option('-d, --download', 'Auto-download generated images')
  .action(async (prompt, options) => {
    const client = await connectToChrome();
    await authenticateChatGPT(client);
    await requestImage(client, prompt);
    
    if (options.download) {
      await waitForImages(client);
      await downloadImages(client);
    }
    
    await client.close();
  });

program
  .command('project <name>')
  .description('Create a new ChatGPT project')
  .action(async (name) => {
    const client = await connectToChrome();
    await createProject(client, name);
    await client.close();
  });

program.parse();
```

## Security Considerations

1. **Extension Permissions**: Need to add `externally_connectable` in manifest
2. **Authentication**: CLI must authenticate with extension
3. **CORS**: Handle cross-origin restrictions
4. **Rate Limiting**: Respect ChatGPT's rate limits

## Recommended Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ semantest   │────▶│   Chrome     │────▶│  ChatGPT    │
│    CLI      │ CDP │   Browser    │     │   Website   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Extension   │
                    │   APIs       │
                    └──────────────┘
```

## Next Steps

1. Build proof-of-concept CLI using CDP
2. Add native messaging support to extension
3. Create authentication flow
4. Implement core commands
5. Package as npm module