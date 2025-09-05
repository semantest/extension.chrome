/**
 * @fileoverview Tests for WebSocket client connection
 * @author Wences
 * @description TDD test suite for WebSocket client implementation
 */

import { WebSocketClient, WebSocketState } from '../websocket-client';
import WS from 'jest-websocket-mock';

describe('WebSocketClient', () => {
  let client: WebSocketClient;
  let mockServer: WS;
  const TEST_URL = 'ws://localhost:8080';
  
  beforeEach(async () => {
    // Create mock WebSocket server
    mockServer = new WS(TEST_URL);
    client = new WebSocketClient(TEST_URL);
  });
  
  afterEach(async () => {
    client.disconnect();
    WS.clean();
  });
  
  describe('Connection Management', () => {
    it('should establish WebSocket connection', async () => {
      const onConnect = jest.fn();
      client.on('connect', onConnect);
      
      await client.connect();
      await mockServer.connected;
      
      expect(client.getState()).toBe(WebSocketState.CONNECTED);
      expect(onConnect).toHaveBeenCalled();
    });
    
    it('should handle connection errors', async () => {
      const onError = jest.fn();
      client.on('error', onError);
      
      // Close server to force error
      mockServer.close();
      
      await expect(client.connect()).rejects.toThrow('Connection failed');
      expect(client.getState()).toBe(WebSocketState.ERROR);
      expect(onError).toHaveBeenCalled();
    });
    
    it('should reconnect automatically', async () => {
      client = new WebSocketClient(TEST_URL, { autoReconnect: true });
      await client.connect();
      await mockServer.connected;
      
      // Simulate disconnect
      mockServer.close();
      
      // Wait for reconnect attempt
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // New server should receive connection
      const newServer = new WS(TEST_URL);
      await newServer.connected;
      
      expect(client.getState()).toBe(WebSocketState.CONNECTED);
    });
  });
  
  describe('Message Handling', () => {
    beforeEach(async () => {
      await client.connect();
      await mockServer.connected;
    });
    
    it('should send messages to server', async () => {
      const message = { type: 'chatgpt_state', state: 'idle' };
      
      client.send(message);
      
      await expect(mockServer).toReceiveMessage(JSON.stringify(message));
    });
    
    it('should receive messages from server', async () => {
      const onMessage = jest.fn();
      client.on('message', onMessage);
      
      const serverMessage = { type: 'command', action: 'send_prompt' };
      mockServer.send(JSON.stringify(serverMessage));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onMessage).toHaveBeenCalledWith(serverMessage);
    });
    
    it('should queue messages when disconnected', () => {
      client.disconnect();
      
      const message1 = { type: 'test1' };
      const message2 = { type: 'test2' };
      
      client.send(message1);
      client.send(message2);
      
      expect(client.getQueueSize()).toBe(2);
    });
    
    it('should send queued messages on reconnect', async () => {
      const message1 = { type: 'queued1' };
      const message2 = { type: 'queued2' };
      
      // Disconnect and queue messages
      client.disconnect();
      client.send(message1);
      client.send(message2);
      
      // Reconnect
      const newServer = new WS(TEST_URL);
      await client.connect();
      await newServer.connected;
      
      // Check messages were sent
      await expect(newServer).toReceiveMessage(JSON.stringify(message1));
      await expect(newServer).toReceiveMessage(JSON.stringify(message2));
      
      expect(client.getQueueSize()).toBe(0);
    });
  });
  
  describe('ChatGPT Integration', () => {
    beforeEach(async () => {
      await client.connect();
      await mockServer.connected;
    });
    
    it('should notify server of ChatGPT state changes', async () => {
      client.notifyChatGPTState('idle');
      
      await expect(mockServer).toReceiveMessage(
        JSON.stringify({
          type: 'chatgpt_state_change',
          state: 'idle',
          timestamp: expect.any(String)
        })
      );
    });
    
    it('should handle ChatGPT commands from server', async () => {
      const onCommand = jest.fn();
      client.on('chatgpt_command', onCommand);
      
      const command = {
        type: 'chatgpt_command',
        action: 'send_prompt',
        prompt: 'Hello ChatGPT!'
      };
      
      mockServer.send(JSON.stringify(command));
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onCommand).toHaveBeenCalledWith({
        action: 'send_prompt',
        prompt: 'Hello ChatGPT!'
      });
    });
    
    it('should maintain heartbeat with server', async () => {
      jest.useFakeTimers();
      
      // Start heartbeat
      client.startHeartbeat(5000);
      
      // Advance time
      jest.advanceTimersByTime(5000);
      
      await expect(mockServer).toReceiveMessage(
        JSON.stringify({ type: 'ping' })
      );
      
      // Server responds with pong
      mockServer.send(JSON.stringify({ type: 'pong' }));
      
      // Advance time again
      jest.advanceTimersByTime(5000);
      
      await expect(mockServer).toReceiveMessage(
        JSON.stringify({ type: 'ping' })
      );
      
      jest.useRealTimers();
    });
  });
  
  describe('Error Recovery', () => {
    it('should handle malformed messages', async () => {
      await client.connect();
      await mockServer.connected;
      
      const onError = jest.fn();
      client.on('error', onError);
      
      // Send malformed JSON
      mockServer.send('not valid json');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('Invalid message')
        })
      );
    });
    
    it('should respect max reconnect attempts', async () => {
      client = new WebSocketClient(TEST_URL, {
        autoReconnect: true,
        maxReconnectAttempts: 2
      });
      
      const onMaxReconnectFailed = jest.fn();
      client.on('max_reconnect_failed', onMaxReconnectFailed);
      
      // Fail initial connection
      mockServer.close();
      await expect(client.connect()).rejects.toThrow();
      
      // Wait for reconnect attempts
      await new Promise(resolve => setTimeout(resolve, 4000));
      
      expect(onMaxReconnectFailed).toHaveBeenCalled();
      expect(client.getState()).toBe(WebSocketState.CLOSED);
    });
    
    it('should cleanup resources on disconnect', () => {
      const cleanupSpy = jest.spyOn(client as any, 'cleanup');
      
      client.disconnect();
      
      expect(cleanupSpy).toHaveBeenCalled();
      expect(client.getState()).toBe(WebSocketState.CLOSED);
    });
  });
});