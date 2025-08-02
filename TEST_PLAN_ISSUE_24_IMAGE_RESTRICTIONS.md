# Test Plan: Issue #24 - Chat Image Restrictions

## Feature Overview
Implement restrictions on image handling in chat sessions to prevent downloading chat images, focusing only on DALL-E generated images while excluding UI elements, avatars, and screenshots.

## Test Categories

### 1. Image Classification Tests

#### 1.1 DALL-E Image Detection
```typescript
describe('DALL-E Image Detection', () => {
  it('should correctly identify DALL-E generated images', () => {
    const dalleUrls = [
      'https://oaiusercontent.com/file-abc123',
      'https://cdn.openai.com/dall-e/image-xyz789',
      'https://images.openai.com/dalle-generated/test.png'
    ];
    
    dalleUrls.forEach(url => {
      expect(imageClassifier.isDalleImage(url)).toBe(true);
    });
  });

  it('should detect DALL-E images by DOM attributes', () => {
    const img = document.createElement('img');
    img.setAttribute('data-dalle-source', 'true');
    img.src = 'https://example.com/image.png';
    
    expect(imageClassifier.isDalleImage(img)).toBe(true);
  });

  it('should detect DALL-E images by parent context', () => {
    const container = document.createElement('div');
    container.className = 'dalle-image-container';
    
    const img = document.createElement('img');
    img.src = 'https://example.com/image.png';
    container.appendChild(img);
    
    expect(imageClassifier.isDalleImage(img)).toBe(true);
  });
});
```

#### 1.2 UI Element Detection
```typescript
describe('UI Element Detection', () => {
  it('should exclude avatar images', () => {
    const avatarUrls = [
      'https://chat.openai.com/avatar/user.png',
      'https://claude.ai/profile/avatar.jpg',
      '/static/images/default-avatar.svg'
    ];
    
    avatarUrls.forEach(url => {
      expect(imageClassifier.isUIElement(url)).toBe(true);
    });
  });

  it('should exclude UI icons and buttons', () => {
    const img = document.createElement('img');
    img.className = 'icon-button';
    img.src = '/assets/icons/send.svg';
    
    expect(imageClassifier.isUIElement(img)).toBe(true);
  });

  it('should exclude logo images', () => {
    const logoSelectors = [
      'img[alt*="logo"]',
      'img.brand-logo',
      'img[src*="/logo"]'
    ];
    
    logoSelectors.forEach(selector => {
      const img = document.createElement('img');
      if (selector.includes('alt')) {
        img.alt = 'Company logo';
      } else if (selector.includes('class')) {
        img.className = 'brand-logo';
      } else {
        img.src = '/assets/logo.png';
      }
      
      expect(imageClassifier.isUIElement(img)).toBe(true);
    });
  });
});
```

### 2. Screenshot Detection Tests

#### 2.1 Paste Event Handling
```typescript
describe('Screenshot Detection', () => {
  it('should detect pasted screenshots', async () => {
    const pasteListener = jest.fn();
    imageMonitor.on('screenshot-detected', pasteListener);
    
    // Simulate paste event with image
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer()
    });
    
    const file = new File(['image data'], 'screenshot.png', {
      type: 'image/png'
    });
    
    pasteEvent.clipboardData!.items.add(file);
    document.dispatchEvent(pasteEvent);
    
    await waitFor(() => {
      expect(pasteListener).toHaveBeenCalledWith({
        type: 'screenshot',
        source: 'clipboard',
        blocked: true
      });
    });
  });

  it('should detect data URL screenshots', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANS...';
    const img = document.createElement('img');
    img.src = dataUrl;
    
    expect(imageClassifier.isScreenshot(img)).toBe(true);
  });

  it('should detect blob URL screenshots', () => {
    const blobUrl = 'blob:https://chat.openai.com/12345-67890';
    const img = document.createElement('img');
    img.src = blobUrl;
    
    expect(imageClassifier.isScreenshot(img)).toBe(true);
  });
});
```

### 3. Download Prevention Tests

#### 3.1 Queue Filtering
```typescript
describe('Download Queue Filtering', () => {
  it('should only queue DALL-E images', async () => {
    const images = [
      { src: 'https://oaiusercontent.com/dalle-image.png', shouldDownload: true },
      { src: 'https://chat.openai.com/avatar.png', shouldDownload: false },
      { src: 'data:image/png;base64,screenshot', shouldDownload: false },
      { src: '/static/icons/menu.svg', shouldDownload: false }
    ];
    
    images.forEach(({ src, shouldDownload }) => {
      const img = document.createElement('img');
      img.src = src;
      document.body.appendChild(img);
    });
    
    await imageDownloader.scanForImages();
    
    const queuedImages = imageDownloader.getQueue();
    expect(queuedImages).toHaveLength(1);
    expect(queuedImages[0].src).toContain('oaiusercontent.com');
  });

  it('should not re-download already processed images', async () => {
    const img = document.createElement('img');
    img.src = 'https://oaiusercontent.com/dalle-test.png';
    
    // First download
    await imageDownloader.processImage(img);
    const firstQueueLength = imageDownloader.getQueue().length;
    
    // Attempt second download
    await imageDownloader.processImage(img);
    const secondQueueLength = imageDownloader.getQueue().length;
    
    expect(secondQueueLength).toBe(firstQueueLength);
  });
});
```

### 4. Performance Tests

#### 4.1 Image Scanning Performance
```typescript
describe('Performance', () => {
  it('should scan 1000 images in under 100ms', async () => {
    // Create 1000 mixed images
    for (let i = 0; i < 1000; i++) {
      const img = document.createElement('img');
      img.src = i % 10 === 0 
        ? `https://oaiusercontent.com/dalle-${i}.png`
        : `/static/ui/icon-${i}.svg`;
      document.body.appendChild(img);
    }
    
    const startTime = performance.now();
    await imageDownloader.scanForImages();
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100);
    expect(imageDownloader.getQueue()).toHaveLength(100); // 10% are DALL-E
  });

  it('should not block UI during classification', async () => {
    const heavyClassifier = {
      classify: async (img: HTMLImageElement) => {
        // Simulate heavy computation
        await new Promise(resolve => setTimeout(resolve, 10));
        return 'dalle';
      }
    };
    
    imageDownloader.setClassifier(heavyClassifier);
    
    let uiBlocked = false;
    const rafPromise = new Promise(resolve => {
      requestAnimationFrame(() => {
        uiBlocked = false;
        resolve(true);
      });
    });
    
    uiBlocked = true;
    await imageDownloader.scanForImages();
    await rafPromise;
    
    expect(uiBlocked).toBe(false);
  });
});
```

### 5. Integration Tests

#### 5.1 ChatGPT Specific Tests
```typescript
describe('ChatGPT Integration', () => {
  beforeEach(() => {
    mockChatGPTEnvironment();
  });

  it('should ignore ChatGPT UI images', async () => {
    const uiImages = [
      '.user-avatar img',
      '.assistant-avatar img',
      '.sidebar-logo',
      '.model-selector img'
    ];
    
    uiImages.forEach(selector => {
      const img = document.querySelector(selector) as HTMLImageElement;
      expect(imageClassifier.shouldDownload(img)).toBe(false);
    });
  });

  it('should detect DALL-E images in message containers', async () => {
    const messageHTML = `
      <div class="message">
        <img src="https://oaiusercontent.com/dalle-result.png" 
             alt="DALL-E generated image">
      </div>
    `;
    
    document.body.innerHTML = messageHTML;
    await imageDownloader.scanForImages();
    
    expect(imageDownloader.getQueue()).toHaveLength(1);
  });
});
```

### 6. Edge Case Tests

#### 6.1 Dynamic Image Loading
```typescript
describe('Dynamic Content', () => {
  it('should handle lazy-loaded images', async () => {
    const img = document.createElement('img');
    img.setAttribute('data-src', 'https://oaiusercontent.com/dalle-lazy.png');
    img.className = 'lazy-load';
    
    document.body.appendChild(img);
    
    // Simulate lazy load
    img.src = img.getAttribute('data-src')!;
    img.dispatchEvent(new Event('load'));
    
    await waitFor(() => {
      expect(imageDownloader.getQueue()).toContainEqual(
        expect.objectContaining({ src: expect.stringContaining('dalle-lazy.png') })
      );
    });
  });

  it('should handle images added via innerHTML', async () => {
    const observer = imageDownloader.startObserving();
    
    document.body.innerHTML += `
      <img src="https://oaiusercontent.com/dalle-dynamic.png">
    `;
    
    await waitFor(() => {
      expect(imageDownloader.getQueue()).toContainEqual(
        expect.objectContaining({ src: expect.stringContaining('dalle-dynamic.png') })
      );
    });
  });
});
```

### 7. Error Handling Tests

#### 7.1 Malformed URLs
```typescript
describe('Error Handling', () => {
  it('should handle malformed image URLs gracefully', () => {
    const malformedUrls = [
      'not-a-url',
      'javascript:alert(1)',
      '//missing-protocol.com/image.png',
      'https://',
      null,
      undefined
    ];
    
    malformedUrls.forEach(url => {
      expect(() => {
        imageClassifier.classify(url as any);
      }).not.toThrow();
    });
  });

  it('should handle classification errors', async () => {
    const errorClassifier = {
      classify: () => {
        throw new Error('Classification failed');
      }
    };
    
    imageDownloader.setClassifier(errorClassifier);
    const consoleSpy = jest.spyOn(console, 'error');
    
    const img = document.createElement('img');
    img.src = 'https://oaiusercontent.com/test.png';
    
    await imageDownloader.processImage(img);
    
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to classify image'),
      expect.any(Error)
    );
  });
});
```

## Test Utilities

```typescript
// Image classification test helpers
class TestImageClassifier {
  isDalleImage(source: string | HTMLImageElement): boolean {
    if (typeof source === 'string') {
      return source.includes('oaiusercontent') || 
             source.includes('dall-e') ||
             source.includes('dalle');
    }
    
    const img = source;
    return this.isDalleImage(img.src) ||
           img.hasAttribute('data-dalle-source') ||
           img.closest('.dalle-image-container') !== null;
  }
  
  isUIElement(source: string | HTMLImageElement): boolean {
    if (typeof source === 'string') {
      return source.includes('avatar') ||
             source.includes('logo') ||
             source.includes('icon') ||
             source.includes('/static/');
    }
    
    const img = source;
    return img.classList.contains('avatar') ||
           img.classList.contains('icon') ||
           img.alt?.toLowerCase().includes('logo') ||
           this.isUIElement(img.src);
  }
  
  isScreenshot(source: string | HTMLImageElement): boolean {
    if (typeof source === 'string') {
      return source.startsWith('data:') ||
             source.startsWith('blob:');
    }
    
    return this.isScreenshot(source.src);
  }
}

// Mock environment helpers
function mockChatGPTEnvironment() {
  document.body.innerHTML = `
    <div class="chat-container">
      <img class="user-avatar" src="/avatar/user.png">
      <img class="assistant-avatar" src="/avatar/assistant.png">
      <div class="message">
        <img src="https://oaiusercontent.com/dalle-test.png">
      </div>
    </div>
  `;
}
```

## Coverage Requirements

- **Unit Tests**: 95% coverage of classification logic
- **Integration Tests**: 90% coverage of platform-specific code
- **Performance Tests**: Verify <100ms for 1000 images
- **Error Handling**: 100% coverage of error paths

## Success Criteria

✅ Only DALL-E images are queued for download
✅ UI elements are never downloaded
✅ Screenshots are properly detected and blocked
✅ Performance remains optimal with many images
✅ No false positives in classification
✅ Graceful error handling
✅ Works across all supported platforms