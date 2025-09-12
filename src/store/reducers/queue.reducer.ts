/**
 * Queue Reducer
 * Manages prompt queue state through events
 */

import { createReducer } from '@reduxjs/toolkit';
import { QueueState, QueueItem } from '../state/app-state';
import { EVENTS } from '../events/event-types';
import { BaseEvent, PromptPayload } from '../events/event-types';

const initialState: QueueState = {
  items: [],
  isPaused: false,
  currentProcessing: null,
  processedCount: 0,
  failedCount: 0,
};

export const queueReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(EVENTS.PROMPT_QUEUED, (state, action: BaseEvent<any, PromptPayload>) => {
      if (action.payload) {
        const item: QueueItem = {
          id: action.payload.id,
          text: action.payload.text,
          priority: action.payload.priority || 0,
          status: 'pending',
          createdAt: action.timestamp,
          retryCount: action.payload.retryCount || 0,
        };
        
        // Insert based on priority
        const insertIndex = state.items.findIndex(i => i.priority < item.priority);
        if (insertIndex === -1) {
          state.items.push(item);
        } else {
          state.items.splice(insertIndex, 0, item);
        }
      }
    })
    .addCase(EVENTS.PROMPT_PROCESSING, (state, action: BaseEvent) => {
      const id = action.payload?.id;
      if (id) {
        state.currentProcessing = id;
        const item = state.items.find(i => i.id === id);
        if (item) {
          item.status = 'processing';
          item.processedAt = action.timestamp;
        }
      }
    })
    .addCase(EVENTS.PROMPT_SUBMITTED, (state, action: BaseEvent) => {
      const id = action.payload?.id;
      if (id) {
        const item = state.items.find(i => i.id === id);
        if (item) {
          item.status = 'processing';
        }
      }
    })
    .addCase(EVENTS.PROMPT_COMPLETED, (state, action: BaseEvent) => {
      const id = action.payload?.id;
      if (id) {
        const itemIndex = state.items.findIndex(i => i.id === id);
        if (itemIndex !== -1) {
          const item = state.items[itemIndex];
          item.status = 'completed';
          item.completedAt = action.timestamp;
          
          // Remove from queue after completion
          state.items.splice(itemIndex, 1);
          state.processedCount++;
          
          if (state.currentProcessing === id) {
            state.currentProcessing = null;
          }
        }
      }
    })
    .addCase(EVENTS.PROMPT_FAILED, (state, action: BaseEvent) => {
      const id = action.payload?.id;
      if (id) {
        const item = state.items.find(i => i.id === id);
        if (item) {
          item.status = 'failed';
          item.error = action.payload?.error;
          item.retryCount++;
          
          // Move to end of queue for retry
          const index = state.items.indexOf(item);
          state.items.splice(index, 1);
          
          if (item.retryCount < 3) {
            item.status = 'pending';
            state.items.push(item);
          } else {
            state.failedCount++;
          }
          
          if (state.currentProcessing === id) {
            state.currentProcessing = null;
          }
        }
      }
    })
    .addCase(EVENTS.QUEUE_CLEARED, (state) => {
      state.items = [];
      state.currentProcessing = null;
    })
    .addCase(EVENTS.QUEUE_PAUSED, (state) => {
      state.isPaused = true;
    })
    .addCase(EVENTS.QUEUE_RESUMED, (state) => {
      state.isPaused = false;
    });
});