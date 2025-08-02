# Test Implementation Examples - Image Restrictions (Issue #24)

## Quick Start Test Implementation for Eva

### 1. Image Classifier Test Setup
```typescript
// tests/image/image-classifier.test.ts
import { ImageClassifier } from '../../src/core/image-classifier';

describe('Image Classifier - DALL-E Detection', () => {
  let classifier: ImageClassifier;
  
  beforeEach(() => {
    classifier = new ImageClassifier();
  });
  
  describe('isDalleImage', () => {
    it('should identify DALL-E URLs correctly', () => {
      const dalleUrls = [
        'https://oaiusercontent.com/file-abc123.png',
        'https://cdn.openai.com/dall-e/generated.jpg',
        'https://images.openai.com/dalle/result.webp'
      ];
      
      dalleUrls.forEach(url => {
        expect(classifier.isDalleImage(url)).toBe(true);
      });
    });
    
    it('should reject non-DALL-E URLs', () => {
      const nonDalleUrls = [
        'https://chat.openai.com/avatar.png',
        'https://example.com/image.jpg',
        '/static/icons/logo.svg',
        'data:image/png;base64,screenshot'
      ];
      
      nonDalleUrls.forEach(url => {
        expect(classifier.isDalleImage(url)).toBe(false);
      });
    });
  });
});
```

### 2. UI Element Filter Implementation
```typescript
// tests/image/ui-element-filter.test.ts
describe('UI Element Filtering', () => {
  it('should filter out avatar images', () => {
    const avatarImg = document.createElement('img');
    avatarImg.src = '/avatar/user-profile.png';
    avatarImg.className = 'user-avatar';
    
    expect(classifier.isUIElement(avatarImg)).toBe(true);
    expect(classifier.shouldDownload(avatarImg)).toBe(false);
  });
  
  it('should filter out UI icons', () => {
    const iconImg = document.createElement('img');
    iconImg.src = '/assets/icons/settings.svg';
    iconImg.setAttribute('role', 'button');
    
    expect(classifier.isUIElement(iconImg)).toBe(true);
  });
  
  it('should filter out logos', () => {
    const logoImg = document.createElement('img');
    logoImg.src = '/images/openai-logo.png';
    logoImg.alt = 'OpenAI Logo';
    
    expect(classifier.isUIElement(logoImg)).toBe(true);
  });
});
```

### 3. Screenshot Detection Tests
```typescript
// tests/image/screenshot-detection.test.ts
describe('Screenshot Detection', () => {
  it('should detect clipboard paste screenshots', async () => {
    const mockFile = new File(['image'], 'screenshot.png', {
      type: 'image/png',
      lastModified: Date.now()
    });
    
    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: new DataTransfer()
    });
    pasteEvent.clipboardData!.files = [mockFile] as any;
    
    const detector = new ScreenshotDetector();
    const result = await detector.handlePaste(pasteEvent);
    
    expect(result.isScreenshot).toBe(true);
    expect(result.shouldBlock).toBe(true);
  });
  
  it('should detect data URL images as screenshots', () => {
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    expect(classifier.isScreenshot(dataUrl)).toBe(true);
  });
  
  it('should detect blob URLs as potential screenshots', () => {
    const blobUrl = 'blob:https://chat.openai.com/550e8400-e29b-41d4-a716-446655440000';
    
    expect(classifier.isScreenshot(blobUrl)).toBe(true);
  });
});
```

### 4. Download Queue Integration Test
```typescript
// tests/integration/download-queue-filtering.test.ts
describe('Download Queue Image Filtering', () => {
  let downloadQueue: ImageDownloadQueue;
  
  beforeEach(() => {
    downloadQueue = new ImageDownloadQueue();
    document.body.innerHTML = '';
  });
  
  it('should only queue DALL-E images', async () => {
    // Add various image types to DOM
    const images = [
      { src: 'https://oaiusercontent.com/dalle-1.png', type: 'dalle' },
      { src: '/static/avatar.png', type: 'avatar' },
      { src: 'data:image/png;base64,abc', type: 'screenshot' },
      { src: 'https://oaiusercontent.com/dalle-2.jpg', type: 'dalle' }
    ];
    
    images.forEach(({ src, type }) => {
      const img = document.createElement('img');
      img.src = src;
      img.className = type;
      document.body.appendChild(img);
    });
    
    await downloadQueue.scanAndQueue();
    
    const queuedItems = downloadQueue.getQueuedImages();
    expect(queuedItems).toHaveLength(2);
    expect(queuedItems.every(item => item.src.includes('oaiusercontent'))).toBe(true);
  });
});
```

### 5. Performance Test
```typescript
// tests/performance/image-scanning.test.ts
describe('Image Scanning Performance', () => {
  it('should process 1000 images efficiently', async () => {
    // Create 1000 test images
    const fragment = document.createDocumentFragment();
    
    for (let i = 0; i < 1000; i++) {
      const img = document.createElement('img');
      img.src = i % 10 === 0 
        ? `https://oaiusercontent.com/dalle-${i}.png`
        : `/static/ui/element-${i}.svg`;
      fragment.appendChild(img);
    }
    
    document.body.appendChild(fragment);
    
    const startTime = performance.now();
    const results = await downloadQueue.scanAndQueue();
    const endTime = performance.now();
    
    expect(endTime - startTime).toBeLessThan(100); // Under 100ms
    expect(results.queued).toBe(100); // 10% are DALL-E images
    expect(results.filtered).toBe(900);
  });
});
```

### 6. Mock Implementation Helper
```typescript
// tests/helpers/image-test-utils.ts
export class ImageTestUtils {
  static createDalleImage(id: string): HTMLImageElement {
    const img = document.createElement('img');
    img.src = `https://oaiusercontent.com/file-${id}.png`;
    img.setAttribute('data-dalle-source', 'true');
    return img;
  }
  
  static createUIElement(type: 'avatar' | 'icon' | 'logo'): HTMLImageElement {
    const img = document.createElement('img');
    
    switch (type) {
      case 'avatar':
        img.src = '/assets/avatar-default.png';
        img.className = 'user-avatar';
        break;
      case 'icon':
        img.src = '/icons/settings.svg';
        img.setAttribute('role', 'button');
        break;
      case 'logo':
        img.src = '/images/company-logo.png';
        img.alt = 'Company Logo';
        break;
    }
    
    return img;
  }
  
  static createScreenshot(type: 'data' | 'blob' = 'data'): string {
    if (type === 'data') {
      return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB...';
    }
    return 'blob:https://example.com/123e4567-e89b-12d3-a456-426614174000';
  }
}
```

## Implementation Checklist for Eva

- [ ] Implement ImageClassifier with URL pattern matching
- [ ] Add DOM attribute checking for DALL-E detection
- [ ] Create UI element detection logic
- [ ] Implement screenshot detection (data URLs, blobs)
- [ ] Integrate with existing download queue
- [ ] Add performance optimizations for large pages
- [ ] Test with real ChatGPT/Claude pages
- [ ] Handle edge cases (malformed URLs, dynamic loading)

## Quick Test Commands
```bash
# Run image restriction tests
npm test -- image-classifier.test.ts

# Run with coverage
npm test -- --coverage image/

# Watch mode for development
npm test -- --watch image-restrictions

# Performance tests only
npm test -- performance/image-scanning
```

## Key Implementation Points

1. **URL Pattern Matching**: Check for oaiusercontent.com, dall-e, openai domains
2. **DOM Context**: Check parent elements, attributes, classes
3. **Screenshot Detection**: Identify data: and blob: URLs
4. **UI Elements**: Filter avatars, icons, logos by URL patterns and DOM attributes
5. **Performance**: Use efficient selectors and batch operations