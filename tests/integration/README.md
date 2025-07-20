# ChatGPT DOM Integration Tests

Comprehensive integration tests for verifying Chrome extension DOM manipulation on ChatGPT.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build the extension first
cd ../.. && npm run build

# Run all integration tests
npm test

# Run in headless mode
npm run test:headless

# Run with visual debugging (slow motion)
npm run test:slow
```

## 📋 Test Coverage

### Test Suites Created

1. **Content Script Initialization** (3 tests)
   - Verifies controller loads and initializes
   - Checks DOM element detection
   - Validates content script injection

2. **Project Management** (3 tests)
   - Tests project creation flow
   - Handles error scenarios
   - Verifies UI updates after creation

3. **Custom Instructions** (2 tests)
   - Tests setting custom instructions
   - Validates dialog opening and form submission

4. **Chat Creation** (2 tests)
   - Tests new chat creation
   - Verifies conversation clearing

5. **Prompt Sending** (4 tests)
   - Tests message sending workflow
   - Validates input handling
   - Checks streaming response detection
   - Handles empty prompts

6. **DOM Manipulation Helpers** (4 tests)
   - Tests custom selector support
   - Validates timeout handling
   - Checks scroll behavior
   - Verifies React event dispatching

7. **Error Handling** (2 tests)
   - Tests initialization timeout scenarios
   - Handles missing UI elements gracefully

8. **Status and Monitoring** (2 tests)
   - Validates status reporting
   - Checks controller ready messages

9. **Message Listener** (3 tests)
   - Tests runtime message handling
   - Validates unknown action handling
   - Checks async response support

**Total: 25+ integration tests**

## 🔧 Test Configuration

### Environment Variables

```bash
# Run tests in headless mode (CI/CD)
HEADLESS=true npm test

# Add delay between actions for debugging
SLOW_MO=250 npm test

# Clean up after tests
CLEAN_SCREENSHOTS=true npm test
CLEAN_PROFILE=true npm test

# Specify extension ID
EXTENSION_ID=your-extension-id npm test
```

### File Structure

```
integration/
├── chatgpt-dom.test.js      # Main test suite
├── setup.js                 # Test utilities and helpers
├── jest.config.js           # Jest configuration
├── jest.setup.js            # Test environment setup
├── global-setup.js          # Pre-test setup
├── global-teardown.js       # Post-test cleanup
├── package.json             # Dependencies
└── README.md                # This file
```

## 🧪 Running Specific Tests

### Run Single Test Suite
```bash
npm test chatgpt-dom.test.js
```

### Run Specific Test
```bash
npm run test:single "should send a prompt successfully"
```

### Debug Mode
```bash
npm run test:debug
# Then open chrome://inspect
```

### Watch Mode
```bash
npm run test:watch
```

## 📸 Screenshots

Screenshots are automatically captured on test failures and saved to `screenshots/`.

### Manual Screenshots
```javascript
await testUtils.takeScreenshot(page, 'test-name');
```

### View Screenshots
```bash
ls -la screenshots/
open screenshots/failure-*.png
```

## 🔍 Debugging Tips

### 1. Visual Debugging
```bash
# Run with slow motion to see actions
SLOW_MO=500 npm test

# Run in headed mode (not headless)
HEADLESS=false npm test
```

### 2. Console Logging
```javascript
// In test setup
page.on('console', msg => console.log('PAGE:', msg.text()));
page.on('pageerror', err => console.error('ERROR:', err));
```

### 3. Pause Execution
```javascript
// Add debugger statement
await page.evaluate(() => { debugger; });

// Or wait indefinitely
await page.waitForTimeout(999999);
```

### 4. Element Inspection
```javascript
// Check if element exists
const exists = await testUtils.elementExists(page, 'selector');

// Get element properties
const props = await page.evaluate(() => {
  const el = document.querySelector('selector');
  return {
    exists: !!el,
    visible: el?.offsetParent !== null,
    text: el?.textContent,
    value: el?.value
  };
});
```

## 🚨 Common Issues

### Extension Not Loading
```bash
# Ensure extension is built
cd ../.. && npm run build

# Check manifest.json exists
ls -la ../../dist/manifest.json
```

### ChatGPT Login Required
The tests use a persistent user profile. First run may require manual login:

```bash
# Run with headed browser
HEADLESS=false npm test

# Login manually when prompted
# Profile will be saved for future runs
```

### Timeout Errors
```javascript
// Increase timeout in specific tests
test('slow test', async () => {
  // test code
}, 120000); // 2 minutes
```

### Element Not Found
```javascript
// Use more specific selectors
const selector = 'button[aria-label="Send message"]:not(:disabled)';

// Wait for element explicitly
await page.waitForSelector(selector, { 
  visible: true,
  timeout: 10000 
});
```

## 📊 Test Reports

### Console Output
Default Jest reporter shows test progress and results.

### JUnit XML Report
```bash
# Generated at coverage/integration-junit.xml
npm run test:ci
```

### HTML Report
```bash
# Generated at coverage/integration-report.html
npm test
npm run report  # Opens in browser
```

## 🔨 Custom Matchers

The test suite includes custom Jest matchers for Puppeteer:

```javascript
// Check if selector exists
await expect(page).toHaveSelector('.chat-input');

// Check element text
await expect(page).toHaveText('button', 'Send');

// Check if element is enabled
await expect(page).toBeEnabled('#send-button');
```

## 🎯 Best Practices

### 1. Wait for Elements
```javascript
// Good
await page.waitForSelector('.element');
await page.click('.element');

// Bad
await page.click('.element'); // May fail if not ready
```

### 2. Use Data Attributes
```javascript
// Prefer data-testid when available
await page.click('[data-testid="send-button"]');
```

### 3. Handle Dynamic Content
```javascript
// Wait for content to stabilize
await page.waitForFunction(
  () => !document.querySelector('.loading-indicator')
);
```

### 4. Clean State Between Tests
```javascript
beforeEach(async () => {
  // Create fresh page
  page = await browser.newPage();
  // Navigate to clean state
  await page.goto(CHATGPT_URL);
});

afterEach(async () => {
  // Close page
  await page.close();
});
```

## 🚀 CI/CD Integration

### GitHub Actions Example
```yaml
- name: Install dependencies
  run: |
    cd extension.chrome
    npm install
    
- name: Build extension
  run: npm run build
  
- name: Run integration tests
  run: |
    cd tests/integration
    npm install
    npm run test:ci
    
- name: Upload test results
  uses: actions/upload-artifact@v3
  with:
    name: test-results
    path: |
      tests/integration/coverage/
      tests/integration/screenshots/
```

### Environment Setup
```yaml
env:
  HEADLESS: true
  EXTENSION_ID: ${{ secrets.EXTENSION_ID }}
  NODE_ENV: test
```

## 📚 Additional Resources

- [Puppeteer Documentation](https://pptr.dev)
- [Jest Documentation](https://jestjs.io)
- [Chrome Extension Testing](https://developer.chrome.com/docs/extensions/mv3/tut_testing/)
- [ChatGPT DOM Structure](https://chatgpt.com)

## 🤝 Contributing

When adding new integration tests:

1. Follow existing test patterns
2. Use descriptive test names
3. Add appropriate waits for dynamic content
4. Include error scenarios
5. Document any new utilities or helpers
6. Update this README with new test coverage