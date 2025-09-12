/**
 * ChatGPT Interaction State Machine
 * Event-driven state machine for managing ChatGPT interactions
 */

import { Store } from 'redux';
import * as EventActions from '../store/events/eventActions';

export enum ChatGPTState {
  IDLE = 'IDLE',
  LOCATING_ELEMENTS = 'LOCATING_ELEMENTS',
  READY = 'READY',
  TYPING_PROMPT = 'TYPING_PROMPT',
  SUBMITTING = 'SUBMITTING',
  WAITING_RESPONSE = 'WAITING_RESPONSE',
  PROCESSING_RESPONSE = 'PROCESSING_RESPONSE',
  EXTRACTING_IMAGE = 'EXTRACTING_IMAGE',
  ERROR = 'ERROR',
  RECOVERING = 'RECOVERING'
}

export interface StateTransition {
  from: ChatGPTState;
  to: ChatGPTState;
  event: string;
  guard?: (context: StateContext) => boolean;
  action?: (context: StateContext) => void;
}

export interface StateContext {
  currentState: ChatGPTState;
  previousState: ChatGPTState | null;
  prompt: string | null;
  correlationId: string | null;
  elements: {
    textarea: HTMLTextAreaElement | null;
    button: HTMLButtonElement | null;
    responseContainer: HTMLElement | null;
  };
  retryCount: number;
  error: Error | null;
  metadata: Record<string, any>;
}

export class ChatGPTStateMachine {
  private store: Store;
  private context: StateContext;
  private transitions: Map<string, StateTransition[]>;
  private stateTimers: Map<ChatGPTState, NodeJS.Timeout>;
  private observers: Map<ChatGPTState, (() => void)[]>;

  constructor(store: Store) {
    this.store = store;
    this.context = this.createInitialContext();
    this.transitions = new Map();
    this.stateTimers = new Map();
    this.observers = new Map();
    this.setupTransitions();
  }

  private createInitialContext(): StateContext {
    return {
      currentState: ChatGPTState.IDLE,
      previousState: null,
      prompt: null,
      correlationId: null,
      elements: {
        textarea: null,
        button: null,
        responseContainer: null
      },
      retryCount: 0,
      error: null,
      metadata: {}
    };
  }

  private setupTransitions(): void {
    // Define all state transitions
    const allTransitions: StateTransition[] = [
      // From IDLE
      {
        from: ChatGPTState.IDLE,
        to: ChatGPTState.LOCATING_ELEMENTS,
        event: 'START_INTERACTION',
        action: (ctx) => {
          console.log('Starting ChatGPT interaction...');
          this.store.dispatch(EventActions.extensionResumed());
        }
      },
      {
        from: ChatGPTState.IDLE,
        to: ChatGPTState.READY,
        event: 'ELEMENTS_ALREADY_FOUND',
        guard: (ctx) => !!ctx.elements.textarea && !!ctx.elements.button
      },

      // From LOCATING_ELEMENTS
      {
        from: ChatGPTState.LOCATING_ELEMENTS,
        to: ChatGPTState.READY,
        event: 'ELEMENTS_FOUND',
        action: (ctx) => {
          console.log('ChatGPT elements located and ready');
          const tabId = this.getTabId();
          if (tabId) {
            this.store.dispatch(EventActions.chatGPTTabReady(tabId));
          }
        }
      },
      {
        from: ChatGPTState.LOCATING_ELEMENTS,
        to: ChatGPTState.ERROR,
        event: 'ELEMENTS_NOT_FOUND',
        action: (ctx) => {
          ctx.error = new Error('ChatGPT elements not found');
          this.store.dispatch(EventActions.errorOccurred(
            'Failed to locate ChatGPT elements',
            { retryCount: ctx.retryCount }
          ));
        }
      },

      // From READY
      {
        from: ChatGPTState.READY,
        to: ChatGPTState.TYPING_PROMPT,
        event: 'TYPE_PROMPT',
        guard: (ctx) => !!ctx.prompt && !!ctx.elements.textarea,
        action: (ctx) => {
          this.typePrompt(ctx);
        }
      },

      // From TYPING_PROMPT
      {
        from: ChatGPTState.TYPING_PROMPT,
        to: ChatGPTState.SUBMITTING,
        event: 'PROMPT_TYPED',
        action: (ctx) => {
          console.log('Prompt typed, ready to submit');
        }
      },
      {
        from: ChatGPTState.TYPING_PROMPT,
        to: ChatGPTState.ERROR,
        event: 'TYPING_FAILED',
        action: (ctx) => {
          ctx.error = new Error('Failed to type prompt');
          this.store.dispatch(EventActions.errorOccurred(
            'Failed to type prompt',
            { prompt: ctx.prompt }
          ));
        }
      },

      // From SUBMITTING
      {
        from: ChatGPTState.SUBMITTING,
        to: ChatGPTState.WAITING_RESPONSE,
        event: 'PROMPT_SUBMITTED',
        action: (ctx) => {
          console.log('Prompt submitted, waiting for response');
          if (ctx.correlationId) {
            this.store.dispatch(EventActions.promptProcessing(ctx.correlationId));
          }
          this.startResponseMonitoring(ctx);
        }
      },
      {
        from: ChatGPTState.SUBMITTING,
        to: ChatGPTState.ERROR,
        event: 'SUBMISSION_FAILED',
        action: (ctx) => {
          ctx.error = new Error('Failed to submit prompt');
          if (ctx.correlationId) {
            this.store.dispatch(EventActions.promptFailed(
              ctx.correlationId,
              'Submission failed'
            ));
          }
        }
      },

      // From WAITING_RESPONSE
      {
        from: ChatGPTState.WAITING_RESPONSE,
        to: ChatGPTState.PROCESSING_RESPONSE,
        event: 'RESPONSE_DETECTED',
        action: (ctx) => {
          console.log('Response detected, processing...');
          this.processResponse(ctx);
        }
      },
      {
        from: ChatGPTState.WAITING_RESPONSE,
        to: ChatGPTState.ERROR,
        event: 'RESPONSE_TIMEOUT',
        action: (ctx) => {
          ctx.error = new Error('Response timeout');
          if (ctx.correlationId) {
            this.store.dispatch(EventActions.promptFailed(
              ctx.correlationId,
              'Response timeout'
            ));
          }
        }
      },

      // From PROCESSING_RESPONSE
      {
        from: ChatGPTState.PROCESSING_RESPONSE,
        to: ChatGPTState.EXTRACTING_IMAGE,
        event: 'IMAGE_DETECTED',
        guard: (ctx) => ctx.metadata.hasImage === true,
        action: (ctx) => {
          this.extractImage(ctx);
        }
      },
      {
        from: ChatGPTState.PROCESSING_RESPONSE,
        to: ChatGPTState.READY,
        event: 'RESPONSE_COMPLETE',
        action: (ctx) => {
          console.log('Response processing complete');
          if (ctx.correlationId && ctx.metadata.responseText) {
            this.store.dispatch(EventActions.promptCompleted(
              ctx.correlationId,
              ctx.metadata.responseText
            ));
          }
          this.resetContext(ctx);
        }
      },

      // From EXTRACTING_IMAGE
      {
        from: ChatGPTState.EXTRACTING_IMAGE,
        to: ChatGPTState.READY,
        event: 'IMAGE_EXTRACTED',
        action: (ctx) => {
          console.log('Image extracted successfully');
          if (ctx.correlationId && ctx.metadata.imageUrl) {
            this.store.dispatch(EventActions.imageReady(
              ctx.metadata.imageUrl,
              ctx.correlationId
            ));
          }
          this.resetContext(ctx);
        }
      },

      // From ERROR
      {
        from: ChatGPTState.ERROR,
        to: ChatGPTState.RECOVERING,
        event: 'START_RECOVERY',
        guard: (ctx) => ctx.retryCount < 3,
        action: (ctx) => {
          ctx.retryCount++;
          console.log(`Attempting recovery (attempt ${ctx.retryCount}/3)`);
          this.store.dispatch(EventActions.errorRetryAttempted(
            ctx.error?.message || 'Unknown error',
            ctx.retryCount
          ));
        }
      },
      {
        from: ChatGPTState.ERROR,
        to: ChatGPTState.IDLE,
        event: 'RESET',
        action: (ctx) => {
          console.log('Resetting to IDLE state');
          this.resetContext(ctx);
        }
      },

      // From RECOVERING
      {
        from: ChatGPTState.RECOVERING,
        to: ChatGPTState.LOCATING_ELEMENTS,
        event: 'RETRY_INTERACTION',
        action: (ctx) => {
          console.log('Retrying interaction...');
          this.store.dispatch(EventActions.errorRecovered(
            'Retrying after error',
            { retryCount: ctx.retryCount }
          ));
        }
      },
      {
        from: ChatGPTState.RECOVERING,
        to: ChatGPTState.ERROR,
        event: 'RECOVERY_FAILED',
        action: (ctx) => {
          console.error('Recovery failed after maximum attempts');
          this.store.dispatch(EventActions.errorOccurred(
            'Recovery failed',
            { maxRetriesReached: true }
          ));
        }
      }
    ];

    // Group transitions by "from" state
    allTransitions.forEach(transition => {
      const key = `${transition.from}_${transition.event}`;
      if (!this.transitions.has(key)) {
        this.transitions.set(key, []);
      }
      this.transitions.get(key)!.push(transition);
    });
  }

  /**
   * Dispatch an event to trigger state transition
   */
  public dispatch(event: string, payload?: any): boolean {
    const key = `${this.context.currentState}_${event}`;
    const possibleTransitions = this.transitions.get(key) || [];

    for (const transition of possibleTransitions) {
      // Check guard condition
      if (transition.guard && !transition.guard(this.context)) {
        continue;
      }

      // Update context with payload
      if (payload) {
        Object.assign(this.context, payload);
      }

      // Execute transition
      this.executeTransition(transition);
      return true;
    }

    console.warn(`No valid transition for event "${event}" from state "${this.context.currentState}"`);
    return false;
  }

  private executeTransition(transition: StateTransition): void {
    const fromState = this.context.currentState;
    const toState = transition.to;

    console.log(`State transition: ${fromState} -> ${toState} (event: ${transition.event})`);

    // Update context
    this.context.previousState = fromState;
    this.context.currentState = toState;

    // Dispatch state change event to Redux
    const tabId = this.getTabId();
    if (tabId) {
      this.store.dispatch(EventActions.tabStateChanged(tabId, toState));
    }

    // Execute transition action
    if (transition.action) {
      transition.action(this.context);
    }

    // Clear any existing timers for the previous state
    this.clearStateTimer(fromState);

    // Notify observers
    this.notifyObservers(toState);

    // Set up automatic transitions for certain states
    this.setupAutomaticTransitions(toState);
  }

  private setupAutomaticTransitions(state: ChatGPTState): void {
    switch (state) {
      case ChatGPTState.LOCATING_ELEMENTS:
        // Automatically try to find elements
        this.setStateTimer(state, () => {
          this.locateElements();
        }, 100);
        break;

      case ChatGPTState.SUBMITTING:
        // Automatically submit after a short delay
        this.setStateTimer(state, () => {
          this.submitPrompt();
        }, 200);
        break;

      case ChatGPTState.WAITING_RESPONSE:
        // Set timeout for response
        this.setStateTimer(state, () => {
          this.dispatch('RESPONSE_TIMEOUT');
        }, 30000); // 30 second timeout
        break;

      case ChatGPTState.ERROR:
        // Attempt recovery after delay
        this.setStateTimer(state, () => {
          this.dispatch('START_RECOVERY');
        }, 2000);
        break;

      case ChatGPTState.RECOVERING:
        // Retry interaction
        this.setStateTimer(state, () => {
          this.dispatch('RETRY_INTERACTION');
        }, 1000);
        break;
    }
  }

  private setStateTimer(state: ChatGPTState, callback: () => void, delay: number): void {
    this.clearStateTimer(state);
    const timer = setTimeout(callback, delay);
    this.stateTimers.set(state, timer);
  }

  private clearStateTimer(state: ChatGPTState): void {
    const timer = this.stateTimers.get(state);
    if (timer) {
      clearTimeout(timer);
      this.stateTimers.delete(state);
    }
  }

  private locateElements(): void {
    const textarea = document.querySelector('textarea[placeholder*="Send a message"], textarea[data-id="prompt-textarea"]') as HTMLTextAreaElement;
    const button = document.querySelector('button[data-testid="send-button"], button:has(svg)') as HTMLButtonElement;
    const responseContainer = document.querySelector('div[class*="markdown"], div[class*="response"]') as HTMLElement;

    if (textarea && button) {
      this.context.elements = { textarea, button, responseContainer };
      this.dispatch('ELEMENTS_FOUND');
    } else {
      this.dispatch('ELEMENTS_NOT_FOUND');
    }
  }

  private typePrompt(ctx: StateContext): void {
    if (!ctx.elements.textarea || !ctx.prompt) {
      this.dispatch('TYPING_FAILED');
      return;
    }

    try {
      // Clear existing text
      ctx.elements.textarea.value = '';
      
      // Type prompt character by character for more natural interaction
      let charIndex = 0;
      const typeChar = () => {
        if (charIndex < ctx.prompt!.length) {
          ctx.elements.textarea!.value += ctx.prompt![charIndex];
          ctx.elements.textarea!.dispatchEvent(new Event('input', { bubbles: true }));
          charIndex++;
          setTimeout(typeChar, 10 + Math.random() * 20); // Random typing speed
        } else {
          this.dispatch('PROMPT_TYPED');
        }
      };
      typeChar();
    } catch (error) {
      console.error('Error typing prompt:', error);
      this.dispatch('TYPING_FAILED');
    }
  }

  private submitPrompt(): void {
    if (!this.context.elements.button) {
      this.dispatch('SUBMISSION_FAILED');
      return;
    }

    try {
      // Click the submit button
      this.context.elements.button.click();
      this.dispatch('PROMPT_SUBMITTED');
    } catch (error) {
      console.error('Error submitting prompt:', error);
      this.dispatch('SUBMISSION_FAILED');
    }
  }

  private startResponseMonitoring(ctx: StateContext): void {
    // Monitor for response appearance
    const checkInterval = setInterval(() => {
      const responseElements = document.querySelectorAll('div[class*="markdown"], div[class*="response"]');
      const lastResponse = responseElements[responseElements.length - 1] as HTMLElement;

      if (lastResponse && lastResponse !== ctx.elements.responseContainer) {
        ctx.elements.responseContainer = lastResponse;
        clearInterval(checkInterval);
        this.dispatch('RESPONSE_DETECTED');
      }
    }, 500);

    // Store interval ID for cleanup
    ctx.metadata.responseCheckInterval = checkInterval;
  }

  private processResponse(ctx: StateContext): void {
    if (!ctx.elements.responseContainer) {
      this.dispatch('RESPONSE_COMPLETE');
      return;
    }

    // Extract response text
    const responseText = ctx.elements.responseContainer.textContent || '';
    ctx.metadata.responseText = responseText;

    // Check for images
    const images = ctx.elements.responseContainer.querySelectorAll('img');
    if (images.length > 0) {
      ctx.metadata.hasImage = true;
      ctx.metadata.imageElements = Array.from(images);
      this.dispatch('IMAGE_DETECTED');
    } else {
      this.dispatch('RESPONSE_COMPLETE');
    }
  }

  private extractImage(ctx: StateContext): void {
    const images = ctx.metadata.imageElements as HTMLImageElement[];
    if (images && images.length > 0) {
      // Find the most likely generated image
      const generatedImage = images.find(img => 
        img.src.includes('dalle') || 
        img.src.includes('openai') ||
        img.alt?.toLowerCase().includes('generated')
      ) || images[0];

      ctx.metadata.imageUrl = generatedImage.src;
      this.dispatch('IMAGE_EXTRACTED');
    } else {
      this.dispatch('RESPONSE_COMPLETE');
    }
  }

  private resetContext(ctx: StateContext): void {
    // Clear timers
    if (ctx.metadata.responseCheckInterval) {
      clearInterval(ctx.metadata.responseCheckInterval);
    }

    // Reset context fields
    ctx.prompt = null;
    ctx.correlationId = null;
    ctx.error = null;
    ctx.retryCount = 0;
    ctx.metadata = {};
  }

  private getTabId(): number | null {
    // In content script, we'd get this from chrome.runtime
    // For now, return a placeholder
    return 1;
  }

  private notifyObservers(state: ChatGPTState): void {
    const observers = this.observers.get(state) || [];
    observers.forEach(observer => observer());
  }

  /**
   * Add observer for state changes
   */
  public onStateEnter(state: ChatGPTState, callback: () => void): () => void {
    if (!this.observers.has(state)) {
      this.observers.set(state, []);
    }
    this.observers.get(state)!.push(callback);

    // Return unsubscribe function
    return () => {
      const observers = this.observers.get(state);
      if (observers) {
        const index = observers.indexOf(callback);
        if (index > -1) {
          observers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Get current state
   */
  public getCurrentState(): ChatGPTState {
    return this.context.currentState;
  }

  /**
   * Get full context
   */
  public getContext(): StateContext {
    return { ...this.context };
  }

  /**
   * Start interaction with a prompt
   */
  public startInteraction(prompt: string, correlationId: string): void {
    this.context.prompt = prompt;
    this.context.correlationId = correlationId;
    
    // Check if we already have elements
    if (this.context.elements.textarea && this.context.elements.button) {
      this.dispatch('ELEMENTS_ALREADY_FOUND');
      setTimeout(() => this.dispatch('TYPE_PROMPT'), 100);
    } else {
      this.dispatch('START_INTERACTION');
    }
  }

  /**
   * Reset state machine
   */
  public reset(): void {
    // Clear all timers
    this.stateTimers.forEach(timer => clearTimeout(timer));
    this.stateTimers.clear();

    // Reset context
    this.context = this.createInitialContext();

    // Dispatch reset event
    this.dispatch('RESET');
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    this.reset();
    this.observers.clear();
    this.transitions.clear();
  }
}

// Export singleton creation function
export const createChatGPTStateMachine = (store: Store): ChatGPTStateMachine => {
  return new ChatGPTStateMachine(store);
};