// Jest setup for Chrome Extension testing
// Mock global fetch API
global.fetch = jest.fn();

// Mock Chrome Extension APIs globally
global.chrome = {
  runtime: {
    onInstalled: { addListener: jest.fn() },
    onStartup: { addListener: jest.fn() },
    onMessage: { addListener: jest.fn() },
    getManifest: jest.fn(() => ({ version: '1.0.1' }))
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      clear: jest.fn()
    },
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  tabs: {
    create: jest.fn(),
    query: jest.fn(),
    sendMessage: jest.fn(),
    get: jest.fn()
  },
  notifications: {
    create: jest.fn(),
    onButtonClicked: { 
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    clear: jest.fn()
  }
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});