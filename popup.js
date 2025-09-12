/**
 * Popup script for Semantest extension
 */

document.addEventListener('DOMContentLoaded', () => {
  // Check WebSocket status
  chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }, (response) => {
    updateWSStatus(response?.connected || false);
  });
  
  // Check ChatGPT tab
  chrome.tabs.query({ url: 'https://chatgpt.com/*' }, (tabs) => {
    updateChatGPTStatus(tabs.length > 0);
  });
  
  // Connect button
  document.getElementById('connect-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CONNECT_WEBSOCKET' });
    setTimeout(() => {
      chrome.runtime.sendMessage({ type: 'GET_WS_STATUS' }, (response) => {
        updateWSStatus(response?.connected || false);
      });
    }, 1000);
  });
  
  // Test button
  document.getElementById('test-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ 
      type: 'SEND_PROMPT',
      prompt: 'Test prompt from Semantest extension'
    });
  });
});

function updateWSStatus(connected) {
  const statusEl = document.getElementById('ws-status');
  const stateEl = document.getElementById('ws-state');
  
  if (connected) {
    statusEl.className = 'status connected';
    stateEl.textContent = 'Connected';
  } else {
    statusEl.className = 'status disconnected';
    stateEl.textContent = 'Disconnected';
  }
}

function updateChatGPTStatus(detected) {
  const statusEl = document.getElementById('chatgpt-status');
  const stateEl = document.getElementById('chatgpt-state');
  
  if (detected) {
    statusEl.className = 'status connected';
    stateEl.textContent = 'Tab detected';
  } else {
    statusEl.className = 'status disconnected';
    stateEl.textContent = 'No tab found';
  }
}