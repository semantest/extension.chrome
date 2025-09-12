// Semantest Background Service Worker with Polling
// More reliable than WebSocket - polls server for new tasks

console.log('🚀 Semantest Background (Polling) Started');

class SemantestPollingHandler {
  constructor() {
    this.pollInterval = 2000; // Poll every 2 seconds
    this.serverUrl = 'http://localhost:8080';
    this.lastProcessedId = null;
    this.isPolling = false;
    this.pendingTasks = [];
  }

  start() {
    console.log('📡 Starting polling service...');
    this.isPolling = true;
    this.poll();
  }

  stop() {
    console.log('🛑 Stopping polling service...');
    this.isPolling = false;
  }

  async poll() {
    if (!this.isPolling) return;

    try {
      // Check for pending tasks from server
      const response = await fetch(`${this.serverUrl}/pending-tasks`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Extension-Id': chrome.runtime.id,
          'X-Last-Id': this.lastProcessedId || ''
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.tasks && data.tasks.length > 0) {
          console.log(`📥 Received ${data.tasks.length} new task(s)`);
          for (const task of data.tasks) {
            await this.processTask(task);
          }
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }

    // Schedule next poll
    setTimeout(() => this.poll(), this.pollInterval);
  }

  async processTask(task) {
    console.log('🎯 Processing task:', task.type);
    
    if (task.type === 'ImageGenerationRequestedEvent' || 
        task.eventType === 'ImageGenerationRequested' ||
        task.type === 'PromptRequestedEvent') {
      
      this.lastProcessedId = task.id;
      
      // Extract domain from payload
      const targetDomain = task.payload?.domain || 'chatgpt.com';
      console.log('🌐 Target domain:', targetDomain);
      
      // Build URL patterns based on domain
      const urlPatterns = [];
      if (targetDomain.includes('chatgpt')) {
        urlPatterns.push('https://chatgpt.com/*', 'https://chat.openai.com/*');
      } else if (targetDomain.includes('claude')) {
        urlPatterns.push('https://claude.ai/*');
      } else if (targetDomain.includes('gemini')) {
        urlPatterns.push('https://gemini.google.com/*');
      } else if (targetDomain.includes('google') || targetDomain.includes('imagen') || targetDomain.includes('text2image')) {
        // Google text2image and related services
        urlPatterns.push(
          'https://aidemo.googlelabs.com/*',
          'https://labs.google.com/*',
          'https://makersuite.google.com/*',
          'https://aistudio.google.com/*',
          'https://imagen.google.com/*',
          'https://*.googlelabs.com/*'
        );
      } else {
        // Generic pattern for custom domains
        urlPatterns.push(`https://${targetDomain}/*`, `https://*.${targetDomain}/*`);
      }
      
      // Find tabs matching the domain
      const tabs = await chrome.tabs.query({ 
        url: urlPatterns
      });

      if (tabs.length > 0) {
        for (const tab of tabs) {
          try {
            // Determine which content script to inject based on domain
            let scriptFile = 'content-script.js'; // Default for ChatGPT
            
            if (targetDomain.includes('claude')) {
              scriptFile = 'content-script-claude.js';
              console.log('🤖 Using Claude content script');
            } else if (targetDomain.includes('gemini')) {
              scriptFile = 'content-script-google.js';
              console.log('✨ Using Google Gemini content script');
            } else if (targetDomain.includes('google') || targetDomain.includes('imagen') || targetDomain.includes('text2image')) {
              scriptFile = 'content-script-google.js';
              console.log('🎨 Using Google text2image content script');
            }
            
            // First, always try to inject the content script
            // This ensures it's present and up-to-date
            console.log('📌 Injecting', scriptFile, 'into tab', tab.id);
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: [scriptFile]
            });
            
            // Wait a bit for the script to initialize
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Now send the message
            console.log('📤 Sending task to tab', tab.id);
            await chrome.tabs.sendMessage(tab.id, task);
            console.log('✅ Successfully sent to tab', tab.id);
            
            // Report success back to server
            await this.reportStatus('delivered', task.id || task.correlationId, tab.id);
            
            // Also report the correlationId if present
            if (task.payload?.correlationId) {
              await this.reportStatus('sent', task.payload.correlationId, tab.id);
            }
            
          } catch (error) {
            console.error('❌ Error processing tab', tab.id, error);
            await this.reportStatus('failed', task.id || task.correlationId, tab.id);
          }
        }
      } else {
        console.log(`⚠️ No tabs found for domain: ${targetDomain}`);
        console.log('   Searched patterns:', urlPatterns);
        await this.reportStatus('no_tabs', task.id || task.correlationId);
      }
    }
  }

  async reportStatus(status, taskId, tabId = null) {
    try {
      await fetch(`${this.serverUrl}/task-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status,
          tabId,
          timestamp: new Date().toISOString()
        })
      });
    } catch (error) {
      console.error('Failed to report status:', error);
    }
  }
}

// Initialize polling handler
const pollingHandler = new SemantestPollingHandler();

// Start polling when extension loads
pollingHandler.start();

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('📨 Message from content script:', request.type);
  
  if (request.type === 'CONTENT_SCRIPT_READY') {
    console.log('✅ Content script ready in tab', sender.tab?.id);
    sendResponse({ status: 'acknowledged' });
  } else if (request.type === 'STATUS_UPDATE') {
    // Forward status to server
    pollingHandler.reportStatus(request.status, request.correlationId, sender.tab?.id);
    sendResponse({ status: 'reported' });
  } else if (request.action === 'DOWNLOAD_IMAGE') {
    // Handle image download
    console.log('📥 Download request:', request);
    
    // Clean up the filename - remove leading slashes and dots
    let filename = request.filename;
    if (filename.startsWith('./')) {
      filename = filename.substring(2);
    }
    if (filename.startsWith('/')) {
      filename = filename.substring(1);
    }
    
    chrome.downloads.download({
      url: request.url,
      filename: filename,
      saveAs: false
    }, (downloadId) => {
      if (chrome.runtime.lastError) {
        console.error('❌ Download failed:', chrome.runtime.lastError);
      } else {
        console.log('✅ Download started:', downloadId, 'to', filename);
      }
    });
    sendResponse({ status: 'downloading' });
  }
  
  return true;
});

// Handle extension suspend/wake
chrome.runtime.onSuspend.addListener(() => {
  console.log('Extension suspending...');
  pollingHandler.stop();
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Extension starting...');
  pollingHandler.start();
});

console.log('✅ Semantest Polling Background initialized');