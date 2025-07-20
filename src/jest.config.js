/**
 * Jest Configuration for Extension Source Code Unit Tests
 * Optimized for Chrome extension development with TypeScript and comprehensive testing
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Root directory
  rootDir: '.',
  
  // Test files pattern
  testMatch: [
    '**/*.test.ts',
    '**/*.test.js',
    '**/__tests__/**/*.(ts|js)'
  ],
  
  // File extensions to consider
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // Module name mapping for imports
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@plugins/(.*)$': '<rootDir>/plugins/$1',
    '^@downloads/(.*)$': '<rootDir>/downloads/$1',
    '^@training/(.*)$': '<rootDir>/training/$1',
    '^@contracts/(.*)$': '<rootDir>/contracts/$1'
  },
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: [
    'text',
    'text-summary',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage collection patterns
  collectCoverageFrom: [
    '**/*.{ts,tsx,js,jsx}',
    '!**/*.d.ts',
    '!**/*.test.{ts,tsx,js,jsx}',
    '!**/node_modules/**',
    '!**/coverage/**',
    '!**/dist/**',
    '!**/build/**',
    '!jest.config.js',
    '!jest.setup.js',
    '!background/**', // Service worker files
    '!content/**',    // Content script files  
    '!devtools.js',
    '!panel.js',
    '!popup.html',
    '!popup.css',
    '!options.html',
    '!panel.html',
    '!devtools.html'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 80,
      statements: 80
    },
    './src/storage.ts': {
      branches: 85,
      functions: 90,
      lines: 95,
      statements: 95
    },
    './src/popup.ts': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    },
    './src/message-store.ts': {
      branches: 85,
      functions: 90,
      lines: 95,
      statements: 95
    },
    './src/plugins/plugin-registry.ts': {
      branches: 80,
      functions: 85,
      lines: 90,
      statements: 90
    }
  },
  
  // Mock configuration
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  
  // Timeout configuration
  testTimeout: 10000,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true,
  
  // Watch mode configuration
  watchPlugins: [
    'jest-watch-typeahead/filename',
    'jest-watch-typeahead/testname'
  ],
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/build/',
    '/coverage/',
    '\\.d\\.ts$'
  ],
  
  // Transform ignore patterns
  transformIgnorePatterns: [
    'node_modules/(?!(module-to-transform)/)'
  ],
  
  // Global test configuration
  globals: {
    'ts-jest': {
      tsconfig: {
        compilerOptions: {
          module: 'commonjs',
          target: 'es2020',
          lib: ['es2020', 'dom'],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          moduleResolution: 'node',
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true
        }
      }
    }
  },
  
  // Preset configuration
  preset: 'ts-jest',
  
  // Module directories
  moduleDirectories: ['node_modules', '<rootDir>'],
  
  // Snapshot configuration
  snapshotSerializers: [],
  
  // Reporters
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: '<rootDir>/coverage',
      outputName: 'junit.xml',
      suiteName: 'Extension Unit Tests'
    }]
  ],
  
  // Test results processor
  testResultsProcessor: undefined,
  
  // Maximum worker processes
  maxWorkers: '50%',
  
  // Cache configuration
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  
  // Notification configuration
  notify: false,
  notifyMode: 'failure-change',
  
  // Extensions and patterns
  extensionsToTreatAsEsm: [],
  
  // Custom test environment options
  testEnvironmentOptions: {
    url: 'https://example.com'
  }
};