/**
 * @fileoverview Tests for FileDownload entity
 */
import { FileDownload } from './file-download';
describe('FileDownload', () => {
    describe('initialization', () => {
        it('should create download with all properties', () => {
            const download = new FileDownload('https://example.com/image.jpg', 'downloads/image.jpg', 'image/jpeg', 1024);
            expect(download.id).toBeDefined();
            expect(download.url).toBe('https://example.com/image.jpg');
            expect(download.fileName).toBe('downloads/image.jpg');
            expect(download.mimeType).toBe('image/jpeg');
            expect(download.size).toBe(1024);
            expect(download.status).toBe('pending');
            expect(download.progress).toBe(0);
            expect(download.createdAt).toBeInstanceOf(Date);
        });
        it('should generate unique IDs', () => {
            const download1 = new FileDownload('url1', 'file1.jpg', 'image/jpeg');
            const download2 = new FileDownload('url2', 'file2.jpg', 'image/jpeg');
            expect(download1.id).not.toBe(download2.id);
        });
    });
    describe('status management', () => {
        let download;
        beforeEach(() => {
            download = new FileDownload('https://example.com/image.jpg', 'image.jpg', 'image/jpeg');
        });
        it('should start download', () => {
            download.start();
            expect(download.status).toBe('downloading');
            expect(download.startedAt).toBeInstanceOf(Date);
        });
        it('should update progress', () => {
            download.start();
            download.updateProgress(50);
            expect(download.progress).toBe(50);
            expect(download.status).toBe('downloading');
        });
        it('should complete download', () => {
            download.start();
            download.complete();
            expect(download.status).toBe('completed');
            expect(download.progress).toBe(100);
            expect(download.completedAt).toBeInstanceOf(Date);
        });
        it('should fail download with error', () => {
            download.start();
            download.fail('Network error');
            expect(download.status).toBe('failed');
            expect(download.error).toBe('Network error');
        });
        it('should pause download', () => {
            download.start();
            download.pause();
            expect(download.status).toBe('paused');
        });
        it('should resume paused download', () => {
            download.start();
            download.pause();
            download.resume();
            expect(download.status).toBe('downloading');
        });
        it('should cancel download', () => {
            download.start();
            download.cancel();
            expect(download.status).toBe('cancelled');
        });
    });
    describe('validation', () => {
        let download;
        beforeEach(() => {
            download = new FileDownload('https://example.com/image.jpg', 'image.jpg', 'image/jpeg', 1024);
        });
        it('should throw error when starting already started download', () => {
            download.start();
            expect(() => download.start()).toThrow('Download already started');
        });
        it('should throw error when updating progress on non-downloading status', () => {
            expect(() => download.updateProgress(50)).toThrow('Cannot update progress - download not in progress');
        });
        it('should validate progress range', () => {
            download.start();
            expect(() => download.updateProgress(-1)).toThrow('Progress must be between 0 and 100');
            expect(() => download.updateProgress(101)).toThrow('Progress must be between 0 and 100');
        });
        it('should not allow operations on completed download', () => {
            download.start();
            download.complete();
            expect(() => download.pause()).toThrow('Cannot pause - download not in progress');
        });
    });
    describe('download metrics', () => {
        let download;
        beforeEach(() => {
            download = new FileDownload('https://example.com/image.jpg', 'image.jpg', 'image/jpeg', 1000000 // 1MB
            );
        });
        it('should calculate download duration', () => {
            const startTime = new Date('2024-01-01T10:00:00');
            const endTime = new Date('2024-01-01T10:00:10'); // 10 seconds later
            download.start();
            download.startedAt = startTime;
            download.complete();
            download.completedAt = endTime;
            expect(download.getDuration()).toBe(10000); // 10 seconds in ms
        });
        it('should calculate download speed', () => {
            const startTime = new Date('2024-01-01T10:00:00');
            const endTime = new Date('2024-01-01T10:00:10'); // 10 seconds later
            download.start();
            download.startedAt = startTime;
            download.complete();
            download.completedAt = endTime;
            expect(download.getSpeed()).toBe(100000); // 100KB/s
        });
        it('should return null for incomplete downloads', () => {
            download.start();
            expect(download.getDuration()).toBeNull();
            expect(download.getSpeed()).toBeNull();
        });
    });
    describe('serialization', () => {
        it('should serialize to JSON', () => {
            const download = new FileDownload('https://example.com/image.jpg', 'image.jpg', 'image/jpeg', 1024);
            download.start();
            download.updateProgress(50);
            const json = download.toJSON();
            expect(json).toHaveProperty('id');
            expect(json).toHaveProperty('url');
            expect(json).toHaveProperty('fileName');
            expect(json).toHaveProperty('mimeType');
            expect(json).toHaveProperty('size');
            expect(json).toHaveProperty('status');
            expect(json).toHaveProperty('progress');
            expect(json).toHaveProperty('createdAt');
            expect(json).toHaveProperty('startedAt');
        });
        it('should create from JSON', () => {
            const download = new FileDownload('https://example.com/image.jpg', 'image.jpg', 'image/jpeg', 1024);
            download.start();
            download.complete();
            const json = download.toJSON();
            const restored = FileDownload.fromJSON(json);
            expect(restored.id).toBe(download.id);
            expect(restored.url).toBe(download.url);
            expect(restored.status).toBe('completed');
            expect(restored.progress).toBe(100);
        });
    });
});
