/**
 * Unit Tests for Message Store
 * Tests Redux-like message store for time-traveling debugging functionality
 */
import { messageStoreActions, messageStoreReducer, messageStoreSelectors, MessageStore, MESSAGE_STORE_ACTIONS } from './message-store';
// Mock Chrome APIs
const mockChrome = {
    storage: {
        local: {
            get: jest.fn(),
            set: jest.fn()
        }
    }
};
global.chrome = mockChrome;
describe('Message Store', () => {
    const mockMetadata = {
        extensionId: 'test-extension-id',
        tabId: 123,
        windowId: 456,
        url: 'https://example.com',
        userAgent: 'test-user-agent'
    };
    const mockMessage = {
        type: 'testMessage',
        payload: { data: 'test' },
        correlationId: 'test-correlation-id',
        direction: 'inbound',
        status: 'pending'
    };
    beforeEach(() => {
        jest.clearAllMocks();
        Date.now = jest.fn(() => 1234567890);
    });
    describe('Action Creators', () => {
        test('should create addMessage action', () => {
            const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.ADD_MESSAGE,
                payload: mockMessage,
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'test-correlation-id',
                    direction: 'inbound',
                    status: 'pending',
                    response: undefined,
                    error: undefined,
                    metadata: mockMetadata
                }
            });
        });
        test('should create updateMessageStatus action for success', () => {
            const response = { result: 'success' };
            const action = messageStoreActions.updateMessageStatus('test-id', 'success', response);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.UPDATE_MESSAGE_STATUS,
                payload: { correlationId: 'test-id', status: 'success', response, error: undefined },
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'test-id',
                    direction: 'outbound',
                    status: 'success',
                    response,
                    error: undefined,
                    metadata: {}
                }
            });
        });
        test('should create updateMessageStatus action for error', () => {
            const error = 'Something went wrong';
            const action = messageStoreActions.updateMessageStatus('test-id', 'error', undefined, error);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.UPDATE_MESSAGE_STATUS,
                payload: { correlationId: 'test-id', status: 'error', response: undefined, error },
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'test-id',
                    direction: 'outbound',
                    status: 'error',
                    response: undefined,
                    error,
                    metadata: {}
                }
            });
        });
        test('should create timeTravelTo action', () => {
            const action = messageStoreActions.timeTravelTo(5);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.TIME_TRAVEL_TO,
                payload: { index: 5 },
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'time-travel-1234567890',
                    direction: 'inbound',
                    status: 'success',
                    metadata: {}
                }
            });
        });
        test('should create resetTimeTravel action', () => {
            const action = messageStoreActions.resetTimeTravel();
            expect(action.type).toBe(MESSAGE_STORE_ACTIONS.RESET_TIME_TRAVEL);
            expect(action.payload).toEqual({});
        });
        test('should create setFilters action', () => {
            const filters = { types: ['testType'], statuses: ['success'] };
            const action = messageStoreActions.setFilters(filters);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.SET_FILTERS,
                payload: filters,
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'set-filters-1234567890',
                    direction: 'inbound',
                    status: 'success',
                    metadata: {}
                }
            });
        });
        test('should create clearMessages action', () => {
            const action = messageStoreActions.clearMessages();
            expect(action.type).toBe(MESSAGE_STORE_ACTIONS.CLEAR_MESSAGES);
            expect(action.payload).toEqual({});
        });
        test('should create loadPersistedMessages action', () => {
            const messages = [
                { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
            ];
            const action = messageStoreActions.loadPersistedMessages(messages);
            expect(action).toEqual({
                type: MESSAGE_STORE_ACTIONS.LOAD_PERSISTED_MESSAGES,
                payload: { messages },
                meta: {
                    timestamp: 1234567890,
                    correlationId: 'load-persisted-1234567890',
                    direction: 'inbound',
                    status: 'success',
                    metadata: {}
                }
            });
        });
    });
    describe('Reducer', () => {
        const initialState = {
            messages: [],
            currentIndex: -1,
            isTimeTraveling: false,
            filters: {
                types: [],
                statuses: [],
                directions: [],
                dateRange: null
            }
        };
        test('should return initial state', () => {
            const state = messageStoreReducer(undefined, { type: 'UNKNOWN', payload: {} });
            expect(state).toEqual(initialState);
        });
        test('should handle ADD_MESSAGE', () => {
            const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
            const state = messageStoreReducer(initialState, action);
            expect(state.messages).toHaveLength(1);
            expect(state.messages[0]).toEqual({
                ...mockMessage,
                timestamp: 1234567890,
                metadata: mockMetadata
            });
            expect(state.currentIndex).toBe(0);
        });
        test('should handle ADD_MESSAGE without advancing index during time travel', () => {
            const stateWithTimeTravel = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                ],
                currentIndex: 0,
                isTimeTraveling: true
            };
            const action = messageStoreActions.addMessage({ ...mockMessage, correlationId: 'new-message' }, mockMetadata);
            const state = messageStoreReducer(stateWithTimeTravel, action);
            expect(state.messages).toHaveLength(2);
            expect(state.currentIndex).toBe(0); // Should not advance during time travel
        });
        test('should handle UPDATE_MESSAGE_STATUS for existing message', () => {
            const initialStateWithMessage = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                ]
            };
            const action = messageStoreActions.updateMessageStatus('test-correlation-id', 'success', { result: 'ok' });
            const state = messageStoreReducer(initialStateWithMessage, action);
            expect(state.messages[0].status).toBe('success');
            expect(state.messages[0].response).toEqual({ result: 'ok' });
        });
        test('should handle UPDATE_MESSAGE_STATUS for non-existent message', () => {
            const action = messageStoreActions.updateMessageStatus('non-existent-id', 'success');
            const state = messageStoreReducer(initialState, action);
            expect(state).toEqual(initialState);
        });
        test('should handle TIME_TRAVEL_TO with valid index', () => {
            const stateWithMessages = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata },
                    { ...mockMessage, correlationId: 'msg-2', timestamp: 1234567891, metadata: mockMetadata }
                ],
                currentIndex: 1
            };
            const action = messageStoreActions.timeTravelTo(0);
            const state = messageStoreReducer(stateWithMessages, action);
            expect(state.currentIndex).toBe(0);
            expect(state.isTimeTraveling).toBe(true);
        });
        test('should handle TIME_TRAVEL_TO with invalid index', () => {
            const stateWithMessages = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                ],
                currentIndex: 0
            };
            const action = messageStoreActions.timeTravelTo(5);
            const state = messageStoreReducer(stateWithMessages, action);
            expect(state).toEqual(stateWithMessages); // Should not change
        });
        test('should handle RESET_TIME_TRAVEL', () => {
            const stateWithTimeTravel = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata },
                    { ...mockMessage, correlationId: 'msg-2', timestamp: 1234567891, metadata: mockMetadata }
                ],
                currentIndex: 0,
                isTimeTraveling: true
            };
            const action = messageStoreActions.resetTimeTravel();
            const state = messageStoreReducer(stateWithTimeTravel, action);
            expect(state.currentIndex).toBe(1); // Last message index
            expect(state.isTimeTraveling).toBe(false);
        });
        test('should handle SET_FILTERS', () => {
            const filters = { types: ['testType'], statuses: ['success'] };
            const action = messageStoreActions.setFilters(filters);
            const state = messageStoreReducer(initialState, action);
            expect(state.filters.types).toEqual(['testType']);
            expect(state.filters.statuses).toEqual(['success']);
            expect(state.filters.directions).toEqual([]); // Should preserve existing
        });
        test('should handle CLEAR_MESSAGES', () => {
            const stateWithMessages = {
                ...initialState,
                messages: [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                ],
                currentIndex: 0,
                isTimeTraveling: true
            };
            const action = messageStoreActions.clearMessages();
            const state = messageStoreReducer(stateWithMessages, action);
            expect(state.messages).toEqual([]);
            expect(state.currentIndex).toBe(-1);
            expect(state.isTimeTraveling).toBe(false);
        });
        test('should handle LOAD_PERSISTED_MESSAGES', () => {
            const messages = [
                { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata },
                { ...mockMessage, correlationId: 'msg-2', timestamp: 1234567891, metadata: mockMetadata }
            ];
            const action = messageStoreActions.loadPersistedMessages(messages);
            const state = messageStoreReducer(initialState, action);
            expect(state.messages).toEqual(messages);
            expect(state.currentIndex).toBe(1);
            expect(state.isTimeTraveling).toBe(false);
        });
    });
    describe('Selectors', () => {
        const stateWithMessages = {
            messages: [
                {
                    type: 'message1',
                    payload: { data: 'test1' },
                    correlationId: 'id-1',
                    direction: 'inbound',
                    status: 'success',
                    timestamp: 1000,
                    metadata: mockMetadata
                },
                {
                    type: 'message2',
                    payload: { data: 'test2' },
                    correlationId: 'id-2',
                    direction: 'outbound',
                    status: 'error',
                    error: 'Failed',
                    timestamp: 2000,
                    metadata: mockMetadata
                },
                {
                    type: 'message1',
                    payload: { data: 'test3' },
                    correlationId: 'id-3',
                    direction: 'inbound',
                    status: 'pending',
                    timestamp: 3000,
                    metadata: mockMetadata
                }
            ],
            currentIndex: 1,
            isTimeTraveling: true,
            filters: {
                types: ['message1'],
                statuses: ['success'],
                directions: ['inbound'],
                dateRange: { from: 500, to: 2500 }
            }
        };
        test('getAllMessages should return all messages', () => {
            const messages = messageStoreSelectors.getAllMessages(stateWithMessages);
            expect(messages).toHaveLength(3);
            expect(messages).toBe(stateWithMessages.messages);
        });
        test('getCurrentMessage should return message at current index', () => {
            const message = messageStoreSelectors.getCurrentMessage(stateWithMessages);
            expect(message).toEqual(stateWithMessages.messages[1]);
        });
        test('getCurrentMessage should return null for invalid index', () => {
            const state = { ...stateWithMessages, currentIndex: -1 };
            const message = messageStoreSelectors.getCurrentMessage(state);
            expect(message).toBeNull();
        });
        test('getFilteredMessages should apply all filters', () => {
            const filtered = messageStoreSelectors.getFilteredMessages(stateWithMessages);
            // Should match: type='message1', status='success', direction='inbound', timestamp in range
            expect(filtered).toHaveLength(1);
            expect(filtered[0].correlationId).toBe('id-1');
        });
        test('getFilteredMessages should return all when no filters applied', () => {
            const stateNoFilters = {
                ...stateWithMessages,
                filters: { types: [], statuses: [], directions: [], dateRange: null }
            };
            const filtered = messageStoreSelectors.getFilteredMessages(stateNoFilters);
            expect(filtered).toHaveLength(3);
        });
        test('getMessagesByType should filter by type', () => {
            const messages = messageStoreSelectors.getMessagesByType(stateWithMessages, 'message1');
            expect(messages).toHaveLength(2);
            expect(messages.every(msg => msg.type === 'message1')).toBe(true);
        });
        test('getMessagesByStatus should filter by status', () => {
            const messages = messageStoreSelectors.getMessagesByStatus(stateWithMessages, 'success');
            expect(messages).toHaveLength(1);
            expect(messages[0].status).toBe('success');
        });
        test('getMessageByCorrelationId should find message by ID', () => {
            const message = messageStoreSelectors.getMessageByCorrelationId(stateWithMessages, 'id-2');
            expect(message?.correlationId).toBe('id-2');
        });
        test('getMessageByCorrelationId should return undefined for non-existent ID', () => {
            const message = messageStoreSelectors.getMessageByCorrelationId(stateWithMessages, 'non-existent');
            expect(message).toBeUndefined();
        });
        test('isTimeTraveling should return time travel state', () => {
            expect(messageStoreSelectors.isTimeTraveling(stateWithMessages)).toBe(true);
        });
        test('getCurrentIndex should return current index', () => {
            expect(messageStoreSelectors.getCurrentIndex(stateWithMessages)).toBe(1);
        });
        test('getTotalMessageCount should return total count', () => {
            expect(messageStoreSelectors.getTotalMessageCount(stateWithMessages)).toBe(3);
        });
        test('getMessageStatistics should return comprehensive stats', () => {
            const stats = messageStoreSelectors.getMessageStatistics(stateWithMessages);
            expect(stats).toEqual({
                total: 3,
                success: 1,
                error: 1,
                pending: 1,
                inbound: 2,
                outbound: 1,
                typeBreakdown: {
                    message1: 2,
                    message2: 1
                }
            });
        });
    });
    describe('MessageStore Class', () => {
        let store;
        const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
        beforeEach(() => {
            jest.clearAllMocks();
            mockChrome.storage.local.get.mockResolvedValue({});
            mockChrome.storage.local.set.mockResolvedValue(undefined);
            store = new MessageStore();
        });
        afterEach(() => {
            consoleSpy.mockClear();
            consoleErrorSpy.mockClear();
        });
        afterAll(() => {
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
        describe('Initialization', () => {
            test('should initialize with empty state', () => {
                const state = store.getState();
                expect(state.messages).toEqual([]);
                expect(state.currentIndex).toBe(-1);
                expect(state.isTimeTraveling).toBe(false);
            });
            test('should load persisted state on construction', async () => {
                const persistedMessages = [
                    { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                ];
                mockChrome.storage.local.get.mockResolvedValue({
                    'web-buddy-message-store': {
                        messages: persistedMessages,
                        timestamp: Date.now(),
                        version: 1
                    }
                });
                const newStore = new MessageStore();
                // Wait for async loading
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(mockChrome.storage.local.get).toHaveBeenCalledWith('web-buddy-message-store');
            });
            test('should handle persistence loading errors', async () => {
                mockChrome.storage.local.get.mockRejectedValue(new Error('Storage error'));
                const newStore = new MessageStore();
                // Wait for async loading
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to load persisted message store:', expect.any(Error));
            });
        });
        describe('State Management', () => {
            test('should dispatch actions and update state', () => {
                const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
                store.dispatch(action);
                const state = store.getState();
                expect(state.messages).toHaveLength(1);
            });
            test('should notify listeners on state change', () => {
                const listener = jest.fn();
                store.subscribe(listener);
                const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
                store.dispatch(action);
                expect(listener).toHaveBeenCalledWith(store.getState());
            });
            test('should not notify listeners if state unchanged', () => {
                const listener = jest.fn();
                store.subscribe(listener);
                // Dispatch an action that doesn't change state
                store.dispatch({ type: 'UNKNOWN_ACTION', payload: {} });
                expect(listener).not.toHaveBeenCalled();
            });
            test('should return unsubscribe function', () => {
                const listener = jest.fn();
                const unsubscribe = store.subscribe(listener);
                unsubscribe();
                const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
                store.dispatch(action);
                expect(listener).not.toHaveBeenCalled();
            });
        });
        describe('Utility Methods', () => {
            test('should add inbound message', () => {
                store.addInboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
                const state = store.getState();
                expect(state.messages).toHaveLength(1);
                expect(state.messages[0].direction).toBe('inbound');
                expect(state.messages[0].status).toBe('pending');
            });
            test('should add outbound message', () => {
                store.addOutboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
                const state = store.getState();
                expect(state.messages).toHaveLength(1);
                expect(state.messages[0].direction).toBe('outbound');
                expect(state.messages[0].status).toBe('pending');
            });
            test('should mark message as success', () => {
                store.addInboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
                store.markMessageSuccess('test-id', { result: 'ok' });
                const state = store.getState();
                expect(state.messages[0].status).toBe('success');
                expect(state.messages[0].response).toEqual({ result: 'ok' });
            });
            test('should mark message as error', () => {
                store.addInboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
                store.markMessageError('test-id', 'Something went wrong');
                const state = store.getState();
                expect(state.messages[0].status).toBe('error');
                expect(state.messages[0].error).toBe('Something went wrong');
            });
            test('should clear all messages', () => {
                store.addInboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
                store.clearAllMessages();
                const state = store.getState();
                expect(state.messages).toEqual([]);
                expect(state.currentIndex).toBe(-1);
                expect(state.isTimeTraveling).toBe(false);
            });
        });
        describe('Time Travel', () => {
            beforeEach(() => {
                // Add some messages for time travel testing
                store.addInboundMessage('msg1', { data: '1' }, 'id-1', mockMetadata);
                store.addInboundMessage('msg2', { data: '2' }, 'id-2', mockMetadata);
                store.addInboundMessage('msg3', { data: '3' }, 'id-3', mockMetadata);
            });
            test('should time travel to specific index', () => {
                store.timeTravelTo(1);
                const state = store.getState();
                expect(state.currentIndex).toBe(1);
                expect(state.isTimeTraveling).toBe(true);
            });
            test('should reset time travel', () => {
                store.timeTravelTo(0);
                store.resetTimeTravel();
                const state = store.getState();
                expect(state.currentIndex).toBe(2); // Last message
                expect(state.isTimeTraveling).toBe(false);
            });
            test('should check if can travel back', () => {
                store.timeTravelTo(1);
                expect(store.canTimeTravelBack()).toBe(true);
                store.timeTravelTo(0);
                expect(store.canTimeTravelBack()).toBe(false);
            });
            test('should check if can travel forward', () => {
                store.timeTravelTo(1);
                expect(store.canTimeTravelForward()).toBe(true);
                store.timeTravelTo(2);
                expect(store.canTimeTravelForward()).toBe(false);
            });
            test('should travel back one step', () => {
                store.timeTravelTo(2);
                store.timeTravelBack();
                expect(store.getState().currentIndex).toBe(1);
            });
            test('should travel forward one step', () => {
                store.timeTravelTo(0);
                store.timeTravelForward();
                expect(store.getState().currentIndex).toBe(1);
            });
            test('should not travel back if at beginning', () => {
                store.timeTravelTo(0);
                store.timeTravelBack();
                expect(store.getState().currentIndex).toBe(0);
            });
            test('should not travel forward if at end', () => {
                store.timeTravelTo(2);
                store.timeTravelForward();
                expect(store.getState().currentIndex).toBe(2);
            });
        });
        describe('Export/Import', () => {
            beforeEach(() => {
                store.addInboundMessage('testType', { data: 'test' }, 'test-id', mockMetadata);
            });
            test('should export messages as JSON', () => {
                const exported = store.exportMessages();
                const data = JSON.parse(exported);
                expect(data.messages).toHaveLength(1);
                expect(data.messages[0].type).toBe('testType');
                expect(data.exportedAt).toBeDefined();
                expect(data.version).toBe(1);
            });
            test('should import messages from JSON', () => {
                const exportData = {
                    messages: [
                        { ...mockMessage, timestamp: 1234567890, metadata: mockMetadata }
                    ],
                    exportedAt: new Date().toISOString(),
                    version: 1
                };
                const result = store.importMessages(JSON.stringify(exportData));
                expect(result).toBe(true);
                expect(store.getState().messages).toHaveLength(1);
            });
            test('should handle invalid import data', () => {
                const result = store.importMessages('invalid json');
                expect(result).toBe(false);
                expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to import messages:', expect.any(Error));
            });
            test('should handle import data without messages', () => {
                const result = store.importMessages('{"invalid": true}');
                expect(result).toBe(false);
            });
        });
        describe('Persistence', () => {
            test('should persist state after dispatch', async () => {
                const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
                store.dispatch(action);
                // Wait for async persistence
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
                    'web-buddy-message-store': expect.objectContaining({
                        messages: expect.any(Array),
                        timestamp: expect.any(Number),
                        version: 1
                    })
                });
            });
            test('should handle persistence errors', async () => {
                mockChrome.storage.local.set.mockRejectedValue(new Error('Storage full'));
                const action = messageStoreActions.addMessage(mockMessage, mockMetadata);
                store.dispatch(action);
                // Wait for async persistence
                await new Promise(resolve => setTimeout(resolve, 10));
                expect(consoleErrorSpy).toHaveBeenCalledWith('❌ Failed to persist message store:', expect.any(Error));
            });
            test('should limit persisted messages to prevent storage bloat', async () => {
                // Add more than maxStoredMessages (1000)
                for (let i = 0; i < 1100; i++) {
                    store.addInboundMessage('testType', { data: i }, `id-${i}`, mockMetadata);
                }
                // Wait for async persistence
                await new Promise(resolve => setTimeout(resolve, 10));
                const setCall = mockChrome.storage.local.set.mock.calls[mockChrome.storage.local.set.mock.calls.length - 1][0];
                const persistedData = setCall['web-buddy-message-store'];
                expect(persistedData.messages).toHaveLength(1000); // Should be limited to maxStoredMessages
            });
        });
    });
});
