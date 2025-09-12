/**
 * @fileoverview ChatGPT Content Script for Image Generation Automation
 * @author Hive Mind - CODER Agent
 * @description Enhanced content script for complete ChatGPT image generation workflow
 */

import { SemantestIdleDetector, ChatGPTState } from './semantest-idle-detector';
import { webBuddyStorage } from './storage';

// Enhanced ChatGPT state for image generation
interface ChatGPTImageState extends ChatGPTState {
  hasImages?: boolean;
  imageCount?: number;
  isGeneratingImage?: boolean;
  lastImageGenerated?: string;
}

// Image generation request interface
interface ImageGenerationRequest {
  prompt: string;
  style?: string;
  size?: string;
  quality?: string;
  downloadImages?: boolean;
  correlationId: string;
}

// Image detection result
interface ImageDetectionResult {
  found: boolean;
  images: Array<{
    url: string;
    alt: string;
    element: HTMLImageElement;
    downloadUrl?: string;
  }>;
  timestamp: string;
}

/**
 * Enhanced ChatGPT automation class for image generation workflows
 */
class ChatGPTImageAutomation {
  private idleDetector: SemantestIdleDetector;
  private currentState: ChatGPTImageState;
  private isListening: boolean = false;
  private imageObserver: MutationObserver | null = null;
  private generationTimeout: NodeJS.Timeout | null = null;

  constructor() {
    this.idleDetector = new SemantestIdleDetector();
    this.currentState = {
      state: 'unknown',
      canSendMessage: false,
      domain: 'chatgpt.com',
      hasImages: false,
      imageCount: 0,
      isGeneratingImage: false
    };

    this.initialize();
  }

  /**
   * Initialize the ChatGPT automation system
   */
  async initialize(): Promise<void> {
    console.log('🤖 Initializing ChatGPT Image Generation Automation');

    // Initialize idle detector
    this.idleDetector.initialize();

    // Set up state change monitoring
    this.idleDetector.onStateChange((state) => {
      this.updateImageState(state);
    });

    // Set up image detection observer
    this.setupImageObserver();

    // Set up message listeners
    this.setupMessageListeners();

    // Initial state detection
    await this.detectCurrentState();

    console.log('✅ ChatGPT Image Automation initialized');
  }

  /**
   * Set up image detection observer for generated content
   */
  private setupImageObserver(): void {
    this.imageObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              const element = node as Element;
              
              // Check for new images
              const images = element.querySelectorAll('img');
              if (images.length > 0) {
                console.log(`🖼️ Detected ${images.length} new images`);
                this.handleNewImages(Array.from(images));
              }

              // Check for generation completion indicators
              if (element.classList.contains('result-streaming') || 
                  element.hasAttribute('data-message-streaming')) {
                this.handleGenerationStatusChange(element);
              }
            }
          });
        }
      });
    });

    // Start observing the chat container
    const chatContainer = document.querySelector('[data-testid="conversation-turn"]') ||
                         document.querySelector('.chat-thread') ||
                         document.body;

    if (chatContainer) {
      this.imageObserver.observe(chatContainer, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-message-streaming', 'class']
      });
    }
  }

  /**
   * Set up message listeners for automation requests
   */
  private setupMessageListeners(): void {
    chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
      console.log('📨 ChatGPT automation received message:', message);

      try {
        let response: any;

        switch (message.type || message.action) {
          case 'SEMANTEST_SEND_PROMPT':
            response = await this.handlePromptSubmission(message.payload);
            break;

          case 'GENERATE_IMAGE':
            response = await this.handleImageGeneration(message.payload);
            break;

          case 'DETECT_IMAGES':
            response = await this.detectImages();
            break;

          case 'DOWNLOAD_IMAGES':
            response = await this.downloadGeneratedImages(message.payload);
            break;

          case 'GET_CHATGPT_STATE':
            response = this.getCurrentState();
            break;

          case 'WAIT_FOR_COMPLETION':
            response = await this.waitForGenerationCompletion(message.payload?.timeout);
            break;

          default:
            response = {
              success: false,
              error: `Unknown action: ${message.type || message.action}`,
              timestamp: new Date().toISOString()
            };
        }

        sendResponse(response);
      } catch (error: any) {
        console.error('❌ Error handling message:', error);
        sendResponse({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }

      return true; // Keep message channel open
    });
  }

  /**
   * Handle prompt submission to ChatGPT
   */
  async handlePromptSubmission(payload: any): Promise<any> {
    const { prompt, correlationId } = payload;

    console.log('📝 Submitting prompt to ChatGPT:', prompt);

    try {
      // Wait for ChatGPT to be idle
      await this.idleDetector.waitForIdle(10000);

      // Find the textarea or contenteditable input
      const textInput = this.findTextInput();
      if (!textInput) {
        throw new Error('Could not find ChatGPT text input');
      }

      // Clear existing content
      this.clearTextInput(textInput);

      // Type the prompt
      await this.typeText(textInput, prompt);

      // Find and click the send button
      const sendButton = this.findSendButton();
      if (!sendButton) {
        throw new Error('Could not find send button');
      }

      // Click send
      sendButton.click();

      // Mark as generating
      this.currentState.isGeneratingImage = true;
      this.currentState.state = 'busy';

      console.log('✅ Prompt submitted successfully');

      return {
        success: true,
        correlationId,
        data: {
          prompt,
          submittedAt: new Date().toISOString(),
          textInputType: textInput.tagName.toLowerCase()
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ Failed to submit prompt:', error);
      return {
        success: false,
        correlationId,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Handle complete image generation workflow
   */
  async handleImageGeneration(request: ImageGenerationRequest): Promise<any> {
    console.log('🎨 Starting image generation workflow:', request);

    try {
      // Step 1: Submit the prompt
      const promptResult = await this.handlePromptSubmission({
        prompt: request.prompt,
        correlationId: request.correlationId
      });

      if (!promptResult.success) {
        throw new Error(`Failed to submit prompt: ${promptResult.error}`);
      }

      // Step 2: Wait for generation to complete
      console.log('⏳ Waiting for image generation to complete...');
      const completionResult = await this.waitForGenerationCompletion(60000); // 60 seconds timeout

      if (!completionResult.success) {
        throw new Error(`Generation timeout: ${completionResult.error}`);
      }

      // Step 3: Detect generated images
      console.log('🔍 Detecting generated images...');
      const imageDetection = await this.detectImages();

      if (!imageDetection.found || imageDetection.images.length === 0) {
        throw new Error('No images were generated or detected');
      }

      // Step 4: Download images if requested
      let downloadResults = null;
      if (request.downloadImages) {
        console.log('💾 Downloading generated images...');
        downloadResults = await this.downloadGeneratedImages({
          correlationId: request.correlationId
        });
      }

      return {
        success: true,
        correlationId: request.correlationId,
        data: {
          prompt: request.prompt,
          imagesGenerated: imageDetection.images.length,
          images: imageDetection.images,
          downloads: downloadResults,
          completedAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ Image generation workflow failed:', error);
      return {
        success: false,
        correlationId: request.correlationId,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Detect generated images in the conversation
   */
  async detectImages(): Promise<ImageDetectionResult> {
    console.log('🔍 Scanning for generated images...');

    const images: ImageDetectionResult['images'] = [];

    // Look for images in conversation turns
    const conversationImages = document.querySelectorAll('img');
    
    conversationImages.forEach((img: HTMLImageElement) => {
      // Filter out UI icons and avatars - focus on content images
      if (this.isContentImage(img)) {
        images.push({
          url: img.src,
          alt: img.alt || '',
          element: img,
          downloadUrl: this.extractDownloadUrl(img)
        });
      }
    });

    // Update state
    this.currentState.hasImages = images.length > 0;
    this.currentState.imageCount = images.length;

    console.log(`🖼️ Found ${images.length} content images`);

    return {
      found: images.length > 0,
      images,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Download all detected images
   */
  async downloadGeneratedImages(payload: any): Promise<any> {
    const { correlationId } = payload;

    console.log('💾 Starting image download process...');

    try {
      const imageDetection = await this.detectImages();
      
      if (!imageDetection.found) {
        throw new Error('No images found to download');
      }

      const downloads = [];

      for (let i = 0; i < imageDetection.images.length; i++) {
        const image = imageDetection.images[i];
        const filename = `chatgpt_image_${Date.now()}_${i + 1}.png`;

        try {
          // Send download request to background script
          const downloadResult = await new Promise<any>((resolve) => {
            chrome.runtime.sendMessage({
              action: 'DOWNLOAD_IMAGE',
              data: {
                url: image.downloadUrl || image.url,
                filename
              }
            }, resolve);
          });

          downloads.push({
            filename,
            url: image.url,
            success: downloadResult?.success || false,
            downloadId: downloadResult?.downloadId
          });

          console.log(`✅ Downloaded image ${i + 1}: ${filename}`);
        } catch (error) {
          console.error(`❌ Failed to download image ${i + 1}:`, error);
          downloads.push({
            filename,
            url: image.url,
            success: false,
            error: error.message
          });
        }
      }

      return {
        success: true,
        correlationId,
        data: {
          totalImages: imageDetection.images.length,
          downloads,
          successCount: downloads.filter(d => d.success).length
        },
        timestamp: new Date().toISOString()
      };

    } catch (error: any) {
      console.error('❌ Download process failed:', error);
      return {
        success: false,
        correlationId,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Wait for image generation to complete
   */
  async waitForGenerationCompletion(timeout: number = 60000): Promise<any> {
    console.log('⏳ Waiting for generation completion...');

    const startTime = Date.now();

    return new Promise((resolve) => {
      const checkCompletion = () => {
        const elapsed = Date.now() - startTime;

        // Check if timeout exceeded
        if (elapsed > timeout) {
          resolve({
            success: false,
            error: 'Generation timeout exceeded',
            elapsed,
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Check if ChatGPT is idle and images are present
        const isIdle = this.idleDetector.isIdle();
        const currentImages = document.querySelectorAll('img').length;

        if (isIdle && currentImages > this.currentState.imageCount) {
          console.log('✅ Generation appears complete - new images detected');
          this.currentState.isGeneratingImage = false;
          resolve({
            success: true,
            elapsed,
            imagesDetected: currentImages,
            timestamp: new Date().toISOString()
          });
          return;
        }

        // Continue checking
        setTimeout(checkCompletion, 1000);
      };

      checkCompletion();
    });
  }

  /**
   * Find ChatGPT text input element
   */
  private findTextInput(): HTMLElement | null {
    // Try multiple selectors for different ChatGPT versions
    const selectors = [
      'div[contenteditable="true"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Send"]',
      '#prompt-textarea',
      '[data-testid="textbox"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector) as HTMLElement;
      if (element && this.isVisibleAndEnabled(element)) {
        return element;
      }
    }

    return null;
  }

  /**
   * Find ChatGPT send button
   */
  private findSendButton(): HTMLButtonElement | null {
    const selectors = [
      'button[data-testid="send-button"]',
      'button[aria-label*="Send"]',
      'button[type="submit"]',
      'button:has(svg[data-testid="send-button-icon"])',
      'button svg[data-testid="send-button-icon"]'
    ].map(s => s.includes('svg') ? s.replace('button svg', 'button:has(svg)') : s);

    for (const selector of selectors) {
      const button = document.querySelector(selector) as HTMLButtonElement;
      if (button && this.isVisibleAndEnabled(button)) {
        return button;
      }
    }

    return null;
  }

  /**
   * Clear text input content
   */
  private clearTextInput(element: HTMLElement): void {
    if (element.tagName.toLowerCase() === 'textarea') {
      (element as HTMLTextAreaElement).value = '';
    } else {
      element.textContent = '';
      element.innerHTML = '';
    }

    // Trigger events
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Type text into input with realistic timing
   */
  private async typeText(element: HTMLElement, text: string): Promise<void> {
    // Clear first
    this.clearTextInput(element);

    // Type character by character with small delays
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (element.tagName.toLowerCase() === 'textarea') {
        (element as HTMLTextAreaElement).value += char;
      } else {
        element.textContent += char;
      }

      // Trigger input event
      element.dispatchEvent(new Event('input', { bubbles: true }));

      // Small delay between characters (10-50ms)
      await new Promise(resolve => setTimeout(resolve, Math.random() * 40 + 10));
    }

    // Final change event
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  /**
   * Check if element is visible and enabled
   */
  private isVisibleAndEnabled(element: HTMLElement): boolean {
    const style = window.getComputedStyle(element);
    const isVisible = style.display !== 'none' && 
                     style.visibility !== 'hidden' && 
                     style.opacity !== '0';

    const isEnabled = !element.hasAttribute('disabled') && 
                     element.getAttribute('aria-disabled') !== 'true';

    return isVisible && isEnabled;
  }

  /**
   * Check if image is content (not UI element)
   */
  private isContentImage(img: HTMLImageElement): boolean {
    const src = img.src.toLowerCase();
    const alt = (img.alt || '').toLowerCase();
    const className = img.className.toLowerCase();

    // Exclude common UI elements
    const excludePatterns = [
      'avatar', 'icon', 'logo', 'profile', 'user', 
      'openai', 'chatgpt', 'button', 'ui-'
    ];

    const isExcluded = excludePatterns.some(pattern => 
      src.includes(pattern) || alt.includes(pattern) || className.includes(pattern)
    );

    // Must be reasonably sized (not tiny icons)
    const isReasonableSize = img.naturalWidth > 50 && img.naturalHeight > 50;

    // Should be in conversation content area
    const isInConversation = img.closest('[data-testid="conversation-turn"]') !== null ||
                            img.closest('.chat-message') !== null ||
                            img.closest('.message-content') !== null;

    return !isExcluded && isReasonableSize && isInConversation;
  }

  /**
   * Extract download URL for image
   */
  private extractDownloadUrl(img: HTMLImageElement): string | undefined {
    // Look for download link or button near the image
    const container = img.closest('div, figure, section');
    if (container) {
      const downloadLink = container.querySelector('a[download], a[href*="download"], button[title*="download"]');
      if (downloadLink) {
        return (downloadLink as HTMLAnchorElement).href || img.src;
      }
    }

    return img.src;
  }

  /**
   * Update image-specific state based on idle detector state
   */
  private updateImageState(state: ChatGPTState): void {
    this.currentState = {
      ...this.currentState,
      ...state
    };

    // Additional image-specific state updates
    if (state.state === 'idle' && this.currentState.isGeneratingImage) {
      console.log('🎨 Generation may be complete - ChatGPT returned to idle');
      // Don't immediately set isGeneratingImage to false, let the completion handler do it
    }
  }

  /**
   * Handle new images being added to the page
   */
  private handleNewImages(images: HTMLImageElement[]): void {
    const contentImages = images.filter(img => this.isContentImage(img));
    
    if (contentImages.length > 0) {
      console.log(`🎨 New content images detected: ${contentImages.length}`);
      
      // Update state
      this.currentState.imageCount += contentImages.length;
      this.currentState.hasImages = true;
      
      // If we were generating, this might be completion
      if (this.currentState.isGeneratingImage) {
        console.log('🎉 Image generation may be complete!');
        this.currentState.lastImageGenerated = new Date().toISOString();
      }
    }
  }

  /**
   * Handle generation status changes
   */
  private handleGenerationStatusChange(element: Element): void {
    const isStreaming = element.hasAttribute('data-message-streaming') ||
                       element.classList.contains('result-streaming');

    if (!isStreaming && this.currentState.isGeneratingImage) {
      console.log('✅ Streaming stopped - generation likely complete');
      setTimeout(() => {
        this.currentState.isGeneratingImage = false;
      }, 2000); // Give a small delay for images to load
    }
  }

  /**
   * Detect current state including image information
   */
  private async detectCurrentState(): Promise<void> {
    const baseState = this.idleDetector.detectChatGPTState();
    const imageDetection = await this.detectImages();

    this.currentState = {
      ...baseState,
      hasImages: imageDetection.found,
      imageCount: imageDetection.images.length,
      isGeneratingImage: false
    };

    console.log('📊 Current ChatGPT state:', this.currentState);
  }

  /**
   * Get current complete state
   */
  getCurrentState(): ChatGPTImageState {
    return { ...this.currentState };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.imageObserver) {
      this.imageObserver.disconnect();
      this.imageObserver = null;
    }

    if (this.generationTimeout) {
      clearTimeout(this.generationTimeout);
      this.generationTimeout = null;
    }

    this.idleDetector.destroy();

    console.log('🧹 ChatGPT Image Automation destroyed');
  }
}

// Initialize the automation system
const chatGPTAutomation = new ChatGPTImageAutomation();

// Export for external access
if (typeof window !== 'undefined') {
  (window as any).chatGPTAutomation = chatGPTAutomation;
}

// Notify background script that enhanced content script is ready
chrome.runtime.sendMessage({
  type: 'CHATGPT_CONTENT_READY',
  capabilities: [
    'prompt_submission',
    'image_generation',
    'image_detection',
    'image_download',
    'state_monitoring',
    'workflow_orchestration'
  ],
  url: window.location.href,
  timestamp: new Date().toISOString()
});

console.log('🚀 ChatGPT Image Generation Content Script loaded:', window.location.href);