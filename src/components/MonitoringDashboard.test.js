/**
 * Unit Tests for MonitoringDashboard Component
 * Tests real-time metrics dashboard, charts, and error tracking
 */

// Mock chrome API
const mockChrome = {
  storage: {
    local: {
      get: jest.fn().mockResolvedValue({
        telemetryMetrics: {
          performance: { loadTime: 150 },
          usage: { activeUsers: 750 }
        },
        errorReports: [
          { timestamp: Date.now(), message: 'Test error 1', component: 'Background', count: 2 },
          { timestamp: Date.now() - 1000, message: 'Test error 2', component: 'Content', count: 1 }
        ]
      })
    },
    sync: {
      get: jest.fn().mockResolvedValue({
        telemetryConsent: true,
        telemetryConsentTimestamp: new Date().toISOString()
      })
    }
  }
};

global.chrome = mockChrome;

// Mock canvas context
const mockCanvasContext = {
  clearRect: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  stroke: jest.fn(),
  fill: jest.fn(),
  arc: jest.fn(),
  fillRect: jest.fn(),
  fillText: jest.fn(),
  strokeStyle: '',
  fillStyle: '',
  lineWidth: 0,
  font: '',
  textAlign: ''
};

HTMLCanvasElement.prototype.getContext = jest.fn(() => mockCanvasContext);

// Import after mocking
const MonitoringDashboard = require('./MonitoringDashboard');

describe('MonitoringDashboard', () => {
  let dashboard;
  let container;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';
    document.head.innerHTML = '<meta charset="UTF-8">';
    
    // Create test container
    container = document.createElement('div');
    container.id = 'monitoring-dashboard';
    document.body.appendChild(container);
    
    // Clear all mocks
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useFakeTimers();
    
    // Create new instance
    dashboard = new MonitoringDashboard();
  });

  afterEach(() => {
    // Cleanup
    dashboard.destroy();
    jest.useRealTimers();
    
    const styles = document.getElementById('monitoring-dashboard-styles');
    if (styles) {
      styles.remove();
    }
  });

  describe('Initialization', () => {
    test('should initialize with default values', () => {
      expect(dashboard.dashboardId).toBe('monitoring-dashboard');
      expect(dashboard.refreshInterval).toBe(5000);
      expect(dashboard.charts).toEqual({});
      expect(dashboard.metrics).toEqual({
        errors: [],
        performance: {},
        usage: {},
        consent: {}
      });
    });

    test('should init dashboard with loading metrics and rendering', async () => {
      const loadMetricsSpy = jest.spyOn(dashboard, 'loadMetrics');
      const renderSpy = jest.spyOn(dashboard, 'render');
      const startAutoRefreshSpy = jest.spyOn(dashboard, 'startAutoRefresh');
      
      await dashboard.init();
      
      expect(loadMetricsSpy).toHaveBeenCalled();
      expect(renderSpy).toHaveBeenCalled();
      expect(startAutoRefreshSpy).toHaveBeenCalled();
    });
  });

  describe('Load Metrics', () => {
    test('should load metrics from chrome storage', async () => {
      await dashboard.loadMetrics();
      
      expect(mockChrome.storage.local.get).toHaveBeenCalledWith(['telemetryMetrics', 'errorReports']);
      expect(mockChrome.storage.sync.get).toHaveBeenCalledWith(['telemetryConsent', 'telemetryConsentTimestamp']);
      
      expect(dashboard.metrics.performance).toEqual({ loadTime: 150 });
      expect(dashboard.metrics.usage).toEqual({ activeUsers: 750 });
      expect(dashboard.metrics.errors).toHaveLength(2);
      expect(dashboard.metrics.consent).toHaveProperty('telemetryConsent', true);
    });

    test('should limit errors to last 50', async () => {
      const manyErrors = Array(100).fill(null).map((_, i) => ({
        timestamp: Date.now() - i * 1000,
        message: `Error ${i}`,
        component: 'Test'
      }));
      
      mockChrome.storage.local.get.mockResolvedValueOnce({
        errorReports: manyErrors
      });
      
      await dashboard.loadMetrics();
      
      expect(dashboard.metrics.errors).toHaveLength(50);
    });

    test('should handle loading errors gracefully', async () => {
      mockChrome.storage.local.get.mockRejectedValueOnce(new Error('Storage error'));
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      await dashboard.loadMetrics();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error loading metrics:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('Render Dashboard', () => {
    test('should render dashboard structure', () => {
      dashboard.render();
      
      expect(container.querySelector('.dashboard-header')).toBeTruthy();
      expect(container.querySelector('.metrics-grid')).toBeTruthy();
      expect(container.querySelector('.charts-section')).toBeTruthy();
      expect(container.querySelector('.errors-section')).toBeTruthy();
      expect(container.querySelector('.performance-section')).toBeTruthy();
    });

    test('should render all metric cards', () => {
      dashboard.render();
      
      const metricCards = container.querySelectorAll('.metric-card');
      expect(metricCards.length).toBe(4);
      
      expect(container.querySelector('#active-users')).toBeTruthy();
      expect(container.querySelector('#error-rate')).toBeTruthy();
      expect(container.querySelector('#response-time')).toBeTruthy();
      expect(container.querySelector('#consent-rate')).toBeTruthy();
    });

    test('should render chart canvases', () => {
      dashboard.render();
      
      expect(container.querySelector('#error-chart')).toBeTruthy();
      expect(container.querySelector('#usage-chart')).toBeTruthy();
    });

    test('should render performance metrics', () => {
      dashboard.render();
      
      expect(container.querySelector('#load-time')).toBeTruthy();
      expect(container.querySelector('#memory-usage')).toBeTruthy();
      expect(container.querySelector('#api-calls')).toBeTruthy();
      expect(container.querySelector('#cache-rate')).toBeTruthy();
    });

    test('should inject styles', () => {
      dashboard.render();
      
      const styles = document.getElementById('monitoring-dashboard-styles');
      expect(styles).toBeTruthy();
    });

    test('should not render if container missing', () => {
      container.remove();
      
      // Should not throw
      dashboard.render();
      expect(true).toBe(true);
    });
  });

  describe('Charts', () => {
    beforeEach(() => {
      dashboard.render();
    });

    test('should draw error chart', () => {
      dashboard.drawErrorChart();
      
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      expect(mockCanvasContext.beginPath).toHaveBeenCalled();
      expect(mockCanvasContext.stroke).toHaveBeenCalled();
      expect(mockCanvasContext.fill).toHaveBeenCalled();
    });

    test('should draw usage chart', () => {
      dashboard.drawUsageChart();
      
      expect(mockCanvasContext.clearRect).toHaveBeenCalled();
      expect(mockCanvasContext.fillRect).toHaveBeenCalled();
      expect(mockCanvasContext.fillText).toHaveBeenCalled();
    });

    test('should handle missing canvas gracefully', () => {
      container.querySelector('#error-chart').remove();
      
      // Should not throw
      dashboard.drawErrorChart();
      expect(true).toBe(true);
    });
  });

  describe('Update Metrics', () => {
    beforeEach(() => {
      dashboard.render();
    });

    test('should update metric values', () => {
      dashboard.updateMetrics();
      
      const activeUsers = container.querySelector('#active-users');
      const errorRate = container.querySelector('#error-rate');
      
      expect(activeUsers.textContent).toMatch(/\d+/);
      expect(errorRate.textContent).toMatch(/\d+\.\d+%/);
    });

    test('should update last updated time', () => {
      dashboard.updateMetrics();
      
      const lastUpdated = container.querySelector('#last-updated');
      expect(lastUpdated.textContent).toMatch(/Updated: \d+:\d+:\d+/);
    });

    test('should update errors table', () => {
      dashboard.metrics.errors = [
        { timestamp: Date.now(), message: 'Error 1', component: 'Test', count: 3 },
        { timestamp: Date.now() - 1000, message: 'Error 2', component: 'UI', count: 1 }
      ];
      
      dashboard.updateMetrics();
      
      const errorRows = container.querySelectorAll('#errors-tbody tr');
      expect(errorRows.length).toBe(2);
      expect(errorRows[0].querySelector('.error-message').textContent).toBe('Error 1');
      expect(errorRows[0].querySelector('.error-count').textContent).toBe('3');
    });

    test('should show no errors message when empty', () => {
      dashboard.metrics.errors = [];
      dashboard.updateMetrics();
      
      const tbody = container.querySelector('#errors-tbody');
      expect(tbody.querySelector('.no-data')).toBeTruthy();
      expect(tbody.textContent).toContain('No errors recorded');
    });
  });

  describe('Refresh Functionality', () => {
    beforeEach(() => {
      dashboard.render();
    });

    test('should handle refresh button click', async () => {
      const loadMetricsSpy = jest.spyOn(dashboard, 'loadMetrics');
      const updateMetricsSpy = jest.spyOn(dashboard, 'updateMetrics');
      
      const refreshBtn = container.querySelector('#refresh-metrics');
      refreshBtn.click();
      
      expect(refreshBtn.classList.contains('spinning')).toBe(true);
      expect(loadMetricsSpy).toHaveBeenCalled();
      expect(updateMetricsSpy).toHaveBeenCalled();
      
      jest.advanceTimersByTime(500);
      expect(refreshBtn.classList.contains('spinning')).toBe(false);
    });

    test('should auto refresh at intervals', () => {
      const loadMetricsSpy = jest.spyOn(dashboard, 'loadMetrics');
      
      dashboard.startAutoRefresh();
      
      expect(dashboard.refreshTimer).toBeDefined();
      
      jest.advanceTimersByTime(5000);
      expect(loadMetricsSpy).toHaveBeenCalledTimes(1);
      
      jest.advanceTimersByTime(5000);
      expect(loadMetricsSpy).toHaveBeenCalledTimes(2);
    });

    test('should stop auto refresh', () => {
      dashboard.startAutoRefresh();
      const timer = dashboard.refreshTimer;
      
      dashboard.stopAutoRefresh();
      
      expect(clearInterval).toHaveBeenCalledWith(timer);
    });
  });

  describe('Errors Table', () => {
    beforeEach(() => {
      dashboard.render();
    });

    test('should display recent errors in reverse order', () => {
      dashboard.metrics.errors = [
        { timestamp: Date.now() - 2000, message: 'Old error', component: 'A' },
        { timestamp: Date.now() - 1000, message: 'Recent error', component: 'B' },
        { timestamp: Date.now(), message: 'Latest error', component: 'C' }
      ];
      
      dashboard.updateErrorsTable();
      
      const rows = container.querySelectorAll('#errors-tbody tr');
      expect(rows[0].querySelector('.error-message').textContent).toBe('Latest error');
      expect(rows[2].querySelector('.error-message').textContent).toBe('Old error');
    });

    test('should show only last 10 errors', () => {
      dashboard.metrics.errors = Array(20).fill(null).map((_, i) => ({
        timestamp: Date.now() - i * 1000,
        message: `Error ${i}`,
        component: 'Test'
      }));
      
      dashboard.updateErrorsTable();
      
      const rows = container.querySelectorAll('#errors-tbody tr');
      expect(rows.length).toBe(10);
    });

    test('should handle missing component gracefully', () => {
      dashboard.metrics.errors = [
        { timestamp: Date.now(), message: 'Error without component' }
      ];
      
      dashboard.updateErrorsTable();
      
      const row = container.querySelector('#errors-tbody tr');
      expect(row.cells[2].textContent).toBe('Unknown');
    });

    test('should default count to 1 if missing', () => {
      dashboard.metrics.errors = [
        { timestamp: Date.now(), message: 'Error without count', component: 'Test' }
      ];
      
      dashboard.updateErrorsTable();
      
      const count = container.querySelector('.error-count');
      expect(count.textContent).toBe('1');
    });
  });

  describe('Style Injection', () => {
    test('should include all component styles', () => {
      dashboard.render();
      
      const styles = document.getElementById('monitoring-dashboard-styles');
      const styleContent = styles.textContent;
      
      // Check for key style definitions
      expect(styleContent).toContain('#monitoring-dashboard');
      expect(styleContent).toContain('.dashboard-header');
      expect(styleContent).toContain('.metrics-grid');
      expect(styleContent).toContain('.metric-card');
      expect(styleContent).toContain('.chart-container');
      expect(styleContent).toContain('.errors-table');
      expect(styleContent).toContain('.performance-grid');
      
      // Check for animations
      expect(styleContent).toContain('@keyframes spin');
      
      // Check for responsive styles
      expect(styleContent).toContain('@media (prefers-color-scheme: dark)');
      expect(styleContent).toContain('@media (max-width: 768px)');
    });

    test('should not duplicate styles', () => {
      dashboard.render();
      dashboard.injectStyles();
      
      const styles = document.querySelectorAll('#monitoring-dashboard-styles');
      expect(styles.length).toBe(1);
    });
  });

  describe('Cleanup', () => {
    test('should clean up on destroy', () => {
      dashboard.render();
      dashboard.startAutoRefresh();
      
      const stopAutoRefreshSpy = jest.spyOn(dashboard, 'stopAutoRefresh');
      
      dashboard.destroy();
      
      expect(stopAutoRefreshSpy).toHaveBeenCalled();
      expect(container.innerHTML).toBe('');
    });

    test('should handle destroy when container missing', () => {
      dashboard.render();
      container.remove();
      
      // Should not throw
      dashboard.destroy();
      expect(true).toBe(true);
    });
  });

  describe('Module Export', () => {
    test('should export MonitoringDashboard class', () => {
      expect(MonitoringDashboard).toBeDefined();
      expect(typeof MonitoringDashboard).toBe('function');
    });

    test('should attach to window in browser environment', () => {
      // Simulate browser environment
      delete require.cache[require.resolve('./MonitoringDashboard')];
      const originalModule = global.module;
      global.module = undefined;
      
      // Re-require the module
      delete global.MonitoringDashboard;
      require('./MonitoringDashboard');
      
      expect(global.MonitoringDashboard).toBeDefined();
      
      // Restore
      global.module = originalModule;
    });
  });
});