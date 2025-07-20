/**
 * Global Setup for Integration Tests
 * Runs once before all test suites
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('\n🚀 Setting up ChatGPT integration tests...\n');
  
  // Create necessary directories
  const dirs = [
    path.join(__dirname, '../../screenshots'),
    path.join(__dirname, '../../test-profile'),
    path.join(__dirname, '../../coverage')
  ];
  
  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
  
  // Check if extension is built
  const extensionPath = path.join(__dirname, '../../dist');
  try {
    await fs.access(extensionPath);
    const manifest = await fs.readFile(path.join(extensionPath, 'manifest.json'), 'utf8');
    const manifestData = JSON.parse(manifest);
    console.log(`✅ Extension found: ${manifestData.name} v${manifestData.version}`);
  } catch (error) {
    console.error('❌ Extension not found at dist/. Please build the extension first.');
    console.error('   Run: npm run build');
    process.exit(1);
  }
  
  // Set up environment variables
  process.env.NODE_ENV = 'test';
  
  // Log test configuration
  console.log('📋 Test Configuration:');
  console.log(`   - Headless: ${process.env.HEADLESS || 'false'}`);
  console.log(`   - Slow Motion: ${process.env.SLOW_MO || '0'}ms`);
  console.log(`   - Extension Path: ${extensionPath}`);
  console.log(`   - ChatGPT URL: https://chatgpt.com`);
  console.log();
};