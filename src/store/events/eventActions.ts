/**
 * Event Action Creators
 * All actions are events that describe what happened
 */

import * as EventTypes from './eventTypes';

// WebSocket Connection Events
export const websocketConnected = (url: string, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_CONNECTED,
  payload: { url, timestamp },
  meta: { isEvent: true }
});

export const websocketDisconnected = (reason?: string, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_DISCONNECTED,
  payload: { reason, timestamp },
  meta: { isEvent: true }
});

export const websocketError = (error: string, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_ERROR,
  payload: { error, timestamp },
  meta: { isEvent: true }
});

export const websocketMessageReceived = (message: any, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_MESSAGE_RECEIVED,
  payload: { message, timestamp },
  meta: { isEvent: true }
});

export const websocketMessageSent = (message: any, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_MESSAGE_SENT,
  payload: { message, timestamp },
  meta: { isEvent: true }
});

export const websocketReconnecting = (attempt: number, timestamp: number = Date.now()) => ({
  type: EventTypes.WEBSOCKET_RECONNECTING,
  payload: { attempt, timestamp },
  meta: { isEvent: true }
});

// ChatGPT Tab Events
export const tabStateChanged = (tabId: number, state: string, timestamp: number = Date.now()) => ({
  type: EventTypes.TAB_STATE_CHANGED,
  payload: { tabId, state, timestamp },
  meta: { isEvent: true }
});

export const chatGPTTabFound = (tabId: number, url: string, timestamp: number = Date.now()) => ({
  type: EventTypes.CHATGPT_TAB_FOUND,
  payload: { tabId, url, timestamp },
  meta: { isEvent: true }
});

export const chatGPTTabLost = (tabId: number, timestamp: number = Date.now()) => ({
  type: EventTypes.CHATGPT_TAB_LOST,
  payload: { tabId, timestamp },
  meta: { isEvent: true }
});

export const chatGPTTabReady = (tabId: number, timestamp: number = Date.now()) => ({
  type: EventTypes.CHATGPT_TAB_READY,
  payload: { tabId, timestamp },
  meta: { isEvent: true }
});

export const chatGPTTabBusy = (tabId: number, timestamp: number = Date.now()) => ({
  type: EventTypes.CHATGPT_TAB_BUSY,
  payload: { tabId, timestamp },
  meta: { isEvent: true }
});

// Prompt Generation Events
export const promptSubmitted = (prompt: string, correlationId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_SUBMITTED,
  payload: { prompt, correlationId, timestamp },
  meta: { isEvent: true }
});

export const promptQueued = (prompt: string, correlationId: string, position: number, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_QUEUED,
  payload: { prompt, correlationId, position, timestamp },
  meta: { isEvent: true }
});

export const promptProcessing = (correlationId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_PROCESSING,
  payload: { correlationId, timestamp },
  meta: { isEvent: true }
});

export const promptCompleted = (correlationId: string, response: string, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_COMPLETED,
  payload: { correlationId, response, timestamp },
  meta: { isEvent: true }
});

export const promptFailed = (correlationId: string, error: string, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_FAILED,
  payload: { correlationId, error, timestamp },
  meta: { isEvent: true }
});

export const promptResponseReceived = (correlationId: string, response: string, timestamp: number = Date.now()) => ({
  type: EventTypes.PROMPT_RESPONSE_RECEIVED,
  payload: { correlationId, response, timestamp },
  meta: { isEvent: true }
});

// Image Generation Events
export const imageGenerationRequested = (prompt: string, correlationId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.IMAGE_GENERATION_REQUESTED,
  payload: { prompt, correlationId, timestamp },
  meta: { isEvent: true }
});

export const imageGenerationStarted = (correlationId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.IMAGE_GENERATION_STARTED,
  payload: { correlationId, timestamp },
  meta: { isEvent: true }
});

export const imageGenerationCompleted = (correlationId: string, imageUrl: string, timestamp: number = Date.now()) => ({
  type: EventTypes.IMAGE_GENERATION_COMPLETED,
  payload: { correlationId, imageUrl, timestamp },
  meta: { isEvent: true }
});

export const imageGenerationFailed = (correlationId: string, error: string, timestamp: number = Date.now()) => ({
  type: EventTypes.IMAGE_GENERATION_FAILED,
  payload: { correlationId, error, timestamp },
  meta: { isEvent: true }
});

export const imageReady = (imageUrl: string, correlationId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.IMAGE_READY,
  payload: { imageUrl, correlationId, timestamp },
  meta: { isEvent: true }
});

// DOM Monitoring Events
export const domChanged = (changes: any[], timestamp: number = Date.now()) => ({
  type: EventTypes.DOM_CHANGED,
  payload: { changes, timestamp },
  meta: { isEvent: true }
});

export const domElementDetected = (element: string, selector: string, timestamp: number = Date.now()) => ({
  type: EventTypes.DOM_ELEMENT_DETECTED,
  payload: { element, selector, timestamp },
  meta: { isEvent: true }
});

export const domElementRemoved = (element: string, selector: string, timestamp: number = Date.now()) => ({
  type: EventTypes.DOM_ELEMENT_REMOVED,
  payload: { element, selector, timestamp },
  meta: { isEvent: true }
});

export const textareaDetected = (selector: string, timestamp: number = Date.now()) => ({
  type: EventTypes.TEXTAREA_DETECTED,
  payload: { selector, timestamp },
  meta: { isEvent: true }
});

export const buttonDetected = (selector: string, label: string, timestamp: number = Date.now()) => ({
  type: EventTypes.BUTTON_DETECTED,
  payload: { selector, label, timestamp },
  meta: { isEvent: true }
});

// Queue Management Events
export const queueItemAdded = (item: any, timestamp: number = Date.now()) => ({
  type: EventTypes.QUEUE_ITEM_ADDED,
  payload: { item, timestamp },
  meta: { isEvent: true }
});

export const queueItemRemoved = (itemId: string, timestamp: number = Date.now()) => ({
  type: EventTypes.QUEUE_ITEM_REMOVED,
  payload: { itemId, timestamp },
  meta: { isEvent: true }
});

export const queueProcessingStarted = (timestamp: number = Date.now()) => ({
  type: EventTypes.QUEUE_PROCESSING_STARTED,
  payload: { timestamp },
  meta: { isEvent: true }
});

export const queueProcessingStopped = (timestamp: number = Date.now()) => ({
  type: EventTypes.QUEUE_PROCESSING_STOPPED,
  payload: { timestamp },
  meta: { isEvent: true }
});

export const queueCleared = (timestamp: number = Date.now()) => ({
  type: EventTypes.QUEUE_CLEARED,
  payload: { timestamp },
  meta: { isEvent: true }
});

// Pattern Recognition Events
export const patternDetected = (pattern: any, confidence: number, timestamp: number = Date.now()) => ({
  type: EventTypes.PATTERN_DETECTED,
  payload: { pattern, confidence, timestamp },
  meta: { isEvent: true }
});

export const patternLearned = (pattern: any, timestamp: number = Date.now()) => ({
  type: EventTypes.PATTERN_LEARNED,
  payload: { pattern, timestamp },
  meta: { isEvent: true }
});

export const patternApplied = (patternId: string, success: boolean, timestamp: number = Date.now()) => ({
  type: EventTypes.PATTERN_APPLIED,
  payload: { patternId, success, timestamp },
  meta: { isEvent: true }
});

// Error Events
export const errorOccurred = (error: string, context: any, timestamp: number = Date.now()) => ({
  type: EventTypes.ERROR_OCCURRED,
  payload: { error, context, timestamp },
  meta: { isEvent: true }
});

export const errorRecovered = (message: string, context?: any, timestamp: number = Date.now()) => ({
  type: EventTypes.ERROR_RECOVERED,
  payload: { message, context, timestamp },
  meta: { isEvent: true }
});

export const errorRetryAttempted = (error: string, attempt: number, timestamp: number = Date.now()) => ({
  type: EventTypes.ERROR_RETRY_ATTEMPTED,
  payload: { error, attempt, timestamp },
  meta: { isEvent: true }
});

// System Events
export const extensionInitialized = (version: string, timestamp: number = Date.now()) => ({
  type: EventTypes.EXTENSION_INITIALIZED,
  payload: { version, timestamp },
  meta: { isEvent: true }
});

export const extensionInstalled = (timestamp: number = Date.now()) => ({
  type: 'EXTENSION_INSTALLED',
  payload: { timestamp },
  meta: { isEvent: true }
});

export const extensionSuspended = (reason?: string, timestamp: number = Date.now()) => ({
  type: EventTypes.EXTENSION_SUSPENDED,
  payload: { reason, timestamp },
  meta: { isEvent: true }
});

export const extensionResumed = (timestamp: number = Date.now()) => ({
  type: EventTypes.EXTENSION_RESUMED,
  payload: { timestamp },
  meta: { isEvent: true }
});

export const chatGPTTabClosed = (tabId: number, timestamp: number = Date.now()) => ({
  type: 'CHATGPT_TAB_CLOSED',
  payload: { tabId, timestamp },
  meta: { isEvent: true }
});

export const configUpdated = (config: any, timestamp: number = Date.now()) => ({
  type: EventTypes.CONFIG_UPDATED,
  payload: { config, timestamp },
  meta: { isEvent: true }
});

export const healthCheckPerformed = (status: any, timestamp: number = Date.now()) => ({
  type: EventTypes.HEALTH_CHECK_PERFORMED,
  payload: { status, timestamp },
  meta: { isEvent: true }
});

// State Machine Events  
export const stateMachineTransition = (from: string, to: string, event: string, timestamp: number = Date.now()) => ({
  type: 'STATE_MACHINE_TRANSITION',
  payload: { from, to, event, timestamp },
  meta: { isEvent: true }
});

export const stateMachineError = (state: string, error: string, timestamp: number = Date.now()) => ({
  type: 'STATE_MACHINE_ERROR',
  payload: { state, error, timestamp },
  meta: { isEvent: true }
});

export const stateMachineReset = (previousState: string, timestamp: number = Date.now()) => ({
  type: 'STATE_MACHINE_RESET',
  payload: { previousState, timestamp },
  meta: { isEvent: true }
});