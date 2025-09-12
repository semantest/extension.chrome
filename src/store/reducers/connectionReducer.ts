/**
 * Connection Reducer
 * Handles WebSocket connection state based on events
 */

import * as EventTypes from '../events/eventTypes';

export interface ConnectionState {
  isConnected: boolean;
  url: string | null;
  reconnectAttempts: number;
  lastError: string | null;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  messagesSent: number;
  messagesReceived: number;
}

const initialState: ConnectionState = {
  isConnected: false,
  url: null,
  reconnectAttempts: 0,
  lastError: null,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
  messagesSent: 0,
  messagesReceived: 0
};

export const connectionReducer = (
  state = initialState,
  action: any
): ConnectionState => {
  switch (action.type) {
    case EventTypes.WEBSOCKET_CONNECTED:
      return {
        ...state,
        isConnected: true,
        url: action.payload.url,
        lastConnectedAt: action.payload.timestamp,
        reconnectAttempts: 0,
        lastError: null
      };

    case EventTypes.WEBSOCKET_DISCONNECTED:
      return {
        ...state,
        isConnected: false,
        lastDisconnectedAt: action.payload.timestamp,
        lastError: action.payload.reason || null
      };

    case EventTypes.WEBSOCKET_ERROR:
      return {
        ...state,
        lastError: action.payload.error
      };

    case EventTypes.WEBSOCKET_RECONNECTING:
      return {
        ...state,
        reconnectAttempts: action.payload.attempt
      };

    case EventTypes.WEBSOCKET_MESSAGE_SENT:
      return {
        ...state,
        messagesSent: state.messagesSent + 1
      };

    case EventTypes.WEBSOCKET_MESSAGE_RECEIVED:
      return {
        ...state,
        messagesReceived: state.messagesReceived + 1
      };

    default:
      return state;
  }
};