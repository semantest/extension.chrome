#!/bin/bash

# Chrome Extension Build & Package Script
# Creates a clean ZIP file ready for Chrome Web Store submission

set -e  # Exit on any error

# Configuration
EXTENSION_NAME="chatgpt-extension"
BUILD_DIR="build"
TEMP_DIR="temp_package"
SRC_DIR="src"
ASSETS_DIR="assets"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Get version from manifest or package.json
get_version() {
    if [ -f "manifest.json" ]; then
        VERSION=$(cat manifest.json | grep '"version"' | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    elif [ -f "package.json" ]; then
        VERSION=$(cat package.json | grep '"version"' | sed 's/.*"version": *"\([^"]*\)".*/\1/')
    else
        VERSION="1.0.0"
        print_warning "No version found, using default: $VERSION"
    fi
    echo $VERSION
}

# Main build function
main() {
    print_status "🚀 Starting Chrome Extension build process..."
    
    # Get version
    VERSION=$(get_version)
    PACKAGE_NAME="${EXTENSION_NAME}-v${VERSION}.zip"
    
    print_status "📦 Building ${EXTENSION_NAME} v${VERSION}"
    
    # Clean previous builds
    print_status "🧹 Cleaning previous builds..."
    rm -rf "$BUILD_DIR" "$TEMP_DIR" *.zip
    
    # Create build directory
    mkdir -p "$BUILD_DIR"
    
    # Run TypeScript compilation if available
    if [ -f "tsconfig.json" ] && command_exists tsc; then
        print_status "📝 Compiling TypeScript..."
        npx tsc || {
            print_error "TypeScript compilation failed"
            exit 1
        }
        print_success "TypeScript compilation completed"
    elif [ -f "tsconfig.json" ]; then
        print_warning "TypeScript config found but tsc not available"
    fi
    
    # Copy manifest.json (prefer build version if available)
    print_status "📋 Copying manifest..."
    if [ -f "manifest-build.json" ]; then
        cp "manifest-build.json" "$BUILD_DIR/manifest.json"
        print_success "Using optimized manifest-build.json"
    elif [ -f "manifest.json" ]; then
        cp "manifest.json" "$BUILD_DIR/"
        print_success "Using manifest.json"
    else
        print_error "No manifest.json found!"
        exit 1
    fi
    
    # Copy HTML files from src
    if [ -d "$SRC_DIR" ]; then
        print_status "📄 Copying HTML files..."
        find "$SRC_DIR" -name "*.html" -exec cp {} "$BUILD_DIR/" \;
        HTML_COUNT=$(find "$SRC_DIR" -name "*.html" | wc -l)
        print_success "Copied $HTML_COUNT HTML files"
    fi
    
    # Copy CSS files
    print_status "🎨 Copying CSS files..."
    if [ -d "$SRC_DIR" ]; then
        find "$SRC_DIR" -name "*.css" -exec cp {} "$BUILD_DIR/" \;
    fi
    find . -maxdepth 1 -name "*.css" -exec cp {} "$BUILD_DIR/" \;
    CSS_COUNT=$(find "$BUILD_DIR" -name "*.css" 2>/dev/null | wc -l)
    print_success "Copied $CSS_COUNT CSS files"
    
    # Copy compiled JavaScript files
    print_status "📜 Copying JavaScript files..."
    if [ -d "$BUILD_DIR" ]; then
        # JS files should already be in build dir from tsc
        JS_COUNT=$(find "$BUILD_DIR" -name "*.js" 2>/dev/null | wc -l)
        print_success "Found $JS_COUNT JavaScript files"
    fi
    
    # Copy assets/icons
    if [ -d "$ASSETS_DIR" ]; then
        print_status "🖼️  Copying assets..."
        cp -r "$ASSETS_DIR" "$BUILD_DIR/"
        ASSET_COUNT=$(find "$BUILD_DIR/$ASSETS_DIR" -type f 2>/dev/null | wc -l)
        print_success "Copied $ASSET_COUNT asset files"
    else
        print_warning "No assets directory found"
    fi
    
    # Verify required files exist
    print_status "🔍 Verifying build output..."
    
    if [ ! -f "$BUILD_DIR/manifest.json" ]; then
        print_error "manifest.json missing from build output"
        exit 1
    fi
    
    # Check manifest requirements
    MANIFEST_VERSION=$(cat "$BUILD_DIR/manifest.json" | grep '"manifest_version"' | sed 's/.*"manifest_version": *\([0-9]*\).*/\1/')
    if [ "$MANIFEST_VERSION" != "3" ] && [ "$MANIFEST_VERSION" != "2" ]; then
        print_warning "Manifest version $MANIFEST_VERSION may not be supported"
    fi
    
    # List critical files
    echo ""
    print_status "📁 Build contents:"
    ls -la "$BUILD_DIR/"
    echo ""
    
    # Create temporary package directory with exclusions
    print_status "📦 Creating clean package..."
    mkdir -p "$TEMP_DIR"
    
    # Copy build files excluding unwanted items
    rsync -av "$BUILD_DIR/" "$TEMP_DIR/" \
        --exclude="*.map" \
        --exclude="*.ts" \
        --exclude="*.test.js" \
        --exclude="*.spec.js" \
        --exclude="test/" \
        --exclude="tests/" \
        --exclude="spec/" \
        --exclude="*.md" \
        --exclude="README*" \
        --exclude="LICENSE*" \
        --exclude="*.log" \
        --exclude=".git*" \
        --exclude="node_modules/" \
        --exclude=".env*" \
        --exclude="*.config.js" \
        --exclude="jest.config.*" \
        --exclude="tsconfig.*" \
        --exclude=".eslint*" \
        --exclude=".prettier*" \
        --exclude="coverage/" \
        --exclude="docs/" \
        --exclude="documentation/"
    
    # Create ZIP package
    print_status "🗜️  Creating ZIP package..."
    
    if command_exists zip; then
        cd "$TEMP_DIR"
        zip -r "../$PACKAGE_NAME" . \
            -x "*.DS_Store" \
            -x "Thumbs.db" \
            -x "*.tmp" \
            -x "*.temp"
        cd ..
        print_success "ZIP package created using system zip"
    else
        print_warning "System zip command not available, creating tar.gz instead"
        tar -czf "${EXTENSION_NAME}-v${VERSION}.tar.gz" -C "$TEMP_DIR" .
        PACKAGE_NAME="${EXTENSION_NAME}-v${VERSION}.tar.gz"
    fi
    
    # Clean up temporary directory
    rm -rf "$TEMP_DIR"
    
    # Verify package
    if [ -f "$PACKAGE_NAME" ]; then
        PACKAGE_SIZE=$(du -h "$PACKAGE_NAME" | cut -f1)
        print_success "Package created: $PACKAGE_NAME ($PACKAGE_SIZE)"
        
        # Check size limit (Chrome Web Store limit is 100MB)
        PACKAGE_SIZE_BYTES=$(stat -f%z "$PACKAGE_NAME" 2>/dev/null || stat -c%s "$PACKAGE_NAME" 2>/dev/null || echo "0")
        MAX_SIZE=$((100 * 1024 * 1024))  # 100MB in bytes
        
        if [ "$PACKAGE_SIZE_BYTES" -gt "$MAX_SIZE" ]; then
            print_error "Package size ($PACKAGE_SIZE) exceeds Chrome Web Store limit (100MB)"
            exit 1
        else
            print_success "Package size is within Chrome Web Store limits"
        fi
        
        # Show package contents
        echo ""
        print_status "📋 Package contents:"
        if command_exists unzip; then
            unzip -l "$PACKAGE_NAME" | head -20
        elif command_exists zipinfo; then
            zipinfo -1 "$PACKAGE_NAME" | head -20
        else
            print_status "ZIP contents listing not available"
        fi
        
    else
        print_error "Failed to create package"
        exit 1
    fi
    
    # Final summary
    echo ""
    print_success "🎉 Build completed successfully!"
    echo ""
    echo "📦 Package: $PACKAGE_NAME"
    echo "📏 Size: $PACKAGE_SIZE"
    echo "🏪 Ready for Chrome Web Store submission"
    echo ""
    echo "📋 Next steps:"
    echo "  1. Test the extension:"
    echo "     - Open chrome://extensions/"
    echo "     - Enable Developer mode"
    echo "     - Click 'Load unpacked' and select the build/ directory"
    echo ""
    echo "  2. Submit to Chrome Web Store:"
    echo "     - Go to Chrome Web Store Developer Dashboard"
    echo "     - Upload $PACKAGE_NAME"
    echo ""
}

# Help function
show_help() {
    echo "Chrome Extension Build Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -v, --verbose  Verbose output"
    echo "  -c, --clean    Clean build artifacts and exit"
    echo ""
    echo "This script will:"
    echo "  1. Compile TypeScript (if available)"
    echo "  2. Copy necessary files to build directory"
    echo "  3. Create a clean ZIP package for Chrome Web Store"
    echo "  4. Exclude test files, docs, and development artifacts"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -c|--clean)
            print_status "🧹 Cleaning build artifacts..."
            rm -rf "$BUILD_DIR" "$TEMP_DIR" *.zip *.tar.gz
            print_success "Clean completed"
            exit 0
            ;;
        -v|--verbose)
            set -x  # Enable verbose mode
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Run main function
main