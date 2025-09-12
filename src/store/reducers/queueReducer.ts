/**
 * Queue Reducer
 * Manages prompt queue state based on events
 */

import * as EventTypes from '../events/eventTypes';

export interface QueueItem {
  id: string;
  correlationId: string;
  prompt: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  timestamp: number;
  response?: string;
  error?: string;
}

export interface QueueState {
  items: QueueItem[];
  isProcessing: boolean;
  currentItem: string | null; // correlationId of current item
  completedCount: number;
  failedCount: number;
}

const initialState: QueueState = {
  items: [],
  isProcessing: false,
  currentItem: null,
  completedCount: 0,
  failedCount: 0
};

export const queueReducer = (
  state = initialState,
  action: any
): QueueState => {
  switch (action.type) {
    case EventTypes.PROMPT_QUEUED:
      return {
        ...state,
        items: [
          ...state.items,
          {
            id: `queue_${Date.now()}_${Math.random()}`,
            correlationId: action.payload.correlationId,
            prompt: action.payload.prompt,
            status: 'pending',
            timestamp: action.payload.timestamp
          }
        ]
      };

    case EventTypes.QUEUE_ITEM_ADDED:
      return {
        ...state,
        items: [...state.items, action.payload.item]
      };

    case EventTypes.QUEUE_ITEM_REMOVED:
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload.itemId)
      };

    case EventTypes.QUEUE_PROCESSING_STARTED:
      return {
        ...state,
        isProcessing: true
      };

    case EventTypes.QUEUE_PROCESSING_STOPPED:
      return {
        ...state,
        isProcessing: false,
        currentItem: null
      };

    case EventTypes.PROMPT_PROCESSING:
      return {
        ...state,
        currentItem: action.payload.correlationId,
        items: state.items.map(item =>
          item.correlationId === action.payload.correlationId
            ? { ...item, status: 'processing' }
            : item
        )
      };

    case EventTypes.PROMPT_COMPLETED:
      return {
        ...state,
        completedCount: state.completedCount + 1,
        currentItem: null,
        items: state.items.map(item =>
          item.correlationId === action.payload.correlationId
            ? { 
                ...item, 
                status: 'completed',
                response: action.payload.response
              }
            : item
        )
      };

    case EventTypes.PROMPT_FAILED:
      return {
        ...state,
        failedCount: state.failedCount + 1,
        currentItem: null,
        items: state.items.map(item =>
          item.correlationId === action.payload.correlationId
            ? { 
                ...item, 
                status: 'failed',
                error: action.payload.error
              }
            : item
        )
      };

    case EventTypes.QUEUE_CLEARED:
      return {
        ...state,
        items: [],
        currentItem: null,
        isProcessing: false
      };

    default:
      return state;
  }
};