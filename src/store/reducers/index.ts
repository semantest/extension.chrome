/**
 * Root Reducer
 * Combines all reducers into a single state tree
 */

import { combineReducers } from 'redux';
import { connectionReducer, ConnectionState } from './connectionReducer';
import { chatGPTTabReducer, ChatGPTTabState } from './chatGPTTabReducer';
import { queueReducer, QueueState } from './queueReducer';
import { currentGenerationReducer, CurrentGenerationState } from './currentGenerationReducer';

export interface RootState {
  connection: ConnectionState;
  chatGPTTab: ChatGPTTabState;
  queue: QueueState;
  currentGeneration: CurrentGenerationState;
}

export const rootReducer = combineReducers({
  connection: connectionReducer,
  chatGPTTab: chatGPTTabReducer,
  queue: queueReducer,
  currentGeneration: currentGenerationReducer
});

export type AppState = ReturnType<typeof rootReducer>;