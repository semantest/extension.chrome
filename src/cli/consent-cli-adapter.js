// consent-cli-adapter.js - CLI-compatible consent management
// Adapts ConsentModal functionality for terminal environments

const readline = require('readline');
const chalk = require('chalk');
const boxen = require('boxen');

class ConsentCLI {
  constructor() {
    this.rl = null;
    this.consentStore = {
      telemetryConsent: null,
      telemetryConsentTimestamp: null
    };
  }

  // Display consent prompt in terminal
  async showConsent() {
    console.clear();
    
    // Display header
    const header = boxen(
      chalk.bold.green('Help Improve Semantest CLI'),
      {
        padding: 1,
        margin: 1,
        borderStyle: 'round',
        borderColor: 'green'
      }
    );
    console.log(header);

    // Display message
    console.log(chalk.white(`
We'd like to collect anonymous usage data to help improve the CLI tool.
No personal information or ChatGPT conversations are ever collected.

${chalk.dim('What we collect:')}
  ${chalk.green('✓')} Error messages to fix bugs
  ${chalk.green('✓')} CLI version info
  ${chalk.green('✓')} Anonymous usage patterns

${chalk.dim('Your privacy:')}
  ${chalk.blue('🔒')} No personal data collected
  ${chalk.blue('🔒')} No ChatGPT conversations
  ${chalk.blue('🔒')} You can opt-out anytime

${chalk.dim('View our privacy policy at: https://semantest.com/privacy')}
    `));

    // Get user choice
    const consent = await this.promptUser();
    
    // Save consent
    await this.saveConsent(consent);
    
    // Show confirmation
    this.showConfirmation(consent);
    
    return consent;
  }

  // Prompt user for consent choice
  async promptUser() {
    return new Promise((resolve) => {
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const question = chalk.yellow('\nAllow anonymous telemetry? (y/N): ');
      
      this.rl.question(question, (answer) => {
        this.rl.close();
        const consent = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
        resolve(consent);
      });
    });
  }

  // Save consent to file/config
  async saveConsent(consent) {
    this.consentStore = {
      telemetryConsent: consent,
      telemetryConsentTimestamp: new Date().toISOString()
    };

    // In real implementation, save to:
    // - ~/.semantest/config.json
    // - Environment variable
    // - Or API endpoint
    
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      const configDir = path.join(os.homedir(), '.semantest');
      const configFile = path.join(configDir, 'config.json');
      
      // Ensure directory exists
      await fs.mkdir(configDir, { recursive: true });
      
      // Read existing config
      let config = {};
      try {
        const existing = await fs.readFile(configFile, 'utf8');
        config = JSON.parse(existing);
      } catch (err) {
        // File doesn't exist yet
      }
      
      // Update with consent
      config.telemetry = this.consentStore;
      
      // Write back
      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
    } catch (error) {
      console.error(chalk.red('Failed to save consent preference:', error.message));
    }
  }

  // Show confirmation message
  showConfirmation(consent) {
    console.log('');
    
    if (consent) {
      const message = boxen(
        chalk.green('✓ Thank you for helping us improve Semantest CLI!'),
        {
          padding: 1,
          borderStyle: 'double',
          borderColor: 'green'
        }
      );
      console.log(message);
    } else {
      console.log(chalk.blue('✓ No problem! You can enable telemetry anytime with: semantest config telemetry.enable'));
    }
    
    console.log(chalk.dim('\nYou can change this setting at any time in ~/.semantest/config.json\n'));
  }

  // Check if consent has been given
  async hasConsent() {
    try {
      const fs = require('fs').promises;
      const path = require('path');
      const os = require('os');
      
      const configFile = path.join(os.homedir(), '.semantest', 'config.json');
      const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
      
      return config.telemetry?.telemetryConsent === true;
    } catch (error) {
      return false;
    }
  }

  // Interactive consent update
  async updateConsent(enable) {
    await this.saveConsent(enable);
    this.showConfirmation(enable);
  }
}

// Alternative: Non-interactive consent for CI/CD environments
class ConsentEnvironment {
  static hasConsent() {
    // Check environment variables
    const consent = process.env.SEMANTEST_TELEMETRY;
    return consent === '1' || consent === 'true' || consent === 'yes';
  }

  static getConsentInfo() {
    return {
      telemetryConsent: this.hasConsent(),
      telemetryConsentTimestamp: process.env.SEMANTEST_TELEMETRY_TIMESTAMP || null,
      source: 'environment'
    };
  }
}

// Web API adapter for hybrid CLI/Extension usage
class ConsentAPI {
  constructor(apiEndpoint) {
    this.endpoint = apiEndpoint;
  }

  async getConsent(userId) {
    try {
      const response = await fetch(`${this.endpoint}/consent/${userId}`);
      return await response.json();
    } catch (error) {
      return { telemetryConsent: false, error: error.message };
    }
  }

  async setConsent(userId, consent) {
    try {
      const response = await fetch(`${this.endpoint}/consent/${userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telemetryConsent: consent,
          telemetryConsentTimestamp: new Date().toISOString(),
          source: 'cli'
        })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = {
  ConsentCLI,
  ConsentEnvironment,
  ConsentAPI
};