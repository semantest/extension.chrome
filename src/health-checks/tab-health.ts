/**
 * Tab Health Check - Extension Layer
 * ONLY responsible for checking and managing ChatGPT tabs
 * Does NOT care about browser launch or user sessions
 */
export class TabHealthCheck {
  private readonly CHATGPT_URL_PATTERN = '*://chat.openai.com/*';
  private readonly CHATGPT_BASE_URL = 'https://chat.openai.com';

  /**
   * Check if a ChatGPT tab exists
   * This is the ONLY check at this layer
   */
  async hasChatGPTTab(): Promise<boolean> {
    try {
      const tabs = await chrome.tabs.query({ 
        url: this.CHATGPT_URL_PATTERN 
      });
      return tabs.length > 0;
    } catch (error) {
      console.error('Failed to query tabs:', error);
      return false;
    }
  }

  /**
   * Get existing ChatGPT tab
   */
  async getChatGPTTab(): Promise<chrome.tabs.Tab | null> {
    try {
      const tabs = await chrome.tabs.query({ 
        url: this.CHATGPT_URL_PATTERN 
      });
      return tabs[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Create a new ChatGPT tab if none exists
   * Returns existing tab if found
   */
  async ensureChatGPTTab(): Promise<chrome.tabs.Tab> {
    // Check for existing tab first
    const existingTab = await this.getChatGPTTab();
    if (existingTab) {
      // Make it active
      await chrome.tabs.update(existingTab.id!, { active: true });
      return existingTab;
    }

    // Create new tab
    return await chrome.tabs.create({ 
      url: this.CHATGPT_BASE_URL,
      active: true
    });
  }

  /**
   * Get health status for this component
   * Delegates child health check to addon
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const hasTab = await this.hasChatGPTTab();
    const tab = await this.getChatGPTTab();

    const status: HealthStatus = {
      component: 'extension',
      healthy: hasTab,
      message: hasTab 
        ? `ChatGPT tab found (ID: ${tab?.id})`
        : 'No ChatGPT tab found',
      action: hasTab
        ? undefined
        : 'Will create ChatGPT tab when needed'
    };

    // If we have a tab, check with addon for session health
    if (hasTab && tab) {
      try {
        const childHealth = await this.checkAddonHealth(tab.id!);
        status.childHealth = childHealth;
      } catch (error) {
        status.childHealth = {
          component: 'addon',
          healthy: false,
          message: 'Failed to check addon health',
          action: 'Ensure content script is loaded'
        };
      }
    }

    return status;
  }

  /**
   * Request health check from addon (content script)
   * This is the handoff point - we don't care about the details
   */
  private async checkAddonHealth(tabId: number): Promise<HealthStatus> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId, 
        { type: 'CHECK_SESSION' },
        (response) => {
          if (chrome.runtime.lastError) {
            resolve({
              component: 'addon',
              healthy: false,
              message: chrome.runtime.lastError.message,
              action: 'Reload the ChatGPT page'
            });
          } else {
            resolve(response as HealthStatus);
          }
        }
      );
    });
  }
}

/**
 * Health status interface (shared across layers)
 */
interface HealthStatus {
  component: 'server' | 'extension' | 'addon';
  healthy: boolean;
  message?: string;
  action?: string;
  childHealth?: HealthStatus;
}