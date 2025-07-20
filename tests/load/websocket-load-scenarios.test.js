/**
 * WebSocket Load Test Scenarios
 * Various load patterns to test error handling system resilience
 */

const WebSocket = require('ws');
const { performance } = require('perf_hooks');

class LoadTestScenario {
  constructor(serverUrl = 'ws://localhost:3003/ws') {
    this.serverUrl = serverUrl;
    this.connections = [];
    this.metrics = {
      connectionsCreated: 0,
      connectionsActive: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      reconnects: 0,
      latencies: [],
      startTime: Date.now()
    };
  }

  async createConnection(id) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.serverUrl);
      const connData = {
        id,
        ws,
        connected: false,
        messages: 0,
        errors: 0
      };

      ws.on('open', () => {
        connData.connected = true;
        this.metrics.connectionsActive++;
        this.metrics.connectionsCreated++;
        resolve(connData);
      });

      ws.on('message', (data) => {
        connData.messages++;
        this.metrics.messagesReceived++;
        
        try {
          const msg = JSON.parse(data);
          if (msg.timestamp) {
            this.metrics.latencies.push(Date.now() - msg.timestamp);
          }
        } catch (e) {}
      });

      ws.on('error', (err) => {
        connData.errors++;
        this.metrics.errors++;
      });

      ws.on('close', () => {
        connData.connected = false;
        this.metrics.connectionsActive--;
      });

      this.connections.push(connData);

      setTimeout(() => {
        if (!connData.connected) {
          reject(new Error(`Connection ${id} timeout`));
        }
      }, 5000);
    });
  }

  sendMessage(conn, message) {
    if (conn.connected && conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
      this.metrics.messagesSent++;
      return true;
    }
    return false;
  }

  async closeConnection(conn) {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.close();
    }
  }

  printMetrics(scenarioName) {
    const duration = (Date.now() - this.metrics.startTime) / 1000;
    const avgLatency = this.metrics.latencies.length > 0
      ? this.metrics.latencies.reduce((a, b) => a + b, 0) / this.metrics.latencies.length
      : 0;

    console.log(`\n📊 ${scenarioName} Results:`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    console.log(`   Connections: ${this.metrics.connectionsCreated} created, ${this.metrics.connectionsActive} active`);
    console.log(`   Messages: ${this.metrics.messagesSent} sent, ${this.metrics.messagesReceived} received`);
    console.log(`   Errors: ${this.metrics.errors}`);
    console.log(`   Avg Latency: ${avgLatency.toFixed(2)}ms`);
    console.log(`   Throughput: ${(this.metrics.messagesReceived / duration).toFixed(2)} msg/s`);
  }

  async cleanup() {
    await Promise.all(
      this.connections.map(conn => this.closeConnection(conn))
    );
  }
}

// Scenario 1: Gradual Ramp-Up
async function gradualRampUp() {
  console.log('\n🔄 Scenario 1: Gradual Ramp-Up (0 -> 1000 connections over 30s)');
  const scenario = new LoadTestScenario();
  
  const targetConnections = 1000;
  const rampUpTime = 30000; // 30 seconds
  const connectionDelay = rampUpTime / targetConnections;

  for (let i = 0; i < targetConnections; i++) {
    setTimeout(async () => {
      try {
        await scenario.createConnection(`gradual-${i}`);
        
        // Send periodic messages
        const conn = scenario.connections[i];
        const messageInterval = setInterval(() => {
          const sent = scenario.sendMessage(conn, {
            type: 'test',
            data: `Message from ${conn.id}`
          });
          if (!sent) clearInterval(messageInterval);
        }, 1000);
      } catch (err) {
        console.error(`Failed to create connection ${i}:`, err.message);
      }
    }, i * connectionDelay);
  }

  // Run for 60 seconds total
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  scenario.printMetrics('Gradual Ramp-Up');
  await scenario.cleanup();
}

// Scenario 2: Spike Test
async function spikeTest() {
  console.log('\n⚡ Scenario 2: Spike Test (500 connections instantly)');
  const scenario = new LoadTestScenario();
  
  const spikeSize = 500;
  const connectionPromises = [];

  // Create all connections at once
  console.log('   Creating spike...');
  for (let i = 0; i < spikeSize; i++) {
    connectionPromises.push(
      scenario.createConnection(`spike-${i}`)
        .catch(err => console.error(`Spike connection ${i} failed:`, err.message))
    );
  }

  const results = await Promise.allSettled(connectionPromises);
  const successful = results.filter(r => r.status === 'fulfilled').length;
  console.log(`   Spike complete: ${successful}/${spikeSize} connections established`);

  // Send burst messages
  for (let burst = 0; burst < 5; burst++) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    console.log(`   Sending burst ${burst + 1}...`);
    scenario.connections.forEach(conn => {
      for (let m = 0; m < 10; m++) {
        scenario.sendMessage(conn, {
          type: 'burst',
          burst: burst,
          message: m
        });
      }
    });
  }

  scenario.printMetrics('Spike Test');
  await scenario.cleanup();
}

// Scenario 3: Wave Pattern
async function wavePattern() {
  console.log('\n🌊 Scenario 3: Wave Pattern (Connect/Disconnect cycles)');
  const scenario = new LoadTestScenario();
  
  const waveSize = 200;
  const numWaves = 5;

  for (let wave = 0; wave < numWaves; wave++) {
    console.log(`   Wave ${wave + 1} starting...`);
    
    // Create connections
    const waveConnections = [];
    for (let i = 0; i < waveSize; i++) {
      try {
        const conn = await scenario.createConnection(`wave${wave}-${i}`);
        waveConnections.push(conn);
      } catch (err) {}
    }

    // Send messages for 5 seconds
    const messageInterval = setInterval(() => {
      waveConnections.forEach(conn => {
        scenario.sendMessage(conn, {
          type: 'wave',
          wave: wave,
          data: 'Wave message'
        });
      });
    }, 100);

    await new Promise(resolve => setTimeout(resolve, 5000));
    clearInterval(messageInterval);

    // Disconnect all
    console.log(`   Wave ${wave + 1} disconnecting...`);
    await Promise.all(waveConnections.map(conn => scenario.closeConnection(conn)));
    
    // Wait before next wave
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  scenario.printMetrics('Wave Pattern');
  await scenario.cleanup();
}

// Scenario 4: Sustained High Load
async function sustainedHighLoad() {
  console.log('\n🔥 Scenario 4: Sustained High Load (2000 connections, 100 msg/s each)');
  const scenario = new LoadTestScenario();
  
  const targetConnections = 2000;
  const messagesPerSecond = 100;
  const testDuration = 30000; // 30 seconds

  console.log('   Establishing connections...');
  const connectionPromises = [];
  for (let i = 0; i < targetConnections; i++) {
    connectionPromises.push(
      scenario.createConnection(`sustained-${i}`)
        .catch(() => null)
    );
  }

  const connections = (await Promise.all(connectionPromises)).filter(Boolean);
  console.log(`   ${connections.length}/${targetConnections} connections established`);

  // Start high-frequency messaging
  console.log('   Starting sustained load...');
  const messageIntervals = connections.map(conn => {
    return setInterval(() => {
      scenario.sendMessage(conn, {
        type: 'sustained',
        id: conn.id,
        sequence: conn.messages
      });
    }, 1000 / messagesPerSecond);
  });

  // Run for specified duration
  await new Promise(resolve => setTimeout(resolve, testDuration));

  // Stop messaging
  messageIntervals.forEach(interval => clearInterval(interval));

  scenario.printMetrics('Sustained High Load');
  await scenario.cleanup();
}

// Scenario 5: Connection Churn
async function connectionChurn() {
  console.log('\n♻️  Scenario 5: Connection Churn (Constant connect/disconnect)');
  const scenario = new LoadTestScenario();
  
  const baseConnections = 100;
  const churnRate = 10; // connections per second
  const testDuration = 30000; // 30 seconds

  // Establish base connections
  console.log('   Establishing base connections...');
  for (let i = 0; i < baseConnections; i++) {
    await scenario.createConnection(`base-${i}`).catch(() => {});
  }

  // Start churning connections
  console.log('   Starting connection churn...');
  let churnCount = 0;
  const churnInterval = setInterval(async () => {
    // Disconnect random connections
    const activeConns = scenario.connections.filter(c => c.connected);
    if (activeConns.length > 0) {
      const toDisconnect = activeConns[Math.floor(Math.random() * activeConns.length)];
      await scenario.closeConnection(toDisconnect);
    }

    // Create new connections
    scenario.createConnection(`churn-${churnCount++}`).catch(() => {});
  }, 1000 / churnRate);

  // Send messages on all active connections
  const messageInterval = setInterval(() => {
    scenario.connections
      .filter(c => c.connected)
      .forEach(conn => {
        scenario.sendMessage(conn, {
          type: 'churn',
          active: scenario.metrics.connectionsActive
        });
      });
  }, 100);

  await new Promise(resolve => setTimeout(resolve, testDuration));

  clearInterval(churnInterval);
  clearInterval(messageInterval);

  scenario.printMetrics('Connection Churn');
  await scenario.cleanup();
}

// Scenario 6: Error Recovery Test
async function errorRecoveryTest() {
  console.log('\n🔧 Scenario 6: Error Recovery Test (Simulated failures)');
  const scenario = new LoadTestScenario();
  
  const numConnections = 500;

  console.log('   Establishing connections...');
  const connections = [];
  for (let i = 0; i < numConnections; i++) {
    try {
      const conn = await scenario.createConnection(`error-test-${i}`);
      connections.push(conn);
    } catch (err) {}
  }

  console.log(`   ${connections.length} connections established`);

  // Simulate various error conditions
  console.log('   Simulating error conditions...');
  
  // 1. Send malformed messages
  connections.slice(0, 100).forEach(conn => {
    if (conn.ws.readyState === WebSocket.OPEN) {
      conn.ws.send('INVALID_JSON{{{');
      conn.ws.send(Buffer.from([0xFF, 0xFE, 0xFD])); // Binary data
    }
  });

  // 2. Rapid connect/disconnect
  const rapidConns = connections.slice(100, 200);
  for (let i = 0; i < 5; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    rapidConns.forEach(conn => conn.ws.close());
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Attempt reconnection
    for (let j = 0; j < rapidConns.length; j++) {
      try {
        const newConn = await scenario.createConnection(`rapid-reconnect-${i}-${j}`);
        rapidConns[j] = newConn;
      } catch (err) {}
    }
  }

  // 3. Send oversized messages
  connections.slice(200, 300).forEach(conn => {
    const largeData = 'x'.repeat(1024 * 1024); // 1MB message
    scenario.sendMessage(conn, {
      type: 'oversized',
      data: largeData
    });
  });

  // 4. Normal operation for remaining connections
  const normalInterval = setInterval(() => {
    connections.slice(300).forEach(conn => {
      scenario.sendMessage(conn, {
        type: 'normal',
        test: 'error-recovery'
      });
    });
  }, 1000);

  await new Promise(resolve => setTimeout(resolve, 10000));
  clearInterval(normalInterval);

  scenario.printMetrics('Error Recovery Test');
  await scenario.cleanup();
}

// Main execution
async function runAllScenarios() {
  console.log('🚀 WebSocket Load Test Scenarios');
  console.log('================================\n');

  const scenarios = [
    gradualRampUp,
    spikeTest,
    wavePattern,
    sustainedHighLoad,
    connectionChurn,
    errorRecoveryTest
  ];

  for (const scenario of scenarios) {
    try {
      await scenario();
      // Pause between scenarios
      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (err) {
      console.error(`\n❌ Scenario failed:`, err);
    }
  }

  console.log('\n\n✅ All scenarios completed!');
  process.exit(0);
}

// Export for individual scenario testing
module.exports = {
  LoadTestScenario,
  gradualRampUp,
  spikeTest,
  wavePattern,
  sustainedHighLoad,
  connectionChurn,
  errorRecoveryTest
};

// Run all scenarios if executed directly
if (require.main === module) {
  runAllScenarios().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}