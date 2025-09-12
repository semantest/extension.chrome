/**
 * Current Generation Reducer
 * Tracks the current image/prompt generation state
 */

import * as EventTypes from '../events/eventTypes';

export interface CurrentGenerationState {
  type: 'prompt' | 'image' | null;
  correlationId: string | null;
  prompt: string | null;
  status: 'idle' | 'requesting' | 'processing' | 'completed' | 'failed';
  startedAt: number | null;
  completedAt: number | null;
  result: {
    response?: string;
    imageUrl?: string;
    error?: string;
  } | null;
}

const initialState: CurrentGenerationState = {
  type: null,
  correlationId: null,
  prompt: null,
  status: 'idle',
  startedAt: null,
  completedAt: null,
  result: null
};

export const currentGenerationReducer = (
  state = initialState,
  action: any
): CurrentGenerationState => {
  switch (action.type) {
    case EventTypes.PROMPT_SUBMITTED:
      return {
        type: 'prompt',
        correlationId: action.payload.correlationId,
        prompt: action.payload.prompt,
        status: 'requesting',
        startedAt: action.payload.timestamp,
        completedAt: null,
        result: null
      };

    case EventTypes.IMAGE_GENERATION_REQUESTED:
      return {
        type: 'image',
        correlationId: action.payload.correlationId,
        prompt: action.payload.prompt,
        status: 'requesting',
        startedAt: action.payload.timestamp,
        completedAt: null,
        result: null
      };

    case EventTypes.PROMPT_PROCESSING:
    case EventTypes.IMAGE_GENERATION_STARTED:
      if (action.payload.correlationId !== state.correlationId) {
        return state;
      }
      return {
        ...state,
        status: 'processing'
      };

    case EventTypes.PROMPT_COMPLETED:
      if (action.payload.correlationId !== state.correlationId) {
        return state;
      }
      return {
        ...state,
        status: 'completed',
        completedAt: action.payload.timestamp,
        result: {
          response: action.payload.response
        }
      };

    case EventTypes.IMAGE_GENERATION_COMPLETED:
    case EventTypes.IMAGE_READY:
      if (action.payload.correlationId !== state.correlationId) {
        return state;
      }
      return {
        ...state,
        status: 'completed',
        completedAt: action.payload.timestamp,
        result: {
          imageUrl: action.payload.imageUrl
        }
      };

    case EventTypes.PROMPT_FAILED:
    case EventTypes.IMAGE_GENERATION_FAILED:
      if (action.payload.correlationId !== state.correlationId) {
        return state;
      }
      return {
        ...state,
        status: 'failed',
        completedAt: action.payload.timestamp,
        result: {
          error: action.payload.error
        }
      };

    case EventTypes.PROMPT_RESPONSE_RECEIVED:
      if (action.payload.correlationId !== state.correlationId) {
        return state;
      }
      return {
        ...state,
        result: {
          ...state.result,
          response: action.payload.response
        }
      };

    default:
      return state;
  }
};