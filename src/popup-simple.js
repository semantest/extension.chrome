// Simple health check
async function checkTabs() {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
    });
    
    const tabStatus = document.getElementById('tabStatus');
    const status = document.getElementById('status');
    
    if (tabs.length > 0) {
      tabStatus.textContent = `Found ${tabs.length} ChatGPT tab(s)`;
      status.textContent = '✅ Extension Ready';
      status.className = 'status healthy';
    } else {
      tabStatus.textContent = 'No ChatGPT tabs found';
      status.textContent = '⚠️ Open ChatGPT first';
      status.className = 'status unhealthy';
    }
  } catch (error) {
    console.error('Error checking tabs:', error);
  }
}

// Test button
document.getElementById('testImage').addEventListener('click', async () => {
  try {
    // Get ChatGPT tabs first
    const tabs = await chrome.tabs.query({
      url: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
    });
    
    if (tabs.length === 0) {
      alert('No ChatGPT tab found. Please open ChatGPT first.');
      return;
    }
    
    // Send directly to the service worker which will forward to content script
    chrome.runtime.sendMessage({
      action: 'ImageRequestReceived',
      data: { prompt: 'Test comic strip: A cat discovers the internet' }
    }, response => {
      console.log('Image test response:', response);
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
      } else if (response?.success) {
        alert('Image request sent successfully!');
      } else {
        alert('Failed: ' + (response?.error || 'Unknown error'));
      }
    });
  } catch (error) {
    console.error('Test button error:', error);
    alert('Error: ' + error.message);
  }
});

// Test direct send button
document.getElementById('testDirect').addEventListener('click', async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
    });
    
    if (tabs.length === 0) {
      alert('No ChatGPT tab found');
      return;
    }
    
    // Inject the new ChatGPT-specific script
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['src/chatgpt-direct-send.js']
    });
    
    // Wait for script to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send message with new action
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'SEND_CHATGPT_PROMPT',
      prompt: 'Direct test: A friendly robot discovers painting and creates colorful artwork'
    }, response => {
      console.log('Direct test response:', response);
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
      } else if (response?.success) {
        alert('Direct test succeeded!');
      } else {
        // Show detailed error for direct send
        let errorMsg = 'Direct test failed\n\n';
        errorMsg += `Error: ${response?.error || 'Unknown error'}\n`;
        
        if (response?.state) {
          errorMsg += `\nChatGPT State:\n`;
          errorMsg += `- Generating: ${response.state.isGenerating ? 'Yes' : 'No'}\n`;
          errorMsg += `- Image Generating: ${response.state.isImageGenerating ? 'Yes' : 'No'}\n`;
          errorMsg += `- Can Send Message: ${response.state.canSendMessage ? 'Yes' : 'No'}\n`;
        }
        
        if (response?.recommendations && response.recommendations.length > 0) {
          errorMsg += `\nRecommendations:\n`;
          response.recommendations.forEach(rec => {
            errorMsg += `- ${rec}\n`;
          });
        }
        
        alert(errorMsg);
      }
    });
  } catch (error) {
    console.error('Direct test error:', error);
    alert('Error: ' + error.message);
  }
});

// Test button click handler
document.getElementById('testButtonClick').addEventListener('click', async () => {
  try {
    const tabs = await chrome.tabs.query({
      url: ["https://chatgpt.com/*", "https://chat.openai.com/*"]
    });
    
    if (tabs.length === 0) {
      alert('No ChatGPT tab found. Please open ChatGPT first.');
      return;
    }
    
    // Get selected button type
    const buttonType = document.getElementById('buttonType').value;
    console.log('Testing button click:', buttonType);
    
    // Inject state detector and button clicker directly
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['src/chatgpt-state-detector.js']
    });
    
    await chrome.scripting.executeScript({
      target: { tabId: tabs[0].id },
      files: ['src/chatgpt-button-clicker.js']
    });
    
    // Wait for scripts to load
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send message directly to content script
    chrome.tabs.sendMessage(tabs[0].id, {
      action: 'CLICK_CHATGPT_BUTTON',
      buttonType: buttonType
    }, response => {
      console.log('Button click test response:', response);
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
      } else if (response?.success) {
        alert(`Successfully clicked ${buttonType} button!\n\nDetails: ${response.message || 'Button clicked'}`);
      } else {
        // Show detailed error with state info
        let errorMsg = `Failed to click ${buttonType} button\n\n`;
        errorMsg += `Error: ${response?.error || 'Unknown error'}\n`;
        
        if (response?.state) {
          errorMsg += `\nChatGPT State:\n`;
          errorMsg += `- Generating: ${response.state.isGenerating ? 'Yes' : 'No'}\n`;
          errorMsg += `- Image Generating: ${response.state.isImageGenerating ? 'Yes' : 'No'}\n`;
          errorMsg += `- Has Error: ${response.state.isError ? 'Yes' : 'No'}\n`;
          errorMsg += `- Unresponsive: ${response.state.isUnresponsive ? 'Yes' : 'No'}\n`;
        }
        
        if (response?.recommendations && response.recommendations.length > 0) {
          errorMsg += `\nRecommendations:\n`;
          response.recommendations.forEach(rec => {
            errorMsg += `- ${rec}\n`;
          });
        }
        
        alert(errorMsg);
      }
    });
  } catch (error) {
    console.error('Button click test error:', error);
    alert('Error: ' + error.message);
  }
});

// Test download request button
document.getElementById('testDownload').addEventListener('click', async () => {
  console.log('Test download clicked');
  
  const promptInput = document.getElementById('downloadPrompt');
  const folderInput = document.getElementById('targetFolder');
  
  const prompt = promptInput.value.trim() || 'Generate a beautiful sunset over mountains';
  const targetFolder = folderInput.value.trim() || '/home/user/images';
  
  try {
    // Send download request via runtime message
    chrome.runtime.sendMessage({
      action: 'SEND_DOWNLOAD_REQUEST',
      data: {
        prompt: prompt,
        targetFolder: targetFolder,
        filename: null, // Let backend generate filename
        metadata: {
          priority: 'normal',
          source: 'popup-test'
        }
      }
    }, response => {
      console.log('Download request response:', response);
      if (chrome.runtime.lastError) {
        alert('Error: ' + chrome.runtime.lastError.message);
      } else if (response?.success) {
        alert(`Download request sent!\n\nRequest ID: ${response.requestId}\nPrompt: ${prompt}\nTarget: ${targetFolder}`);
      } else {
        alert(`Failed to send download request: ${response?.error || 'Unknown error'}`);
      }
    });
  } catch (error) {
    console.error('Download test error:', error);
    alert('Error: ' + error.message);
  }
});

// Check on load
checkTabs();
// Check every 2 seconds
setInterval(checkTabs, 2000);