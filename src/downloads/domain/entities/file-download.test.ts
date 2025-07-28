/**
 * Unit Tests for FileDownload Entity
 * Tests for file download operations and state management
 */

import { FileDownload } from './file-download';
import {
  FileDownloadRequested,
  FileDownloadStarted,
  FileDownloadFailed,
  FileDownloadProgress,
  FileDownloadStatusRequested,
  FileDownloadListRequested,
  DownloadStatusProvided,
  DownloadListProvided
} from '../events/download-events';

// Mock chrome.downloads API
const mockChrome = {
  downloads: {
    download: jest.fn(),
    search: jest.fn()
  },
  runtime: {
    lastError: null as any
  }
};

// Replace global chrome with mock
(global as any).chrome = mockChrome;

// Mock the Entity base class and @listen decorator
jest.mock('@typescript-eda/core', () => ({
  Entity: class MockEntity<T> {
    constructor() {}
  },
  listen: () => (target: any, propertyKey: string, descriptor: PropertyDescriptor) => descriptor
}));

describe('FileDownload', () => {
  let fileDownload: FileDownload;

  beforeEach(() => {
    fileDownload = new FileDownload();
    jest.clearAllMocks();
    mockChrome.runtime.lastError = null;
  });

  describe('startDownload', () => {
    test('should start download successfully', async () => {
      const downloadId = 123;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      expect((result as FileDownloadStarted).downloadId).toBe(downloadId);
      expect((result as FileDownloadStarted).url).toBe('https://example.com/file.pdf');
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: 'https://example.com/file.pdf',
        filename: undefined,
        conflictAction: 'uniquify',
        saveAs: false
      }, expect.any(Function));
    });

    test('should use provided filename', async () => {
      const downloadId = 124;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested(
        'corr-2',
        'https://example.com/file.pdf',
        'custom-name.pdf',
        'overwrite',
        true
      );
      
      const result = await fileDownload.startDownload(event);

      expect((result as FileDownloadStarted).filename).toBe('custom-name.pdf');
      expect(mockChrome.downloads.download).toHaveBeenCalledWith({
        url: 'https://example.com/file.pdf',
        filename: 'custom-name.pdf',
        conflictAction: 'overwrite',
        saveAs: true
      }, expect.any(Function));
    });

    test('should handle download failure with lastError', async () => {
      mockChrome.runtime.lastError = { message: 'Download blocked' };
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(undefined);
      });

      const event = new FileDownloadRequested('corr-3', 'https://example.com/file.pdf');
      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      expect((result as FileDownloadFailed).error).toBe('Download blocked');
    });

    test('should handle download initialization exception', async () => {
      mockChrome.downloads.download.mockImplementation(() => {
        throw new Error('API not available');
      });

      const event = new FileDownloadRequested('corr-4', 'https://example.com/file.pdf');
      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      expect((result as FileDownloadFailed).error).toBe('API not available');
    });

    test('should extract filename from URL when not provided', async () => {
      const downloadId = 125;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested('corr-5', 'https://example.com/documents/report.xlsx');
      const result = await fileDownload.startDownload(event);

      expect((result as FileDownloadStarted).filename).toBe('report.xlsx');
    });

    test('should handle URL without filename', async () => {
      const downloadId = 126;
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(downloadId);
      });

      const event = new FileDownloadRequested('corr-6', 'https://example.com/');
      const result = await fileDownload.startDownload(event);

      expect((result as FileDownloadStarted).filename).toBe('download.unknown');
    });
  });

  describe('updateProgress', () => {
    test('should update download progress', async () => {
      // First start a download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      // Update progress
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'in_progress',
        50000,
        100000
      );
      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getProgressPercentage()).toBe(50);
      expect(fileDownload.getState()).toBe('in_progress');
    });

    test('should handle download completion', async () => {
      // Start download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      // Complete download
      const completeEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'complete',
        100000,
        100000,
        '/downloads/file.pdf'
      );
      await fileDownload.updateProgress(completeEvent);

      expect(fileDownload.getState()).toBe('complete');
      expect(fileDownload.getFilepath()).toBe('/downloads/file.pdf');
      expect(fileDownload.isCompleted()).toBe(true);
    });

    test('should handle download interruption', async () => {
      // Start download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      // Interrupt download
      const interruptEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'interrupted',
        50000,
        100000,
        undefined,
        'Network failure'
      );
      await fileDownload.updateProgress(interruptEvent);

      expect(fileDownload.getState()).toBe('interrupted');
    });

    test('should ignore progress updates for different download IDs', async () => {
      // Start download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      // Update progress for different download
      const progressEvent = new FileDownloadProgress(
        999, // Different ID
        'https://example.com/other.pdf',
        'other.pdf',
        'in_progress',
        50000,
        100000
      );
      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getProgressPercentage()).toBe(0);
    });
  });

  describe('getDownloadStatus', () => {
    test('should return current instance status', async () => {
      // Start download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      const statusEvent = new FileDownloadStatusRequested('status-1');
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      expect(result.status.downloadId).toBe(123);
      expect(result.status.url).toBe('https://example.com/file.pdf');
      expect(result.status.state).toBe('in_progress');
    });

    test('should query specific download by ID', async () => {
      const mockDownload = {
        id: 456,
        url: 'https://example.com/other.pdf',
        filename: '/downloads/other.pdf',
        state: 'complete',
        bytesReceived: 200000,
        totalBytes: 200000,
        exists: true,
        paused: false,
        error: undefined
      };
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([mockDownload]);
      });

      const statusEvent = new FileDownloadStatusRequested('status-2', 456);
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(mockChrome.downloads.search).toHaveBeenCalledWith({ id: 456 }, expect.any(Function));
      expect(result.status.downloadId).toBe(456);
      expect(result.status.state).toBe('complete');
      expect(result.status.exists).toBe(true);
    });

    test('should handle download not found', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([]);
      });

      const statusEvent = new FileDownloadStatusRequested('status-3', 999);
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result.status.downloadId).toBe(999);
      expect(result.status.state).toBe('interrupted');
      expect(result.status.error).toBe('Download not found');
    });
  });

  describe('getDownloadsList', () => {
    test('should return list of downloads', async () => {
      const mockDownloads = [
        {
          id: 1,
          url: 'https://example.com/file1.pdf',
          filename: '/downloads/file1.pdf',
          state: 'complete',
          bytesReceived: 100000,
          totalBytes: 100000,
          startTime: '2023-01-01T10:00:00',
          endTime: '2023-01-01T10:01:00'
        },
        {
          id: 2,
          url: 'https://example.com/file2.pdf',
          filename: '/downloads/file2.pdf',
          state: 'in_progress',
          bytesReceived: 50000,
          totalBytes: 100000,
          startTime: '2023-01-01T10:02:00',
          endTime: undefined
        }
      ];
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback(mockDownloads);
      });

      const listEvent = new FileDownloadListRequested('list-1');
      const result = await fileDownload.getDownloadsList(listEvent);

      expect(result).toBeInstanceOf(DownloadListProvided);
      expect(result.downloads).toHaveLength(2);
      expect(result.downloads[0].id).toBe(1);
      expect(result.downloads[1].state).toBe('in_progress');
    });

    test('should apply query filters', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([]);
      });

      const listEvent = new FileDownloadListRequested('list-2', {
        state: 'complete',
        limit: 50,
        orderBy: ['-endTime']
      });
      await fileDownload.getDownloadsList(listEvent);

      expect(mockChrome.downloads.search).toHaveBeenCalledWith({
        orderBy: ['-endTime'],
        limit: 50,
        state: 'complete'
      }, expect.any(Function));
    });

    test('should use default query parameters', async () => {
      mockChrome.downloads.search.mockImplementation((query, callback) => {
        callback([]);
      });

      const listEvent = new FileDownloadListRequested('list-3');
      await fileDownload.getDownloadsList(listEvent);

      expect(mockChrome.downloads.search).toHaveBeenCalledWith({
        orderBy: ['-startTime'],
        limit: 100,
        state: undefined
      }, expect.any(Function));
    });
  });

  describe('Helper methods', () => {
    test('getProgressPercentage should handle zero total bytes', () => {
      expect(fileDownload.getProgressPercentage()).toBe(0);
    });

    test('getProgressPercentage should calculate percentage correctly', async () => {
      // Start download
      mockChrome.downloads.download.mockImplementation((options, callback) => {
        callback(123);
      });
      const startEvent = new FileDownloadRequested('corr-1', 'https://example.com/file.pdf');
      await fileDownload.startDownload(startEvent);

      // Update progress
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'in_progress',
        75000,
        100000
      );
      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getProgressPercentage()).toBe(75);
    });

    test('extractFilenameFromUrl should handle various URL formats', () => {
      const download = new FileDownload();
      
      // Access private method through any type casting
      const extractFilename = (download as any).extractFilenameFromUrl.bind(download);
      
      expect(extractFilename('https://example.com/files/document.pdf')).toBe('document.pdf');
      expect(extractFilename('https://example.com/files/')).toBe('download.unknown');
      expect(extractFilename('https://example.com')).toBe('download.unknown');
      expect(extractFilename('invalid-url')).toBe('download.unknown');
      expect(extractFilename('https://example.com/file-without-extension')).toBe('file-without-extension.unknown');
    });

    test('isCompleted should return false for incomplete downloads', () => {
      expect(fileDownload.isCompleted()).toBe(false);
    });

    test('getFilepath should return empty string initially', () => {
      expect(fileDownload.getFilepath()).toBe('');
    });

    test('getState should return pending initially', () => {
      expect(fileDownload.getState()).toBe('pending');
    });
  });
});