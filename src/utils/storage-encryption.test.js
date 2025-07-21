// Unit tests for Storage Encryption Module
// Tests AES-GCM encryption for sensitive data protection

const { storageEncryption, encryptedStorage } = require('./storage-encryption');

// Mock Chrome storage API
const mockStorage = {
  data: {},
  local: {
    get: jest.fn((keys) => {
      return Promise.resolve(
        Array.isArray(keys) 
          ? keys.reduce((acc, key) => {
              if (mockStorage.data[key] !== undefined) {
                acc[key] = mockStorage.data[key];
              }
              return acc;
            }, {})
          : mockStorage.data
      );
    }),
    set: jest.fn((items) => {
      Object.assign(mockStorage.data, items);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      mockStorage.data = {};
      return Promise.resolve();
    })
  }
};

global.chrome = {
  storage: mockStorage
};

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    generateKey: jest.fn(),
    importKey: jest.fn(),
    exportKey: jest.fn(),
    encrypt: jest.fn(),
    decrypt: jest.fn()
  },
  getRandomValues: jest.fn((array) => {
    // Fill with mock random values
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  })
};

global.crypto = mockCrypto;

// Mock TextEncoder/TextDecoder
global.TextEncoder = class {
  encode(str) {
    return new Uint8Array(str.split('').map(c => c.charCodeAt(0)));
  }
};

global.TextDecoder = class {
  decode(buffer) {
    return String.fromCharCode(...new Uint8Array(buffer));
  }
};

// Mock btoa/atob
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');

describe('StorageEncryption', () => {
  let mockKey;
  let mockExportedKey;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    mockStorage.data = {};
    
    // Mock crypto key
    mockKey = { type: 'secret', algorithm: 'AES-GCM' };
    mockExportedKey = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    
    mockCrypto.subtle.generateKey.mockResolvedValue(mockKey);
    mockCrypto.subtle.importKey.mockResolvedValue(mockKey);
    mockCrypto.subtle.exportKey.mockResolvedValue(mockExportedKey.buffer);
  });

  describe('initialization', () => {
    test('generates new key on first use', async () => {
      const encryption = new StorageEncryption();
      await encryption.init();

      expect(mockCrypto.subtle.generateKey).toHaveBeenCalledWith(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalledWith('raw', mockKey);
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        encryptionKey: expect.any(String)
      });
    });

    test('uses existing key from storage', async () => {
      // Pre-store a key
      mockStorage.data.encryptionKey = btoa(String.fromCharCode(...mockExportedKey));
      
      const encryption = new StorageEncryption();
      await encryption.init();

      expect(mockCrypto.subtle.generateKey).not.toHaveBeenCalled();
      expect(mockCrypto.subtle.importKey).toHaveBeenCalledWith(
        'raw',
        mockExportedKey.buffer,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
      );
    });

    test('throws error if key initialization fails', async () => {
      mockCrypto.subtle.generateKey.mockRejectedValue(new Error('Crypto error'));
      
      const encryption = new StorageEncryption();
      await expect(encryption.init()).rejects.toThrow('Failed to initialize encryption key');
    });
  });

  describe('encrypt', () => {
    test('encrypts data successfully', async () => {
      const testData = { username: 'testuser', password: 'secret123' };
      const mockEncrypted = new Uint8Array([10, 20, 30, 40, 50]);
      
      mockCrypto.subtle.encrypt.mockResolvedValue(mockEncrypted.buffer);
      
      const result = await storageEncryption.encrypt(testData);
      
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array)
        }),
        mockKey,
        expect.any(Uint8Array)
      );
      
      expect(typeof result).toBe('string'); // Base64 string
      expect(result.length).toBeGreaterThan(0);
    });

    test('handles complex data structures', async () => {
      const complexData = {
        array: [1, 2, 3],
        nested: {
          deep: {
            value: 'test'
          }
        },
        nullValue: null,
        boolValue: true,
        numberValue: 42.5
      };
      
      mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(100));
      
      const result = await storageEncryption.encrypt(complexData);
      
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    test('generates unique IV for each encryption', async () => {
      mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(50));
      
      await storageEncryption.encrypt({ data: 'test1' });
      await storageEncryption.encrypt({ data: 'test2' });
      
      const calls = mockCrypto.subtle.encrypt.mock.calls;
      const iv1 = calls[0][0].iv;
      const iv2 = calls[1][0].iv;
      
      expect(iv1).not.toEqual(iv2);
    });

    test('throws error on encryption failure', async () => {
      mockCrypto.subtle.encrypt.mockRejectedValue(new Error('Encryption failed'));
      
      await expect(storageEncryption.encrypt({ data: 'test' }))
        .rejects.toThrow('Encryption failed');
    });
  });

  describe('decrypt', () => {
    test('decrypts data successfully', async () => {
      const originalData = { username: 'testuser', secret: 'value' };
      const jsonString = JSON.stringify(originalData);
      const encoder = new TextEncoder();
      const dataBuffer = encoder.encode(jsonString);
      
      mockCrypto.subtle.decrypt.mockResolvedValue(dataBuffer.buffer);
      
      // Create mock encrypted data (IV + encrypted)
      const iv = new Uint8Array(12);
      const encrypted = new Uint8Array(50);
      const combined = new Uint8Array(62);
      combined.set(iv, 0);
      combined.set(encrypted, 12);
      const encryptedBase64 = btoa(String.fromCharCode(...combined));
      
      const result = await storageEncryption.decrypt(encryptedBase64);
      
      expect(result).toEqual(originalData);
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AES-GCM',
          iv: expect.any(Uint8Array)
        }),
        mockKey,
        expect.any(Uint8Array)
      );
    });

    test('handles invalid base64 input', async () => {
      await expect(storageEncryption.decrypt('invalid-base64!@#'))
        .rejects.toThrow('Decryption failed');
    });

    test('throws error on decryption failure', async () => {
      mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Invalid key'));
      
      const validBase64 = btoa('x'.repeat(62)); // Valid base64 with correct length
      
      await expect(storageEncryption.decrypt(validBase64))
        .rejects.toThrow('Decryption failed');
    });

    test('handles corrupted encrypted data', async () => {
      // Return invalid JSON
      mockCrypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(10));
      
      const validBase64 = btoa('x'.repeat(62));
      
      await expect(storageEncryption.decrypt(validBase64))
        .rejects.toThrow('Decryption failed');
    });
  });

  describe('utility functions', () => {
    test('arrayBufferToBase64 converts correctly', () => {
      const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer; // "Hello"
      const base64 = storageEncryption.arrayBufferToBase64(buffer);
      
      expect(base64).toBe(btoa('Hello'));
    });

    test('base64ToArrayBuffer converts correctly', () => {
      const base64 = btoa('Hello');
      const buffer = storageEncryption.base64ToArrayBuffer(base64);
      const array = new Uint8Array(buffer);
      
      expect(array).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
    });

    test('round-trip conversion works', () => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 255, 0, 128]);
      const base64 = storageEncryption.arrayBufferToBase64(original.buffer);
      const converted = storageEncryption.base64ToArrayBuffer(base64);
      
      expect(new Uint8Array(converted)).toEqual(original);
    });
  });
});

describe('encryptedStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.data = {};
    
    // Mock successful encryption/decryption
    jest.spyOn(storageEncryption, 'encrypt').mockImplementation(
      async (data) => btoa(JSON.stringify(data))
    );
    jest.spyOn(storageEncryption, 'decrypt').mockImplementation(
      async (encrypted) => JSON.parse(atob(encrypted))
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('set', () => {
    test('encrypts sensitive keys', async () => {
      await encryptedStorage.set({
        userProjects: ['project1', 'project2'],
        normalData: 'not encrypted'
      });

      expect(storageEncryption.encrypt).toHaveBeenCalledWith(['project1', 'project2']);
      expect(mockStorage.local.set).toHaveBeenCalledWith({
        userProjects: expect.any(String), // Encrypted
        userProjects_encrypted: true,
        normalData: 'not encrypted' // Not encrypted
      });
    });

    test('handles multiple sensitive keys', async () => {
      await encryptedStorage.set({
        customInstructions: 'My instructions',
        chatHistory: ['chat1', 'chat2'],
        apiKeys: { key: 'secret' },
        publicData: 'visible'
      });

      expect(storageEncryption.encrypt).toHaveBeenCalledTimes(3);
      expect(mockStorage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          customInstructions_encrypted: true,
          chatHistory_encrypted: true,
          apiKeys_encrypted: true,
          publicData: 'visible' // Not encrypted
        })
      );
    });

    test('handles empty objects', async () => {
      await encryptedStorage.set({});
      
      expect(mockStorage.local.set).toHaveBeenCalledWith({});
    });
  });

  describe('get', () => {
    test('decrypts encrypted keys', async () => {
      // Pre-store encrypted data
      mockStorage.data = {
        userProjects: btoa(JSON.stringify(['project1', 'project2'])),
        userProjects_encrypted: true,
        normalData: 'not encrypted'
      };

      const result = await encryptedStorage.get(['userProjects', 'normalData']);

      expect(storageEncryption.decrypt).toHaveBeenCalledWith(
        mockStorage.data.userProjects
      );
      expect(result).toEqual({
        userProjects: ['project1', 'project2'],
        normalData: 'not encrypted'
      });
    });

    test('returns null for failed decryption', async () => {
      storageEncryption.decrypt.mockRejectedValue(new Error('Decryption failed'));
      
      mockStorage.data = {
        userProjects: 'corrupted-data',
        userProjects_encrypted: true
      };

      const result = await encryptedStorage.get(['userProjects']);

      expect(result.userProjects).toBeNull();
    });

    test('handles mixed encrypted/unencrypted data', async () => {
      mockStorage.data = {
        customInstructions: btoa(JSON.stringify('My instructions')),
        customInstructions_encrypted: true,
        telemetrySessionId: btoa(JSON.stringify('session-123')),
        telemetrySessionId_encrypted: true,
        publicSetting: 'visible',
        anotherSetting: 42
      };

      const result = await encryptedStorage.get([
        'customInstructions',
        'telemetrySessionId',
        'publicSetting',
        'anotherSetting'
      ]);

      expect(result).toEqual({
        customInstructions: 'My instructions',
        telemetrySessionId: 'session-123',
        publicSetting: 'visible',
        anotherSetting: 42
      });
    });

    test('handles non-existent keys', async () => {
      const result = await encryptedStorage.get(['nonExistentKey']);
      
      expect(result).toEqual({});
    });
  });

  describe('shouldEncrypt', () => {
    test('identifies sensitive keys correctly', () => {
      const sensitiveKeys = [
        'userProjects',
        'customInstructions',
        'chatHistory',
        'apiKeys',
        'userPreferences',
        'telemetrySessionId'
      ];

      sensitiveKeys.forEach(key => {
        expect(encryptedStorage.shouldEncrypt(key)).toBe(true);
      });
    });

    test('identifies non-sensitive keys correctly', () => {
      const normalKeys = [
        'theme',
        'language',
        'version',
        'lastUpdate',
        'featureFlags'
      ];

      normalKeys.forEach(key => {
        expect(encryptedStorage.shouldEncrypt(key)).toBe(false);
      });
    });
  });
});

describe('Integration scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage.data = {};
    
    // Use real encryption/decryption flow
    jest.restoreAllMocks();
    
    // Mock crypto operations with realistic behavior
    const mockEncryptedData = new Map();
    
    mockCrypto.subtle.encrypt.mockImplementation(async (algorithm, key, data) => {
      const id = Math.random().toString(36);
      mockEncryptedData.set(id, data);
      return new TextEncoder().encode(id).buffer;
    });
    
    mockCrypto.subtle.decrypt.mockImplementation(async (algorithm, key, data) => {
      const id = new TextDecoder().decode(data);
      return mockEncryptedData.get(id) || new ArrayBuffer(0);
    });
  });

  test('full encryption/decryption cycle', async () => {
    const testData = {
      userProjects: [
        { id: 1, name: 'Project Alpha', sensitive: true },
        { id: 2, name: 'Project Beta', sensitive: false }
      ]
    };

    // Store encrypted
    await encryptedStorage.set(testData);
    
    // Retrieve and decrypt
    const retrieved = await encryptedStorage.get(['userProjects']);
    
    expect(retrieved.userProjects).toEqual(testData.userProjects);
  });

  test('handles concurrent operations', async () => {
    const operations = [];
    
    // Concurrent writes
    for (let i = 0; i < 5; i++) {
      operations.push(
        encryptedStorage.set({
          [`userProjects_${i}`]: `Project ${i} data`
        })
      );
    }
    
    await Promise.all(operations);
    
    // Concurrent reads
    const readOps = [];
    for (let i = 0; i < 5; i++) {
      readOps.push(encryptedStorage.get([`userProjects_${i}`]));
    }
    
    const results = await Promise.all(readOps);
    
    results.forEach((result, i) => {
      expect(result[`userProjects_${i}`]).toBe(`Project ${i} data`);
    });
  });
});