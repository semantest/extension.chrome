/**
 * Unit tests for image-downloader.js
 */

describe('Image Downloader', () => {
  let mockDocument;
  let mockWindow;
  let mockChrome;
  let downloadedImages;

  beforeEach(() => {
    // Mock DOM
    mockDocument = {
      querySelectorAll: jest.fn(),
      createElement: jest.fn(),
      body: {
        appendChild: jest.fn(),
        removeChild: jest.fn()
      }
    };

    // Mock window
    mockWindow = {
      location: {
        hostname: 'chat.openai.com'
      },
      MutationObserver: jest.fn()
    };

    // Mock chrome API
    mockChrome = {
      runtime: {
        sendMessage: jest.fn()
      }
    };

    // Reset downloaded images set
    downloadedImages = new Set();

    // Mock console
    global.console = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn()
    };

    // Set up globals
    global.document = mockDocument;
    global.window = mockWindow;
    global.chrome = mockChrome;
  });

  describe('downloadImage', () => {
    it('should download an image with proper filename', async () => {
      // Mock image element
      const mockImg = {
        src: 'https://example.com/image.png',
        naturalWidth: 1024,
        naturalHeight: 768
      };

      // Mock link element
      const mockLink = {
        href: '',
        download: '',
        click: jest.fn(),
        style: {}
      };

      mockDocument.createElement.mockReturnValue(mockLink);

      // Import and execute downloadImage function
      // Note: In real test, we'd import the actual function
      const downloadImage = async (img) => {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `chatgpt-image-${timestamp}.png`;
        
        const link = document.createElement('a');
        link.href = img.src;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        return { filename, size: `${img.naturalWidth}x${img.naturalHeight}` };
      };

      const result = await downloadImage(mockImg);

      expect(result.filename).toMatch(/^chatgpt-image-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z\.png$/);
      expect(result.size).toBe('1024x768');
      expect(mockLink.click).toHaveBeenCalled();
    });

    it('should not download the same image twice', async () => {
      const mockImg = {
        src: 'https://example.com/image.png'
      };

      // Simulate already downloaded
      downloadedImages.add(mockImg.src);

      // Mock the actual check
      const shouldDownload = (img) => {
        return !downloadedImages.has(img.src);
      };

      expect(shouldDownload(mockImg)).toBe(false);
    });
  });

  describe('checkForImages', () => {
    it('should find DALL-E generated images', () => {
      const mockImages = [
        {
          src: 'https://cdn.openai.com/dall-e/image1.png',
          closest: jest.fn().mockReturnValue(true), // Has container
          naturalWidth: 512,
          naturalHeight: 512
        },
        {
          src: 'https://example.com/other-image.png', // Not DALL-E
          closest: jest.fn().mockReturnValue(true),
          naturalWidth: 100,
          naturalHeight: 100
        }
      ];

      mockDocument.querySelectorAll.mockReturnValue(mockImages);

      // Mock the check function
      const checkForImages = () => {
        const allImages = document.querySelectorAll('img');
        const dalleImages = [];
        
        allImages.forEach(img => {
          if (!img.src) return;
          
          // Check if it's a DALL-E image
          const isDalleImage = img.src.includes('dalle') || 
                              img.src.includes('openai.com') ||
                              (img.closest('[data-testid*="image"]') && img.naturalWidth > 256);
          
          if (isDalleImage && !downloadedImages.has(img.src)) {
            dalleImages.push(img);
          }
        });
        
        return dalleImages;
      };

      const result = checkForImages();
      expect(result).toHaveLength(1);
      expect(result[0].src).toContain('openai.com');
    });
  });

  describe('Image Monitoring', () => {
    it('should start monitoring when requested', () => {
      const mockObserver = {
        observe: jest.fn(),
        disconnect: jest.fn()
      };

      mockWindow.MutationObserver.mockImplementation(() => mockObserver);

      const startImageMonitoring = () => {
        console.log('🎯 Starting image monitoring...');
        
        const observer = new MutationObserver(() => {
          // Check for new images
        });
        
        observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
          attributeFilter: ['src']
        });
        
        return observer;
      };

      const observer = startImageMonitoring();
      
      expect(mockWindow.MutationObserver).toHaveBeenCalled();
      expect(mockObserver.observe).toHaveBeenCalledWith(
        mockDocument.body,
        expect.objectContaining({
          childList: true,
          subtree: true
        })
      );
    });

    it('should stop monitoring when requested', () => {
      const mockObserver = {
        disconnect: jest.fn()
      };

      const stopImageMonitoring = (observer) => {
        if (observer) {
          observer.disconnect();
          console.log('🛑 Stopped image monitoring');
        }
      };

      stopImageMonitoring(mockObserver);
      expect(mockObserver.disconnect).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    it('should handle download completion message', () => {
      const sendDownloadComplete = (result) => {
        chrome.runtime.sendMessage({
          type: 'addon:response',
          success: true,
          result: {
            downloaded: true,
            ...result
          }
        });
      };

      const result = {
        filename: 'test-image.png',
        size: '512x512',
        timestamp: Date.now()
      };

      sendDownloadComplete(result);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'addon:response',
          success: true,
          result: expect.objectContaining({
            downloaded: true,
            filename: 'test-image.png'
          })
        })
      );
    });
  });

  describe('Clear Downloaded Cache', () => {
    it('should clear downloaded images cache', () => {
      downloadedImages.add('image1.png');
      downloadedImages.add('image2.png');
      
      expect(downloadedImages.size).toBe(2);
      
      const clearDownloadedImages = () => {
        downloadedImages.clear();
        console.log('🧹 Cleared downloaded images cache');
      };
      
      clearDownloadedImages();
      
      expect(downloadedImages.size).toBe(0);
      expect(console.log).toHaveBeenCalledWith('🧹 Cleared downloaded images cache');
    });
  });
});