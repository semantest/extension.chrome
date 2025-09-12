/**
 * Tab Reducer
 * Manages ChatGPT tab state through events
 */

import { createReducer } from '@reduxjs/toolkit';
import { ChatGPTTabState } from '../state/app-state';
import { EVENTS } from '../events/event-types';
import { BaseEvent, TabStatePayload } from '../events/event-types';

const initialState: ChatGPTTabState = {
  tabId: null,
  url: null,
  status: 'inactive',
  isActive: false,
  elements: {
    inputDetected: false,
    buttonDetected: false,
    responseDetected: false,
  },
};

export const tabReducer = createReducer(initialState, (builder) => {
  builder
    .addCase(EVENTS.TAB_ACTIVATED, (state, action: BaseEvent) => {
      state.tabId = action.payload?.tabId || null;
      state.url = action.payload?.url || null;
      state.isActive = true;
      state.status = 'loading';
    })
    .addCase(EVENTS.TAB_DEACTIVATED, (state) => {
      state.isActive = false;
      state.status = 'inactive';
    })
    .addCase(EVENTS.TAB_STATE_CHANGED, (state, action: BaseEvent<any, TabStatePayload>) => {
      if (action.payload) {
        state.tabId = action.payload.tabId;
        state.url = action.payload.url;
        state.status = action.payload.state;
        if (action.payload.details) {
          Object.assign(state, action.payload.details);
        }
      }
    })
    .addCase(EVENTS.TAB_URL_CHANGED, (state, action: BaseEvent) => {
      state.url = action.payload?.url || null;
      state.status = 'loading';
    })
    .addCase(EVENTS.TAB_READY, (state, action: BaseEvent) => {
      state.status = 'ready';
      state.tabId = action.payload?.tabId || state.tabId;
    })
    .addCase(EVENTS.TAB_LOADING, (state) => {
      state.status = 'loading';
    })
    .addCase(EVENTS.TAB_ERROR, (state, action: BaseEvent) => {
      state.status = 'error';
    })
    .addCase(EVENTS.INPUT_DETECTED, (state, action: BaseEvent) => {
      state.elements.inputDetected = action.payload?.ready || false;
    })
    .addCase(EVENTS.BUTTON_DETECTED, (state, action: BaseEvent) => {
      state.elements.buttonDetected = action.payload?.enabled || false;
    })
    .addCase(EVENTS.RESPONSE_DETECTED, (state, action: BaseEvent) => {
      state.elements.responseDetected = action.payload?.complete || false;
    })
    .addCase(EVENTS.CHAT_READY, (state) => {
      state.status = 'ready';
      state.elements = {
        inputDetected: true,
        buttonDetected: true,
        responseDetected: false,
      };
    })
    .addCase(EVENTS.CHAT_BUSY, (state) => {
      state.status = 'busy';
    });
});