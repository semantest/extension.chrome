#!/usr/bin/env node

// Semantest CLI Prototype
// Communicates with Chrome Extension via DevTools Protocol

const CDP = require('chrome-remote-interface');
const { program } = require('commander');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs').promises;
const path = require('path');

class SemantestCLI {
  constructor() {
    this.client = null;
    this.extensionId = null;
    this.config = {
      port: 9222,
      host: 'localhost',
      timeout: 30000
    };
  }

  async connect() {
    const spinner = ora('Connecting to Chrome...').start();
    
    try {
      this.client = await CDP({
        port: this.config.port,
        host: this.config.host
      });
      
      const { Runtime, Page } = this.client;
      await Runtime.enable();
      await Page.enable();
      
      // Find extension ID
      this.extensionId = await this.findExtensionId();
      
      spinner.succeed('Connected to Chrome and extension');
      return true;
    } catch (error) {
      spinner.fail('Failed to connect. Is Chrome running with --remote-debugging-port=9222?');
      console.error(chalk.red(error.message));
      return false;
    }
  }

  async findExtensionId() {
    // Get all extensions
    const { result } = await this.client.Runtime.evaluate({
      expression: 'chrome.runtime.getManifest ? chrome.runtime.id : null'
    });
    
    // In real implementation, would search for our extension
    return 'YOUR_EXTENSION_ID';
  }

  async sendToExtension(action, data = {}) {
    if (!this.client) {
      throw new Error('Not connected to Chrome');
    }

    const { result } = await this.client.Runtime.evaluate({
      expression: `
        new Promise((resolve) => {
          chrome.runtime.sendMessage(
            '${this.extensionId}',
            { action: '${action}', data: ${JSON.stringify(data)} },
            response => resolve(response)
          );
        })
      `,
      awaitPromise: true
    });

    return result.value;
  }

  async ensureChatGPTOpen() {
    const { result } = await this.client.Runtime.evaluate({
      expression: 'window.location.href'
    });
    
    if (!result.value.includes('chat.openai.com')) {
      const spinner = ora('Opening ChatGPT...').start();
      await this.client.Page.navigate({ url: 'https://chat.openai.com' });
      await this.client.Page.loadEventFired();
      spinner.succeed('ChatGPT opened');
    }
  }

  // Commands
  async createProject(name) {
    await this.ensureChatGPTOpen();
    const spinner = ora(`Creating project "${name}"...`).start();
    
    try {
      const response = await this.sendToExtension('CREATE_PROJECT', { name });
      
      if (response.success) {
        spinner.succeed(`Project "${name}" created successfully`);
      } else {
        spinner.fail(`Failed to create project: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async setCustomInstructions(aboutUser, aboutModel) {
    await this.ensureChatGPTOpen();
    const spinner = ora('Setting custom instructions...').start();
    
    try {
      const response = await this.sendToExtension('SET_CUSTOM_INSTRUCTIONS', {
        aboutUser,
        aboutModel
      });
      
      if (response.success) {
        spinner.succeed('Custom instructions set successfully');
      } else {
        spinner.fail(`Failed: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async requestImage(prompt, options = {}) {
    await this.ensureChatGPTOpen();
    const spinner = ora(`Requesting image: "${prompt}"...`).start();
    
    try {
      const response = await this.sendToExtension('REQUEST_IMAGE', {
        prompt,
        ...options
      });
      
      if (response.success) {
        spinner.succeed('Image request sent');
        
        if (options.wait) {
          await this.waitForImageGeneration();
        }
        
        if (options.download) {
          await this.downloadLatestImages();
        }
      } else {
        spinner.fail(`Failed: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async sendPrompt(text) {
    await this.ensureChatGPTOpen();
    const spinner = ora('Sending prompt...').start();
    
    try {
      const response = await this.sendToExtension('SEND_PROMPT', { text });
      
      if (response.success) {
        spinner.succeed('Prompt sent successfully');
      } else {
        spinner.fail(`Failed: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async downloadImages(outputDir = './images') {
    await this.ensureChatGPTOpen();
    const spinner = ora('Downloading images...').start();
    
    try {
      const response = await this.sendToExtension('DOWNLOAD_IMAGES');
      
      if (response.success) {
        spinner.succeed(`Downloaded ${response.count || 0} images`);
      } else {
        spinner.fail(`Failed: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async getStatus() {
    const spinner = ora('Getting extension status...').start();
    
    try {
      const response = await this.sendToExtension('GET_STATUS');
      
      if (response.success) {
        spinner.succeed('Extension status:');
        console.log(chalk.gray(JSON.stringify(response.status, null, 2)));
      } else {
        spinner.fail(`Failed: ${response.error}`);
      }
    } catch (error) {
      spinner.fail(`Error: ${error.message}`);
    }
  }

  async waitForImageGeneration(timeout = 30000) {
    const spinner = ora('Waiting for image generation...').start();
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check for image in DOM
      const { result } = await this.client.Runtime.evaluate({
        expression: `
          document.querySelector('[data-message-author-role="assistant"] img') !== null
        `
      });
      
      if (result.value) {
        spinner.succeed('Image generated');
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    spinner.fail('Timeout waiting for image');
    return false;
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

// CLI Commands
program
  .name('semantest-cli')
  .description('CLI for ChatGPT Browser Extension')
  .version('0.1.0');

program
  .command('project <name>')
  .description('Create a new ChatGPT project')
  .action(async (name) => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.createProject(name);
      await cli.disconnect();
    }
  });

program
  .command('chat')
  .description('Start a new chat')
  .action(async () => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.sendToExtension('CREATE_NEW_CHAT');
      console.log(chalk.green('✓ New chat created'));
      await cli.disconnect();
    }
  });

program
  .command('prompt <text>')
  .description('Send a prompt to ChatGPT')
  .action(async (text) => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.sendPrompt(text);
      await cli.disconnect();
    }
  });

program
  .command('image <prompt>')
  .description('Request an image from DALL-E')
  .option('-w, --wait', 'Wait for image generation')
  .option('-d, --download', 'Download generated images')
  .action(async (prompt, options) => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.requestImage(prompt, options);
      await cli.disconnect();
    }
  });

program
  .command('download')
  .description('Download all images from current chat')
  .option('-o, --output <dir>', 'Output directory', './images')
  .action(async (options) => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.downloadImages(options.output);
      await cli.disconnect();
    }
  });

program
  .command('instructions')
  .description('Set custom instructions')
  .option('-u, --user <text>', 'About user')
  .option('-m, --model <text>', 'About model')
  .action(async (options) => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.setCustomInstructions(options.user || '', options.model || '');
      await cli.disconnect();
    }
  });

program
  .command('status')
  .description('Get extension status')
  .action(async () => {
    const cli = new SemantestCLI();
    if (await cli.connect()) {
      await cli.getStatus();
      await cli.disconnect();
    }
  });

program
  .command('launch')
  .description('Launch Chrome with debugging enabled')
  .action(() => {
    console.log(chalk.blue('Launch Chrome with:'));
    console.log(chalk.gray('google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug'));
    console.log(chalk.yellow('\nThen run any semantest-cli command'));
  });

// Parse arguments
program.parse();

// Show help if no command
if (!process.argv.slice(2).length) {
  program.outputHelp();
}