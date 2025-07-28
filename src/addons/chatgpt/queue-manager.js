// Queue Manager for handling multiple image generation requests
console.log('📋 Queue Manager loaded');

class ImageGenerationQueue {
  constructor() {
    this.queue = [];
    this.isProcessing = false;
    this.currentRequest = null;
  }

  // Add a request to the queue
  add(request) {
    console.log(`📥 Adding request to queue: ${request.prompt}`);
    this.queue.push({
      ...request,
      id: request.id || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: 'queued',
      queuedAt: Date.now()
    });
    
    // Send queue status update
    this.sendQueueStatus();
    
    // Try to process if not already processing
    this.processNext();
  }

  // Check if we can process the next request
  canProcess() {
    // Check if send button is enabled (ChatGPT is ready)
    const sendButton = document.querySelector('button[data-testid="send-button"]') ||
                      document.querySelector('button[aria-label="Send message"]') ||
                      document.querySelector('#prompt-textarea')?.parentElement?.querySelector('button[type="submit"]');
    
    return sendButton && !sendButton.disabled;
  }

  // Process the next request in queue
  async processNext() {
    // Don't process if already processing or queue is empty
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    // Check if ChatGPT is ready
    if (!this.canProcess()) {
      console.log('⏳ ChatGPT not ready, waiting...');
      // Check again in 2 seconds
      setTimeout(() => this.processNext(), 2000);
      return;
    }

    // Get next request
    const request = this.queue.shift();
    this.currentRequest = request;
    this.isProcessing = true;
    
    console.log(`🚀 Processing request: ${request.prompt}`);
    request.status = 'processing';
    request.startedAt = Date.now();
    
    // Send status update
    this.sendRequestStatus(request, 'processing');
    
    try {
      // Generate the image
      const result = await window.chatGPTImageGenerator.generateImage(request.prompt);
      
      if (result.success) {
        request.status = 'completed';
        request.completedAt = Date.now();
        request.result = result;
        
        console.log(`✅ Request completed: ${request.prompt}`);
        this.sendRequestStatus(request, 'completed');
      } else {
        request.status = 'failed';
        request.error = result.error;
        request.failedAt = Date.now();
        
        console.error(`❌ Request failed: ${request.prompt}`, result.error);
        this.sendRequestStatus(request, 'failed');
      }
    } catch (error) {
      request.status = 'failed';
      request.error = error.message;
      request.failedAt = Date.now();
      
      console.error(`❌ Request error: ${request.prompt}`, error);
      this.sendRequestStatus(request, 'failed');
    } finally {
      this.isProcessing = false;
      this.currentRequest = null;
      
      // Wait a bit before processing next to ensure ChatGPT is ready
      setTimeout(() => this.processNext(), 3000);
    }
  }

  // Send queue status update
  sendQueueStatus() {
    if (window.semantestBridge && window.semantestBridge.sendToExtension) {
      window.semantestBridge.sendToExtension({
        type: 'addon:queue:status',
        queue: {
          length: this.queue.length,
          items: this.queue.map(req => ({
            id: req.id,
            prompt: req.prompt,
            status: req.status,
            queuedAt: req.queuedAt
          }))
        },
        processing: this.isProcessing,
        currentRequest: this.currentRequest ? {
          id: this.currentRequest.id,
          prompt: this.currentRequest.prompt,
          status: this.currentRequest.status
        } : null
      });
    }
  }

  // Send individual request status update
  sendRequestStatus(request, status) {
    if (window.semantestBridge && window.semantestBridge.sendToExtension) {
      window.semantestBridge.sendToExtension({
        type: 'addon:request:status',
        request: {
          id: request.id,
          prompt: request.prompt,
          status: status,
          queuedAt: request.queuedAt,
          startedAt: request.startedAt,
          completedAt: request.completedAt,
          failedAt: request.failedAt,
          error: request.error,
          result: request.result
        }
      });
    }
  }

  // Get queue status
  getStatus() {
    return {
      queueLength: this.queue.length,
      isProcessing: this.isProcessing,
      currentRequest: this.currentRequest,
      queue: this.queue
    };
  }

  // Clear the queue
  clear() {
    console.log('🗑️ Clearing queue');
    this.queue = [];
    this.sendQueueStatus();
  }

  // Remove a specific request from queue
  remove(requestId) {
    const index = this.queue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      const removed = this.queue.splice(index, 1)[0];
      console.log(`🗑️ Removed request from queue: ${removed.prompt}`);
      this.sendQueueStatus();
      return true;
    }
    return false;
  }
}

// Create global queue instance
window.imageGenerationQueue = new ImageGenerationQueue();

// Monitor for send button state changes to resume processing
let lastButtonState = null;
setInterval(() => {
  const sendButton = document.querySelector('button[data-testid="send-button"]') ||
                    document.querySelector('button[aria-label="Send message"]');
  
  if (sendButton) {
    const currentState = !sendButton.disabled;
    
    // If button just became enabled and we have queued items
    if (currentState && lastButtonState === false && window.imageGenerationQueue.queue.length > 0) {
      console.log('📢 Send button enabled, resuming queue processing...');
      window.imageGenerationQueue.processNext();
    }
    
    lastButtonState = currentState;
  }
}, 1000);

console.log('📋 Queue Manager ready - use window.imageGenerationQueue');