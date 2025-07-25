#!/bin/bash

# Generate PNG icons from SVG for Chrome extension
# Requires ImageMagick or similar tool

echo "🎨 Generating Semantest extension icons..."

# Check if convert command exists
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick 'convert' command not found."
    echo "Please install ImageMagick:"
    echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
    echo "  macOS: brew install imagemagick"
    echo ""
    echo "Alternative: Use an online SVG to PNG converter:"
    echo "  1. Upload semantest-icon.svg"
    echo "  2. Generate sizes: 16x16, 32x32, 48x48, 128x128"
    echo "  3. Save as icon16.png, icon32.png, icon48.png, icon128.png"
    exit 1
fi

# Generate each size
for size in 16 32 48 128; do
    echo "Creating icon${size}.png..."
    convert -background none -resize ${size}x${size} semantest-icon.svg icon${size}.png
done

echo "✅ Icons generated successfully!"
echo ""
echo "Generated files:"
ls -la icon*.png