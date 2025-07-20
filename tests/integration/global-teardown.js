/**
 * Global Teardown for Integration Tests
 * Runs once after all test suites
 */

const fs = require('fs').promises;
const path = require('path');

module.exports = async () => {
  console.log('\n🧹 Cleaning up integration tests...\n');
  
  // Clean up old screenshots (optional)
  if (process.env.CLEAN_SCREENSHOTS === 'true') {
    try {
      const screenshotDir = path.join(__dirname, '../../screenshots');
      const files = await fs.readdir(screenshotDir);
      
      for (const file of files) {
        if (file.endsWith('.png')) {
          await fs.unlink(path.join(screenshotDir, file));
        }
      }
      
      console.log(`✅ Cleaned ${files.length} screenshots`);
    } catch (error) {
      // Ignore errors
    }
  }
  
  // Clean up test profile (optional)
  if (process.env.CLEAN_PROFILE === 'true') {
    try {
      const profileDir = path.join(__dirname, '../../test-profile');
      await fs.rmdir(profileDir, { recursive: true });
      console.log('✅ Cleaned test profile');
    } catch (error) {
      // Ignore errors
    }
  }
  
  console.log('\n✨ Integration tests completed!\n');
};