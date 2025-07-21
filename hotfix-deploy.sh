#!/bin/bash
# ChatGPT Extension Hotfix Deployment Script

set -e

echo "🚨 HOTFIX DEPLOYMENT PIPELINE v1.1.0"
echo "===================================="

# 1. Get current version and increment
CURRENT_VERSION=$(grep '"version"' build/manifest.json | cut -d'"' -f4)
IFS='.-' read -ra VERSION_PARTS <<< "$CURRENT_VERSION"

# Increment patch version
if [[ ${#VERSION_PARTS[@]} -eq 3 ]]; then
    # 1.0.0 format
    NEW_VERSION="${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.$((${VERSION_PARTS[2]} + 1))"
elif [[ ${#VERSION_PARTS[@]} -eq 4 ]]; then
    # 1.0.0-beta format
    NEW_VERSION="${VERSION_PARTS[0]}.${VERSION_PARTS[1]}.${VERSION_PARTS[2]}-${VERSION_PARTS[3]}"
else
    # 1.0.0-beta.1 format
    PATCH_NUM="${CURRENT_VERSION##*.}"
    NEW_VERSION="${CURRENT_VERSION%.*}.$((PATCH_NUM + 1))"
fi

echo "📌 Current version: $CURRENT_VERSION"
echo "📌 New version: $NEW_VERSION"

# 2. Update manifest version
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" build/manifest.json
echo "✅ Updated manifest.json"

# 3. Remove console.logs (safety check)
sed -i '/console\./d' build/chatgpt-controller.js
sed -i '/console\./d' build/service-worker.js
echo "✅ Cleaned debug code"

# 4. Create hotfix package
python3 create_package.py
PACKAGE_NAME="chatgpt-extension-v${NEW_VERSION}.zip"

if [[ -f "$PACKAGE_NAME" ]]; then
    echo "✅ Package created: $PACKAGE_NAME"
    echo ""
    echo "📦 Package size: $(du -h $PACKAGE_NAME | cut -f1)"
    echo ""
    echo "🚀 READY FOR CHROME WEB STORE UPLOAD!"
    echo "===================================="
    echo "Next steps:"
    echo "1. Upload $PACKAGE_NAME to Chrome Web Store"
    echo "2. Add release notes about the fix"
    echo "3. Submit for review (request expedited review for critical fixes)"
    echo ""
    echo "📝 Don't forget to:"
    echo "- Update GitHub release notes"
    echo "- Notify users of the fix"
    echo "- Monitor for any new issues"
else
    echo "❌ ERROR: Package creation failed!"
    exit 1
fi