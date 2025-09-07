/**
 * SEMANTEST Background Script
 * Handles WebSocket connection and event routing
 */

console.log('🚀 SEMANTEST Background Script Started');

// WebSocket connection to server
let ws = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

// Connect to SEMANTEST server
function connectWebSocket() {
  const wsUrl = 'ws://localhost:8081';
  console.log(`🔌 Connecting to SEMANTEST server at ${wsUrl}...`);
  
  ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log('✅ Connected to SEMANTEST server');
    reconnectAttempts = 0;
    
    // Send connection event
    ws.send(JSON.stringify({
      type: 'ExtensionConnectedEvent',
      payload: {
        domain: 'extension',
        timestamp: Date.now()
      }
    }));
  };
  
  ws.onmessage = (event) => {
    console.log('📥 Received SEMANTEST event:', event.data);
    
    try {
      const semantestEvent = JSON.parse(event.data);
      handleSemantestEvent(semantestEvent);
    } catch (error) {
      console.error('Error parsing event:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.error('❌ WebSocket error:', error);
  };
  
  ws.onclose = () => {
    console.log('🔌 WebSocket disconnected');
    
    // Attempt reconnection
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
      reconnectAttempts++;
      const delay = Math.pow(2, reconnectAttempts) * 1000;
      console.log(`⏳ Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
      setTimeout(connectWebSocket, delay);
    }
  };
}

// Handle SEMANTEST events
async function handleSemantestEvent(event) {
  const { type, payload } = event;
  
  console.log(`🎯 Handling ${type} for domain: ${payload.domain}`);
  
  switch (type) {
    case 'ImageGenerationRequestedEvent':
      await handleImageGenerationRequest(payload);
      break;
      
    case 'GetStateEvent':
      await sendChatGPTState(payload);
      break;
      
    default:
      console.log(`Unknown event type: ${type}`);
  }
}

// Handle image generation request
async function handleImageGenerationRequest(payload) {
  const { domain, prompt, correlationId } = payload;
  
  // Find ChatGPT tab
  const tabs = await chrome.tabs.query({ url: '*://chatgpt.com/*' });
  
  if (tabs.length === 0) {
    console.error('No ChatGPT tab found');
    sendErrorEvent('No ChatGPT tab found', correlationId);
    return;
  }
  
  const tab = tabs[0];
  console.log(`📤 Sending prompt to ChatGPT tab ${tab.id}`);
  
  // Send message to content script
  chrome.tabs.sendMessage(tab.id, {
    type: 'SEND_PROMPT',
    payload: { prompt, correlationId }
  });
}

// Send ChatGPT state back to server
async function sendChatGPTState(payload) {
  const tabs = await chrome.tabs.query({ url: '*://chatgpt.com/*' });
  
  if (tabs.length > 0) {
    chrome.tabs.sendMessage(tabs[0].id, {
      type: 'GET_STATE'
    }, (response) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'ChatGPTStateEvent',
          payload: {
            ...response,
            correlationId: payload.correlationId
          }
        }));
      }
    });
  }
}

// Send error event
function sendErrorEvent(message, correlationId) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'ErrorEvent',
      payload: {
        message,
        correlationId,
        timestamp: Date.now()
      }
    }));
  }
}

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Message from content script:', message);
  
  // Handle image generated event specifically
  if (message.type === 'ImageGeneratedEvent') {
    console.log('🎉 IMAGE GENERATED! Sending to server...');
    if (ws && ws.readyState === WebSocket.OPEN) {
      // Add output path from original request if we have it
      const enhancedMessage = {
        ...message,
        payload: {
          ...message.payload,
          outputPath: message.payload.outputPath || '/tmp/semantest-image.png'
        }
      };
      ws.send(JSON.stringify(enhancedMessage));
    }
  } else {
    // Forward other messages as-is
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  sendResponse({ received: true });
  return true;
});

// Start WebSocket connection
connectWebSocket();

// Monitor tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('chatgpt.com')) {
    console.log('🔄 ChatGPT tab loaded, injecting content script');
    
    chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-script.js']
    });
  }
});

console.log('🎯 SEMANTEST Background Script Ready');