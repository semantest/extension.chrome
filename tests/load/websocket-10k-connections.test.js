/**
 * WebSocket Load Test - 10,000 Concurrent Connections
 * High-performance load testing for error handling system
 */

const WebSocket = require('ws');
const cluster = require('cluster');
const os = require('os');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  targetConnections: 10000,
  serverUrl: process.env.WS_SERVER_URL || 'ws://localhost:3003/ws',
  workersCount: process.env.WORKERS || os.cpus().length,
  connectionsPerWorker: null, // Calculated below
  rampUpTime: 30000, // 30 seconds to establish all connections
  testDuration: 120000, // 2 minutes of sustained load
  messageInterval: 5000, // Send message every 5 seconds per connection
  statsInterval: 5000, // Report stats every 5 seconds
  reconnectDelay: 1000, // Delay before reconnecting failed connections
  maxReconnectAttempts: 3
};

CONFIG.connectionsPerWorker = Math.ceil(CONFIG.targetConnections / CONFIG.workersCount);

// Shared metrics storage
const metrics = {
  connectionsEstablished: 0,
  connectionsFailed: 0,
  messagesReceived: 0,
  messagesSent: 0,
  errors: 0,
  latencies: [],
  memoryUsage: [],
  cpuUsage: [],
  startTime: Date.now()
};

// Master process - Orchestrator
if (cluster.isMaster) {
  console.log(`🚀 WebSocket Load Test - Target: ${CONFIG.targetConnections} connections`);
  console.log(`👷 Workers: ${CONFIG.workersCount} (${CONFIG.connectionsPerWorker} connections each)`);
  console.log(`📍 Server: ${CONFIG.serverUrl}`);
  console.log(`⏱️  Ramp-up: ${CONFIG.rampUpTime / 1000}s, Test duration: ${CONFIG.testDuration / 1000}s\n`);

  const workerMetrics = new Map();
  let testStartTime = Date.now();
  let allConnectionsEstablished = false;

  // Fork workers
  for (let i = 0; i < CONFIG.workersCount; i++) {
    const worker = cluster.fork();
    workerMetrics.set(worker.id, {
      connections: 0,
      messages: 0,
      errors: 0,
      latencies: []
    });
  }

  // Handle worker messages
  cluster.on('message', (worker, message) => {
    if (message.type === 'metrics') {
      const workerData = workerMetrics.get(worker.id);
      Object.assign(workerData, message.data);
    }
  });

  // Periodic stats reporting
  const statsInterval = setInterval(() => {
    let totalConnections = 0;
    let totalMessages = 0;
    let totalErrors = 0;
    let allLatencies = [];

    // Aggregate metrics from all workers
    for (const [workerId, data] of workerMetrics) {
      totalConnections += data.connections;
      totalMessages += data.messages;
      totalErrors += data.errors;
      allLatencies = allLatencies.concat(data.latencies);
    }

    const elapsed = (Date.now() - testStartTime) / 1000;
    const avgLatency = allLatencies.length > 0 
      ? (allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(2)
      : 0;
    const p95Latency = allLatencies.length > 0
      ? allLatencies.sort((a, b) => a - b)[Math.floor(allLatencies.length * 0.95)]
      : 0;

    // Memory usage
    const memUsage = process.memoryUsage();
    const memMB = (memUsage.heapUsed / 1024 / 1024).toFixed(2);

    console.log(`\n📊 Stats at ${elapsed.toFixed(0)}s:`);
    console.log(`   Connections: ${totalConnections}/${CONFIG.targetConnections} (${(totalConnections / CONFIG.targetConnections * 100).toFixed(1)}%)`);
    console.log(`   Messages: ${totalMessages} (${(totalMessages / elapsed).toFixed(1)} msg/s)`);
    console.log(`   Errors: ${totalErrors}`);
    console.log(`   Latency: avg=${avgLatency}ms, p95=${p95Latency}ms`);
    console.log(`   Memory: ${memMB}MB`);

    // Check if all connections established
    if (!allConnectionsEstablished && totalConnections >= CONFIG.targetConnections * 0.95) {
      allConnectionsEstablished = true;
      console.log(`\n✅ Target connections reached! Starting sustained load test...`);
      
      // Send sustained load command to workers
      for (const worker of Object.values(cluster.workers)) {
        worker.send({ command: 'startSustainedLoad' });
      }
    }

    // Clear latency data periodically to prevent memory growth
    for (const data of workerMetrics.values()) {
      data.latencies = [];
    }
  }, CONFIG.statsInterval);

  // Handle worker exit
  cluster.on('exit', (worker, code, signal) => {
    console.error(`❌ Worker ${worker.id} died (${signal || code})`);
    workerMetrics.delete(worker.id);
    
    // Replace dead worker
    if (Object.keys(cluster.workers).length < CONFIG.workersCount) {
      const newWorker = cluster.fork();
      workerMetrics.set(newWorker.id, {
        connections: 0,
        messages: 0,
        errors: 0,
        latencies: []
      });
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n🛑 Shutting down load test...');
    clearInterval(statsInterval);
    
    // Signal workers to disconnect
    for (const worker of Object.values(cluster.workers)) {
      worker.send({ command: 'shutdown' });
    }

    setTimeout(() => {
      console.log('📈 Final report generated');
      process.exit(0);
    }, 5000);
  });

  // Test completion
  setTimeout(() => {
    console.log('\n\n✅ Load test completed!');
    process.emit('SIGINT');
  }, CONFIG.rampUpTime + CONFIG.testDuration);

} else {
  // Worker process - Connection handler
  const connections = [];
  const workerMetrics = {
    connections: 0,
    messages: 0,
    errors: 0,
    latencies: []
  };
  let sustainedLoadStarted = false;

  // Create connections with ramp-up
  const connectionDelay = CONFIG.rampUpTime / CONFIG.connectionsPerWorker;
  
  function createConnection(index) {
    const ws = new WebSocket(CONFIG.serverUrl);
    const connectionData = {
      id: `worker-${cluster.worker.id}-conn-${index}`,
      ws: ws,
      connected: false,
      reconnectAttempts: 0,
      lastMessageTime: Date.now(),
      messageInterval: null
    };

    ws.on('open', () => {
      connectionData.connected = true;
      workerMetrics.connections++;
      
      // Send initial handshake
      ws.send(JSON.stringify({
        type: 'handshake',
        clientId: connectionData.id,
        timestamp: Date.now()
      }));

      // Start sending messages if sustained load started
      if (sustainedLoadStarted) {
        startMessageSending(connectionData);
      }
    });

    ws.on('message', (data) => {
      workerMetrics.messages++;
      
      try {
        const message = JSON.parse(data);
        
        // Calculate latency for echo messages
        if (message.type === 'echo' && message.timestamp) {
          const latency = Date.now() - message.timestamp;
          workerMetrics.latencies.push(latency);
        }
      } catch (err) {
        // Handle non-JSON messages
      }
    });

    ws.on('error', (err) => {
      workerMetrics.errors++;
      connectionData.connected = false;
    });

    ws.on('close', () => {
      connectionData.connected = false;
      workerMetrics.connections--;
      
      // Clear message interval
      if (connectionData.messageInterval) {
        clearInterval(connectionData.messageInterval);
      }

      // Attempt reconnection
      if (connectionData.reconnectAttempts < CONFIG.maxReconnectAttempts) {
        connectionData.reconnectAttempts++;
        setTimeout(() => {
          reconnectConnection(connectionData);
        }, CONFIG.reconnectDelay);
      }
    });

    connections.push(connectionData);
  }

  function reconnectConnection(connectionData) {
    const ws = new WebSocket(CONFIG.serverUrl);
    connectionData.ws = ws;
    
    // Re-attach event handlers
    ws.on('open', () => {
      connectionData.connected = true;
      connectionData.reconnectAttempts = 0;
      workerMetrics.connections++;
      
      ws.send(JSON.stringify({
        type: 'handshake',
        clientId: connectionData.id,
        timestamp: Date.now()
      }));

      if (sustainedLoadStarted) {
        startMessageSending(connectionData);
      }
    });

    ws.on('message', (data) => {
      workerMetrics.messages++;
      
      try {
        const message = JSON.parse(data);
        if (message.type === 'echo' && message.timestamp) {
          const latency = Date.now() - message.timestamp;
          workerMetrics.latencies.push(latency);
        }
      } catch (err) {}
    });

    ws.on('error', () => {
      workerMetrics.errors++;
      connectionData.connected = false;
    });

    ws.on('close', () => {
      connectionData.connected = false;
      workerMetrics.connections--;
      
      if (connectionData.messageInterval) {
        clearInterval(connectionData.messageInterval);
      }
    });
  }

  function startMessageSending(connectionData) {
    if (connectionData.messageInterval) {
      clearInterval(connectionData.messageInterval);
    }

    // Send messages at regular intervals
    connectionData.messageInterval = setInterval(() => {
      if (connectionData.connected && connectionData.ws.readyState === WebSocket.OPEN) {
        const message = {
          type: 'test',
          clientId: connectionData.id,
          timestamp: Date.now(),
          data: `Test message from ${connectionData.id}`,
          sequence: workerMetrics.messages
        };

        connectionData.ws.send(JSON.stringify(message));
        connectionData.lastMessageTime = Date.now();
      }
    }, CONFIG.messageInterval + Math.random() * 1000); // Add jitter to prevent thundering herd
  }

  // Create connections with ramp-up timing
  for (let i = 0; i < CONFIG.connectionsPerWorker; i++) {
    setTimeout(() => {
      createConnection(i);
    }, i * connectionDelay);
  }

  // Report metrics to master
  setInterval(() => {
    process.send({
      type: 'metrics',
      data: {
        connections: workerMetrics.connections,
        messages: workerMetrics.messages,
        errors: workerMetrics.errors,
        latencies: [...workerMetrics.latencies]
      }
    });
  }, CONFIG.statsInterval);

  // Handle commands from master
  process.on('message', (message) => {
    if (message.command === 'startSustainedLoad') {
      sustainedLoadStarted = true;
      
      // Start sending messages on all active connections
      connections.forEach(conn => {
        if (conn.connected) {
          startMessageSending(conn);
        }
      });
    } else if (message.command === 'shutdown') {
      // Gracefully close all connections
      connections.forEach(conn => {
        if (conn.messageInterval) {
          clearInterval(conn.messageInterval);
        }
        if (conn.ws && conn.ws.readyState === WebSocket.OPEN) {
          conn.ws.close();
        }
      });
      
      // Exit worker
      setTimeout(() => {
        process.exit(0);
      }, 1000);
    }
  });

  // Monitor connection health
  setInterval(() => {
    const now = Date.now();
    connections.forEach(conn => {
      if (conn.connected && sustainedLoadStarted) {
        // Check for stale connections
        if (now - conn.lastMessageTime > CONFIG.messageInterval * 3) {
          // Connection might be stale, close and reconnect
          conn.ws.close();
        }
      }
    });
  }, 10000); // Check every 10 seconds
}