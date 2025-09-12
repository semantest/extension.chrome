/**
 * Redux Store Configuration
 * Central state management with event-driven architecture
 */

import { configureStore } from '@reduxjs/toolkit';
import { rootReducer } from './reducers';
import { createWebSocketMiddleware, defaultWebSocketConfig } from './middleware/websocketMiddleware';

// Create WebSocket middleware instance
const websocketMiddleware = createWebSocketMiddleware(defaultWebSocketConfig);

// Configure the Redux store
export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types for serialization checks
        ignoredActions: [
          'WEBSOCKET_MESSAGE_RECEIVED',
          'WEBSOCKET_MESSAGE_SENT',
          'DOM_CHANGED'
        ],
        // Ignore these paths in the state
        ignoredPaths: ['connection.socket']
      }
    }).concat(websocketMiddleware),
  devTools: process.env.NODE_ENV !== 'production'
});

// Export types
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Export all event actions for easy access
export * from './events/eventActions';
export * from './events/eventTypes';