/**
 * @fileoverview ChatGPT Image Generation Demo Script
 * @author Hive Mind - CODER Agent
 * @description Demonstration of complete ChatGPT image generation workflow automation
 */

/**
 * Demo class for ChatGPT image generation automation
 */
class ChatGPTImageGenerationDemo {
  private correlationId: string;

  constructor() {
    this.correlationId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Run the complete image generation demo
   */
  async runDemo(): Promise<void> {
    console.log('🚀 Starting ChatGPT Image Generation Demo');

    try {
      // Demo prompts for different types of images
      const demoPrompts = [
        {
          prompt: "Create a realistic image of a serene mountain landscape with a clear blue lake reflecting snow-capped peaks",
          description: "Landscape Photography Style"
        },
        {
          prompt: "Generate a vibrant digital art illustration of a cyberpunk cityscape at night with neon lights",
          description: "Digital Art Style"
        },
        {
          prompt: "Create a minimalist logo design for a tech startup, incorporating geometric shapes and modern typography",
          description: "Logo Design"
        },
        {
          prompt: "Generate a photorealistic image of a cozy coffee shop interior with warm lighting and comfortable seating",
          description: "Interior Design"
        }
      ];

      console.log(`📋 Demo includes ${demoPrompts.length} different image generation examples`);

      // Run each demo prompt
      for (let i = 0; i < demoPrompts.length; i++) {
        const demo = demoPrompts[i];
        console.log(`\n🎨 Demo ${i + 1}/${demoPrompts.length}: ${demo.description}`);
        
        await this.runSingleDemo(demo.prompt, demo.description);
        
        // Wait between demos to avoid overwhelming the system
        if (i < demoPrompts.length - 1) {
          console.log('⏳ Waiting 5 seconds before next demo...');
          await this.sleep(5000);
        }
      }

      console.log('\n✅ All demos completed successfully!');

    } catch (error) {
      console.error('❌ Demo failed:', error);
    }
  }

  /**
   * Run a single image generation demo
   */
  private async runSingleDemo(prompt: string, description: string): Promise<void> {
    const demoCorrelationId = `${this.correlationId}_${Date.now()}`;

    try {
      console.log(`📝 Prompt: "${prompt}"`);
      
      // Step 1: Check if ChatGPT is ready
      console.log('🔍 Checking ChatGPT state...');
      const stateCheck = await this.sendMessageToActiveTab({
        type: 'GET_CHATGPT_STATE'
      });

      if (!stateCheck.canSendMessage) {
        console.log('⏳ Waiting for ChatGPT to become ready...');
        await this.waitForChatGPTReady();
      }

      // Step 2: Generate image
      console.log('🎨 Starting image generation...');
      const generationResult = await this.sendMessageToBackground({
        action: 'GENERATE_CHATGPT_IMAGE',
        prompt,
        correlationId: demoCorrelationId,
        downloadImages: true
      });

      if (!generationResult.success) {
        throw new Error(`Generation failed: ${generationResult.error}`);
      }

      // Step 3: Report results
      const { data } = generationResult;
      console.log(`✅ ${description} completed!`);
      console.log(`   • Images generated: ${data.imagesGenerated}`);
      console.log(`   • Images downloaded: ${data.downloads?.successCount || 0}`);
      console.log(`   • Completion time: ${this.formatTime(data.completedAt)}`);

      if (data.downloads?.downloads) {
        data.downloads.downloads.forEach((download, index) => {
          const status = download.success ? '✅' : '❌';
          console.log(`   ${status} ${download.filename}`);
        });
      }

    } catch (error) {
      console.error(`❌ Demo "${description}" failed:`, error);
      throw error;
    }
  }

  /**
   * Wait for ChatGPT to become ready
   */
  private async waitForChatGPTReady(timeout: number = 30000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const state = await this.sendMessageToActiveTab({
        type: 'GET_CHATGPT_STATE'
      });

      if (state.canSendMessage && state.state === 'idle') {
        console.log('✅ ChatGPT is ready');
        return;
      }

      await this.sleep(1000);
    }

    throw new Error('Timeout waiting for ChatGPT to become ready');
  }

  /**
   * Send message to the active ChatGPT tab
   */
  private async sendMessageToActiveTab(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs.length === 0) {
          reject(new Error('No active tab found'));
          return;
        }

        const activeTab = tabs[0];
        if (!activeTab.id) {
          reject(new Error('Active tab has no ID'));
          return;
        }

        chrome.tabs.sendMessage(activeTab.id, message, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    });
  }

  /**
   * Send message to background script
   */
  private async sendMessageToBackground(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Format timestamp for display
   */
  private formatTime(isoString: string): string {
    return new Date(isoString).toLocaleTimeString();
  }

  /**
   * Get demo statistics
   */
  async getDemoStats(): Promise<any> {
    try {
      const stats = await this.sendMessageToBackground({
        action: 'IMAGE_GENERATION_STATUS'
      });

      return {
        success: true,
        stats: stats.status,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

/**
 * Interactive demo functions for browser console
 */
class InteractiveChatGPTDemo {
  private demo: ChatGPTImageGenerationDemo;

  constructor() {
    this.demo = new ChatGPTImageGenerationDemo();
  }

  /**
   * Generate a single image with custom prompt
   */
  async generateImage(prompt: string, downloadImages: boolean = true): Promise<void> {
    console.log(`🎨 Generating image: "${prompt}"`);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'GENERATE_CHATGPT_IMAGE',
        prompt,
        correlationId: `interactive_${Date.now()}`,
        downloadImages
      });

      if (result.success) {
        console.log('✅ Image generation completed:', result.data);
      } else {
        console.error('❌ Image generation failed:', result.error);
      }
    } catch (error) {
      console.error('❌ Generation error:', error);
    }
  }

  /**
   * Check current ChatGPT state
   */
  async checkState(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.error('❌ No active tab found');
        return;
      }

      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'GET_CHATGPT_STATE'
      });

      console.log('📊 Current ChatGPT State:', response);
    } catch (error) {
      console.error('❌ State check failed:', error);
    }
  }

  /**
   * Detect images in current conversation
   */
  async detectImages(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length === 0) {
        console.error('❌ No active tab found');
        return;
      }

      const response = await chrome.tabs.sendMessage(tabs[0].id!, {
        type: 'DETECT_IMAGES'
      });

      console.log('🖼️ Image Detection Results:', response);
    } catch (error) {
      console.error('❌ Image detection failed:', error);
    }
  }

  /**
   * Get extension statistics
   */
  async getStats(): Promise<void> {
    const stats = await this.demo.getDemoStats();
    console.log('📊 Extension Statistics:', stats);
  }

  /**
   * Run full demo suite
   */
  async runFullDemo(): Promise<void> {
    await this.demo.runDemo();
  }
}

// Export for browser console usage
if (typeof window !== 'undefined') {
  (window as any).ChatGPTImageDemo = new InteractiveChatGPTDemo();
  (window as any).runChatGPTDemo = async () => {
    const demo = new ChatGPTImageGenerationDemo();
    await demo.runDemo();
  };

  console.log('🎮 ChatGPT Image Generation Demo loaded!');
  console.log('Usage in console:');
  console.log('  • ChatGPTImageDemo.generateImage("your prompt here")');
  console.log('  • ChatGPTImageDemo.checkState()');
  console.log('  • ChatGPTImageDemo.detectImages()');
  console.log('  • ChatGPTImageDemo.getStats()');
  console.log('  • ChatGPTImageDemo.runFullDemo()');
  console.log('  • runChatGPTDemo() - Quick demo runner');
}

export { ChatGPTImageGenerationDemo, InteractiveChatGPTDemo };