/**
 * SEMANTEST Tab Router
 * Routes events to browser tabs based on domain
 * @author Rafa - Systems Architect
 */

export interface SemantestEvent {
  type: string;
  payload: {
    domain: string;
    correlationId: string;
    [key: string]: any;
  };
}

export class SemantestTabRouter {
  /**
   * Find tab by domain
   * CRITICAL: This is how SEMANTEST knows which tab to target
   */
  async findTabByDomain(domain: string): Promise<chrome.tabs.Tab | null> {
    const tabs = await chrome.tabs.query({});
    
    const matchingTab = tabs.find(tab => {
      if (!tab.url) return false;
      
      try {
        const url = new URL(tab.url);
        return url.hostname === domain || 
               url.hostname === `www.${domain}` ||
               url.hostname.endsWith(`.${domain}`);
      } catch {
        return false;
      }
    });
    
    if (matchingTab) {
      console.log(`✅ Found tab for domain ${domain}:`, matchingTab.id);
    } else {
      console.warn(`⚠️ No tab found for domain ${domain}`);
    }
    
    return matchingTab || null;
  }
  
  /**
   * Route event to appropriate tab
   */
  async routeEventToTab(event: SemantestEvent): Promise<void> {
    const { domain } = event.payload;
    
    if (!domain) {
      throw new Error('Event missing required domain field');
    }
    
    const tab = await this.findTabByDomain(domain);
    
    if (!tab || !tab.id) {
      throw new Error(`No tab found for domain: ${domain}`);
    }
    
    // Send event to content script in the tab
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SEMANTEST_EVENT',
      event
    });
    
    console.log(`📤 Routed ${event.type} to tab ${tab.id} (${domain})`);
  }
  
  /**
   * Handle ImageGenerationRequestedEvent
   */
  async handleImageGenerationRequest(event: SemantestEvent): Promise<void> {
    const { prompt, domain } = event.payload;
    
    // Find ChatGPT tab
    const tab = await this.findTabByDomain(domain);
    
    if (!tab || !tab.id) {
      throw new Error('ChatGPT tab not found');
    }
    
    // Make tab active
    await chrome.tabs.update(tab.id, { active: true });
    
    // Send prompt to ChatGPT
    await chrome.tabs.sendMessage(tab.id, {
      type: 'SEMANTEST_SEND_PROMPT',
      payload: {
        prompt,
        correlationId: event.payload.correlationId
      }
    });
  }
  
  /**
   * Monitor all tabs for domain changes
   */
  setupTabMonitoring(): void {
    // Monitor tab URL changes
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.url) {
        console.log(`🔄 Tab ${tabId} URL changed to:`, changeInfo.url);
        
        // Check if it's a domain we care about
        const importantDomains = ['chatgpt.com', 'claude.ai', 'gemini.google.com'];
        const url = new URL(changeInfo.url);
        
        if (importantDomains.some(domain => url.hostname.includes(domain))) {
          console.log(`🎯 Important domain detected: ${url.hostname}`);
          
          // Inject content script if needed
          this.injectContentScript(tabId, url.hostname);
        }
      }
    });
    
    // Monitor new tabs
    chrome.tabs.onCreated.addListener((tab) => {
      console.log(`➕ New tab created:`, tab.id);
    });
  }
  
  /**
   * Inject SEMANTEST content script into tab
   */
  async injectContentScript(tabId: number, domain: string): Promise<void> {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content-scripts/semantest-content.js']
      });
      
      console.log(`💉 Injected SEMANTEST content script into tab ${tabId} (${domain})`);
    } catch (error) {
      console.error(`Failed to inject content script:`, error);
    }
  }
  
  /**
   * Get all tabs with their domains
   */
  async getAllTabDomains(): Promise<Map<string, number>> {
    const tabs = await chrome.tabs.query({});
    const domainMap = new Map<string, number>();
    
    tabs.forEach(tab => {
      if (tab.url && tab.id) {
        try {
          const url = new URL(tab.url);
          domainMap.set(url.hostname, tab.id);
        } catch {
          // Ignore invalid URLs
        }
      }
    });
    
    return domainMap;
  }
}

// Export singleton
export const tabRouter = new SemantestTabRouter();