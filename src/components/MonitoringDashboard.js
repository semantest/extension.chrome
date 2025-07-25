// MonitoringDashboard.js - Real-time metrics and monitoring UI for v1.0.2
// Displays telemetry data, error tracking, and performance metrics

class MonitoringDashboard {
  constructor() {
    this.dashboardId = 'monitoring-dashboard';
    this.refreshInterval = 5000; // 5 seconds
    this.charts = {};
    this.metrics = {
      errors: [],
      performance: {},
      usage: {},
      consent: {}
    };
  }

  // Initialize the dashboard
  async init() {
    await this.loadMetrics();
    this.render();
    this.startAutoRefresh();
    this.attachEventListeners();
  }

  // Load metrics from storage and telemetry
  async loadMetrics() {
    try {
      // Load stored metrics
      const stored = await chrome.storage.local.get(['telemetryMetrics', 'errorReports']);
      
      if (stored.telemetryMetrics) {
        this.metrics = { ...this.metrics, ...stored.telemetryMetrics };
      }
      
      if (stored.errorReports) {
        this.metrics.errors = stored.errorReports.slice(-50); // Last 50 errors
      }

      // Load consent statistics
      const consentData = await chrome.storage.sync.get(['telemetryConsent', 'telemetryConsentTimestamp']);
      this.metrics.consent = consentData;

    } catch (error) {
      console.error('Error loading metrics:', error);
    }
  }

  // Render the dashboard
  render() {
    const container = document.getElementById(this.dashboardId);
    if (!container) return;

    container.innerHTML = `
      <div class="dashboard-header">
        <h1>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          Extension Monitoring Dashboard
        </h1>
        <div class="dashboard-controls">
          <button class="refresh-btn" id="refresh-metrics">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 8C2 11.3137 4.68629 14 8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C5.79086 2 3.88354 3.27477 2.8817 5.12602" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              <path d="M2 2V5H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            Refresh
          </button>
          <span class="last-updated" id="last-updated">Updated: Just now</span>
        </div>
      </div>

      <div class="metrics-grid">
        <!-- Key Metrics Cards -->
        <div class="metric-card">
          <div class="metric-icon success">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
              <path d="M8 12L11 15L16 9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Active Users</h3>
            <div class="metric-value" id="active-users">0</div>
            <div class="metric-change positive">+12% from yesterday</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon warning">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 9V13M12 17H12.01M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Error Rate</h3>
            <div class="metric-value" id="error-rate">0.02%</div>
            <div class="metric-change negative">+0.01% from yesterday</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon info">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 11L22 2M22 2H16M22 2V8M11 2L2 11M2 11V5M2 11H8M13 22L22 13M22 13H16M22 13V19M11 13L2 22M2 22V16M2 22H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Avg Response Time</h3>
            <div class="metric-value" id="response-time">124ms</div>
            <div class="metric-change positive">-8ms from yesterday</div>
          </div>
        </div>

        <div class="metric-card">
          <div class="metric-icon primary">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M9 11L12 14L22 4M21 12V19C21 20.1046 20.1046 21 19 21H5C3.89543 21 3 20.1046 3 19V5C3 3.89543 3.89543 3 5 3H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="metric-content">
            <h3>Consent Rate</h3>
            <div class="metric-value" id="consent-rate">78%</div>
            <div class="metric-change neutral">No change</div>
          </div>
        </div>
      </div>

      <!-- Charts Section -->
      <div class="charts-section">
        <div class="chart-container">
          <h3>Error Trends (Last 24 Hours)</h3>
          <canvas id="error-chart" width="400" height="200"></canvas>
        </div>

        <div class="chart-container">
          <h3>Feature Usage</h3>
          <canvas id="usage-chart" width="400" height="200"></canvas>
        </div>
      </div>

      <!-- Recent Errors Table -->
      <div class="errors-section">
        <h3>Recent Errors</h3>
        <div class="errors-table">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Error</th>
                <th>Component</th>
                <th>Count</th>
              </tr>
            </thead>
            <tbody id="errors-tbody">
              <tr>
                <td colspan="4" class="no-data">No errors recorded</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Performance Metrics -->
      <div class="performance-section">
        <h3>Performance Metrics</h3>
        <div class="performance-grid">
          <div class="perf-metric">
            <span class="perf-label">Load Time</span>
            <span class="perf-value" id="load-time">0ms</span>
          </div>
          <div class="perf-metric">
            <span class="perf-label">Memory Usage</span>
            <span class="perf-value" id="memory-usage">0 MB</span>
          </div>
          <div class="perf-metric">
            <span class="perf-label">API Calls/min</span>
            <span class="perf-value" id="api-calls">0</span>
          </div>
          <div class="perf-metric">
            <span class="perf-label">Cache Hit Rate</span>
            <span class="perf-value" id="cache-rate">0%</span>
          </div>
        </div>
      </div>
    `;

    this.injectStyles();
    this.initCharts();
    this.updateMetrics();
  }

  // Initialize charts
  initCharts() {
    // Simple canvas-based charts (placeholder for actual chart library)
    this.drawErrorChart();
    this.drawUsageChart();
  }

  // Draw error trends chart
  drawErrorChart() {
    const canvas = document.getElementById('error-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Draw axes
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, height - 30);
    ctx.lineTo(width - 20, height - 30);
    ctx.moveTo(40, 20);
    ctx.lineTo(40, height - 30);
    ctx.stroke();

    // Draw sample data (replace with actual data)
    const data = [2, 3, 1, 4, 2, 3, 1, 0, 1, 2, 3, 2];
    const maxValue = Math.max(...data);
    const stepX = (width - 60) / (data.length - 1);
    const scaleY = (height - 50) / maxValue;

    // Draw line
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    data.forEach((value, index) => {
      const x = 40 + index * stepX;
      const y = height - 30 - value * scaleY;
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // Draw points
    ctx.fillStyle = '#ef4444';
    data.forEach((value, index) => {
      const x = 40 + index * stepX;
      const y = height - 30 - value * scaleY;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  // Draw usage chart
  drawUsageChart() {
    const canvas = document.getElementById('usage-chart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Sample data
    const features = [
      { name: 'Projects', value: 85, color: '#10a37f' },
      { name: 'Instructions', value: 72, color: '#3b82f6' },
      { name: 'Prompts', value: 65, color: '#8b5cf6' },
      { name: 'Images', value: 45, color: '#f59e0b' },
      { name: 'Time Travel', value: 30, color: '#ef4444' }
    ];

    const barWidth = 40;
    const barSpacing = 20;
    const startX = 60;
    const maxHeight = height - 60;

    features.forEach((feature, index) => {
      const x = startX + index * (barWidth + barSpacing);
      const barHeight = (feature.value / 100) * maxHeight;
      const y = height - 30 - barHeight;

      // Draw bar
      ctx.fillStyle = feature.color;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Draw label
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(feature.name, x + barWidth / 2, height - 10);

      // Draw value
      ctx.fillStyle = '#1f2937';
      ctx.fillText(feature.value + '%', x + barWidth / 2, y - 5);
    });
  }

  // Update metrics display
  updateMetrics() {
    // Update metric values (with sample data)
    const updates = {
      'active-users': Math.floor(Math.random() * 1000) + 500,
      'error-rate': (Math.random() * 0.1).toFixed(2) + '%',
      'response-time': Math.floor(Math.random() * 50) + 100 + 'ms',
      'consent-rate': Math.floor(Math.random() * 20) + 70 + '%',
      'load-time': Math.floor(Math.random() * 200) + 50 + 'ms',
      'memory-usage': (Math.random() * 20 + 10).toFixed(1) + ' MB',
      'api-calls': Math.floor(Math.random() * 100) + 20,
      'cache-rate': Math.floor(Math.random() * 30) + 60 + '%'
    };

    Object.entries(updates).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) {
        element.textContent = value;
      }
    });

    // Update errors table
    this.updateErrorsTable();

    // Update last updated time
    const lastUpdated = document.getElementById('last-updated');
    if (lastUpdated) {
      lastUpdated.textContent = `Updated: ${new Date().toLocaleTimeString()}`;
    }
  }

  // Update errors table
  updateErrorsTable() {
    const tbody = document.getElementById('errors-tbody');
    if (!tbody) return;

    if (this.metrics.errors.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" class="no-data">No errors recorded</td></tr>';
      return;
    }

    const recentErrors = this.metrics.errors.slice(-10).reverse();
    tbody.innerHTML = recentErrors.map(error => `
      <tr>
        <td>${new Date(error.timestamp).toLocaleTimeString()}</td>
        <td class="error-message">${error.message}</td>
        <td>${error.component || 'Unknown'}</td>
        <td><span class="error-count">${error.count || 1}</span></td>
      </tr>
    `).join('');
  }

  // Attach event listeners
  attachEventListeners() {
    const refreshBtn = document.getElementById('refresh-metrics');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        refreshBtn.classList.add('spinning');
        await this.loadMetrics();
        this.updateMetrics();
        this.drawErrorChart();
        this.drawUsageChart();
        setTimeout(() => refreshBtn.classList.remove('spinning'), 500);
      });
    }
  }

  // Start auto refresh
  startAutoRefresh() {
    this.refreshTimer = setInterval(async () => {
      await this.loadMetrics();
      this.updateMetrics();
    }, this.refreshInterval);
  }

  // Stop auto refresh
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
  }

  // Inject required styles
  injectStyles() {
    if (document.getElementById('monitoring-dashboard-styles')) return;

    const styles = `
      <style id="monitoring-dashboard-styles">
        #${this.dashboardId} {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #1f2937;
          padding: 24px;
          background: #f9fafb;
          min-height: 100vh;
        }

        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
        }

        .dashboard-header h1 {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 28px;
          font-weight: 600;
          margin: 0;
        }

        .dashboard-controls {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .refresh-btn:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .refresh-btn.spinning svg {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .last-updated {
          font-size: 14px;
          color: #6b7280;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          display: flex;
          gap: 16px;
        }

        .metric-icon {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .metric-icon.success {
          background: #d1fae5;
          color: #10a37f;
        }

        .metric-icon.warning {
          background: #fef3c7;
          color: #f59e0b;
        }

        .metric-icon.info {
          background: #dbeafe;
          color: #3b82f6;
        }

        .metric-icon.primary {
          background: #ede9fe;
          color: #8b5cf6;
        }

        .metric-content h3 {
          font-size: 14px;
          font-weight: 500;
          color: #6b7280;
          margin: 0 0 8px 0;
        }

        .metric-value {
          font-size: 32px;
          font-weight: 600;
          line-height: 1;
          margin-bottom: 8px;
        }

        .metric-change {
          font-size: 12px;
          font-weight: 500;
        }

        .metric-change.positive {
          color: #10a37f;
        }

        .metric-change.negative {
          color: #ef4444;
        }

        .metric-change.neutral {
          color: #6b7280;
        }

        .charts-section {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 20px;
          margin-bottom: 32px;
        }

        .chart-container {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .chart-container h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .chart-container canvas {
          max-width: 100%;
          height: auto;
        }

        .errors-section,
        .performance-section {
          background: white;
          border-radius: 12px;
          padding: 20px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
          margin-bottom: 20px;
        }

        .errors-section h3,
        .performance-section h3 {
          font-size: 16px;
          font-weight: 600;
          margin: 0 0 16px 0;
        }

        .errors-table {
          overflow-x: auto;
        }

        .errors-table table {
          width: 100%;
          border-collapse: collapse;
        }

        .errors-table th {
          text-align: left;
          padding: 12px;
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
        }

        .errors-table td {
          padding: 12px;
          font-size: 14px;
          border-bottom: 1px solid #f3f4f6;
        }

        .errors-table .no-data {
          text-align: center;
          color: #9ca3af;
          font-style: italic;
        }

        .error-message {
          max-width: 300px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .error-count {
          display: inline-block;
          min-width: 24px;
          padding: 2px 8px;
          background: #fef2f2;
          color: #ef4444;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
        }

        .performance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
        }

        .perf-metric {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .perf-label {
          font-size: 12px;
          color: #6b7280;
        }

        .perf-value {
          font-size: 24px;
          font-weight: 600;
        }

        /* Dark mode support */
        @media (prefers-color-scheme: dark) {
          #${this.dashboardId} {
            background: #111827;
            color: #f9fafb;
          }

          .metric-card,
          .chart-container,
          .errors-section,
          .performance-section {
            background: #1f2937;
          }

          .refresh-btn {
            background: #1f2937;
            border-color: #374151;
            color: #f9fafb;
          }

          .refresh-btn:hover {
            background: #374151;
          }

          .errors-table th {
            color: #9ca3af;
            border-color: #374151;
          }

          .errors-table td {
            border-color: #1f2937;
          }

          .error-count {
            background: #7f1d1d;
          }
        }

        /* Responsive design */
        @media (max-width: 768px) {
          .dashboard-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .charts-section {
            grid-template-columns: 1fr;
          }

          .metric-value {
            font-size: 24px;
          }
        }
      </style>
    `;

    document.head.insertAdjacentHTML('beforeend', styles);
  }

  // Cleanup
  destroy() {
    this.stopAutoRefresh();
    const container = document.getElementById(this.dashboardId);
    if (container) {
      container.innerHTML = '';
    }
  }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MonitoringDashboard;
} else {
  window.MonitoringDashboard = MonitoringDashboard;
}