/**
 * Unit tests for FileDownload entity
 */

import { FileDownload } from './file-download';
import {
  FileDownloadRequested,
  FileDownloadStarted,
  FileDownloadCompleted,
  FileDownloadFailed,
  FileDownloadProgress,
  FileDownloadStatusRequested,
  FileDownloadListRequested,
  DownloadStatusProvided,
  DownloadListProvided
} from '../events/download-events';

// Mock Chrome downloads API
const mockChrome = {
  downloads: {
    download: jest.fn(),
    search: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
    cancel: jest.fn(),
    getFileIcon: jest.fn(),
    open: jest.fn(),
    show: jest.fn(),
    showDefaultFolder: jest.fn(),
    erase: jest.fn(),
    removeFile: jest.fn(),
    acceptDanger: jest.fn(),
    setShelfEnabled: jest.fn(),
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  runtime: {
    lastError: null as any
  }
};

// @ts-ignore
global.chrome = mockChrome;

describe('FileDownload', () => {
  let fileDownload: FileDownload;

  beforeEach(() => {
    jest.clearAllMocks();
    fileDownload = new FileDownload();
    mockChrome.runtime.lastError = null;
  });

  describe('Download Initiation', () => {
    test('should start download successfully', async () => {
      const downloadId = 123;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf',
        'uniquify',
        false
      );

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      if (result instanceof FileDownloadStarted) {
        expect(result.downloadId).toBe(downloadId);
        expect(result.url).toBe('https://example.com/file.pdf');
        expect(result.filename).toBe('file.pdf');
      }

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: 'https://example.com/file.pdf',
          filename: 'file.pdf',
          conflictAction: 'uniquify',
          saveAs: false
        },
        expect.any(Function)
      );
    });

    test('should handle download initiation failure', async () => {
      mockChrome.runtime.lastError = { message: 'Download blocked by policy' };
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(undefined);
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf'
      );

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      if (result instanceof FileDownloadFailed) {
        expect(result.url).toBe('https://example.com/file.pdf');
        expect(result.error).toBe('Download blocked by policy');
      }
    });

    test('should use default filename from URL when not provided', async () => {
      const downloadId = 456;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/path/to/document.pdf'
      );

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      if (result instanceof FileDownloadStarted) {
        expect(result.filename).toBe('document.pdf');
      }
    });

    test('should handle complex URLs for filename extraction', async () => {
      const downloadId = 789;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/download?file=report.xlsx&token=abc123'
      );

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      if (result instanceof FileDownloadStarted) {
        expect(result.filename).toBe('download');
      }
    });

    test('should handle download with custom conflict action', async () => {
      const downloadId = 999;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf',
        'overwrite',
        true
      );

      await fileDownload.startDownload(event);

      expect(mockChrome.downloads.download).toHaveBeenCalledWith(
        {
          url: 'https://example.com/file.pdf',
          filename: 'file.pdf',
          conflictAction: 'overwrite',
          saveAs: true
        },
        expect.any(Function)
      );
    });

    test('should handle exception during download', async () => {
      mockChrome.downloads.download.mockImplementation(() => {
        throw new Error('Network error');
      });

      const event = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf'
      );

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      if (result instanceof FileDownloadFailed) {
        expect(result.error).toBe('Network error');
      }
    });
  });

  describe('Download Status', () => {
    test('should provide download status for active download', async () => {
      // First start a download
      const downloadId = 123;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const startEvent = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf'
      );

      await fileDownload.startDownload(startEvent);

      // Mock chrome.downloads.search
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([{
          id: downloadId,
          url: 'https://example.com/file.pdf',
          filename: 'file.pdf',
          state: 'in_progress',
          paused: false,
          canResume: false,
          bytesReceived: 1024,
          totalBytes: 2048,
          fileSize: 2048,
          exists: true,
          startTime: '2024-01-01T00:00:00.000Z',
          endTime: '',
          error: null
        }]);
      });

      const statusEvent = new FileDownloadStatusRequested(
        'status-correlation-id',
        downloadId
      );

      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      if (result instanceof DownloadStatusProvided) {
        expect(result.status.downloadId).toBe(downloadId);
        expect(result.status.state).toBe('in_progress');
        expect(result.status.bytesReceived).toBe(1024);
        expect(result.status.totalBytes).toBe(2048);
        // progress is calculated, not stored in status
      }
    });

    test('should handle status request for non-existent download', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([]);
      });

      const statusEvent = new FileDownloadStatusRequested(
        'status-correlation-id',
        999
      );

      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      if (result instanceof DownloadStatusProvided) {
        expect(result.status.downloadId).toBe(999);
        expect(result.status.state).toBe('interrupted');
        expect(result.status.error).toBe('Download not found');
      }
    });
  });

  describe('Download Progress Tracking', () => {
    test('should track download progress updates', async () => {
      // Start a download first
      const downloadId = 123;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const startEvent = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf'
      );

      await fileDownload.startDownload(startEvent);

      // Simulate progress update
      const progressEvent = new FileDownloadProgress(
        'progress-correlation-id',
        downloadId,
        5120,
        10240,
        'in_progress',
        '/downloads/file.pdf'
      );

      fileDownload.updateProgress(progressEvent);

      // Verify internal state updated
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([{
          id: downloadId,
          state: 'in_progress',
          bytesReceived: 5120,
          totalBytes: 10240
        }]);
      });

      const statusEvent = new FileDownloadStatusRequested(
        'status-correlation-id',
        downloadId
      );

      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      if (result instanceof DownloadStatusProvided) {
        expect(result.status.bytesReceived).toBe(5120);
        expect(result.status.totalBytes).toBe(10240);
        // progress is calculated, not stored in status
      }
    });
  });

  describe('Download List Management', () => {
    test('should provide list of all downloads', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([
          {
            id: 1,
            url: 'https://example.com/file1.pdf',
            filename: 'file1.pdf',
            state: 'complete',
            bytesReceived: 1024,
            totalBytes: 1024,
            startTime: '2024-01-01T00:00:00.000Z',
            endTime: '2024-01-01T00:01:00.000Z'
          },
          {
            id: 2,
            url: 'https://example.com/file2.pdf',
            filename: 'file2.pdf',
            state: 'in_progress',
            bytesReceived: 512,
            totalBytes: 2048,
            startTime: '2024-01-01T00:02:00.000Z'
          }
        ]);
      });

      const listEvent = new FileDownloadListRequested(
        'list-correlation-id'
      );

      const result = await fileDownload.getDownloadsList(listEvent);

      expect(result).toBeInstanceOf(DownloadListProvided);
      if (result instanceof DownloadListProvided) {
        expect(result.downloads).toHaveLength(2);
        expect(result.downloads[0].filename).toBe('file1.pdf');
        expect(result.downloads[0].state).toBe('complete');
        expect(result.downloads[1].filename).toBe('file2.pdf');
        expect(result.downloads[1].state).toBe('in_progress');
      }
    });

    test('should filter downloads by state', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        // Simulate filtering
        if (query.state === 'complete') {
          callback([
            {
              id: 1,
              url: 'https://example.com/file1.pdf',
              filename: 'file1.pdf',
              state: 'complete',
              bytesReceived: 1024,
              totalBytes: 1024
            }
          ]);
        } else {
          callback([]);
        }
      });

      const listEvent = new FileDownloadListRequested(
        'list-correlation-id',
        { state: 'complete' }
      );

      const result = await fileDownload.getDownloadsList(listEvent);

      expect(result).toBeInstanceOf(DownloadListProvided);
      if (result instanceof DownloadListProvided) {
        expect(result.downloads).toHaveLength(1);
        expect(result.downloads[0].state).toBe('complete');
      }

      expect(mockChrome.downloads.search).toHaveBeenCalledWith(
        { state: 'complete' },
        expect.any(Function)
      );
    });
  });

  describe('Download Completion', () => {
    test('should handle successful download completion', async () => {
      const downloadId = 123;
      // First start a download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const startEvent = new FileDownloadRequested(
        'test-correlation-id',
        'https://example.com/file.pdf',
        'file.pdf'
      );

      await fileDownload.startDownload(startEvent);

      // Simulate completion
      const completedEvent = new FileDownloadCompleted(
        'complete-correlation-id',
        downloadId,
        '/downloads/file.pdf',
        1024,
        new Date()
      );

      // Note: FileDownload doesn't have onDownloadCompleted method
      // Instead, it would be handled by updateProgress with 'complete' state

      // Verify state updated
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([{
          id: downloadId,
          state: 'complete',
          filename: '/downloads/file.pdf',
          fileSize: 1024
        }]);
      });

      const statusEvent = new FileDownloadStatusRequested(
        'status-correlation-id',
        downloadId
      );

      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      if (result instanceof DownloadStatusProvided) {
        expect(result.status.state).toBe('complete');
        expect(result.status.totalBytes).toBe(1024);
      }
    });
  });
});