// Mock implementation of HealthCheckHandler

export interface HealthStatus {
  component: 'server' | 'extension' | 'addon';
  healthy: boolean;
  message?: string;
  action?: string;
  childHealth?: HealthStatus;
}

export class HealthCheckHandler {
  private tabHealthCheck: any;
  
  constructor() {
    this.tabHealthCheck = {
      performHealthCheck: jest.fn(),
      checkAndEnsureTab: jest.fn()
    };
  }
  
  async handleHealthCheckRequest(): Promise<HealthStatus> {
    console.log('🏥 Health check requested by server');
    const status = await this.tabHealthCheck.performHealthCheck();
    console.log('📊 Health check result:', status);
    return status;
  }
  
  async handleImageGenerationRequest(payload: any): Promise<any> {
    console.log('🎨 Image generation request received');
    
    const tabResult = await this.tabHealthCheck.checkAndEnsureTab();
    
    if (!tabResult.tab) {
      throw new Error('Failed to create or find ChatGPT tab');
    }
    
    if (tabResult.created) {
      console.log('⏳ Waiting for new ChatGPT tab to load...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
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
  
  setupMessageListeners(): void {
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
          return true;
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
          return true;
        }
      }
    );
    
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
          return true;
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
          return true;
        }
      }
    );
    
    console.log('✅ Health check message listeners set up');
  }
}

export const healthCheckHandler = new HealthCheckHandler();