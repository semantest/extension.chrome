# WebSocket Load Testing Suite

Comprehensive load testing suite designed to stress test WebSocket servers with 10,000+ concurrent connections.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Run 10K connection test
npm run test:10k

# Run various load scenarios
npm run test:scenarios

# Run distributed test (requires multiple machines)
npm run test:distributed
```

## 📋 Test Suites

### 1. **10K Concurrent Connections Test** (`websocket-10k-connections.test.js`)
- Establishes 10,000 concurrent WebSocket connections
- Uses worker threads for optimal performance
- Gradual ramp-up over 30 seconds
- Sustained load testing for 2 minutes
- Real-time metrics reporting
- Automatic reconnection handling

**Usage:**
```bash
# Default configuration
node websocket-10k-connections.test.js

# Custom configuration
WS_SERVER_URL=ws://myserver:8080/ws WORKERS=16 node websocket-10k-connections.test.js
```

### 2. **Load Test Scenarios** (`websocket-load-scenarios.test.js`)
Multiple testing patterns to evaluate different stress conditions:

- **Gradual Ramp-Up**: 0 to 1000 connections over 30 seconds
- **Spike Test**: 500 connections instantly
- **Wave Pattern**: Connect/disconnect cycles
- **Sustained High Load**: 2000 connections at 100 msg/s each
- **Connection Churn**: Constant connect/disconnect pattern
- **Error Recovery**: Tests error handling and recovery

**Usage:**
```bash
# Run all scenarios
node websocket-load-scenarios.test.js

# Run specific scenario
const { spikeTest } = require('./websocket-load-scenarios.test.js');
spikeTest();
```

### 3. **Distributed Load Test** (`distributed-load-test.js`)
Orchestrates load testing across multiple machines for massive scale:

- Coordinator/Agent architecture
- Automatic agent discovery
- Real-time metrics aggregation
- REST API for control and monitoring
- Supports 50K+ connections across agents

**Usage:**
```bash
# Start coordinator
node distributed-load-test.js coordinator

# Start agents on different machines
node distributed-load-test.js agent 8081 http://coordinator-ip:8080
node distributed-load-test.js agent 8082 http://coordinator-ip:8080

# Start test via API
curl -X POST http://localhost:8080/start
```

### 4. **Real-time Monitor** (`load-test-monitor.js`)
Terminal-based dashboard for monitoring load tests (Coming Soon):

- Live connection count
- Message throughput
- Latency percentiles
- CPU and memory usage
- Network I/O
- Error rates

## 🔧 Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `WS_SERVER_URL` | ws://localhost:3003/ws | WebSocket server endpoint |
| `WORKERS` | CPU count | Number of worker processes |
| `TARGET_CONNECTIONS` | 10000 | Total connections to establish |
| `RAMP_UP_TIME` | 30000 | Time to reach target (ms) |
| `TEST_DURATION` | 120000 | Test duration after ramp-up (ms) |
| `MESSAGE_INTERVAL` | 5000 | Message frequency per connection (ms) |

### Load Profiles

```javascript
// Light load
const light = {
  targetConnections: 1000,
  messageInterval: 10000,
  testDuration: 60000
};

// Medium load
const medium = {
  targetConnections: 5000,
  messageInterval: 5000,
  testDuration: 120000
};

// Heavy load
const heavy = {
  targetConnections: 10000,
  messageInterval: 1000,
  testDuration: 300000
};

// Extreme load
const extreme = {
  targetConnections: 50000,
  messageInterval: 500,
  testDuration: 600000
};
```

## 📊 Metrics

### Real-time Metrics
- **Connections**: Active, failed, reconnecting
- **Messages**: Sent/received per second
- **Latency**: Average, P50, P95, P99
- **Errors**: Connection errors, message errors
- **System**: CPU usage, memory, network I/O

### Performance Targets
- **10K connections**: < 5% CPU per 1K connections
- **Latency P95**: < 100ms under load
- **Error rate**: < 0.1%
- **Message throughput**: 100K+ msg/s
- **Memory**: < 2GB for 10K connections

## 🎯 Test Scenarios

### Scenario 1: E-commerce Flash Sale
```javascript
// Simulate 10K users joining at once
const flashSale = {
  connections: 10000,
  rampUp: 5000, // 5 seconds
  messageInterval: 100, // Rapid updates
  duration: 300000 // 5 minutes
};
```

### Scenario 2: Live Event Streaming
```javascript
// Gradual join, sustained viewing
const liveEvent = {
  connections: 20000,
  rampUp: 600000, // 10 minutes
  messageInterval: 30000, // Periodic heartbeat
  duration: 7200000 // 2 hours
};
```

### Scenario 3: IoT Sensor Network
```javascript
// Many connections, infrequent messages
const iotNetwork = {
  connections: 50000,
  rampUp: 300000, // 5 minutes
  messageInterval: 60000, // 1 minute
  duration: 86400000 // 24 hours
};
```

## 🔍 Debugging

### Enable Debug Logging
```bash
DEBUG=websocket:* node websocket-10k-connections.test.js
```

### Capture Network Traffic
```bash
# Using tcpdump
sudo tcpdump -i any -w websocket-load.pcap port 3003

# Using Wireshark
wireshark -k -i any -f "port 3003"
```

### Performance Profiling
```bash
# CPU profiling
node --prof websocket-10k-connections.test.js
node --prof-process isolate-*.log

# Memory profiling
node --expose-gc --inspect websocket-10k-connections.test.js
```

## 🚨 Troubleshooting

### "Too many open files" Error
```bash
# Increase file descriptor limit
ulimit -n 100000

# Permanent change (Linux)
echo "* soft nofile 100000" >> /etc/security/limits.conf
echo "* hard nofile 100000" >> /etc/security/limits.conf
```

### High Memory Usage
```javascript
// Reduce metrics collection frequency
const CONFIG = {
  statsInterval: 10000, // 10 seconds instead of 5
  // Clear latency arrays more frequently
};
```

### Connection Timeouts
```javascript
// Increase timeout values
const CONFIG = {
  connectTimeout: 10000, // 10 seconds
  reconnectDelay: 2000, // 2 seconds
  maxReconnectAttempts: 5
};
```

## 📈 Optimization Tips

### Server-side
1. Use connection pooling
2. Implement message batching
3. Enable compression
4. Use binary protocols when possible
5. Implement backpressure handling

### Client-side
1. Reuse connections when possible
2. Batch messages
3. Implement exponential backoff
4. Use worker threads for CPU-intensive tasks
5. Monitor memory usage

## 🔗 Integration

### CI/CD Pipeline
```yaml
# .github/workflows/load-test.yml
name: Load Test
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM
jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run test:scenarios
      - run: npm run test:10k
```

### Docker Support
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
CMD ["npm", "run", "test:10k"]
```

### Kubernetes Deployment
```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: websocket-load-test
spec:
  parallelism: 5
  template:
    spec:
      containers:
      - name: load-test
        image: websocket-load-test:latest
        env:
        - name: WS_SERVER_URL
          value: "ws://websocket-server:8080/ws"
        - name: WORKERS
          value: "4"
```

## 📚 Additional Resources

- [WebSocket Protocol RFC 6455](https://tools.ietf.org/html/rfc6455)
- [Node.js Worker Threads](https://nodejs.org/api/worker_threads.html)
- [Performance Testing Best Practices](https://www.w3.org/TR/websockets/)
- [Load Testing at Scale](https://engineering.linkedin.com/blog/2019/load-testing-at-scale)

## 🤝 Contributing

1. Add new test scenarios in `websocket-load-scenarios.test.js`
2. Update metrics collection for new patterns
3. Document performance findings
4. Share optimization techniques
5. Report issues and edge cases