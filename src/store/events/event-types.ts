/**
 * Event-Driven Architecture: Core Event Types
 * All state changes in the system are represented as events
 */

// Connection Events
export const CONNECTION_EVENTS = {
  WEBSOCKET_CONNECTING: 'WEBSOCKET_CONNECTING',
  WEBSOCKET_CONNECTED: 'WEBSOCKET_CONNECTED',
  WEBSOCKET_DISCONNECTED: 'WEBSOCKET_DISCONNECTED',
  WEBSOCKET_ERROR: 'WEBSOCKET_ERROR',
  WEBSOCKET_RECONNECTING: 'WEBSOCKET_RECONNECTING',
  WEBSOCKET_MESSAGE_RECEIVED: 'WEBSOCKET_MESSAGE_RECEIVED',
  WEBSOCKET_MESSAGE_SENT: 'WEBSOCKET_MESSAGE_SENT',
} as const;

// ChatGPT Tab Events
export const TAB_EVENTS = {
  TAB_ACTIVATED: 'TAB_ACTIVATED',
  TAB_DEACTIVATED: 'TAB_DEACTIVATED',
  TAB_STATE_CHANGED: 'TAB_STATE_CHANGED',
  TAB_URL_CHANGED: 'TAB_URL_CHANGED',
  TAB_READY: 'TAB_READY',
  TAB_LOADING: 'TAB_LOADING',
  TAB_ERROR: 'TAB_ERROR',
} as const;

// DOM Monitoring Events
export const DOM_EVENTS = {
  DOM_CHANGED: 'DOM_CHANGED',
  INPUT_DETECTED: 'INPUT_DETECTED',
  BUTTON_DETECTED: 'BUTTON_DETECTED',
  RESPONSE_DETECTED: 'RESPONSE_DETECTED',
  CHAT_READY: 'CHAT_READY',
  CHAT_BUSY: 'CHAT_BUSY',
  ELEMENT_APPEARED: 'ELEMENT_APPEARED',
  ELEMENT_DISAPPEARED: 'ELEMENT_DISAPPEARED',
} as const;

// Prompt Queue Events
export const QUEUE_EVENTS = {
  PROMPT_QUEUED: 'PROMPT_QUEUED',
  PROMPT_PROCESSING: 'PROMPT_PROCESSING',
  PROMPT_SUBMITTED: 'PROMPT_SUBMITTED',
  PROMPT_COMPLETED: 'PROMPT_COMPLETED',
  PROMPT_FAILED: 'PROMPT_FAILED',
  QUEUE_CLEARED: 'QUEUE_CLEARED',
  QUEUE_PAUSED: 'QUEUE_PAUSED',
  QUEUE_RESUMED: 'QUEUE_RESUMED',
} as const;

// Image Generation Events
export const GENERATION_EVENTS = {
  GENERATION_REQUESTED: 'GENERATION_REQUESTED',
  GENERATION_STARTED: 'GENERATION_STARTED',
  GENERATION_PROGRESS: 'GENERATION_PROGRESS',
  GENERATION_COMPLETED: 'GENERATION_COMPLETED',
  GENERATION_FAILED: 'GENERATION_FAILED',
  IMAGE_READY: 'IMAGE_READY',
  IMAGE_DOWNLOADED: 'IMAGE_DOWNLOADED',
} as const;

// System Events
export const SYSTEM_EVENTS = {
  EXTENSION_INITIALIZED: 'EXTENSION_INITIALIZED',
  EXTENSION_ERROR: 'EXTENSION_ERROR',
  STORAGE_UPDATED: 'STORAGE_UPDATED',
  SETTINGS_CHANGED: 'SETTINGS_CHANGED',
  PERMISSION_GRANTED: 'PERMISSION_GRANTED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
} as const;

// Combine all events
export const EVENTS = {
  ...CONNECTION_EVENTS,
  ...TAB_EVENTS,
  ...DOM_EVENTS,
  ...QUEUE_EVENTS,
  ...GENERATION_EVENTS,
  ...SYSTEM_EVENTS,
} as const;

// Type definitions
export type EventType = typeof EVENTS[keyof typeof EVENTS];
export type ConnectionEvent = typeof CONNECTION_EVENTS[keyof typeof CONNECTION_EVENTS];
export type TabEvent = typeof TAB_EVENTS[keyof typeof TAB_EVENTS];
export type DomEvent = typeof DOM_EVENTS[keyof typeof DOM_EVENTS];
export type QueueEvent = typeof QUEUE_EVENTS[keyof typeof QUEUE_EVENTS];
export type GenerationEvent = typeof GENERATION_EVENTS[keyof typeof GENERATION_EVENTS];
export type SystemEvent = typeof SYSTEM_EVENTS[keyof typeof SYSTEM_EVENTS];

// Event payload interfaces
export interface BaseEvent<T = EventType, P = any> {
  type: T;
  payload?: P;
  timestamp: number;
  source: 'extension' | 'content-script' | 'background' | 'websocket' | 'user';
  meta?: {
    correlationId?: string;
    retry?: number;
    [key: string]: any;
  };
}

export interface WebSocketMessagePayload {
  data: any;
  messageType: string;
}

export interface TabStatePayload {
  tabId: number;
  url: string;
  state: 'idle' | 'ready' | 'busy' | 'error';
  details?: any;
}

export interface DomChangePayload {
  selector: string;
  changeType: 'added' | 'removed' | 'modified' | 'text';
  element?: {
    id?: string;
    className?: string;
    tagName?: string;
    textContent?: string;
  };
}

export interface PromptPayload {
  id: string;
  text: string;
  priority?: number;
  retryCount?: number;
  timestamp?: number;
}

export interface GenerationPayload {
  id: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    images?: string[];
    error?: string;
  };
}