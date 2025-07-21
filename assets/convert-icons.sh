#!/bin/bash

# Semantest Extension Icon Conversion Script
# Converts SVG icons to PNG format for Chrome extension

echo "🎨 Converting Semantest extension icons..."

# Check if ImageMagick is installed
if ! command -v convert &> /dev/null; then
    echo "❌ ImageMagick not found. Please install ImageMagick:"
    echo "   macOS: brew install imagemagick"
    echo "   Ubuntu: sudo apt install imagemagick"
    echo "   Windows: Download from https://imagemagick.org/"
    exit 1
fi

# Create output directory if it doesn't exist
mkdir -p png-exports

# Convert 16x16 icon
echo "Converting 16x16 icon..."
convert -background transparent icon-16.svg -resize 16x16 png-exports/icon16.png
convert -background transparent icon-16.svg -resize 32x32 png-exports/icon16@2x.png

# Convert 48x48 icon  
echo "Converting 48x48 icon..."
convert -background transparent icon-48.svg -resize 48x48 png-exports/icon48.png
convert -background transparent icon-48.svg -resize 96x96 png-exports/icon48@2x.png

# Convert 128x128 icon
echo "Converting 128x128 icon..."
convert -background transparent icon-128.svg -resize 128x128 png-exports/icon128.png
convert -background transparent icon-128.svg -resize 256x256 png-exports/icon128@2x.png

# Create 32x32 icon for compatibility
echo "Creating 32x32 icon..."
convert -background transparent icon-48.svg -resize 32x32 png-exports/icon32.png
convert -background transparent icon-48.svg -resize 64x64 png-exports/icon32@2x.png

# Copy to extension directory (update paths as needed)
echo "Copying icons to extension directory..."
cp png-exports/icon16.png ../icon16.png
cp png-exports/icon32.png ../icon32.png  
cp png-exports/icon48.png ../icon48.png
cp png-exports/icon128.png ../icon128.png

echo "✅ Icon conversion complete!"
echo "📁 PNG files generated:"
echo "   - icon16.png (16x16)"
echo "   - icon32.png (32x32)" 
echo "   - icon48.png (48x48)"
echo "   - icon128.png (128x128)"
echo "   - Retina versions (@2x) in png-exports/"

# Verify file sizes
echo "📊 File sizes:"
ls -lh png-exports/*.png

echo ""
echo "🔧 Next steps:"
echo "1. Update manifest.json to reference PNG files"
echo "2. Test icons in Chrome extension"
echo "3. Verify appearance at all sizes"