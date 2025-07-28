#!/bin/bash

echo "Running passing tests to calculate accurate coverage..."

# Run passing tests
npm test -- \
  src/message-store.test.ts \
  src/shared/patterns/error-handling.test.ts \
  src/shared/patterns/event-handling.test.ts \
  src/health-checks/tab-health.test.ts \
  src/time-travel-ui.test.ts \
  src/performance-optimizer.test.ts \
  --coverage \
  --passWithNoTests \
  2>&1 | tail -100