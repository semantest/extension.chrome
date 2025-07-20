/**
 * Distributed WebSocket Load Test Coordinator
 * Orchestrates load testing across multiple machines/containers
 */

const cluster = require('cluster');
const express = require('express');
const axios = require('axios');
const os = require('os');

// Configuration
const CONFIG = {
  coordinatorPort: process.env.COORDINATOR_PORT || 8080,
  targetConnections: parseInt(process.env.TARGET_CONNECTIONS) || 10000,
  testDuration: parseInt(process.env.TEST_DURATION) || 120000, // 2 minutes
  rampUpTime: parseInt(process.env.RAMP_UP_TIME) || 30000, // 30 seconds
  reportInterval: 5000, // 5 seconds
  agents: process.env.LOAD_AGENTS?.split(',') || ['localhost:8081', 'localhost:8082'],
  wsServerUrl: process.env.WS_SERVER_URL || 'ws://localhost:3003/ws'
};

class LoadTestCoordinator {
  constructor(config) {
    this.config = config;
    this.agents = new Map();
    this.metrics = {
      totalConnections: 0,
      totalMessages: 0,
      totalErrors: 0,
      startTime: null,
      endTime: null,
      agentMetrics: new Map()
    };
    this.app = express();
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());

    // Agent registration
    this.app.post('/register', (req, res) => {
      const { agentId, capabilities } = req.body;
      this.agents.set(agentId, {
        id: agentId,
        capabilities,
        status: 'ready',
        assignedConnections: 0,
        lastHeartbeat: Date.now()
      });
      
      console.log(`✅ Agent registered: ${agentId} (max connections: ${capabilities.maxConnections})`);
      res.json({ success: true, agentId });
    });

    // Agent metrics reporting
    this.app.post('/metrics/:agentId', (req, res) => {
      const { agentId } = req.params;
      const metrics = req.body;
      
      this.agentMetrics.set(agentId, {
        ...metrics,
        lastUpdate: Date.now()
      });
      
      res.json({ success: true });
    });

    // Agent heartbeat
    this.app.post('/heartbeat/:agentId', (req, res) => {
      const { agentId } = req.params;
      const agent = this.agents.get(agentId);
      
      if (agent) {
        agent.lastHeartbeat = Date.now();
        agent.status = req.body.status || 'ready';
      }
      
      res.json({ success: true });
    });

    // Status endpoint
    this.app.get('/status', (req, res) => {
      const aggregatedMetrics = this.aggregateMetrics();
      res.json({
        config: this.config,
        agents: Array.from(this.agents.values()),
        metrics: aggregatedMetrics,
        testRunning: this.testRunning,
        elapsed: this.metrics.startTime ? Date.now() - this.metrics.startTime : 0
      });
    });

    // Start test endpoint
    this.app.post('/start', async (req, res) => {
      try {
        await this.startDistributedTest();
        res.json({ success: true, message: 'Test started' });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Stop test endpoint
    this.app.post('/stop', async (req, res) => {
      try {
        await this.stopDistributedTest();
        res.json({ success: true, message: 'Test stopped' });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });
  }

  async start() {
    this.server = this.app.listen(this.config.coordinatorPort, () => {
      console.log(`🎯 Load Test Coordinator started on port ${this.config.coordinatorPort}`);
      console.log(`📊 Target: ${this.config.targetConnections} connections`);
      console.log(`⏱️  Duration: ${this.config.testDuration / 1000}s`);
      console.log(`🚀 Ramp-up: ${this.config.rampUpTime / 1000}s`);
    });

    // Start agent health monitoring
    this.healthCheckInterval = setInterval(() => {
      this.checkAgentHealth();
    }, 5000);

    // Auto-discover agents if configured
    if (this.config.agents.length > 0) {
      await this.discoverAgents();
    }
  }

  async discoverAgents() {
    console.log('\n🔍 Discovering load test agents...');
    
    for (const agentAddr of this.config.agents) {
      try {
        const response = await axios.get(`http://${agentAddr}/health`);
        if (response.data.ready) {
          console.log(`  ✓ Agent available: ${agentAddr}`);
        }
      } catch (err) {
        console.log(`  ✗ Agent unavailable: ${agentAddr}`);
      }
    }
  }

  async startDistributedTest() {
    console.log('\n🚀 Starting distributed load test...');
    
    this.testRunning = true;
    this.metrics.startTime = Date.now();
    
    // Calculate connections per agent
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'ready');
    if (activeAgents.length === 0) {
      throw new Error('No agents available');
    }

    const connectionsPerAgent = Math.ceil(this.config.targetConnections / activeAgents.length);
    
    console.log(`📊 Distributing ${this.config.targetConnections} connections across ${activeAgents.length} agents`);
    console.log(`   (~${connectionsPerAgent} connections per agent)`);

    // Send start commands to all agents
    const startPromises = activeAgents.map(async (agent) => {
      const agentConfig = {
        connections: connectionsPerAgent,
        serverUrl: this.config.wsServerUrl,
        rampUpTime: this.config.rampUpTime,
        testDuration: this.config.testDuration,
        messageInterval: 5000,
        coordinatorUrl: `http://localhost:${this.config.coordinatorPort}`
      };

      try {
        const response = await axios.post(`http://${agent.id}/start`, agentConfig);
        agent.status = 'running';
        agent.assignedConnections = connectionsPerAgent;
        console.log(`   ✓ Agent ${agent.id} started with ${connectionsPerAgent} connections`);
        return response.data;
      } catch (err) {
        console.error(`   ✗ Failed to start agent ${agent.id}:`, err.message);
        agent.status = 'error';
        return null;
      }
    });

    await Promise.all(startPromises);

    // Start metrics aggregation
    this.metricsInterval = setInterval(() => {
      this.reportAggregatedMetrics();
    }, this.config.reportInterval);

    // Schedule test completion
    setTimeout(() => {
      this.stopDistributedTest();
    }, this.config.rampUpTime + this.config.testDuration);
  }

  async stopDistributedTest() {
    console.log('\n🛑 Stopping distributed load test...');
    
    this.testRunning = false;
    this.metrics.endTime = Date.now();

    // Stop metrics reporting
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Send stop commands to all agents
    const activeAgents = Array.from(this.agents.values()).filter(a => a.status === 'running');
    const stopPromises = activeAgents.map(async (agent) => {
      try {
        await axios.post(`http://${agent.id}/stop`);
        agent.status = 'stopped';
        console.log(`   ✓ Agent ${agent.id} stopped`);
      } catch (err) {
        console.error(`   ✗ Failed to stop agent ${agent.id}:`, err.message);
      }
    });

    await Promise.all(stopPromises);

    // Generate final report
    this.generateFinalReport();
  }

  checkAgentHealth() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    for (const [agentId, agent] of this.agents) {
      if (now - agent.lastHeartbeat > timeout) {
        console.warn(`⚠️  Agent ${agentId} is unresponsive`);
        agent.status = 'unresponsive';
      }
    }
  }

  aggregateMetrics() {
    const aggregated = {
      connections: 0,
      messages: 0,
      errors: 0,
      latencies: [],
      throughput: 0
    };

    for (const [agentId, metrics] of this.agentMetrics) {
      aggregated.connections += metrics.connections || 0;
      aggregated.messages += metrics.messages || 0;
      aggregated.errors += metrics.errors || 0;
      
      if (metrics.latencies && Array.isArray(metrics.latencies)) {
        aggregated.latencies = aggregated.latencies.concat(metrics.latencies);
      }
    }

    // Calculate throughput
    if (this.metrics.startTime) {
      const elapsed = (Date.now() - this.metrics.startTime) / 1000;
      aggregated.throughput = aggregated.messages / elapsed;
    }

    // Calculate latency percentiles
    if (aggregated.latencies.length > 0) {
      aggregated.latencies.sort((a, b) => a - b);
      aggregated.avgLatency = aggregated.latencies.reduce((a, b) => a + b, 0) / aggregated.latencies.length;
      aggregated.p50Latency = aggregated.latencies[Math.floor(aggregated.latencies.length * 0.5)];
      aggregated.p95Latency = aggregated.latencies[Math.floor(aggregated.latencies.length * 0.95)];
      aggregated.p99Latency = aggregated.latencies[Math.floor(aggregated.latencies.length * 0.99)];
      
      // Don't keep all latencies in memory
      delete aggregated.latencies;
    }

    return aggregated;
  }

  reportAggregatedMetrics() {
    const metrics = this.aggregateMetrics();
    const elapsed = (Date.now() - this.metrics.startTime) / 1000;

    console.log(`\n📊 Distributed Test Metrics (${elapsed.toFixed(0)}s):`);
    console.log(`   Active Agents: ${Array.from(this.agents.values()).filter(a => a.status === 'running').length}`);
    console.log(`   Connections: ${metrics.connections}/${this.config.targetConnections}`);
    console.log(`   Messages: ${metrics.messages} (${metrics.throughput.toFixed(2)} msg/s)`);
    console.log(`   Errors: ${metrics.errors}`);
    
    if (metrics.avgLatency) {
      console.log(`   Latency: avg=${metrics.avgLatency.toFixed(2)}ms, p50=${metrics.p50Latency}ms, p95=${metrics.p95Latency}ms, p99=${metrics.p99Latency}ms`);
    }

    // Update stored metrics
    this.metrics.totalConnections = metrics.connections;
    this.metrics.totalMessages = metrics.messages;
    this.metrics.totalErrors = metrics.errors;
  }

  generateFinalReport() {
    const duration = (this.metrics.endTime - this.metrics.startTime) / 1000;
    const finalMetrics = this.aggregateMetrics();

    console.log('\n' + '='.repeat(60));
    console.log('📈 DISTRIBUTED LOAD TEST FINAL REPORT');
    console.log('='.repeat(60));
    console.log(`\nTest Configuration:`);
    console.log(`  Target Connections: ${this.config.targetConnections}`);
    console.log(`  Test Duration: ${duration.toFixed(2)}s`);
    console.log(`  Agents Used: ${this.agents.size}`);
    console.log(`  WebSocket Server: ${this.config.wsServerUrl}`);
    
    console.log(`\nPerformance Metrics:`);
    console.log(`  Total Connections: ${finalMetrics.connections}`);
    console.log(`  Total Messages: ${finalMetrics.messages}`);
    console.log(`  Average Throughput: ${finalMetrics.throughput.toFixed(2)} msg/s`);
    console.log(`  Total Errors: ${finalMetrics.errors}`);
    console.log(`  Error Rate: ${((finalMetrics.errors / finalMetrics.messages) * 100).toFixed(2)}%`);
    
    if (finalMetrics.avgLatency) {
      console.log(`\nLatency Analysis:`);
      console.log(`  Average: ${finalMetrics.avgLatency.toFixed(2)}ms`);
      console.log(`  Median (p50): ${finalMetrics.p50Latency}ms`);
      console.log(`  95th percentile: ${finalMetrics.p95Latency}ms`);
      console.log(`  99th percentile: ${finalMetrics.p99Latency}ms`);
    }

    console.log(`\nAgent Performance:`);
    for (const [agentId, agent] of this.agents) {
      const agentMetrics = this.agentMetrics.get(agentId);
      if (agentMetrics) {
        console.log(`  ${agentId}:`);
        console.log(`    Connections: ${agentMetrics.connections}`);
        console.log(`    Messages: ${agentMetrics.messages}`);
        console.log(`    Errors: ${agentMetrics.errors}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ Test completed successfully');
    console.log('='.repeat(60) + '\n');
  }

  async stop() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
  }
}

// Load Test Agent
class LoadTestAgent {
  constructor(agentId, coordinatorUrl) {
    this.agentId = agentId;
    this.coordinatorUrl = coordinatorUrl;
    this.app = express();
    this.connections = [];
    this.metrics = {
      connections: 0,
      messages: 0,
      errors: 0,
      latencies: []
    };
    this.setupRoutes();
  }

  setupRoutes() {
    this.app.use(express.json());

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        ready: true,
        connections: this.connections.length,
        metrics: this.metrics
      });
    });

    // Start test
    this.app.post('/start', async (req, res) => {
      try {
        this.testConfig = req.body;
        await this.startTest();
        res.json({ success: true });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });

    // Stop test
    this.app.post('/stop', async (req, res) => {
      await this.stopTest();
      res.json({ success: true });
    });
  }

  async start(port) {
    this.port = port;
    this.server = this.app.listen(port, () => {
      console.log(`🤖 Load Test Agent started on port ${port}`);
    });

    // Register with coordinator
    await this.registerWithCoordinator();

    // Start heartbeat
    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, 10000);
  }

  async registerWithCoordinator() {
    try {
      const response = await axios.post(`${this.coordinatorUrl}/register`, {
        agentId: `${os.hostname()}:${this.port}`,
        capabilities: {
          maxConnections: 5000,
          cpuCores: os.cpus().length,
          memory: os.totalmem()
        }
      });
      console.log('✅ Registered with coordinator');
    } catch (err) {
      console.error('❌ Failed to register with coordinator:', err.message);
    }
  }

  async sendHeartbeat() {
    try {
      await axios.post(`${this.coordinatorUrl}/heartbeat/${this.agentId}`, {
        status: this.testRunning ? 'running' : 'ready',
        connections: this.connections.length
      });
    } catch (err) {
      console.error('Failed to send heartbeat:', err.message);
    }
  }

  async sendMetrics() {
    try {
      await axios.post(`${this.coordinatorUrl}/metrics/${this.agentId}`, this.metrics);
    } catch (err) {
      console.error('Failed to send metrics:', err.message);
    }
  }

  async startTest() {
    console.log(`Starting test with ${this.testConfig.connections} connections...`);
    this.testRunning = true;

    // Implement connection creation and management
    // This would use the WebSocket connection logic from the main load test

    // Start metrics reporting
    this.metricsInterval = setInterval(() => {
      this.sendMetrics();
    }, 5000);
  }

  async stopTest() {
    console.log('Stopping test...');
    this.testRunning = false;

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Close all connections
    // Implementation here
  }

  async stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.server) {
      await new Promise(resolve => this.server.close(resolve));
    }
  }
}

// CLI for running coordinator or agent
if (require.main === module) {
  const mode = process.argv[2] || 'coordinator';

  if (mode === 'coordinator') {
    const coordinator = new LoadTestCoordinator(CONFIG);
    coordinator.start().catch(console.error);

    process.on('SIGINT', async () => {
      console.log('\nShutting down coordinator...');
      await coordinator.stop();
      process.exit(0);
    });
  } else if (mode === 'agent') {
    const port = parseInt(process.argv[3]) || 8081;
    const coordinatorUrl = process.argv[4] || 'http://localhost:8080';
    
    const agent = new LoadTestAgent(`${os.hostname()}:${port}`, coordinatorUrl);
    agent.start(port).catch(console.error);

    process.on('SIGINT', async () => {
      console.log('\nShutting down agent...');
      await agent.stop();
      process.exit(0);
    });
  } else {
    console.log('Usage: node distributed-load-test.js [coordinator|agent] [port] [coordinator-url]');
    process.exit(1);
  }
}

module.exports = { LoadTestCoordinator, LoadTestAgent };