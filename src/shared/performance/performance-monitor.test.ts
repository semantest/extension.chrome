/**
 * Tests for PerformanceMonitor class
 */

import { PerformanceMonitor } from './index';

describe('PerformanceMonitor', () => {
  beforeEach(() => {
    PerformanceMonitor.clear();
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('setThreshold', () => {
    it('should set threshold for a metric', () => {
      PerformanceMonitor.setThreshold('api-response', 1000);
      
      // Verify by recording a value above threshold
      PerformanceMonitor.record('api-response', 1500);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for api-response: 1500ms > 1000ms'
      );
    });
  });

  describe('record', () => {
    it('should record performance metrics', () => {
      PerformanceMonitor.record('test-metric', 100);
      PerformanceMonitor.record('test-metric', 200);
      PerformanceMonitor.record('test-metric', 150);
      
      const stats = PerformanceMonitor.getStats('test-metric');
      
      expect(stats).toEqual({
        count: 3,
        min: 100,
        max: 200,
        avg: 150,
        p95: 200
      });
    });

    it('should keep only last 100 measurements', () => {
      for (let i = 0; i < 110; i++) {
        PerformanceMonitor.record('many-metrics', i);
      }
      
      const stats = PerformanceMonitor.getStats('many-metrics');
      
      expect(stats!.count).toBe(100);
      expect(stats!.min).toBe(10); // First 10 values were removed
    });

    it('should warn when threshold is exceeded', () => {
      PerformanceMonitor.setThreshold('slow-api', 500);
      PerformanceMonitor.record('slow-api', 600);
      
      expect(console.warn).toHaveBeenCalledWith(
        'Performance threshold exceeded for slow-api: 600ms > 500ms'
      );
    });

    it('should not warn when within threshold', () => {
      PerformanceMonitor.setThreshold('fast-api', 500);
      PerformanceMonitor.record('fast-api', 400);
      
      expect(console.warn).not.toHaveBeenCalledWith(
        expect.stringContaining('fast-api')
      );
    });
  });

  describe('getStats', () => {
    it('should return null for unknown metric', () => {
      const stats = PerformanceMonitor.getStats('unknown');
      expect(stats).toBeNull();
    });

    it('should calculate correct statistics', () => {
      const values = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
      values.forEach(v => PerformanceMonitor.record('test', v));
      
      const stats = PerformanceMonitor.getStats('test');
      
      expect(stats).toEqual({
        count: 10,
        min: 100,
        max: 1000,
        avg: 550,
        p95: 1000 // 95th percentile of 10 values is the last one
      });
    });

    it('should handle single value correctly', () => {
      PerformanceMonitor.record('single', 123);
      
      const stats = PerformanceMonitor.getStats('single');
      
      expect(stats).toEqual({
        count: 1,
        min: 123,
        max: 123,
        avg: 123,
        p95: 123
      });
    });

    it('should calculate p95 correctly for various sizes', () => {
      // Test with 20 values
      for (let i = 1; i <= 20; i++) {
        PerformanceMonitor.record('p95-test', i * 10);
      }
      
      const stats = PerformanceMonitor.getStats('p95-test');
      // p95 index for 20 values = floor(20 * 0.95) = floor(19) = 19
      // Values are 10, 20, 30, ..., 200
      // sorted[19] = 200
      expect(stats!.p95).toBe(200);
    });
  });

  describe('clear', () => {
    it('should clear all metrics', () => {
      PerformanceMonitor.record('metric1', 100);
      PerformanceMonitor.record('metric2', 200);
      
      PerformanceMonitor.clear();
      
      expect(PerformanceMonitor.getStats('metric1')).toBeNull();
      expect(PerformanceMonitor.getStats('metric2')).toBeNull();
    });
  });
});