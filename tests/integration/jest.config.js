/**
 * Jest Configuration for Integration Tests
 * Optimized for Puppeteer-based ChatGPT DOM testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'node',
  
  // Root directory
  rootDir: '.',
  
  // Test files pattern
  testMatch: [
    '**/*.test.js',
    '**/*.test.ts'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Global setup/teardown
  globalSetup: '<rootDir>/global-setup.js',
  globalTeardown: '<rootDir>/global-teardown.js',
  
  // Test timeout for integration tests
  testTimeout: 60000, // 1 minute per test
  
  // Retry failed tests
  testRetries: 2,
  
  // Coverage configuration
  collectCoverage: false, // Disabled for integration tests
  
  // Verbose output
  verbose: true,
  
  // Error on deprecated APIs
  errorOnDeprecated: true,
  
  // Bail on first test failure
  bail: false,
  
  // Maximum worker processes
  maxWorkers: 1, // Run tests serially for browser automation
  
  // Transform files
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: ['js', 'json', 'jsx', 'ts', 'tsx'],
  
  // Test path ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/screenshots/'
  ],
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/coverage',
      outputName: 'integration-junit.xml',
      suiteName: 'ChatGPT DOM Integration Tests',
      classNameTemplate: '{classname}',
      titleTemplate: '{title}',
      ancestorSeparator: ' › ',
      usePathForSuiteName: true
    }],
    ['jest-html-reporter', {
      pageTitle: 'ChatGPT Integration Test Report',
      outputPath: '<rootDir>/coverage/integration-report.html',
      includeFailureMsg: true,
      includeConsoleLog: true,
      dateFormat: 'yyyy-mm-dd HH:MM:ss'
    }]
  ],
  
  // Test environment options
  testEnvironmentOptions: {
    // Puppeteer specific options
    puppeteer: {
      headless: process.env.HEADLESS === 'true',
      slowMo: parseInt(process.env.SLOW_MO || '0')
    }
  },
  
  // Global variables
  globals: {
    EXTENSION_PATH: '<rootDir>/../../dist',
    CHATGPT_URL: 'https://chatgpt.com',
    TEST_TIMEOUT: 60000
  }
};