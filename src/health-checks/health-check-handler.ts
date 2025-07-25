/**
 * Health check message handler for Chrome Extension
 * Integrates TabHealthCheck with the background script message handling
 */

import { TabHealthCheck, HealthStatus } from './tab-health';

export class HealthCheckHandler {
  private tabHealthCheck: TabHealthCheck;
  
  constructor() {
    this.tabHealthCheck = new TabHealthCheck();
  }
  
  /**
   * Handle health check requests from the server
   */
  async handleHealthCheckRequest(): Promise<HealthStatus> {
    console.log('🏥 Health check requested by server');
    const status = await this.tabHealthCheck.performHealthCheck();
    console.log('📊 Health check result:', status);
    return status;
  }
  
  /**
   * Handle image generation requests
   * Ensures ChatGPT tab exists before processing
   */
  async handleImageGenerationRequest(payload: any): Promise<any> {
    console.log('🎨 Image generation request received');
    
    // First ensure we have a ChatGPT tab
    const tabResult = await this.tabHealthCheck.checkAndEnsureTab();
    
    if (!tabResult.tab) {
      throw new Error('Failed to create or find ChatGPT tab');
    }
    
    // If we just created the tab, wait for it to load
    if (tabResult.created) {
      console.log('⏳ Waiting for new ChatGPT tab to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    // Forward the request to the content script (addon)
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for addon response'));
      }, 30000);
      
      chrome.tabs.sendMessage(tabResult.tab!.id!, {
        type: 'GENERATE_IMAGE',
        payload: payload
      }, (response) => {
        clearTimeout(timeout);
        
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to communicate with addon: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        resolve(response);
      });
    });
  }
  
  /**
   * Setup message listeners for health check related messages
   */
  setupMessageListeners(): void {
    // Listen for external messages from the server
    chrome.runtime.onMessageExternal.addListener(
      async (request, sender, sendResponse) => {
        if (request.type === 'HEALTH_CHECK') {
          try {
            const health = await this.handleHealthCheckRequest();
            sendResponse({ success: true, health });
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
          return true; // Keep channel open for async response
        }
        
        if (request.type === 'IMAGE_REQUEST') {
          try {
            const result = await this.handleImageGenerationRequest(request.payload);
            sendResponse({ success: true, result });
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
          return true; // Keep channel open for async response
        }
      }
    );
    
    // Also listen for internal messages (from popup or other extension parts)
    chrome.runtime.onMessage.addListener(
      async (request, sender, sendResponse) => {
        if (request.action === 'performHealthCheck') {
          try {
            const health = await this.handleHealthCheckRequest();
            sendResponse({ success: true, health });
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
          return true; // Keep channel open for async response
        }
        
        if (request.action === 'ensureChatGPTTab') {
          try {
            const tabResult = await this.tabHealthCheck.checkAndEnsureTab();
            sendResponse({ success: true, ...tabResult });
          } catch (error) {
            sendResponse({ 
              success: false, 
              error: error instanceof Error ? error.message : 'Unknown error' 
            });
          }
          return true; // Keep channel open for async response
        }
      }
    );
    
    console.log('✅ Health check message listeners set up');
  }
}

// Export singleton instance
export const healthCheckHandler = new HealthCheckHandler();