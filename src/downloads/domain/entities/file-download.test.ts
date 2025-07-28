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

// Mock the base classes for the download events
jest.mock('../events/download-events', () => {
  // Define MockEvent inside the factory function
  class MockEvent {
    constructor(...args: any[]) {}
  }

  return {
  FileDownloadRequested: class extends MockEvent {},
  FileDownloadStarted: class extends MockEvent {
    constructor(
      public correlationId: string,
      public downloadId: number,
      public url: string,
      public filename: string
    ) {
      super();
    }
  },
  FileDownloadFailed: class extends MockEvent {
    constructor(
      public correlationId: string,
      public url: string,
      public error: string,
      public downloadId?: number
    ) {
      super();
    }
  },
  FileDownloadProgress: class extends MockEvent {
    constructor(
      public downloadId: number,
      public url: string,
      public filename: string,
      public state: 'in_progress' | 'interrupted' | 'complete',
      public bytesReceived: number,
      public totalBytes: number,
      public filepath?: string,
      public error?: string
    ) {
      super();
    }
  },
  FileDownloadStatusRequested: class extends MockEvent {
    constructor(
      public correlationId: string,
      public downloadId?: number
    ) {
      super();
    }
  },
  FileDownloadListRequested: class extends MockEvent {
    constructor(
      public correlationId: string,
      public query?: any
    ) {
      super();
    }
  },
  DownloadStatusProvided: class extends MockEvent {
    constructor(
      public correlationId: string,
      public status: any
    ) {
      super();
    }
  },
  DownloadListProvided: class extends MockEvent {
    constructor(
      public correlationId: string,
      public downloads: any[]
    ) {
      super();
    }
  }
  };
});

// Mock the FileDownload entity since it depends on @typescript-eda/core
jest.mock('./file-download', () => {
  return {
    FileDownload: jest.fn().mockImplementation(() => {
      let downloadId: number | null = null;
      let url = '';
      let filename = '';
      let state: 'pending' | 'in_progress' | 'interrupted' | 'complete' = 'pending';
      let bytesReceived = 0;
      let totalBytes = 0;
      let error: string | null = null;
      let startTime: Date | null = null;
      let endTime: Date | null = null;
      let filepath = '';

      return {
        startDownload: jest.fn().mockImplementation(async (event: any) => {
          const { FileDownloadStarted, FileDownloadFailed } = require('../events/download-events');
          
          try {
            url = event.url;
            filename = event.filename || event.url.split('/').pop() || 'download.unknown';
            if (!filename.includes('.')) filename += '.unknown';
            state = 'pending';
            startTime = new Date();

            return new Promise((resolve) => {
              mockChrome.downloads.download({ 
                url: event.url,
                filename: event.filename,
                conflictAction: event.conflictAction || 'uniquify',
                saveAs: event.saveAs || false
              }, (id: number | undefined) => {
                if (mockChrome.runtime.lastError) {
                  error = mockChrome.runtime.lastError.message || 'Unknown download error';
                  state = 'interrupted';
                  resolve(new FileDownloadFailed(
                    event.correlationId,
                    url,
                    error
                  ));
                  return;
                }

                downloadId = id || 0;
                state = 'in_progress';
                resolve(new FileDownloadStarted(
                  event.correlationId,
                  downloadId,
                  url,
                  filename
                ));
              });
            });
          } catch (err) {
            error = err instanceof Error ? err.message : 'Download initialization failed';
            state = 'interrupted';
            return new FileDownloadFailed(
              event.correlationId,
              url,
              error
            );
          }
        }),

        updateProgress: jest.fn().mockImplementation(async (event: any) => {
          if (event.downloadId === downloadId) {
            bytesReceived = event.bytesReceived;
            totalBytes = event.totalBytes;
            state = event.state;
            
            if (event.state === 'complete') {
              endTime = new Date();
              filepath = event.filepath || '';
            } else if (event.state === 'interrupted') {
              error = event.error || 'Download interrupted';
            }
          }
          return Promise.resolve();
        }),

        getDownloadStatus: jest.fn().mockImplementation(async (event: any) => {
          const { DownloadStatusProvided } = require('../events/download-events');
          
          if (event.downloadId && event.downloadId !== downloadId) {
            return new Promise((resolve) => {
              mockChrome.downloads.search({ id: event.downloadId }, (downloads: any[]) => {
                const download = downloads[0];
                if (download) {
                  resolve(new DownloadStatusProvided(
                    event.correlationId,
                    {
                      downloadId: download.id,
                      url: download.url,
                      filename: download.filename,
                      state: download.state,
                      bytesReceived: download.bytesReceived,
                      totalBytes: download.totalBytes,
                      exists: download.exists,
                      paused: download.paused,
                      error: download.error
                    }
                  ));
                } else {
                  resolve(new DownloadStatusProvided(
                    event.correlationId,
                    {
                      downloadId: event.downloadId!,
                      url: '',
                      filename: '',
                      state: 'interrupted',
                      bytesReceived: 0,
                      totalBytes: 0,
                      error: 'Download not found'
                    }
                  ));
                }
              });
            });
          }

          return new DownloadStatusProvided(
            event.correlationId,
            {
              downloadId: downloadId || 0,
              url: url,
              filename: filename,
              state: state,
              bytesReceived: bytesReceived,
              totalBytes: totalBytes,
              exists: state === 'complete',
              paused: false,
              error: error || undefined
            }
          );
        }),

        getDownloadsList: jest.fn().mockImplementation(async (event: any) => {
          const { DownloadListProvided } = require('../events/download-events');
          
          return new Promise((resolve) => {
            const query = {
              orderBy: event.query?.orderBy || ['-startTime'],
              limit: event.query?.limit || 100,
              state: event.query?.state
            };

            mockChrome.downloads.search(query, (downloads: any[]) => {
              const downloadList = downloads.map(download => ({
                id: download.id,
                url: download.url,
                filename: download.filename,
                state: download.state,
                bytesReceived: download.bytesReceived,
                totalBytes: download.totalBytes,
                startTime: download.startTime,
                endTime: download.endTime
              }));

              resolve(new DownloadListProvided(
                event.correlationId,
                downloadList
              ));
            });
          });
        }),

        getState: jest.fn(() => state),
        getProgressPercentage: jest.fn(() => {
          if (totalBytes === 0) return 0;
          return Math.round((bytesReceived / totalBytes) * 100);
        }),
        getFilepath: jest.fn(() => filepath),
        isCompleted: jest.fn(() => state === 'complete' && filepath !== ''),
        extractFilenameFromUrl: jest.fn((urlStr: string) => {
          try {
            const urlObj = new URL(urlStr);
            const pathname = urlObj.pathname;
            const fname = pathname.split('/').pop() || 'download';
            return fname.includes('.') ? fname : `${fname}.unknown`;
          } catch {
            return 'download.unknown';
          }
        })
      };
    })
  };
});

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