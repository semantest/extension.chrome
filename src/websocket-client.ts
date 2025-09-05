/**
 * @fileoverview WebSocket client for Chrome extension
 * @author Wences
 * @description Robust WebSocket client with auto-reconnect and message queueing
 */

import { EventEmitter } from 'events';

/**
 * WebSocket connection states
 */
export enum WebSocketState {
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTING = 'disconnecting',
  CLOSED = 'closed',
  ERROR = 'error'
}

/**
 * Configuration options for WebSocket client
 */
export interface WebSocketConfig {
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelay?: number;
  heartbeatInterval?: number;
}

/**
 * Message structure
 */
export interface WSMessage {
  type: string;
  [key: string]: any;
}

/**
 * WebSocket client with auto-reconnect and message queueing
 */
export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private state: WebSocketState = WebSocketState.CLOSED;
  private config: Required<WebSocketConfig>;
  private reconnectAttempts = 0;
  private messageQueue: WSMessage[] = [];
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;

  constructor(url: string, config: WebSocketConfig = {}) {
    super();
    this.url = url;
    this.config = {
      autoReconnect: config.autoReconnect ?? false,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      heartbeatInterval: config.heartbeatInterval ?? 30000
    };
  }

  /**
   * Connect to WebSocket server
   */
  public async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.state === WebSocketState.CONNECTED) {
        resolve();
        return;
      }

      this.state = WebSocketState.CONNECTING;

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('✅ Connected to WebSocket server');
          this.state = WebSocketState.CONNECTED;
          this.reconnectAttempts = 0;
          this.emit('connect');
          
          // Process queued messages
          this.flushMessageQueue();
          
          resolve();
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.state = WebSocketState.ERROR;
          this.emit('error', error);
          
          if (this.reconnectAttempts === 0) {
            reject(new Error('Connection failed'));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onclose = () => {
          console.log('🔌 WebSocket disconnected');
          this.state = WebSocketState.CLOSED;
          this.emit('disconnect');
          
          if (this.config.autoReconnect) {
            this.handleReconnect();
          }
        };

      } catch (error) {
        this.state = WebSocketState.ERROR;
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  public disconnect(): void {
    this.state = WebSocketState.DISCONNECTING;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.state = WebSocketState.CLOSED;
    this.cleanup();
  }

  /**
   * Send message to server
   */
  public send(message: WSMessage): void {
    if (this.state === WebSocketState.CONNECTED && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      // Queue message if not connected
      this.messageQueue.push(message);
      console.log(`📋 Message queued (${this.messageQueue.length} in queue)`);
    }
  }

  /**
   * Get current connection state
   */
  public getState(): WebSocketState {
    return this.state;
  }

  /**
   * Get queue size
   */
  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  /**
   * Notify server of ChatGPT state change
   */
  public notifyChatGPTState(state: string): void {
    this.send({
      type: 'chatgpt_state_change',
      state,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Start heartbeat to keep connection alive
   */
  public startHeartbeat(interval?: number): void {
    const heartbeatInterval = interval || this.config.heartbeatInterval;
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.heartbeatTimer = setInterval(() => {
      if (this.state === WebSocketState.CONNECTED) {
        this.send({ type: 'ping' });
      }
    }, heartbeatInterval);
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as WSMessage;
      
      // Emit general message event
      this.emit('message', message);
      
      // Handle specific message types
      switch (message.type) {
        case 'pong':
          // Heartbeat response
          break;
          
        case 'chatgpt_command':
          this.emit('chatgpt_command', {
            action: message.action,
            prompt: message.prompt
          });
          break;
          
        default:
          // Emit typed events
          this.emit(message.type, message);
      }
      
    } catch (error) {
      console.error('Failed to parse message:', error);
      this.emit('error', { message: 'Invalid message format' });
    }
  }

  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      this.emit('max_reconnect_failed');
      return;
    }

    const delay = Math.pow(2, this.reconnectAttempts) * this.config.reconnectDelay;
    
    console.log(`🔄 Attempting reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts++;
      try {
        await this.connect();
      } catch (error) {
        // Connection will retry automatically if autoReconnect is enabled
      }
    }, delay);
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message);
      }
    }
  }

  /**
   * Cleanup resources
   */
  private cleanup(): void {
    this.removeAllListeners();
    this.messageQueue = [];
  }
}

// Export for Chrome extension usage
if (typeof chrome !== 'undefined' && chrome.runtime) {
  (window as any).WebSocketClient = WebSocketClient;
}