/**
 * @jest-environment jsdom
 */

// Mock @typescript-eda/core
jest.mock('@typescript-eda/core');

// Mock the download events module to avoid circular dependencies
jest.mock('../events/download-events');

// Mock chrome.downloads API
const mockDownload = jest.fn();
const mockSearch = jest.fn();

global.chrome = {
  downloads: {
    download: mockDownload,
    search: mockSearch
  },
  runtime: {
    lastError: null
  }
} as any;

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


describe('FileDownload Entity', () => {
  let fileDownload: FileDownload;

  beforeEach(() => {
    fileDownload = new FileDownload();
    jest.clearAllMocks();
    (chrome.runtime as any).lastError = null;
  });

  describe('startDownload', () => {
    it('should start a download successfully', async () => {
      const event = new FileDownloadRequested(
        'corr-123',
        'https://example.com/file.pdf',
        'document.pdf',
        'uniquify',
        false
      );

      mockDownload.mockImplementation((options, callback) => {
        callback(123);
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      expect((result as FileDownloadStarted).correlationId).toBe('corr-123');
      expect((result as FileDownloadStarted).downloadId).toBe(123);
      expect((result as FileDownloadStarted).url).toBe('https://example.com/file.pdf');
      expect((result as FileDownloadStarted).filename).toBe('document.pdf');

      expect(mockDownload).toHaveBeenCalledWith({
        url: 'https://example.com/file.pdf',
        filename: 'document.pdf',
        conflictAction: 'uniquify',
        saveAs: false
      }, expect.any(Function));
    });

    it('should extract filename from URL when not provided', async () => {
      const event = new FileDownloadRequested(
        'corr-456',
        'https://example.com/path/to/myfile.zip'
      );

      mockDownload.mockImplementation((options, callback) => {
        callback(456);
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      expect((result as FileDownloadStarted).filename).toBe('myfile.zip');
    });

    it('should handle URL without extension', async () => {
      const event = new FileDownloadRequested(
        'corr-789',
        'https://example.com/download'
      );

      mockDownload.mockImplementation((options, callback) => {
        callback(789);
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      expect((result as FileDownloadStarted).filename).toBe('download.unknown');
    });

    it('should handle Chrome runtime error', async () => {
      const event = new FileDownloadRequested(
        'corr-error',
        'https://example.com/file.pdf'
      );

      (chrome.runtime as any).lastError = { message: 'Network error' };
      mockDownload.mockImplementation((options, callback) => {
        callback(undefined);
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      expect((result as FileDownloadFailed).correlationId).toBe('corr-error');
      expect((result as FileDownloadFailed).error).toBe('Network error');
    });

    it('should handle exception during download', async () => {
      const event = new FileDownloadRequested(
        'corr-exception',
        'https://example.com/file.pdf'
      );

      mockDownload.mockImplementation(() => {
        throw new Error('Download API failed');
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadFailed);
      expect((result as FileDownloadFailed).error).toBe('Download API failed');
    });

    it('should use default values when optional parameters not provided', async () => {
      const event = new FileDownloadRequested(
        'corr-defaults',
        'https://example.com/file.pdf'
      );

      mockDownload.mockImplementation((options, callback) => {
        callback(999);
      });

      await fileDownload.startDownload(event);

      expect(mockDownload).toHaveBeenCalledWith({
        url: 'https://example.com/file.pdf',
        filename: undefined,
        conflictAction: 'uniquify',
        saveAs: false
      }, expect.any(Function));
    });

    it('should handle invalid URL gracefully', async () => {
      const event = new FileDownloadRequested(
        'corr-invalid',
        'not-a-valid-url'
      );

      mockDownload.mockImplementation((options, callback) => {
        callback(111);
      });

      const result = await fileDownload.startDownload(event);

      expect(result).toBeInstanceOf(FileDownloadStarted);
      expect((result as FileDownloadStarted).filename).toBe('download.unknown');
    });
  });

  describe('updateProgress', () => {
    beforeEach(async () => {
      // Start a download first
      const startEvent = new FileDownloadRequested(
        'corr-setup',
        'https://example.com/file.pdf'
      );
      mockDownload.mockImplementation((options, callback) => {
        callback(123);
      });
      await fileDownload.startDownload(startEvent);
    });
    it('should update progress for matching download', async () => {
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'in_progress',
        500000,
        1000000
      );

      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getProgressPercentage()).toBe(50);
      expect(fileDownload.getState()).toBe('in_progress');
    });

    it('should handle download completion', async () => {
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'complete',
        1000000,
        1000000,
        '/downloads/file.pdf'
      );

      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getState()).toBe('complete');
      expect(fileDownload.getFilepath()).toBe('/downloads/file.pdf');
      expect(fileDownload.isCompleted()).toBe(true);
      expect(fileDownload.getProgressPercentage()).toBe(100);
    });

    it('should handle download interruption', async () => {
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'interrupted',
        300000,
        1000000,
        undefined,
        'Disk full'
      );

      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getState()).toBe('interrupted');
      expect(fileDownload.isCompleted()).toBe(false);
    });

    it('should ignore progress for different download ID', async () => {
      const progressEvent = new FileDownloadProgress(
        999, // Different ID
        'https://example.com/other.pdf',
        'other.pdf',
        'complete',
        1000000,
        1000000
      );

      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getState()).toBe('in_progress'); // Unchanged
      expect(fileDownload.getProgressPercentage()).toBe(0);
    });

    it('should handle zero total bytes', async () => {
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'in_progress',
        0,
        0
      );

      await fileDownload.updateProgress(progressEvent);

      expect(fileDownload.getProgressPercentage()).toBe(0);
    });
  });

  describe('getDownloadStatus', () => {
    it('should return status for current download', async () => {
      // Start a download
      const startEvent = new FileDownloadRequested(
        'corr-start',
        'https://example.com/file.pdf',
        'file.pdf'
      );
      mockDownload.mockImplementation((options, callback) => {
        callback(123);
      });
      await fileDownload.startDownload(startEvent);

      // Update progress
      const progressEvent = new FileDownloadProgress(
        123,
        'https://example.com/file.pdf',
        'file.pdf',
        'in_progress',
        500000,
        1000000
      );
      await fileDownload.updateProgress(progressEvent);

      // Request status
      const statusEvent = new FileDownloadStatusRequested('corr-status');
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result).toBeInstanceOf(DownloadStatusProvided);
      expect(result.correlationId).toBe('corr-status');
      expect(result.status.downloadId).toBe(123);
      expect(result.status.url).toBe('https://example.com/file.pdf');
      expect(result.status.filename).toBe('file.pdf');
      expect(result.status.state).toBe('in_progress');
      expect(result.status.bytesReceived).toBe(500000);
      expect(result.status.totalBytes).toBe(1000000);
      expect(result.status.exists).toBe(false);
      expect(result.status.paused).toBe(false);
    });

    it('should query Chrome API for different download ID', async () => {
      const chromeDownload = {
        id: 456,
        url: 'https://example.com/other.pdf',
        filename: 'other.pdf',
        state: 'complete',
        bytesReceived: 2000000,
        totalBytes: 2000000,
        exists: true,
        paused: false,
        error: undefined
      };

      mockSearch.mockImplementation((query, callback) => {
        callback([chromeDownload]);
      });

      const statusEvent = new FileDownloadStatusRequested('corr-other', 456);
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(mockSearch).toHaveBeenCalledWith({ id: 456 }, expect.any(Function));
      expect(result.status.downloadId).toBe(456);
      expect(result.status.url).toBe('https://example.com/other.pdf');
      expect(result.status.state).toBe('complete');
      expect(result.status.exists).toBe(true);
    });

    it('should handle download not found', async () => {
      mockSearch.mockImplementation((query, callback) => {
        callback([]);
      });

      const statusEvent = new FileDownloadStatusRequested('corr-notfound', 999);
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result.status.downloadId).toBe(999);
      expect(result.status.state).toBe('interrupted');
      expect(result.status.error).toBe('Download not found');
    });

    it('should return initial state when no download started', async () => {
      const statusEvent = new FileDownloadStatusRequested('corr-initial');
      const result = await fileDownload.getDownloadStatus(statusEvent);

      expect(result.status.downloadId).toBe(0);
      expect(result.status.url).toBe('');
      expect(result.status.filename).toBe('');
      expect(result.status.state).toBe('pending');
      expect(result.status.bytesReceived).toBe(0);
      expect(result.status.totalBytes).toBe(0);
    });
  });

  describe('getDownloadsList', () => {
    it('should return list of downloads with default query', async () => {
      const downloads = [
        {
          id: 1,
          url: 'https://example.com/file1.pdf',
          filename: 'file1.pdf',
          state: 'complete',
          bytesReceived: 1000000,
          totalBytes: 1000000,
          startTime: '2024-01-15T10:00:00.000Z',
          endTime: '2024-01-15T10:05:00.000Z'
        },
        {
          id: 2,
          url: 'https://example.com/file2.zip',
          filename: 'file2.zip',
          state: 'in_progress',
          bytesReceived: 500000,
          totalBytes: 2000000,
          startTime: '2024-01-15T10:10:00.000Z',
          endTime: undefined
        }
      ];

      mockSearch.mockImplementation((query, callback) => {
        callback(downloads);
      });

      const listEvent = new FileDownloadListRequested('corr-list');
      const result = await fileDownload.getDownloadsList(listEvent);

      expect(mockSearch).toHaveBeenCalledWith({
        orderBy: ['-startTime'],
        limit: 100,
        state: undefined
      }, expect.any(Function));

      expect(result).toBeInstanceOf(DownloadListProvided);
      expect(result.correlationId).toBe('corr-list');
      expect(result.downloads).toHaveLength(2);
      expect(result.downloads[0].id).toBe(1);
      expect(result.downloads[1].id).toBe(2);
    });

    it('should apply custom query parameters', async () => {
      mockSearch.mockImplementation((query, callback) => {
        callback([]);
      });

      const listEvent = new FileDownloadListRequested('corr-custom', {
        orderBy: ['filename'],
        limit: 50,
        state: 'complete'
      });
      
      await fileDownload.getDownloadsList(listEvent);

      expect(mockSearch).toHaveBeenCalledWith({
        orderBy: ['filename'],
        limit: 50,
        state: 'complete'
      }, expect.any(Function));
    });

    it('should handle empty downloads list', async () => {
      mockSearch.mockImplementation((query, callback) => {
        callback([]);
      });

      const listEvent = new FileDownloadListRequested('corr-empty');
      const result = await fileDownload.getDownloadsList(listEvent);

      expect(result.downloads).toHaveLength(0);
    });
  });

  describe('helper methods', () => {
    it('should correctly calculate progress percentage', () => {
      expect(fileDownload.getProgressPercentage()).toBe(0);
    });

    it('should return correct completion status', () => {
      expect(fileDownload.isCompleted()).toBe(false);
    });

    it('should return empty filepath initially', () => {
      expect(fileDownload.getFilepath()).toBe('');
    });

    it('should return pending state initially', () => {
      expect(fileDownload.getState()).toBe('pending');
    });
  });
});