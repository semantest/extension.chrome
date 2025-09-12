/**
 * Application State Shape
 * Event-driven state management with Redux
 */

export interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
  url: string | null;
  error: string | null;
  reconnectAttempts: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

export interface ChatGPTTabState {
  tabId: number | null;
  url: string | null;
  status: 'inactive' | 'loading' | 'ready' | 'busy' | 'error';
  isActive: boolean;
  elements: {
    inputDetected: boolean;
    buttonDetected: boolean;
    responseDetected: boolean;
  };
}

export interface QueueItem {
  id: string;
  text: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: number;
  processedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount: number;
}

export interface QueueState {
  items: QueueItem[];
  isPaused: boolean;
  currentProcessing: string | null;
  processedCount: number;
  failedCount: number;
}

export interface GenerationState {
  currentGeneration: {
    id: string | null;
    prompt: string | null;
    status: 'idle' | 'requesting' | 'processing' | 'completed' | 'failed';
    progress: number;
    images: string[];
    error: string | null;
  };
  history: Array<{
    id: string;
    prompt: string;
    images: string[];
    timestamp: number;
  }>;
}

export interface SystemState {
  initialized: boolean;
  version: string;
  permissions: {
    tabs: boolean;
    storage: boolean;
    downloads: boolean;
  };
  settings: {
    autoReconnect: boolean;
    reconnectDelay: number;
    maxReconnectAttempts: number;
    queueProcessingDelay: number;
    debugMode: boolean;
  };
  errors: Array<{
    timestamp: number;
    message: string;
    details?: any;
  }>;
}

export interface AppState {
  connection: ConnectionState;
  chatGPTTab: ChatGPTTabState;
  queue: QueueState;
  generation: GenerationState;
  system: SystemState;
}

// Initial state
export const initialAppState: AppState = {
  connection: {
    status: 'disconnected',
    url: null,
    error: null,
    reconnectAttempts: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  },
  chatGPTTab: {
    tabId: null,
    url: null,
    status: 'inactive',
    isActive: false,
    elements: {
      inputDetected: false,
      buttonDetected: false,
      responseDetected: false,
    },
  },
  queue: {
    items: [],
    isPaused: false,
    currentProcessing: null,
    processedCount: 0,
    failedCount: 0,
  },
  generation: {
    currentGeneration: {
      id: null,
      prompt: null,
      status: 'idle',
      progress: 0,
      images: [],
      error: null,
    },
    history: [],
  },
  system: {
    initialized: false,
    version: '2.0.0',
    permissions: {
      tabs: false,
      storage: false,
      downloads: false,
    },
    settings: {
      autoReconnect: true,
      reconnectDelay: 1000,
      maxReconnectAttempts: 5,
      queueProcessingDelay: 500,
      debugMode: false,
    },
    errors: [],
  },
};