/**
 * @jest-environment jsdom
 */

// Mock @typescript-eda/core
jest.mock('@typescript-eda/core', () => ({
  Event: class Event {
    public readonly timestamp: Date;
    constructor() {
      this.timestamp = new Date();
    }
  }
}));

import {
  FileDownloadRequested,
  FileDownloadStatusRequested,
  FileDownloadListRequested,
  FileDownloadStarted,
  FileDownloadProgress,
  FileDownloadCompleted,
  FileDownloadFailed,
  DownloadStatusProvided,
  DownloadListProvided,
  DownloadPatternDetected,
  DownloadPatternLearned,
  DownloadPatternExecuted,
  ServerFileAccessRequested,
  ServerFileAccessProvided,
  GoogleImageDownloadRequested,
  GoogleImageDownloadCompleted
} from './download-events';

describe('Download Domain Events', () => {
  describe('FileDownloadRequested', () => {
    it('should create event with required parameters', () => {
      const event = new FileDownloadRequested(
        'corr-123',
        'https://example.com/file.pdf'
      );

      expect(event.correlationId).toBe('corr-123');
      expect(event.url).toBe('https://example.com/file.pdf');
      expect(event.filename).toBeUndefined();
      expect(event.conflictAction).toBeUndefined();
      expect(event.saveAs).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with all parameters', () => {
      const event = new FileDownloadRequested(
        'corr-456',
        'https://example.com/file.pdf',
        'custom-name.pdf',
        'overwrite',
        true
      );

      expect(event.correlationId).toBe('corr-456');
      expect(event.url).toBe('https://example.com/file.pdf');
      expect(event.filename).toBe('custom-name.pdf');
      expect(event.conflictAction).toBe('overwrite');
      expect(event.saveAs).toBe(true);
    });
  });

  describe('FileDownloadStatusRequested', () => {
    it('should create event without downloadId', () => {
      const event = new FileDownloadStatusRequested('corr-789');

      expect(event.correlationId).toBe('corr-789');
      expect(event.downloadId).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with downloadId', () => {
      const event = new FileDownloadStatusRequested('corr-789', 12345);

      expect(event.correlationId).toBe('corr-789');
      expect(event.downloadId).toBe(12345);
    });
  });

  describe('FileDownloadListRequested', () => {
    it('should create event without query', () => {
      const event = new FileDownloadListRequested('corr-list');

      expect(event.correlationId).toBe('corr-list');
      expect(event.query).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with query', () => {
      const event = new FileDownloadListRequested('corr-list', {
        orderBy: ['startTime'],
        limit: 10,
        state: 'in_progress'
      });

      expect(event.correlationId).toBe('corr-list');
      expect(event.query).toEqual({
        orderBy: ['startTime'],
        limit: 10,
        state: 'in_progress'
      });
    });
  });

  describe('FileDownloadStarted', () => {
    it('should create event with all parameters', () => {
      const event = new FileDownloadStarted(
        'corr-start',
        123,
        'https://example.com/file.zip',
        'file.zip'
      );

      expect(event.correlationId).toBe('corr-start');
      expect(event.downloadId).toBe(123);
      expect(event.url).toBe('https://example.com/file.zip');
      expect(event.filename).toBe('file.zip');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('FileDownloadProgress', () => {
    it('should create event with required parameters', () => {
      const event = new FileDownloadProgress(
        456,
        'https://example.com/large.zip',
        'large.zip',
        'in_progress',
        1024000,
        10240000
      );

      expect(event.downloadId).toBe(456);
      expect(event.url).toBe('https://example.com/large.zip');
      expect(event.filename).toBe('large.zip');
      expect(event.state).toBe('in_progress');
      expect(event.bytesReceived).toBe(1024000);
      expect(event.totalBytes).toBe(10240000);
      expect(event.filepath).toBeUndefined();
      expect(event.error).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with all parameters', () => {
      const event = new FileDownloadProgress(
        456,
        'https://example.com/large.zip',
        'large.zip',
        'interrupted',
        5000000,
        10240000,
        '/tmp/downloads/large.zip',
        'Network error'
      );

      expect(event.filepath).toBe('/tmp/downloads/large.zip');
      expect(event.error).toBe('Network error');
    });
  });

  describe('FileDownloadCompleted', () => {
    it('should create event with required parameters', () => {
      const event = new FileDownloadCompleted(
        789,
        'https://example.com/complete.pdf',
        'complete.pdf',
        '/downloads/complete.pdf',
        2048000
      );

      expect(event.downloadId).toBe(789);
      expect(event.url).toBe('https://example.com/complete.pdf');
      expect(event.filename).toBe('complete.pdf');
      expect(event.filepath).toBe('/downloads/complete.pdf');
      expect(event.size).toBe(2048000);
      expect(event.mimeType).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with mimeType', () => {
      const event = new FileDownloadCompleted(
        789,
        'https://example.com/complete.pdf',
        'complete.pdf',
        '/downloads/complete.pdf',
        2048000,
        'application/pdf'
      );

      expect(event.mimeType).toBe('application/pdf');
    });
  });

  describe('FileDownloadFailed', () => {
    it('should create event without downloadId', () => {
      const event = new FileDownloadFailed(
        'corr-fail',
        'https://example.com/fail.zip',
        'Connection timeout'
      );

      expect(event.correlationId).toBe('corr-fail');
      expect(event.url).toBe('https://example.com/fail.zip');
      expect(event.error).toBe('Connection timeout');
      expect(event.downloadId).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with downloadId', () => {
      const event = new FileDownloadFailed(
        'corr-fail',
        'https://example.com/fail.zip',
        'Disk full',
        999
      );

      expect(event.downloadId).toBe(999);
    });
  });

  describe('DownloadStatusProvided', () => {
    it('should create event with status object', () => {
      const status = {
        downloadId: 123,
        url: 'https://example.com/status.doc',
        filename: 'status.doc',
        state: 'in_progress' as const,
        bytesReceived: 500000,
        totalBytes: 1000000,
        exists: true,
        paused: false,
        error: undefined
      };

      const event = new DownloadStatusProvided('corr-status', status);

      expect(event.correlationId).toBe('corr-status');
      expect(event.status).toEqual(status);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DownloadListProvided', () => {
    it('should create event with downloads array', () => {
      const downloads = [
        {
          id: 1,
          url: 'https://example.com/file1.zip',
          filename: 'file1.zip',
          state: 'complete' as const,
          bytesReceived: 1000000,
          totalBytes: 1000000,
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: '2024-01-15T10:05:00.000Z'
        },
        {
          id: 2,
          url: 'https://example.com/file2.zip',
          filename: 'file2.zip',
          state: 'in_progress' as const,
          bytesReceived: 500000,
          totalBytes: 2000000,
          startTime: '2024-01-15T10:10:00.000Z'
        }
      ];

      const event = new DownloadListProvided('corr-list', downloads);

      expect(event.correlationId).toBe('corr-list');
      expect(event.downloads).toEqual(downloads);
      expect(event.downloads.length).toBe(2);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DownloadPatternDetected', () => {
    it('should create event with all context', () => {
      const event = new DownloadPatternDetected(
        'https://example.com/pattern.pdf',
        'a.download-link',
        {
          tagName: 'A',
          className: 'download-link btn-primary',
          id: 'download-btn',
          textContent: 'Download PDF',
          href: 'https://example.com/pattern.pdf'
        },
        {
          hostname: 'example.com',
          pathname: '/downloads',
          title: 'Downloads Page'
        }
      );

      expect(event.url).toBe('https://example.com/pattern.pdf');
      expect(event.selector).toBe('a.download-link');
      expect(event.elementContext.tagName).toBe('A');
      expect(event.elementContext.className).toBe('download-link btn-primary');
      expect(event.pageContext.hostname).toBe('example.com');
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DownloadPatternLearned', () => {
    it('should create event with pattern data', () => {
      const context = {
        hostname: 'example.com',
        elementType: 'link',
        attributes: ['href', 'download']
      };

      const event = new DownloadPatternLearned(
        'pattern-123',
        'https://example.com/*.pdf',
        'a[download]',
        context,
        0.95
      );

      expect(event.patternId).toBe('pattern-123');
      expect(event.url).toBe('https://example.com/*.pdf');
      expect(event.selector).toBe('a[download]');
      expect(event.context).toEqual(context);
      expect(event.confidence).toBe(0.95);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('DownloadPatternExecuted', () => {
    it('should create event with execution results', () => {
      const event = new DownloadPatternExecuted(
        'pattern-456',
        789,
        true,
        1250
      );

      expect(event.patternId).toBe('pattern-456');
      expect(event.downloadId).toBe(789);
      expect(event.success).toBe(true);
      expect(event.executionTime).toBe(1250);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });

  describe('ServerFileAccessRequested', () => {
    it('should create event without targetPath', () => {
      const event = new ServerFileAccessRequested(
        'corr-access',
        111,
        'read'
      );

      expect(event.correlationId).toBe('corr-access');
      expect(event.downloadId).toBe(111);
      expect(event.requestedOperation).toBe('read');
      expect(event.targetPath).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with targetPath', () => {
      const event = new ServerFileAccessRequested(
        'corr-move',
        222,
        'move',
        '/new/location/file.zip'
      );

      expect(event.targetPath).toBe('/new/location/file.zip');
    });
  });

  describe('ServerFileAccessProvided', () => {
    it('should create success event with content', () => {
      const event = new ServerFileAccessProvided(
        'corr-read',
        333,
        'read',
        true,
        '/downloads/file.txt',
        'File content here'
      );

      expect(event.correlationId).toBe('corr-read');
      expect(event.downloadId).toBe(333);
      expect(event.operation).toBe('read');
      expect(event.success).toBe(true);
      expect(event.filepath).toBe('/downloads/file.txt');
      expect(event.content).toBe('File content here');
      expect(event.error).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create failure event with error', () => {
      const event = new ServerFileAccessProvided(
        'corr-delete',
        444,
        'delete',
        false,
        undefined,
        undefined,
        'Permission denied'
      );

      expect(event.success).toBe(false);
      expect(event.error).toBe('Permission denied');
    });
  });

  describe('GoogleImageDownloadRequested', () => {
    it('should create event with required parameters', () => {
      const event = new GoogleImageDownloadRequested(
        'corr-img',
        {
          src: 'https://example.com/image.jpg',
          alt: 'Example image',
          title: 'Download this image',
          width: 800,
          height: 600
        }
      );

      expect(event.correlationId).toBe('corr-img');
      expect(event.imageElement.src).toBe('https://example.com/image.jpg');
      expect(event.imageElement.alt).toBe('Example image');
      expect(event.searchQuery).toBeUndefined();
      expect(event.filename).toBeUndefined();
      expect(event.timestamp).toBeInstanceOf(Date);
    });

    it('should create event with all parameters', () => {
      const event = new GoogleImageDownloadRequested(
        'corr-img-full',
        {
          src: 'https://example.com/cat.jpg',
          alt: 'Cute cat'
        },
        'cats',
        'my-cat.jpg'
      );

      expect(event.searchQuery).toBe('cats');
      expect(event.filename).toBe('my-cat.jpg');
    });
  });

  describe('GoogleImageDownloadCompleted', () => {
    it('should create event with all metadata', () => {
      const event = new GoogleImageDownloadCompleted(
        'corr-img-done',
        555,
        'https://example.com/final.jpg',
        'final.jpg',
        '/downloads/final.jpg',
        {
          searchQuery: 'nature',
          alt: 'Beautiful sunset',
          title: 'Sunset photo',
          dimensions: { width: 1920, height: 1080 },
          size: 2500000
        }
      );

      expect(event.correlationId).toBe('corr-img-done');
      expect(event.downloadId).toBe(555);
      expect(event.imageUrl).toBe('https://example.com/final.jpg');
      expect(event.filename).toBe('final.jpg');
      expect(event.filepath).toBe('/downloads/final.jpg');
      expect(event.metadata.searchQuery).toBe('nature');
      expect(event.metadata.dimensions).toEqual({ width: 1920, height: 1080 });
      expect(event.metadata.size).toBe(2500000);
      expect(event.timestamp).toBeInstanceOf(Date);
    });
  });
});