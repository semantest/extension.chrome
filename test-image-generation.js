#!/usr/bin/env node

/**
 * Test script for image generation flow
 * Tests the complete pipeline: CLI → WebSocket → Extension → ChatGPT → Download
 */

const WebSocket = require('ws');
const { spawn } = require('child_process');
const path = require('path');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`)
};

class ImageGenerationTest {
  constructor() {
    this.ws = null;
    this.serverUrl = 'ws://localhost:3004';
    this.testResults = {
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runTests() {
    log.info('Starting image generation tests...\n');

    // Test 1: WebSocket Connection
    await this.testWebSocketConnection();

    // Test 2: Event Subscription
    await this.testEventSubscription();

    // Test 3: Image Generation Request
    await this.testImageGenerationRequest();

    // Test 4: Response Handling
    await this.testResponseHandling();

    // Test 5: CLI Integration
    await this.testCLIIntegration();

    // Print results
    this.printResults();
  }

  async testWebSocketConnection() {
    const testName = 'WebSocket Connection';
    log.info(`Testing: ${testName}`);

    try {
      await this.connectWebSocket();
      this.recordTest(testName, true, 'Connected successfully');
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async testEventSubscription() {
    const testName = 'Event Subscription';
    log.info(`Testing: ${testName}`);

    if (!this.ws) {
      this.recordTest(testName, false, 'WebSocket not connected');
      return;
    }

    try {
      const subscribeMessage = {
        id: `test-sub-${Date.now()}`,
        type: 'subscribe',
        timestamp: Date.now(),
        payload: {
          eventTypes: ['semantest/custom/image/download/requested']
        }
      };

      this.ws.send(JSON.stringify(subscribeMessage));
      
      // Wait for acknowledgment (simplified for test)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      this.recordTest(testName, true, 'Subscription sent successfully');
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async testImageGenerationRequest() {
    const testName = 'Image Generation Request';
    log.info(`Testing: ${testName}`);

    if (!this.ws) {
      this.recordTest(testName, false, 'WebSocket not connected');
      return;
    }

    try {
      const requestMessage = {
        id: `test-req-${Date.now()}`,
        type: 'event',
        timestamp: Date.now(),
        payload: {
          type: 'semantest/custom/image/download/requested',
          payload: {
            prompt: 'Test image generation',
            timestamp: Date.now()
          }
        }
      };

      this.ws.send(JSON.stringify(requestMessage));
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.recordTest(testName, true, 'Request sent successfully');
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async testResponseHandling() {
    const testName = 'Response Handling';
    log.info(`Testing: ${testName}`);

    if (!this.ws) {
      this.recordTest(testName, false, 'WebSocket not connected');
      return;
    }

    try {
      let responseReceived = false;
      
      this.ws.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'semantest/custom/image/downloaded' || 
            message.type === 'semantest/custom/image/response') {
          responseReceived = true;
        }
      });

      // Wait for response
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      if (responseReceived) {
        this.recordTest(testName, true, 'Response received');
      } else {
        this.recordTest(testName, false, 'No response received within timeout');
      }
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async testCLIIntegration() {
    const testName = 'CLI Integration';
    log.info(`Testing: ${testName}`);

    try {
      const scriptPath = path.join(__dirname, '..', 'generate-image.sh');
      
      const child = spawn('bash', [scriptPath, 'test image from automated test'], {
        env: { ...process.env, SKIP_PROMPT: 'true' }
      });

      let output = '';
      let errorOutput = '';

      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      const exitCode = await new Promise((resolve) => {
        child.on('close', resolve);
      });

      if (exitCode === 0) {
        this.recordTest(testName, true, 'CLI executed successfully');
      } else {
        this.recordTest(testName, false, `CLI exited with code ${exitCode}: ${errorOutput}`);
      }
    } catch (error) {
      this.recordTest(testName, false, error.message);
    }
  }

  async connectWebSocket() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.serverUrl);

      this.ws.on('open', () => {
        log.success('WebSocket connected');
        resolve();
      });

      this.ws.on('error', (error) => {
        reject(new Error(`WebSocket error: ${error.message}`));
      });

      this.ws.on('close', () => {
        log.warning('WebSocket closed');
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) {
          reject(new Error('WebSocket connection timeout'));
        }
      }, 5000);
    });
  }

  recordTest(name, passed, details) {
    this.testResults.tests.push({ name, passed, details });
    if (passed) {
      this.testResults.passed++;
      log.success(`${name}: ${details}`);
    } else {
      this.testResults.failed++;
      log.error(`${name}: ${details}`);
    }
    console.log(''); // Empty line for readability
  }

  printResults() {
    console.log('━'.repeat(50));
    console.log(`${colors.blue}Test Results:${colors.reset}`);
    console.log('━'.repeat(50));
    
    this.testResults.tests.forEach((test, index) => {
      const status = test.passed ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
      console.log(`${index + 1}. ${test.name}: ${status}`);
      if (!test.passed) {
        console.log(`   ${colors.yellow}Details: ${test.details}${colors.reset}`);
      }
    });
    
    console.log('━'.repeat(50));
    const totalTests = this.testResults.passed + this.testResults.failed;
    const percentage = totalTests > 0 ? Math.round((this.testResults.passed / totalTests) * 100) : 0;
    
    console.log(`Total: ${totalTests} tests`);
    console.log(`${colors.green}Passed: ${this.testResults.passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${this.testResults.failed}${colors.reset}`);
    console.log(`${colors.blue}Success Rate: ${percentage}%${colors.reset}`);
    
    if (this.ws) {
      this.ws.close();
    }
    
    process.exit(this.testResults.failed > 0 ? 1 : 0);
  }
}

// Run tests
const tester = new ImageGenerationTest();
tester.runTests().catch(error => {
  log.error(`Test suite failed: ${error.message}`);
  process.exit(1);
});