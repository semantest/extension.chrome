#!/bin/bash

echo "🧪 Testing complete image generation flow..."
echo ""
echo "📋 Prerequisites:"
echo "1. Extension reloaded with latest changes"
echo "2. ChatGPT tab open and ready"
echo "3. SDK server running on port 3004"
echo ""

echo "📨 Sending test image request..."
./generate-image.sh "A serene mountain landscape at sunset"

echo ""
echo "⏱️  Watch for:"
echo "1. Extension popup should show the request"
echo "2. ChatGPT should generate the image"
echo "3. Response should be sent back to SDK"
echo "4. 'Active Addon' should show 'ChatGPT Integration'"
echo ""
echo "🔍 Check the extension popup for message logs!"