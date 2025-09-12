/**
 * ChatGPT Tab Reducer
 * Manages ChatGPT tab state based on events
 */

import * as EventTypes from '../events/eventTypes';

export interface ChatGPTTabState {
  tabId: number | null;
  url: string | null;
  isReady: boolean;
  isBusy: boolean;
  lastActivity: number | null;
  domElements: {
    textarea: string | null;
    submitButton: string | null;
    responseContainer: string | null;
  };
}

const initialState: ChatGPTTabState = {
  tabId: null,
  url: null,
  isReady: false,
  isBusy: false,
  lastActivity: null,
  domElements: {
    textarea: null,
    submitButton: null,
    responseContainer: null
  }
};

export const chatGPTTabReducer = (
  state = initialState,
  action: any
): ChatGPTTabState => {
  switch (action.type) {
    case EventTypes.CHATGPT_TAB_FOUND:
      return {
        ...state,
        tabId: action.payload.tabId,
        url: action.payload.url,
        lastActivity: action.payload.timestamp
      };

    case EventTypes.CHATGPT_TAB_LOST:
      return {
        ...initialState
      };

    case EventTypes.CHATGPT_TAB_READY:
      return {
        ...state,
        isReady: true,
        isBusy: false,
        lastActivity: action.payload.timestamp
      };

    case EventTypes.CHATGPT_TAB_BUSY:
      return {
        ...state,
        isReady: false,
        isBusy: true,
        lastActivity: action.payload.timestamp
      };

    case EventTypes.TAB_STATE_CHANGED:
      if (action.payload.tabId !== state.tabId) {
        return state;
      }
      return {
        ...state,
        isReady: action.payload.state === 'ready',
        isBusy: action.payload.state === 'busy',
        lastActivity: action.payload.timestamp
      };

    case EventTypes.TEXTAREA_DETECTED:
      return {
        ...state,
        domElements: {
          ...state.domElements,
          textarea: action.payload.selector
        }
      };

    case EventTypes.BUTTON_DETECTED:
      if (action.payload.label?.toLowerCase().includes('submit') ||
          action.payload.label?.toLowerCase().includes('send')) {
        return {
          ...state,
          domElements: {
            ...state.domElements,
            submitButton: action.payload.selector
          }
        };
      }
      return state;

    case EventTypes.RESPONSE_CONTAINER_DETECTED:
      return {
        ...state,
        domElements: {
          ...state.domElements,
          responseContainer: action.payload.selector
        }
      };

    default:
      return state;
  }
};