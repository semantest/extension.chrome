/**
 * DOM Monitor Service
 * Monitors DOM changes and dispatches events to Redux store
 */

import { Store } from 'redux';
import * as EventActions from '../store/events/eventActions';

export class DOMMonitor {
  private observer: MutationObserver | null = null;
  private store: Store;
  private isMonitoring: boolean = false;
  private selectors = {
    chatGPTTextarea: 'textarea[placeholder*="Send a message"], textarea[data-id="prompt-textarea"]',
    chatGPTButton: 'button[data-testid="send-button"], button:has(svg)',
    responseContainer: 'div[class*="markdown"], div[class*="response"]',
    imageContainer: 'img[src*="dalle"], img[alt*="Generated"]'
  };

  constructor(store: Store) {
    this.store = store;
  }

  /**
   * Start monitoring DOM changes
   */
  start(): void {
    if (this.isMonitoring) {
      console.log('DOM monitoring already active');
      return;
    }

    console.log('Starting DOM monitoring...');
    this.isMonitoring = true;

    // Initial DOM scan
    this.scanDOM();

    // Set up MutationObserver
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Observe entire document with specific configuration
    this.observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'data-testid', 'placeholder'],
      characterData: true
    });

    console.log('DOM monitoring started');
  }

  /**
   * Stop monitoring DOM changes
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    console.log('Stopping DOM monitoring...');
    this.isMonitoring = false;

    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    console.log('DOM monitoring stopped');
  }

  /**
   * Scan current DOM for important elements
   */
  private scanDOM(): void {
    // Check for ChatGPT textarea
    const textarea = document.querySelector(this.selectors.chatGPTTextarea);
    if (textarea) {
      this.store.dispatch(EventActions.textareaDetected(this.selectors.chatGPTTextarea));
      this.attachTextareaListeners(textarea as HTMLTextAreaElement);
    }

    // Check for submit button
    const button = document.querySelector(this.selectors.chatGPTButton);
    if (button) {
      const label = button.textContent || button.getAttribute('aria-label') || 'Send';
      this.store.dispatch(EventActions.buttonDetected(this.selectors.chatGPTButton, label));
      this.attachButtonListeners(button as HTMLButtonElement);
    }

    // Check for response container
    const responseContainer = document.querySelector(this.selectors.responseContainer);
    if (responseContainer) {
      this.store.dispatch(EventActions.domElementDetected(
        'responseContainer',
        this.selectors.responseContainer
      ));
    }

    // Check if this is a ChatGPT tab
    if (this.isChatGPTPage()) {
      const tabId = this.getTabId();
      if (tabId) {
        this.store.dispatch(EventActions.chatGPTTabFound(tabId, window.location.href));
        this.store.dispatch(EventActions.chatGPTTabReady(tabId));
      }
    }
  }

  /**
   * Handle DOM mutations
   */
  private handleMutations(mutations: MutationRecord[]): void {
    const changes: any[] = [];
    let hasSignificantChanges = false;

    for (const mutation of mutations) {
      // Track added nodes
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          // Check if it's a textarea
          if (element.matches?.(this.selectors.chatGPTTextarea) || 
              element.querySelector?.(this.selectors.chatGPTTextarea)) {
            this.store.dispatch(EventActions.textareaDetected(this.selectors.chatGPTTextarea));
            hasSignificantChanges = true;
          }

          // Check if it's a button
          if (element.matches?.(this.selectors.chatGPTButton) ||
              element.querySelector?.(this.selectors.chatGPTButton)) {
            const button = element.matches?.(this.selectors.chatGPTButton) 
              ? element 
              : element.querySelector(this.selectors.chatGPTButton);
            if (button) {
              const label = button.textContent || button.getAttribute('aria-label') || 'Send';
              this.store.dispatch(EventActions.buttonDetected(this.selectors.chatGPTButton, label));
              this.attachButtonListeners(button as HTMLButtonElement);
              hasSignificantChanges = true;
            }
          }

          // Check for response content
          if (element.matches?.(this.selectors.responseContainer)) {
            this.handleResponseContent(element);
            hasSignificantChanges = true;
          }

          // Check for generated images
          if (element.tagName === 'IMG') {
            const img = element as HTMLImageElement;
            if (this.isGeneratedImage(img)) {
              this.handleGeneratedImage(img);
              hasSignificantChanges = true;
            }
          }

          changes.push({
            type: 'added',
            element: element.tagName,
            id: element.id,
            classes: element.className
          });
        }
      });

      // Track removed nodes
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const element = node as HTMLElement;
          
          if (element.matches?.(this.selectors.chatGPTTextarea)) {
            this.store.dispatch(EventActions.domElementRemoved(
              'textarea',
              this.selectors.chatGPTTextarea
            ));
            hasSignificantChanges = true;
          }

          changes.push({
            type: 'removed',
            element: element.tagName,
            id: element.id,
            classes: element.className
          });
        }
      });

      // Track attribute changes
      if (mutation.type === 'attributes') {
        const element = mutation.target as HTMLElement;
        changes.push({
          type: 'attributes',
          element: element.tagName,
          attribute: mutation.attributeName,
          value: element.getAttribute(mutation.attributeName!)
        });
      }
    }

    // Dispatch DOM changed event if there were changes
    if (changes.length > 0) {
      this.store.dispatch(EventActions.domChanged(changes));
    }

    // Update tab state if significant changes occurred
    if (hasSignificantChanges) {
      this.updateTabState();
    }
  }

  /**
   * Attach listeners to textarea for event tracking
   */
  private attachTextareaListeners(textarea: HTMLTextAreaElement): void {
    // Remove any existing listeners
    textarea.removeEventListener('input', this.handleTextareaInput);
    textarea.removeEventListener('keydown', this.handleTextareaKeydown);

    // Add new listeners
    textarea.addEventListener('input', this.handleTextareaInput.bind(this));
    textarea.addEventListener('keydown', this.handleTextareaKeydown.bind(this));
  }

  /**
   * Handle textarea input events
   */
  private handleTextareaInput(event: Event): void {
    const textarea = event.target as HTMLTextAreaElement;
    const value = textarea.value;

    // Detect patterns in input
    if (value.toLowerCase().includes('generate image') || 
        value.toLowerCase().includes('create image') ||
        value.toLowerCase().includes('dall-e')) {
      this.store.dispatch(EventActions.patternDetected(
        { type: 'image_generation_intent', prompt: value },
        0.8
      ));
    }
  }

  /**
   * Handle textarea keydown events
   */
  private handleTextareaKeydown(event: KeyboardEvent): void {
    // Detect Enter key submission (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
      const textarea = event.target as HTMLTextAreaElement;
      const prompt = textarea.value.trim();
      
      if (prompt) {
        const correlationId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.store.dispatch(EventActions.promptSubmitted(prompt, correlationId));
      }
    }
  }

  /**
   * Attach listeners to button for event tracking
   */
  private attachButtonListeners(button: HTMLButtonElement): void {
    button.removeEventListener('click', this.handleButtonClick);
    button.addEventListener('click', this.handleButtonClick.bind(this));
  }

  /**
   * Handle button click events
   */
  private handleButtonClick(event: Event): void {
    // Find the associated textarea
    const textarea = document.querySelector(this.selectors.chatGPTTextarea) as HTMLTextAreaElement;
    if (textarea) {
      const prompt = textarea.value.trim();
      if (prompt) {
        const correlationId = `prompt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.store.dispatch(EventActions.promptSubmitted(prompt, correlationId));
      }
    }
  }

  /**
   * Handle response content detection
   */
  private handleResponseContent(element: HTMLElement): void {
    const text = element.textContent || '';
    
    // Check if response mentions image generation
    if (text.includes('generated') && text.includes('image')) {
      this.store.dispatch(EventActions.patternDetected(
        { type: 'image_generation_response', content: text },
        0.7
      ));
    }

    // Dispatch response received event
    const state = this.store.getState() as any;
    if (state.currentGeneration?.correlationId) {
      this.store.dispatch(EventActions.promptResponseReceived(
        state.currentGeneration.correlationId,
        text
      ));
    }
  }

  /**
   * Handle generated image detection
   */
  private handleGeneratedImage(img: HTMLImageElement): void {
    const state = this.store.getState() as any;
    const correlationId = state.currentGeneration?.correlationId || 
                          `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.store.dispatch(EventActions.imageReady(img.src, correlationId));
  }

  /**
   * Check if image is a generated image
   */
  private isGeneratedImage(img: HTMLImageElement): boolean {
    return img.src.includes('dalle') || 
           img.src.includes('openai') ||
           img.alt?.toLowerCase().includes('generated') ||
           img.alt?.toLowerCase().includes('dall-e');
  }

  /**
   * Check if current page is ChatGPT
   */
  private isChatGPTPage(): boolean {
    return window.location.href.includes('chat.openai.com') ||
           window.location.href.includes('chatgpt.com') ||
           document.title.toLowerCase().includes('chatgpt');
  }

  /**
   * Get current tab ID (if available)
   */
  private getTabId(): number | null {
    // In content script context, we need to request tab info from background
    // For now, return a placeholder
    return 1; // This would be obtained from chrome.runtime
  }

  /**
   * Update tab state based on DOM
   */
  private updateTabState(): void {
    const tabId = this.getTabId();
    if (!tabId) return;

    const textarea = document.querySelector(this.selectors.chatGPTTextarea);
    const button = document.querySelector(this.selectors.chatGPTButton);
    
    if (textarea && button) {
      // Check if button is disabled (indicating busy state)
      const isDisabled = button.hasAttribute('disabled') || 
                        button.getAttribute('aria-disabled') === 'true';
      
      if (isDisabled) {
        this.store.dispatch(EventActions.chatGPTTabBusy(tabId));
      } else {
        this.store.dispatch(EventActions.chatGPTTabReady(tabId));
      }
    }
  }
}

// Export singleton instance creation function
export const createDOMMonitor = (store: Store): DOMMonitor => {
  return new DOMMonitor(store);
};