// Semantest Content Script for Claude.ai
// Handles message passing and prompt automation

(function() {
  console.log('🚀 Semantest Content Script loaded on Claude.ai');
  
  // Keep track of processed responses to avoid duplicates
  const processedResponses = new Set();
  
  // Tell background script we're ready
  chrome.runtime.sendMessage({
    type: 'CONTENT_SCRIPT_READY',
    source: 'claude-content',
    url: window.location.href
  });
  
  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('📨 Received message from background:', request);
    console.log('Message type:', request.type);
    console.log('Message payload:', request.payload);
    
    if (request.type === 'ImageGenerationRequestedEvent' || 
        request.eventType === 'ImageGenerationRequested' ||
        request.type === 'PromptRequestedEvent') {
      console.log('🎯 Processing prompt request');
      
      // Send immediate response and don't keep channel open
      sendResponse({ status: 'processing', acknowledged: true });
      
      // Handle the request asynchronously
      setTimeout(() => {
        handlePromptRequest(request.payload || request);
      }, 100);
      
      return false; // Don't keep channel open - we already responded
      
    } else if (request.action === 'CHECK_STATUS') {
      console.log('✅ Status check');
      sendResponse({ status: 'ready', url: window.location.href });
      return false; // Synchronous response
      
    } else {
      console.log('⚠️ Unknown message type:', request.type);
      sendResponse({ status: 'unknown', type: request.type });
      return false; // Synchronous response
    }
  });
  
  // Handle prompt request (Claude doesn't generate images, but can process prompts)
  function handlePromptRequest(payload) {
    console.log('🎨 Processing prompt request:', payload);
    
    const prompt = payload.prompt;
    if (!prompt) {
      console.error('No prompt provided');
      return;
    }
    
    // Find the Claude input field - try multiple selectors
    const inputSelectors = [
      'div[contenteditable="true"]',
      'div[data-placeholder*="message"]',
      'div[role="textbox"]',
      'div.ProseMirror',
      'div[class*="composer"]',
      'div[class*="input"]',
      'textarea'
    ];
    
    let inputField = null;
    for (const selector of inputSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        // Check if it's actually editable and visible
        if ((element.contentEditable === 'true' || element.tagName === 'TEXTAREA') && 
            element.offsetParent !== null) {
          inputField = element;
          console.log('✅ Found input field with selector:', selector);
          break;
        }
      }
      if (inputField) break;
    }
    
    if (!inputField) {
      console.error('❌ Could not find Claude input field');
      console.log('Available contenteditable:', document.querySelectorAll('[contenteditable="true"]'));
      console.log('Available textareas:', document.querySelectorAll('textarea'));
      reportStatus('error', 'Input field not found', payload.correlationId);
      return;
    }
    
    // Clear any existing text and type the new prompt
    console.log('📝 Typing prompt:', prompt);
    inputField.focus();
    
    // Handle both contenteditable divs and textareas
    if (inputField.tagName === 'TEXTAREA') {
      inputField.value = prompt;
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // For contenteditable divs (most likely in Claude)
      inputField.innerHTML = '';
      inputField.textContent = prompt;
      
      // Trigger input events that Claude listens to
      inputField.dispatchEvent(new Event('input', { bubbles: true }));
      inputField.dispatchEvent(new InputEvent('input', { 
        bubbles: true,
        cancelable: true,
        data: prompt,
        inputType: 'insertText'
      }));
    }
    
    // Wait a bit then send the message
    setTimeout(sendMessage, 500);
    
    function sendMessage() {
      // Find and click the send button - try multiple selectors
      const sendButtonSelectors = [
        'button[aria-label*="Send"]',
        'button[aria-label*="send"]',
        'button[data-testid*="send"]',
        'button svg[class*="send"]',
        'button:has(svg)',
        'button[type="submit"]'
      ];
      
      let sendButton = null;
      for (const selector of sendButtonSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          // Check if button is visible and not disabled
          if (button.offsetParent !== null && !button.disabled) {
            // Additional check for Claude's send button (usually has an SVG)
            if (button.querySelector('svg') || button.getAttribute('aria-label')?.toLowerCase().includes('send')) {
              sendButton = button;
              console.log('✅ Found send button with selector:', selector);
              break;
            }
          }
        }
        if (sendButton) break;
      }
      
      if (sendButton && !sendButton.disabled) {
        console.log('🚀 Clicking send button');
        sendButton.click();
        
        reportStatus('sent', 'Prompt submitted to Claude', payload.correlationId);
        
        // Monitor for response
        setTimeout(() => monitorForResponse(payload), 2000);
      } else {
        console.error('❌ Could not find active send button');
        console.log('Available buttons:', document.querySelectorAll('button'));
        reportStatus('error', 'Send button not found or disabled', payload.correlationId);
      }
    }
  }
  
  // Monitor for Claude's response
  function monitorForResponse(payload) {
    console.log('👀 Monitoring for Claude response...');
    
    let foundNewResponse = false;
    let checkCount = 0;
    const maxChecks = 60; // 1 minute with 1 second intervals
    
    const checkInterval = setInterval(() => {
      checkCount++;
      
      // Look for response elements - Claude uses different structure than ChatGPT
      const responseSelectors = [
        'div[data-testid*="message"]',
        'div[class*="message"]',
        'div[class*="response"]',
        'div[class*="assistant"]',
        'div[role="article"]'
      ];
      
      let responses = [];
      for (const selector of responseSelectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          responses = Array.from(elements);
          break;
        }
      }
      
      // Filter to only new responses we haven't processed
      const newResponses = responses.filter(element => {
        const text = element.textContent || '';
        return text.length > 10 && !processedResponses.has(text);
      });
      
      if (newResponses.length > 0) {
        foundNewResponse = true;
        console.log('✅ Found ' + newResponses.length + ' new response(s)');
        
        // Process only the latest response
        const latestResponse = newResponses[newResponses.length - 1];
        const responseText = latestResponse.textContent;
        
        // Mark as processed
        processedResponses.add(responseText);
        
        console.log('📄 Response received (first 200 chars):', responseText.substring(0, 200));
        
        // Report response found
        reportStatus('response_received', responseText.substring(0, 500), payload.correlationId);
        
        // Stop monitoring after finding response
        clearInterval(checkInterval);
      } else if (checkCount >= maxChecks) {
        // Timeout reached
        clearInterval(checkInterval);
        if (!foundNewResponse) {
          console.log('⏱️ Stopped monitoring for response (timeout)');
          reportStatus('timeout', 'No response within timeout period', payload.correlationId);
        }
      }
    }, 1000);
  }
  
  // Report status back to background script
  function reportStatus(status, message, correlationId) {
    chrome.runtime.sendMessage({
      type: 'STATUS_UPDATE',
      status: status,
      message: message,
      correlationId: correlationId,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log('✅ Semantest Claude content script initialized');
})();