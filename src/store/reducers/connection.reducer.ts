/**
 * Connection Reducer
 * Handles all WebSocket connection state changes via events
 */

import { createReducer } from '@reduxjs/toolkit';
import { ConnectionState } from '../state/app-state';
import { EVENTS } from '../events/event-types';
import { BaseEvent } from '../events/event-types';

const initialState: ConnectionState = {
  status: 'disconnected',
  url: null,
  error: null,
  reconnectAttempts: 0,
  lastConnectedAt: null,
  lastDisconnectedAt: null,
};

export const connectionReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(EVENTS.WEBSOCKET_CONNECTING, (state) => {
      state.status = 'connecting';
      state.error = null;
    })
    .addCase(EVENTS.WEBSOCKET_CONNECTED, (state, action: BaseEvent) => {
      state.status = 'connected';
      state.url = action.payload?.url || null;
      state.error = null;
      state.reconnectAttempts = 0;
      state.lastConnectedAt = action.timestamp;
    })
    .addCase(EVENTS.WEBSOCKET_DISCONNECTED, (state, action: BaseEvent) => {
      state.status = 'disconnected';
      state.lastDisconnectedAt = action.timestamp;
      if (action.payload?.reason) {
        state.error = action.payload.reason;
      }
    })
    .addCase(EVENTS.WEBSOCKET_ERROR, (state, action: BaseEvent) => {
      state.status = 'error';
      state.error = action.payload?.error || 'Unknown error';
    })
    .addCase(EVENTS.WEBSOCKET_RECONNECTING, (state, action: BaseEvent) => {
      state.status = 'reconnecting';
      state.reconnectAttempts = action.payload?.attempt || state.reconnectAttempts + 1;
    });
});