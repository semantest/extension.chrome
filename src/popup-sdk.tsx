import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { ConnectionStatus } from '@semantest/client';

interface ConnectionState {
  connected: boolean;
  connecting: boolean;
  serverUrl: string;
  lastMessage: string;
  lastError: string;
  autoReconnect: boolean;
}

function PopupApp() {
  const [status, setStatus] = useState<ConnectionState>({
    connected: false,
    connecting: false,
    serverUrl: 'ws://localhost:8080',
    lastMessage: 'None',
    lastError: '',
    autoReconnect: true
  });
  const [serverUrl, setServerUrl] = useState('ws://localhost:8080');

  // Get connection status on mount and set up listener
  useEffect(() => {
    // Get initial status
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response?.status) {
        setStatus(response.status);
        setServerUrl(response.status.serverUrl);
      }
    });

    // Listen for status updates
    const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes.connectionStatus?.newValue) {
        setStatus(changes.connectionStatus.newValue);
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const handleConnect = () => {
    chrome.runtime.sendMessage({ 
      type: 'CONNECT', 
      serverUrl 
    });
  };

  const handleDisconnect = () => {
    chrome.runtime.sendMessage({ type: 'DISCONNECT' });
  };

  const handleTestEvent = () => {
    chrome.runtime.sendMessage({
      type: 'SEND_EVENT',
      eventType: 'test.manual',
      payload: {
        message: 'Manual test from popup',
        timestamp: Date.now()
      }
    }, (response) => {
      if (!response?.success) {
        console.error('Failed to send test event:', response?.error);
      }
    });
  };

  return (
    <div className="w-96 p-4 bg-gray-50">
      <div className="mb-4">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Semantest Extension</h1>
        <p className="text-sm text-gray-600">AI-powered automation framework</p>
      </div>

      {/* Connection Status */}
      <ConnectionStatus
        connected={status.connected}
        connecting={status.connecting}
        error={status.lastError ? new Error(status.lastError) : null}
        url={status.serverUrl}
        className="mb-4"
      />

      {/* Server URL Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Server URL
        </label>
        <input
          type="text"
          value={serverUrl}
          onChange={(e) => setServerUrl(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="ws://localhost:8080"
        />
      </div>

      {/* Connection Controls */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={handleConnect}
          disabled={status.connected || status.connecting}
          className={`flex-1 py-2 px-4 rounded-md font-medium text-white ${
            status.connected || status.connecting
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {status.connecting ? 'Connecting...' : 'Connect'}
        </button>
        <button
          onClick={handleDisconnect}
          disabled={!status.connected}
          className={`flex-1 py-2 px-4 rounded-md font-medium ${
            status.connected
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          Disconnect
        </button>
      </div>

      {/* Status Info */}
      <div className="bg-white rounded-lg p-3 mb-4 text-sm">
        <div className="flex justify-between mb-1">
          <span className="text-gray-600">Last Message:</span>
          <span className="text-gray-900 font-mono">{status.lastMessage}</span>
        </div>
        {status.lastError && (
          <div className="mt-2 p-2 bg-red-50 rounded text-red-700 text-xs">
            {status.lastError}
          </div>
        )}
      </div>

      {/* Test Actions */}
      {status.connected && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Test Actions</h3>
          <button
            onClick={handleTestEvent}
            className="w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium"
          >
            Send Test Event
          </button>
        </div>
      )}

      {/* Links */}
      <div className="mt-4 pt-4 border-t text-xs text-gray-500 text-center">
        <a
          href="https://github.com/semantest/semantest"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Documentation
        </a>
        {' • '}
        <a
          href="#"
          onClick={() => chrome.runtime.openOptionsPage()}
          className="text-blue-600 hover:underline"
        >
          Settings
        </a>
      </div>
    </div>
  );
}

// Initialize React app
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<PopupApp />);