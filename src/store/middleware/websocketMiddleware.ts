/**
 * WebSocket Event Bridge Middleware
 * Bridges Redux events with WebSocket communication
 */

import { Middleware } from 'redux';
import * as EventActions from '../events/eventActions';
import * as EventTypes from '../events/eventTypes';

interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnectAttempts: number;
}

export const createWebSocketMiddleware = (config: WebSocketConfig): Middleware => {
  let socket: WebSocket | null = null;
  let reconnectAttempts = 0;
  let reconnectTimeout: NodeJS.Timeout | null = null;

  return store => next => action => {
    // Pass the action through first
    const result = next(action);

    // Handle WebSocket-related events
    switch (action.type) {
      case 'WEBSOCKET_CONNECT':
        connectWebSocket();
        break;

      case 'WEBSOCKET_DISCONNECT':
        disconnectWebSocket();
        break;

      case 'WEBSOCKET_SEND':
        sendMessage(action.payload);
        break;

      // Bridge outgoing events to WebSocket
      case EventTypes.PROMPT_SUBMITTED:
      case EventTypes.IMAGE_GENERATION_REQUESTED:
      case EventTypes.PATTERN_DETECTED:
      case EventTypes.DOM_CHANGED:
        // Send these events to the server
        if (socket && socket.readyState === WebSocket.OPEN) {
          const message = {
            type: 'EVENT',
            eventType: action.type,
            payload: action.payload,
            timestamp: Date.now()
          };
          socket.send(JSON.stringify(message));
          store.dispatch(EventActions.websocketMessageSent(message));
        }
        break;
    }

    function connectWebSocket() {
      if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('WebSocket already connected');
        return;
      }

      try {
        socket = new WebSocket(config.url);

        socket.onopen = () => {
          console.log('WebSocket connected');
          reconnectAttempts = 0;
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
          }
          store.dispatch(EventActions.websocketConnected(config.url));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            // Dispatch received message event
            store.dispatch(EventActions.websocketMessageReceived(message));

            // Convert server messages to Redux events
            handleServerMessage(message);
          } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            store.dispatch(EventActions.errorOccurred(
              'Failed to parse WebSocket message',
              { error: error.message }
            ));
          }
        };

        socket.onerror = (error) => {
          console.error('WebSocket error:', error);
          store.dispatch(EventActions.websocketError('WebSocket connection error'));
        };

        socket.onclose = (event) => {
          console.log('WebSocket disconnected:', event.reason);
          store.dispatch(EventActions.websocketDisconnected(event.reason));
          
          // Attempt reconnection
          attemptReconnect();
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        store.dispatch(EventActions.websocketError(error.message));
        attemptReconnect();
      }
    }

    function disconnectWebSocket() {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      if (socket) {
        socket.close();
        socket = null;
      }
    }

    function sendMessage(message: any) {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
        store.dispatch(EventActions.websocketMessageSent(message));
      } else {
        console.error('WebSocket not connected');
        store.dispatch(EventActions.errorOccurred(
          'Cannot send message: WebSocket not connected',
          { message }
        ));
      }
    }

    function attemptReconnect() {
      if (reconnectAttempts >= config.maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        store.dispatch(EventActions.errorOccurred(
          'WebSocket reconnection failed after maximum attempts',
          { attempts: reconnectAttempts }
        ));
        return;
      }

      reconnectAttempts++;
      store.dispatch(EventActions.websocketReconnecting(reconnectAttempts));

      reconnectTimeout = setTimeout(() => {
        console.log(`Attempting reconnection (${reconnectAttempts}/${config.maxReconnectAttempts})`);
        connectWebSocket();
      }, config.reconnectInterval * Math.pow(2, reconnectAttempts - 1)); // Exponential backoff
    }

    function handleServerMessage(message: any) {
      // Convert server messages to appropriate Redux events
      switch (message.type) {
        case 'PROMPT_RESPONSE':
          store.dispatch(EventActions.promptResponseReceived(
            message.correlationId,
            message.response
          ));
          store.dispatch(EventActions.promptCompleted(
            message.correlationId,
            message.response
          ));
          break;

        case 'IMAGE_READY':
          store.dispatch(EventActions.imageReady(
            message.imageUrl,
            message.correlationId
          ));
          break;

        case 'ERROR':
          store.dispatch(EventActions.errorOccurred(
            message.error,
            message.context
          ));
          break;

        case 'TAB_STATE_UPDATE':
          store.dispatch(EventActions.tabStateChanged(
            message.tabId,
            message.state
          ));
          break;

        case 'PATTERN_SUGGESTION':
          store.dispatch(EventActions.patternDetected(
            message.pattern,
            message.confidence
          ));
          break;

        case 'HEALTH_CHECK':
          store.dispatch(EventActions.healthCheckPerformed(message.status));
          break;

        default:
          console.log('Unknown message type from server:', message.type);
      }
    }

    return result;
  };
};

// Default WebSocket configuration
export const defaultWebSocketConfig: WebSocketConfig = {
  url: 'ws://localhost:8081',
  reconnectInterval: 1000, // Start with 1 second
  maxReconnectAttempts: 10
};