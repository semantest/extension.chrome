# ChatGPT Extension E2E Tests

Comprehensive end-to-end test suite for the ChatGPT browser extension using Jest and Puppeteer.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Debug tests
npm run test:debug
```

## 📁 Test Structure

```
tests/e2e/
├── setup.js                    # Test environment setup
├── jest.config.js             # Jest configuration
├── jest.setup.js              # Test helpers and matchers
├── package.json               # Dependencies and scripts
├── project-creation.test.js   # Project creation flow tests
├── custom-instructions.test.js # Instructions persistence tests
├── chat-creation.test.js      # Chat creation and management
├── prompt-sending.test.js     # Prompt sending and responses
├── image-request.test.js      # Image generation testing
└── download-functionality.test.js # Download workflow tests
```

## 🧪 Test Coverage

### 1. Project Creation Flow (60 test cases)
- ✅ Valid project names, validation, unicode support
- ✅ Error handling for duplicates, invalid characters, length limits
- ✅ Storage persistence, multi-tab sync, rapid creation
- ✅ Keyboard navigation, accessibility compliance

### 2. Custom Instructions (25 test cases)
- ✅ Adding/editing instructions with character limits
- ✅ Multi-line formatting, special characters, markdown
- ✅ Persistence across sessions, project isolation
- ✅ Storage error handling, UI state management

### 3. Chat Creation (20 test cases)
- ✅ Basic chat creation with timestamps and IDs
- ✅ Multiple chats per project, switching, ordering
- ✅ Project association, instruction inheritance
- ✅ Rapid creation, keyboard shortcuts, metadata

### 4. Prompt Sending (30 test cases)
- ✅ Text prompt sending with Enter/Shift+Enter
- ✅ Input validation, whitespace handling, long prompts
- ✅ Streaming responses, error handling, retries
- ✅ Message history, context preservation, typing indicators

### 5. Image Requests (25 test cases)
- ✅ Image generation from text prompts
- ✅ Generation progress, variants, metadata display
- ✅ Error handling for content policy, timeouts, failures
- ✅ Quality/size options, style selection, history

### 6. Download Functionality (30 test cases)
- ✅ Single/multiple image downloads with quality preservation
- ✅ Format options (PNG/JPEG/WEBP), custom filenames
- ✅ Batch downloads, ZIP archives, selective download
- ✅ Error handling, history tracking, browser compatibility

## 🔧 Configuration

### Extension Path Setup
Update `EXTENSION_PATH` in `setup.js`:
```javascript
const EXTENSION_PATH = path.join(__dirname, '../../dist');
```

### Extension ID Configuration
Update `EXTENSION_ID` in `setup.js`:
```javascript
const EXTENSION_ID = 'your-actual-extension-id';
```

### Browser Configuration
```javascript
const browser = await puppeteer.launch({
  headless: false, // Set to true for CI/CD
  args: [
    `--disable-extensions-except=${EXTENSION_PATH}`,
    `--load-extension=${EXTENSION_PATH}`,
    '--no-sandbox',
    '--disable-setuid-sandbox'
  ]
});
```

## 🎯 Test Data Attributes

Tests rely on `data-testid` attributes in the extension UI:

```html
<!-- Project Management -->
<button data-testid="create-project-btn">Create Project</button>
<input data-testid="project-name-input" />
<div data-testid="project-item">Project Name</div>

<!-- Instructions -->
<button data-testid="add-instructions-btn">Add Instructions</button>
<textarea data-testid="instructions-textarea"></textarea>
<div data-testid="instructions-display">Instructions</div>

<!-- Chat Interface -->
<button data-testid="new-chat-btn">New Chat</button>
<div data-testid="chat-item">Chat</div>
<textarea data-testid="message-input"></textarea>
<button data-testid="send-btn">Send</button>

<!-- Image Generation -->
<button data-testid="image-request-btn">Generate Image</button>
<img data-testid="generated-image" />
<button data-testid="download-image-btn">Download</button>
```

## 🚨 Common Issues & Solutions

### Extension Not Loading
```bash
# Ensure extension is built
cd ../../
npm run build

# Check extension path in setup.js
# Verify manifest.json exists in dist/
```

### Timeout Errors
```javascript
// Increase timeout in jest.config.js
testTimeout: 60000 // 60 seconds

// Or per test
test('long running test', async () => {
  // test code
}, 60000);
```

### Permission Issues
```bash
# Chrome may need explicit permission for downloads
# Run with --allow-downloads flag or manually allow in browser
```

### CI/CD Setup
```javascript
// Use headless mode for CI
const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
```

## 📊 Test Execution Matrix

| Test Suite | Duration | Coverage | Critical Path |
|------------|----------|----------|---------------|
| Project Creation | ~5 min | 95% | ✅ Core |
| Custom Instructions | ~3 min | 90% | ✅ Core |
| Chat Creation | ~2 min | 85% | ✅ Core |
| Prompt Sending | ~8 min | 95% | ✅ Critical |
| Image Requests | ~6 min | 90% | ⚠️ Feature |
| Download Functionality | ~4 min | 85% | ⚠️ Feature |

**Total Execution Time**: ~28 minutes  
**Total Test Cases**: 190 tests  
**Critical Path Coverage**: 100%

## 🔍 Debugging Tests

### Running Individual Suites
```bash
# Run specific test file
npx jest project-creation.test.js

# Run specific test
npx jest -t "should create project with valid name"

# Debug with Chrome DevTools
npm run test:debug
```

### Browser Developer Tools
```javascript
// Add breakpoint in test
await page.waitForTimeout(10000); // Keep browser open
// Then inspect elements in browser
```

### Screenshot on Failure
```javascript
afterEach(async () => {
  if (this.currentTest.state === 'failed') {
    await page.screenshot({
      path: `./screenshots/${this.currentTest.title}.png`,
      fullPage: true
    });
  }
});
```

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
name: E2E Tests
on: [push, pull_request]
jobs:
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
      - run: cd tests/e2e && npm install
      - run: cd tests/e2e && npm test
```

## 📝 Writing New Tests

### Test Template
```javascript
describe('Feature Name', () => {
  let browser, page;

  beforeAll(async () => {
    browser = await setupBrowser();
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await getExtensionPage(browser);
    await clearExtensionData(page);
    // Setup test preconditions
  });

  test('should do something', async () => {
    // Test steps
    await page.click('[data-testid="button"]');
    
    // Assertions
    await expect(page).toBeVisibleInPage('[data-testid="result"]');
  });
});
```

### Best Practices
- Use descriptive test names
- Keep tests independent
- Clean up between tests
- Use explicit waits
- Add meaningful assertions
- Test error scenarios
- Verify accessibility