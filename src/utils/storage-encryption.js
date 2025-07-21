// Storage Encryption Module for ChatGPT Extension
// Encrypts sensitive data before storing in chrome.storage.local

class StorageEncryption {
  constructor() {
    this.algorithm = { name: 'AES-GCM', length: 256 };
    this.keyUsages = ['encrypt', 'decrypt'];
    this.initPromise = this.init();
  }

  async init() {
    // Get or generate encryption key
    this.cryptoKey = await this.getOrGenerateKey();
  }

  async getOrGenerateKey() {
    try {
      // Try to get existing key from storage
      const stored = await chrome.storage.local.get(['encryptionKey']);
      
      if (stored.encryptionKey) {
        // Import existing key
        const keyData = this.base64ToArrayBuffer(stored.encryptionKey);
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          this.algorithm,
          false,
          this.keyUsages
        );
      } else {
        // Generate new key
        const key = await crypto.subtle.generateKey(
          this.algorithm,
          true,
          this.keyUsages
        );
        
        // Export and store key
        const exported = await crypto.subtle.exportKey('raw', key);
        const keyBase64 = this.arrayBufferToBase64(exported);
        await chrome.storage.local.set({ encryptionKey: keyBase64 });
        
        return key;
      }
    } catch (error) {
      throw new Error('Failed to initialize encryption key: ' + error.message);
    }
  }

  async encrypt(data) {
    await this.initPromise;
    
    try {
      // Convert data to string
      const jsonString = JSON.stringify(data);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);
      
      // Generate IV
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encrypt
      const encryptedBuffer = await crypto.subtle.encrypt(
        { name: this.algorithm.name, iv },
        this.cryptoKey,
        dataBuffer
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encryptedBuffer), iv.length);
      
      // Return as base64
      return this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      throw new Error('Encryption failed: ' + error.message);
    }
  }

  async decrypt(encryptedBase64) {
    await this.initPromise;
    
    try {
      // Convert from base64
      const combined = this.base64ToArrayBuffer(encryptedBase64);
      const combinedArray = new Uint8Array(combined);
      
      // Extract IV and encrypted data
      const iv = combinedArray.slice(0, 12);
      const encryptedData = combinedArray.slice(12);
      
      // Decrypt
      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: this.algorithm.name, iv },
        this.cryptoKey,
        encryptedData
      );
      
      // Convert back to data
      const decoder = new TextDecoder();
      const jsonString = decoder.decode(decryptedBuffer);
      return JSON.parse(jsonString);
    } catch (error) {
      throw new Error('Decryption failed: ' + error.message);
    }
  }

  // Utility functions
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
}

// Singleton instance
const storageEncryption = new StorageEncryption();

// Encrypted storage wrapper
const encryptedStorage = {
  async set(items) {
    const encrypted = {};
    for (const [key, value] of Object.entries(items)) {
      // Only encrypt sensitive keys
      if (this.shouldEncrypt(key)) {
        encrypted[key] = await storageEncryption.encrypt(value);
        encrypted[`${key}_encrypted`] = true;
      } else {
        encrypted[key] = value;
      }
    }
    return chrome.storage.local.set(encrypted);
  },

  async get(keys) {
    const stored = await chrome.storage.local.get(keys);
    const decrypted = {};
    
    for (const [key, value] of Object.entries(stored)) {
      if (stored[`${key}_encrypted`]) {
        try {
          decrypted[key] = await storageEncryption.decrypt(value);
        } catch (error) {
          // Return null if decryption fails
          decrypted[key] = null;
        }
      } else {
        decrypted[key] = value;
      }
    }
    
    return decrypted;
  },

  shouldEncrypt(key) {
    // Define which keys contain sensitive data
    const sensitiveKeys = [
      'userProjects',
      'customInstructions',
      'chatHistory',
      'apiKeys',
      'userPreferences',
      'telemetrySessionId'
    ];
    return sensitiveKeys.includes(key);
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { storageEncryption, encryptedStorage };
} else {
  window.storageEncryption = storageEncryption;
  window.encryptedStorage = encryptedStorage;
}