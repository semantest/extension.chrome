/**
 * Real-time Load Test Monitor
 * Visual dashboard for monitoring WebSocket load tests
 */

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const si = require('systeminformation');
const WebSocket = require('ws');

class LoadTestMonitor {
  constructor(wsServerUrl = 'ws://localhost:3003/ws', refreshInterval = 1000) {
    this.wsServerUrl = wsServerUrl;
    this.refreshInterval = refreshInterval;
    this.metrics = {
      connections: 0,
      messages: 0,
      errors: 0,
      latencies: [],
      cpuUsage: [],
      memoryUsage: [],
      networkIn: [],
      networkOut: [],
      timestamps: []
    };
    
    this.setupUI();
    this.startMonitoring();
  }

  setupUI() {
    // Create screen
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'WebSocket Load Test Monitor'
    });

    // Create grid
    this.grid = new contrib.grid({
      rows: 12,
      cols: 12,
      screen: this.screen
    });

    // Connection gauge
    this.connectionGauge = this.grid.set(0, 0, 3, 3, contrib.gauge, {
      label: 'Active Connections',
      stroke: 'green',
      fill: 'white',
      percent: 0
    });

    // Message rate gauge
    this.messageGauge = this.grid.set(0, 3, 3, 3, contrib.gauge, {
      label: 'Messages/sec',
      stroke: 'cyan',
      fill: 'white',
      percent: 0
    });

    // Error rate gauge
    this.errorGauge = this.grid.set(0, 6, 3, 3, contrib.gauge, {
      label: 'Error Rate %',
      stroke: 'red',
      fill: 'white',
      percent: 0
    });

    // System info
    this.systemInfo = this.grid.set(0, 9, 3, 3, blessed.box, {
      label: 'System Info',
      content: 'Loading...',
      style: {
        fg: 'white',
        border: { fg: 'cyan' }
      }
    });

    // Latency line chart
    this.latencyChart = this.grid.set(3, 0, 4, 6, contrib.line, {
      style: {
        line: 'yellow',
        text: 'green',
        baseline: 'black'
      },
      label: 'Latency (ms)',
      showLegend: true
    });

    // Throughput line chart
    this.throughputChart = this.grid.set(3, 6, 4, 6, contrib.line, {
      style: {
        line: 'green',
        text: 'green',
        baseline: 'black'
      },
      label: 'Throughput (msg/s)',
      showLegend: true
    });

    // CPU usage line chart
    this.cpuChart = this.grid.set(7, 0, 3, 6, contrib.line, {
      style: {
        line: 'red',
        text: 'green',
        baseline: 'black'
      },
      label: 'CPU Usage %',
      showLegend: false,
      minY: 0,
      maxY: 100
    });

    // Memory usage line chart
    this.memoryChart = this.grid.set(7, 6, 3, 6, contrib.line, {
      style: {
        line: 'magenta',
        text: 'green',
        baseline: 'black'
      },
      label: 'Memory Usage (MB)',
      showLegend: false
    });

    // Log window
    this.logBox = this.grid.set(10, 0, 2, 12, contrib.log, {
      fg: 'green',
      selectedFg: 'green',
      label: 'Event Log'
    });

    // Key bindings
    this.screen.key(['escape', 'q', 'C-c'], () => {
      this.stop();
      process.exit(0);
    });

    this.screen.render();
  }

  async startMonitoring() {
    // Connect to metrics endpoint or WebSocket server
    this.connectToMetricsSource();

    // Start system monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.updateMetrics();
      this.updateUI();
    }, this.refreshInterval);

    this.log('Monitor started - Press Q or ESC to exit');
  }

  connectToMetricsSource() {
    // Try to connect to a metrics WebSocket endpoint
    try {
      this.metricsWs = new WebSocket(this.wsServerUrl.replace('/ws', '/metrics'));
      
      this.metricsWs.on('open', () => {
        this.log('Connected to metrics endpoint');
      });

      this.metricsWs.on('message', (data) => {
        try {
          const metrics = JSON.parse(data);
          this.updateRemoteMetrics(metrics);
        } catch (err) {
          // Handle non-JSON messages
        }
      });

      this.metricsWs.on('error', (err) => {
        this.log(`Metrics connection error: ${err.message}`);
      });

      this.metricsWs.on('close', () => {
        this.log('Metrics connection closed');
        // Attempt reconnection
        setTimeout(() => this.connectToMetricsSource(), 5000);
      });
    } catch (err) {
      this.log(`Failed to connect to metrics: ${err.message}`);
    }
  }

  async updateMetrics() {
    // Get system metrics
    const cpu = await si.currentLoad();
    const mem = await si.mem();
    const network = await si.networkStats();

    // Update metrics arrays (keep last 60 data points)
    const maxDataPoints = 60;
    
    this.metrics.cpuUsage.push(cpu.currentLoad);
    if (this.metrics.cpuUsage.length > maxDataPoints) {
      this.metrics.cpuUsage.shift();
    }

    const memUsageMB = (mem.used / 1024 / 1024);
    this.metrics.memoryUsage.push(memUsageMB);
    if (this.metrics.memoryUsage.length > maxDataPoints) {
      this.metrics.memoryUsage.shift();
    }

    // Network metrics (if available)
    if (network && network[0]) {
      const netIn = (network[0].rx_sec / 1024); // KB/s
      const netOut = (network[0].tx_sec / 1024); // KB/s
      
      this.metrics.networkIn.push(netIn);
      this.metrics.networkOut.push(netOut);
      
      if (this.metrics.networkIn.length > maxDataPoints) {
        this.metrics.networkIn.shift();
        this.metrics.networkOut.shift();
      }
    }

    // Add timestamp
    this.metrics.timestamps.push(new Date().toLocaleTimeString());
    if (this.metrics.timestamps.length > maxDataPoints) {
      this.metrics.timestamps.shift();
    }
  }

  updateRemoteMetrics(data) {
    // Update metrics from remote source
    if (data.connections !== undefined) {
      this.metrics.connections = data.connections;
    }
    if (data.messages !== undefined) {
      this.metrics.messages = data.messages;
    }
    if (data.errors !== undefined) {
      this.metrics.errors = data.errors;
    }
    if (data.latency !== undefined) {
      this.metrics.latencies.push(data.latency);
      if (this.metrics.latencies.length > 60) {
        this.metrics.latencies.shift();
      }
    }
  }

  updateUI() {
    // Update gauges
    const connectionPercent = Math.min((this.metrics.connections / 10000) * 100, 100);
    this.connectionGauge.setPercent(connectionPercent);

    const messageRate = this.calculateMessageRate();
    const messagePercent = Math.min((messageRate / 1000) * 100, 100);
    this.messageGauge.setPercent(messagePercent);

    const errorRate = this.metrics.messages > 0 
      ? (this.metrics.errors / this.metrics.messages) * 100 
      : 0;
    this.errorGauge.setPercent(Math.min(errorRate, 100));

    // Update system info
    const systemInfoText = [
      `Connections: ${this.metrics.connections}`,
      `Messages: ${this.metrics.messages}`,
      `Errors: ${this.metrics.errors}`,
      `CPU Cores: ${require('os').cpus().length}`,
      `Memory: ${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(1)}GB`,
      `Uptime: ${this.formatUptime()}`
    ].join('\n');
    this.systemInfo.setContent(systemInfoText);

    // Update charts
    this.updateCharts();

    this.screen.render();
  }

  updateCharts() {
    // Latency chart
    if (this.metrics.latencies.length > 0) {
      const avgLatencies = this.calculateMovingAverage(this.metrics.latencies, 5);
      const p95Latencies = this.calculatePercentile(this.metrics.latencies, 95);
      
      this.latencyChart.setData([
        {
          title: 'Avg',
          x: this.metrics.timestamps.slice(-avgLatencies.length),
          y: avgLatencies,
          style: { line: 'yellow' }
        },
        {
          title: 'P95',
          x: this.metrics.timestamps.slice(-p95Latencies.length),
          y: p95Latencies,
          style: { line: 'red' }
        }
      ]);
    }

    // Throughput chart
    const throughputData = this.calculateThroughput();
    if (throughputData.length > 0) {
      this.throughputChart.setData([{
        title: 'msg/s',
        x: this.metrics.timestamps.slice(-throughputData.length),
        y: throughputData
      }]);
    }

    // CPU chart
    this.cpuChart.setData([{
      x: this.metrics.timestamps,
      y: this.metrics.cpuUsage
    }]);

    // Memory chart
    this.memoryChart.setData([{
      x: this.metrics.timestamps,
      y: this.metrics.memoryUsage
    }]);
  }

  calculateMessageRate() {
    // Calculate messages per second (simplified)
    return Math.floor(this.metrics.messages / (Date.now() / 1000));
  }

  calculateMovingAverage(data, window) {
    const result = [];
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - window + 1);
      const subset = data.slice(start, i + 1);
      const avg = subset.reduce((a, b) => a + b, 0) / subset.length;
      result.push(avg);
    }
    return result;
  }

  calculatePercentile(data, percentile) {
    const sorted = [...data].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * (percentile / 100));
    return new Array(data.length).fill(sorted[index] || 0);
  }

  calculateThroughput() {
    // Simplified throughput calculation
    const throughput = [];
    let lastMessages = 0;
    
    for (let i = 0; i < this.metrics.timestamps.length; i++) {
      const currentMessages = this.metrics.messages;
      const rate = currentMessages - lastMessages;
      throughput.push(Math.max(0, rate));
      lastMessages = currentMessages;
    }
    
    return throughput;
  }

  formatUptime() {
    const uptime = process.uptime();
    const hours = Math.floor(uptime / 3600);
    const minutes = Math.floor((uptime % 3600) / 60);
    const seconds = Math.floor(uptime % 60);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  log(message) {
    const timestamp = new Date().toLocaleTimeString();
    this.logBox.log(`[${timestamp}] ${message}`);
  }

  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.metricsWs) {
      this.metricsWs.close();
    }

    this.log('Monitor stopped');
  }
}

// Run the monitor
if (require.main === module) {
  const serverUrl = process.argv[2] || 'ws://localhost:3003/ws';
  const refreshInterval = parseInt(process.argv[3]) || 1000;

  console.log('Starting WebSocket Load Test Monitor...');
  console.log(`Server: ${serverUrl}`);
  console.log(`Refresh: ${refreshInterval}ms`);

  const monitor = new LoadTestMonitor(serverUrl, refreshInterval);

  process.on('SIGINT', () => {
    monitor.stop();
    process.exit(0);
  });
}