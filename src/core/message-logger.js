/**
 * Core Message Logger
 * Stores and manages WebSocket messages for display in popup
 * Domain-agnostic, works with any message type
 */

class MessageLogger {
  constructor() {
    this.buffer = [];
    this.BUFFER_SIZE = 100;
    this.PERSIST_INTERVAL = 5000;
    this.MAX_STORAGE_SIZE = 50;
    this.listeners = new Set();
    
    // Restore from storage on init
    this.restore();
    
    // Periodic persistence
    setInterval(() => this.persist(), this.PERSIST_INTERVAL);
  }

  /**
   * Add a message to the log
   * @param {Object} message - Message object with type, timestamp, payload
   * @param {string} direction - 'incoming' or 'outgoing'
   */
  async addMessage(message, direction = 'incoming') {
    const logEntry = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      direction,
      type: message.type || 'unknown',
      payload: message.payload || message,
      raw: JSON.stringify(message)
    };

    this.buffer.push(logEntry);
    
    // Trigger immediate persist on buffer overflow
    if (this.buffer.length > this.BUFFER_SIZE) {
      await this.persist();
      this.buffer = this.buffer.slice(-this.BUFFER_SIZE / 2);
    }
    
    // Notify listeners
    this.notifyListeners('message-added', logEntry);
  }

  /**
   * Get all messages or filtered by criteria
   * @param {Object} filter - Filter criteria
   * @returns {Array} Filtered messages
   */
  async getMessages(filter = {}, limit = 50) {
    let filtered = [...this.buffer];
    
    if (filter.type) {
      filtered = filtered.filter(msg => msg.type === filter.type);
    }
    
    if (filter.direction) {
      filtered = filtered.filter(msg => msg.direction === filter.direction);
    }
    
    if (filter.since) {
      filtered = filtered.filter(msg => msg.timestamp >= filter.since);
    }
    
    return filtered.slice(-limit);
  }

  /**
   * Clear all messages
   */
  clear() {
    this.buffer = [];
    this.persist();
    this.notifyListeners('messages-cleared');
  }

  /**
   * Add a listener for message events
   * @param {Function} callback - Callback function
   */
  addListener(callback) {
    this.listeners.add(callback);
  }

  /**
   * Remove a listener
   * @param {Function} callback - Callback function
   */
  removeListener(callback) {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners of an event
   * @param {string} event - Event type
   * @param {*} data - Event data
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('Error in message logger listener:', error);
      }
    });
  }

  /**
   * Persist messages to chrome.storage.local
   */
  async persist() {
    try {
      await chrome.storage.local.set({
        messages: this.buffer.slice(-this.MAX_STORAGE_SIZE),
        lastPersisted: Date.now()
      });
    } catch (error) {
      console.error('Failed to persist messages:', error);
    }
  }

  /**
   * Restore messages from chrome.storage.local
   */
  async restore() {
    try {
      const { messages = [] } = await chrome.storage.local.get('messages');
      this.buffer = messages;
      this.notifyListeners('messages-loaded', this.buffer);
    } catch (error) {
      console.error('Failed to restore messages:', error);
    }
  }

  /**
   * Get message statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    const stats = {
      total: this.buffer.length,
      incoming: this.buffer.filter(m => m.direction === 'incoming').length,
      outgoing: this.buffer.filter(m => m.direction === 'outgoing').length,
      system: this.buffer.filter(m => m.direction === 'system').length,
      byType: {}
    };

    // Count by message type
    this.buffer.forEach(msg => {
      stats.byType[msg.type] = (stats.byType[msg.type] || 0) + 1;
    });

    return stats;
  }
}

// Create singleton instance
const messageLogger = new MessageLogger();

// Export for use in extension
if (typeof module !== 'undefined' && module.exports) {
  module.exports = messageLogger;
} else {
  window.messageLogger = messageLogger;
}