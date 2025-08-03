# Test Coordination for Semantest API

## Overview
Comprehensive test strategy for Alex's Semantest API implementation, coordinating with team efforts.

## API Testing Requirements

### 1. NewChatRequested Endpoint Testing (#23)

#### Async Job Queue Tests
```typescript
describe('BullMQ Job Processing', () => {
  let queue: Queue;
  let worker: Worker;
  
  beforeEach(async () => {
    queue = new Queue('image-generation', {
      connection: mockRedis
    });
    
    worker = new Worker('image-generation', jobProcessor, {
      connection: mockRedis
    });
  });
  
  it('should queue NewChatRequested jobs', async () => {
    const job = await queue.add('new-chat', {
      chatId: 'test-123',
      provider: 'dalle',
      prompt: 'test prompt'
    });
    
    expect(job.id).toBeDefined();
    expect(job.data).toMatchObject({
      chatId: 'test-123',
      provider: 'dalle'
    });
  });
  
  it('should handle job failures with retry', async () => {
    const failingJob = await queue.add('new-chat', {
      chatId: 'fail-test',
      shouldFail: true
    }, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      }
    });
    
    await expect(failingJob.waitUntilFinished()).rejects.toThrow();
    expect(failingJob.attemptsMade).toBe(3);
  });
});
```

#### Multi-Provider Tests
```typescript
describe('Multi-Provider Support', () => {
  const providers = ['dalle', 'stable-diffusion', 'midjourney'];
  
  providers.forEach(provider => {
    it(`should handle ${provider} provider`, async () => {
      const response = await request(app)
        .post('/api/v1/image-generation')
        .send({
          provider,
          prompt: 'test prompt',
          options: getProviderDefaults(provider)
        });
      
      expect(response.status).toBe(202);
      expect(response.body.jobId).toBeDefined();
      expect(response.body.provider).toBe(provider);
    });
  });
  
  it('should validate provider-specific options', async () => {
    const response = await request(app)
      .post('/api/v1/image-generation')
      .send({
        provider: 'dalle',
        prompt: 'test',
        options: {
          size: 'invalid-size' // Should fail validation
        }
      });
    
    expect(response.status).toBe(400);
    expect(response.body.error).toContain('Invalid size');
  });
});
```

#### Webhook Callback Tests
```typescript
describe('Webhook Callbacks', () => {
  let webhookServer: Server;
  let receivedCallbacks: any[] = [];
  
  beforeEach(() => {
    webhookServer = createWebhookServer((data) => {
      receivedCallbacks.push(data);
    });
  });
  
  it('should send webhook on job completion', async () => {
    const response = await request(app)
      .post('/api/v1/image-generation')
      .send({
        provider: 'dalle',
        prompt: 'test',
        webhookUrl: 'http://localhost:8080/webhook'
      });
    
    const jobId = response.body.jobId;
    
    // Wait for job completion
    await waitForJobCompletion(jobId);
    
    expect(receivedCallbacks).toContainEqual(
      expect.objectContaining({
        jobId,
        status: 'completed',
        result: expect.any(Object)
      })
    );
  });
});
```

### 2. WebSocket Event Testing

```typescript
describe('WebSocket Events', () => {
  let wsClient: WebSocket;
  
  beforeEach((done) => {
    wsClient = new WebSocket('ws://localhost:3000');
    wsClient.on('open', done);
  });
  
  it('should emit NewChatRequested event', (done) => {
    wsClient.on('message', (data) => {
      const event = JSON.parse(data.toString());
      
      if (event.type === 'NewChatRequested') {
        expect(event.payload).toMatchObject({
          chatId: expect.any(String),
          timestamp: expect.any(Number),
          metadata: expect.any(Object)
        });
        done();
      }
    });
    
    // Trigger new chat
    triggerNewChat();
  });
});
```

### 3. Addon Separation Testing

```typescript
describe('Addon API Tests', () => {
  it('should retrieve addon list', async () => {
    const response = await request(app)
      .get('/api/v1/addons')
      .set('Authorization', 'Bearer test-token');
    
    expect(response.status).toBe(200);
    expect(response.body.addons).toBeInstanceOf(Array);
    expect(response.body.addons[0]).toMatchObject({
      id: expect.any(String),
      name: expect.any(String),
      version: expect.any(String),
      cdnUrl: expect.stringMatching(/^https:\/\/cdn/)
    });
  });
  
  it('should validate CORS headers', async () => {
    const response = await request(app)
      .options('/api/v1/addons')
      .set('Origin', 'chrome-extension://test-id');
    
    expect(response.headers['access-control-allow-origin']).toBe('chrome-extension://test-id');
    expect(response.headers['access-control-allow-methods']).toContain('GET');
  });
});
```

### 4. Rate Limiting & Health Check Tests

```typescript
describe('Rate Limiting', () => {
  it('should enforce rate limits', async () => {
    const requests = Array(101).fill(null).map(() =>
      request(app).post('/api/v1/image-generation').send({
        provider: 'dalle',
        prompt: 'test'
      })
    );
    
    const responses = await Promise.all(requests);
    const rateLimited = responses.filter(r => r.status === 429);
    
    expect(rateLimited.length).toBeGreaterThan(0);
  });
});

describe('Health Checks', () => {
  it('should report Redis health', async () => {
    const response = await request(app).get('/api/v1/health');
    
    expect(response.body).toMatchObject({
      status: 'healthy',
      services: {
        redis: 'connected',
        bullmq: 'active',
        database: 'connected'
      }
    });
  });
});
```

## Performance Testing

```typescript
describe('Performance Benchmarks', () => {
  it('should handle 100 concurrent requests', async () => {
    const startTime = Date.now();
    
    const requests = Array(100).fill(null).map(() =>
      request(app).post('/api/v1/image-generation').send({
        provider: 'dalle',
        prompt: 'concurrent test'
      })
    );
    
    const responses = await Promise.all(requests);
    const duration = Date.now() - startTime;
    
    expect(responses.every(r => r.status === 202)).toBe(true);
    expect(duration).toBeLessThan(5000); // Under 5 seconds
  });
});
```

## Test Infrastructure Requirements

1. **Redis Mock**: For BullMQ testing
2. **WebSocket Mock**: For real-time event testing
3. **Provider Mocks**: For DALL-E, Stable Diffusion, Midjourney
4. **Webhook Server**: For callback testing

## Coverage Goals

- Unit Tests: 95% coverage
- Integration Tests: 90% coverage
- E2E Tests: Critical paths covered
- Performance Tests: Load and stress testing

## Coordination with Team

- **Sam**: Document test scenarios and acceptance criteria
- **Dana**: CI/CD pipeline for test execution
- **Aria**: Architecture validation through tests
- **Eva**: Extension integration tests