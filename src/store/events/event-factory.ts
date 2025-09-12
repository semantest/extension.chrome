/**
 * Event Factory: Creates events with consistent structure
 * Every action in the system creates an event
 */

import {
  BaseEvent,
  EventType,
  WebSocketMessagePayload,
  TabStatePayload,
  DomChangePayload,
  PromptPayload,
  GenerationPayload,
  EVENTS
} from './event-types';

export class EventFactory {
  private static correlationCounter = 0;

  /**
   * Generate a unique correlation ID for event tracking
   */
  private static generateCorrelationId(): string {
    return `${Date.now()}-${++this.correlationCounter}`;
  }

  /**
   * Create a base event with common properties
   */
  private static createEvent<T extends EventType, P = any>(
    type: T,
    payload?: P,
    source: BaseEvent['source'] = 'extension',
    meta?: BaseEvent['meta']
  ): BaseEvent<T, P> {
    return {
      type,
      payload,
      timestamp: Date.now(),
      source,
      meta: {
        correlationId: this.generateCorrelationId(),
        ...meta
      }
    };
  }

  // Connection Events
  static websocketConnecting() {
    return this.createEvent(EVENTS.WEBSOCKET_CONNECTING, undefined, 'background');
  }

  static websocketConnected(url: string) {
    return this.createEvent(EVENTS.WEBSOCKET_CONNECTED, { url }, 'background');
  }

  static websocketDisconnected(reason?: string) {
    return this.createEvent(EVENTS.WEBSOCKET_DISCONNECTED, { reason }, 'background');
  }

  static websocketError(error: string) {
    return this.createEvent(EVENTS.WEBSOCKET_ERROR, { error }, 'background');
  }

  static websocketReconnecting(attempt: number) {
    return this.createEvent(EVENTS.WEBSOCKET_RECONNECTING, { attempt }, 'background');
  }

  static websocketMessageReceived(payload: WebSocketMessagePayload) {
    return this.createEvent(EVENTS.WEBSOCKET_MESSAGE_RECEIVED, payload, 'websocket');
  }

  static websocketMessageSent(payload: WebSocketMessagePayload) {
    return this.createEvent(EVENTS.WEBSOCKET_MESSAGE_SENT, payload, 'extension');
  }

  // Tab Events
  static tabActivated(tabId: number, url: string) {
    return this.createEvent(EVENTS.TAB_ACTIVATED, { tabId, url }, 'background');
  }

  static tabDeactivated(tabId: number) {
    return this.createEvent(EVENTS.TAB_DEACTIVATED, { tabId }, 'background');
  }

  static tabStateChanged(payload: TabStatePayload) {
    return this.createEvent(EVENTS.TAB_STATE_CHANGED, payload, 'content-script');
  }

  static tabUrlChanged(tabId: number, url: string) {
    return this.createEvent(EVENTS.TAB_URL_CHANGED, { tabId, url }, 'background');
  }

  static tabReady(tabId: number) {
    return this.createEvent(EVENTS.TAB_READY, { tabId }, 'content-script');
  }

  static tabLoading(tabId: number) {
    return this.createEvent(EVENTS.TAB_LOADING, { tabId }, 'content-script');
  }

  static tabError(tabId: number, error: string) {
    return this.createEvent(EVENTS.TAB_ERROR, { tabId, error }, 'content-script');
  }

  // DOM Events
  static domChanged(payload: DomChangePayload) {
    return this.createEvent(EVENTS.DOM_CHANGED, payload, 'content-script');
  }

  static inputDetected(selector: string, ready: boolean) {
    return this.createEvent(EVENTS.INPUT_DETECTED, { selector, ready }, 'content-script');
  }

  static buttonDetected(selector: string, enabled: boolean) {
    return this.createEvent(EVENTS.BUTTON_DETECTED, { selector, enabled }, 'content-script');
  }

  static responseDetected(content: string, complete: boolean) {
    return this.createEvent(EVENTS.RESPONSE_DETECTED, { content, complete }, 'content-script');
  }

  static chatReady() {
    return this.createEvent(EVENTS.CHAT_READY, undefined, 'content-script');
  }

  static chatBusy() {
    return this.createEvent(EVENTS.CHAT_BUSY, undefined, 'content-script');
  }

  // Queue Events
  static promptQueued(payload: PromptPayload) {
    return this.createEvent(EVENTS.PROMPT_QUEUED, payload, 'extension');
  }

  static promptProcessing(id: string) {
    return this.createEvent(EVENTS.PROMPT_PROCESSING, { id }, 'extension');
  }

  static promptSubmitted(id: string) {
    return this.createEvent(EVENTS.PROMPT_SUBMITTED, { id }, 'content-script');
  }

  static promptCompleted(id: string, result?: any) {
    return this.createEvent(EVENTS.PROMPT_COMPLETED, { id, result }, 'content-script');
  }

  static promptFailed(id: string, error: string) {
    return this.createEvent(EVENTS.PROMPT_FAILED, { id, error }, 'extension');
  }

  static queueCleared() {
    return this.createEvent(EVENTS.QUEUE_CLEARED, undefined, 'user');
  }

  static queuePaused() {
    return this.createEvent(EVENTS.QUEUE_PAUSED, undefined, 'user');
  }

  static queueResumed() {
    return this.createEvent(EVENTS.QUEUE_RESUMED, undefined, 'user');
  }

  // Generation Events
  static generationRequested(payload: GenerationPayload) {
    return this.createEvent(EVENTS.GENERATION_REQUESTED, payload, 'user');
  }

  static generationStarted(id: string) {
    return this.createEvent(EVENTS.GENERATION_STARTED, { id }, 'extension');
  }

  static generationProgress(id: string, progress: number) {
    return this.createEvent(EVENTS.GENERATION_PROGRESS, { id, progress }, 'content-script');
  }

  static generationCompleted(id: string, images: string[]) {
    return this.createEvent(EVENTS.GENERATION_COMPLETED, { id, images }, 'content-script');
  }

  static generationFailed(id: string, error: string) {
    return this.createEvent(EVENTS.GENERATION_FAILED, { id, error }, 'extension');
  }

  static imageReady(url: string, generationId: string) {
    return this.createEvent(EVENTS.IMAGE_READY, { url, generationId }, 'content-script');
  }

  static imageDownloaded(url: string, path: string) {
    return this.createEvent(EVENTS.IMAGE_DOWNLOADED, { url, path }, 'background');
  }

  // System Events
  static extensionInitialized() {
    return this.createEvent(EVENTS.EXTENSION_INITIALIZED, undefined, 'background');
  }

  static extensionError(error: string, details?: any) {
    return this.createEvent(EVENTS.EXTENSION_ERROR, { error, details }, 'extension');
  }

  static storageUpdated(key: string, value: any) {
    return this.createEvent(EVENTS.STORAGE_UPDATED, { key, value }, 'background');
  }

  static settingsChanged(settings: Record<string, any>) {
    return this.createEvent(EVENTS.SETTINGS_CHANGED, settings, 'user');
  }

  static permissionGranted(permission: string) {
    return this.createEvent(EVENTS.PERMISSION_GRANTED, { permission }, 'background');
  }

  static permissionDenied(permission: string) {
    return this.createEvent(EVENTS.PERMISSION_DENIED, { permission }, 'background');
  }
}