#!/bin/bash
# Run automated consent popup tests

echo "🧪 Running Automated Consent Popup Tests..."
echo "========================================="

# Set test environment
export NODE_ENV=test

# Run the specific consent popup automation tests
npx jest tests/consent-popup-automation.test.js --verbose --coverage

# Check test results
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ All automated tests passed!"
  echo ""
  echo "Test Summary:"
  echo "- Consent popup appears on install ✓"
  echo "- Retry logic works correctly ✓"
  echo "- Storage flags set properly ✓"
else
  echo ""
  echo "❌ Some tests failed. Please review the output above."
  exit 1
fi