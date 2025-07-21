# Complete User Flow E2E Tests

Comprehensive end-to-end tests that validate the entire user journey from extension installation to image download.

## 🎯 Test Coverage

### Complete User Flow Test (`complete-user-flow.test.js`)
Tests the full workflow:
1. **Extension Installation & Verification** - Verify extension loads and is accessible
2. **ChatGPT Integration** - Connect to ChatGPT and initialize content script
3. **Project Creation** - Create new project with custom name
4. **Custom Instructions Setup** - Configure AI behavior settings
5. **Prompt Sending & Response** - Send image generation prompt and receive response
6. **Image Detection & Download** - Detect generated images and attempt download

### Visual Demonstration Test (`complete-user-flow-visual.test.js`)
Interactive visual test with:
- Step-by-step visual indicators
- Real-time progress tracking
- Element highlighting and animations
- Success/error visual feedback
- Complete flow summary

## 🚀 Quick Start

```bash
# Navigate to E2E test directory
cd tests/e2e

# Install dependencies
npm install

# Run complete flow test (headless)
npm run test:flow-fast

# Run complete flow test (visible browser)
npm run test:flow

# Run visual demonstration (slow motion)
npm run test:flow-visual
```

## 📋 Test Scenarios

### Automated Flow Test
```bash
# Standard automated test
npm run test:flow

# Fast headless execution
npm run test:flow-fast

# With debugging
HEADLESS=false DEVTOOLS=true npm run test:flow
```

### Visual Demonstration
```bash
# Slow motion visual demo
npm run test:flow-visual

# Custom slow motion speed
HEADLESS=false SLOW_MO=1000 npm test complete-user-flow-visual.test.js

# With debugging
HEADLESS=false DEVTOOLS=true SLOW_MO=500 npm run test:flow-visual
```

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `HEADLESS` | `true` | Run browser in headless mode |
| `SLOW_MO` | `0` | Delay between actions (ms) |
| `DEVTOOLS` | `false` | Open browser devtools |
| `DEBUG` | `false` | Enable console logging |

### Test Configuration
```javascript
// Jest timeout for complete flow
testTimeout: 300000 // 5 minutes

// Puppeteer launch options
{
  headless: process.env.HEADLESS !== 'false',
  slowMo: parseInt(process.env.SLOW_MO) || 0,
  devtools: process.env.DEVTOOLS === 'true',
  defaultViewport: null
}
```

## 📊 Test Structure

### Complete Flow Test Steps

1. **Extension Verification**
   - Load extension popup
   - Verify UI elements
   - Check extension information

2. **ChatGPT Integration**
   - Navigate to ChatGPT
   - Wait for page load
   - Initialize content script
   - Verify controller status

3. **Project Creation**
   - Find New Project button
   - Create project with test name
   - Verify project appears in sidebar

4. **Custom Instructions**
   - Open settings/profile menu
   - Set custom instructions
   - Verify instructions saved

5. **Prompt & Response**
   - Send image generation prompt
   - Wait for AI response
   - Verify message appears

6. **Image Handling**
   - Wait for image generation
   - Detect generated images
   - Attempt download
   - Report results

### Visual Test Features

- **Step Indicators**: Real-time progress display
- **Element Highlighting**: Red outlines for active elements
- **Success Feedback**: Green highlights for completed actions
- **Progress Tracking**: Step-by-step status updates
- **Final Summary**: Complete flow results

## 🎬 Visual Demonstration Features

### CSS Animations
```css
.e2e-highlight {
  outline: 3px solid #ff0000 !important;
  animation: e2e-pulse 2s infinite !important;
}

.e2e-success {
  outline: 3px solid #00ff00 !important;
  animation: e2e-success-pulse 1s infinite !important;
}
```

### Step Indicators
- Fixed position progress display
- Step number and description
- Gradient background with animations
- Auto-clearing between steps

### Element Highlighting
- Automatic element detection
- Smooth scrolling to highlighted elements
- Pulse animations for attention
- Success/error color coding

## 🧪 Test Results

### Success Criteria
- Extension loads and initializes ✅
- ChatGPT integration successful ✅
- Project creation works ✅
- Custom instructions set ✅
- Prompt sent and response received ✅
- Image detection attempted ✅

### Expected Outcomes
```
📊 COMPLETE FLOW RESULTS
========================
   ✅ Extension Load
   ✅ Chatgpt Load
   ✅ Project Creation
   ✅ Custom Instructions
   ✅ Prompt Sending
   ✅ Image Detection

🎯 Success Rate: 6/6 (100%)
```

### Performance Metrics
- **Total Test Time**: ~3-5 minutes
- **Extension Load**: <10 seconds
- **ChatGPT Load**: <30 seconds
- **Project Creation**: <10 seconds
- **Prompt Response**: <60 seconds
- **Image Detection**: <45 seconds

## 🔍 Debugging

### Enable Debug Mode
```bash
DEBUG=true HEADLESS=false npm run test:flow
```

### Console Output
```
🚀 Starting Complete User Flow E2E Test
=====================================

📋 Step 1: Verifying Extension Installation
   ✅ Extension popup loaded successfully
   ✅ UI elements detected: 4/5

📋 Step 2: ChatGPT Integration & Project Creation
   🌐 Navigating to ChatGPT...
   ⏳ Waiting for extension content script...
   ✅ ChatGPT loaded and extension initialized

📋 Step 2b: Creating New Project
   📁 Creating project: "E2E Test Project 1703123456789"
   ✅ Project created and visible in sidebar
```

### Error Handling
- Automatic screenshot capture on failures
- Detailed error messages with context
- Step-by-step failure isolation
- Graceful degradation for optional features

## 🚨 Troubleshooting

### Common Issues

**Extension Not Loading**
```bash
# Ensure extension is built
cd ../.. && npm run build

# Check dist directory exists
ls -la dist/
```

**ChatGPT Login Required**
```bash
# Run with visible browser for manual login
HEADLESS=false npm run test:flow

# Login manually when prompted
# Profile will be saved for future runs
```

**Timeout Errors**
```javascript
// Increase timeout in test
test('flow test', async () => {
  // test code
}, 600000); // 10 minutes
```

**Image Generation Issues**
- Image generation may take 30-60 seconds
- Not all prompts generate images
- Download functionality may vary by browser
- Test will not fail if no images generated

### Performance Optimization
```bash
# Run specific test only
npm test complete-user-flow.test.js

# Use headless mode for speed
HEADLESS=true npm run test:flow-fast

# Reduce slow motion for faster execution
SLOW_MO=100 npm run test:flow
```

## 📈 Metrics & Reporting

### Test Metrics
- Total execution time
- Step completion rates
- Error occurrence patterns
- Performance bottlenecks

### Reporting
```bash
# Generate coverage report
npm run test:coverage

# Export results to JUnit XML
npm run test:ci

# View HTML report
open coverage/lcov-report/index.html
```

## 🔄 Continuous Integration

### GitHub Actions Example
```yaml
- name: Run Complete User Flow Test
  run: |
    cd tests/e2e
    npm install
    npm run test:flow-fast
  env:
    HEADLESS: true
    CI: true
```

### Docker Support
```dockerfile
FROM node:18
WORKDIR /app
COPY tests/e2e/package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "test:flow-fast"]
```

## 🎯 Usage Examples

### Development Testing
```bash
# Quick validation during development
npm run test:flow-fast

# Visual validation of UI changes
npm run test:flow-visual

# Debug specific issues
DEBUG=true HEADLESS=false npm run test:flow
```

### Demo & Presentation
```bash
# Slow motion demo for presentations
SLOW_MO=1000 npm run test:flow-visual

# Full visual demo with all animations
npm run test:flow-visual
```

### CI/CD Pipeline
```bash
# Automated testing in pipeline
HEADLESS=true CI=true npm run test:flow-fast

# With coverage reporting
npm run test:coverage
```

## 🤝 Contributing

When adding to the complete flow tests:

1. **Maintain Step Structure**: Keep numbered steps clear
2. **Add Visual Feedback**: Include highlighting for new elements
3. **Update Documentation**: Document new test scenarios
4. **Test Both Modes**: Verify automated and visual tests
5. **Handle Edge Cases**: Account for timing variations
6. **Update Success Criteria**: Adjust expectations as needed

## 📚 Related Documentation

- [E2E Test Setup](./setup.js)
- [Integration Tests](../integration/README.md)
- [Unit Tests](../../src/jest.config.js)
- [Load Tests](../load/README.md)