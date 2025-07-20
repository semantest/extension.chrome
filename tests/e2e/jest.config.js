module.exports = {
  preset: 'jest-puppeteer',
  testMatch: ['**/*.test.js'],
  testTimeout: 30000,
  setupFilesAfterEnv: ['./jest.setup.js'],
  testEnvironment: './puppeteer-environment.js'
};