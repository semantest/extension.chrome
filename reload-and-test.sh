#!/bin/bash

echo "🔄 Reloading Semantest extension and testing message flow..."
echo ""

# Get the extension ID
EXTENSION_ID=$(find ~/.config/google-chrome/Default/Extensions -name "manifest.json" -exec grep -l "Semantest" {} \; 2>/dev/null | head -1 | cut -d'/' -f8)

if [ -z "$EXTENSION_ID" ]; then
    echo "❌ Could not find Semantest extension ID"
    echo "Please reload the extension manually in chrome://extensions"
else
    echo "📦 Found extension ID: $EXTENSION_ID"
    echo "Please reload the extension manually in chrome://extensions"
fi

echo ""
echo "📋 After reloading, follow these steps:"
echo ""
echo "1. Open ChatGPT (chat.openai.com)"
echo "2. Open Chrome DevTools (F12)"
echo "3. Go to Console tab"
echo "4. Run this test:"
echo ""
echo "   // Check components"
echo "   console.log('Bridge:', !!window.semantestBridge);"
echo "   console.log('Image Generator:', !!window.chatGPTImageGenerator);"
echo "   console.log('Addon:', !!window.chatgptAddon);"
echo ""
echo "5. Then test image generation:"
echo "   ./generate-image.sh \"A beautiful sunset\""
echo ""
echo "6. Check the extension popup for messages"
echo ""
echo "🔍 If components are missing, try refreshing the ChatGPT page"