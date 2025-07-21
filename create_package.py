#!/usr/bin/env python3

import zipfile
import os
import json
import sys
from pathlib import Path

def create_extension_package():
    """Create a Chrome Web Store ready ZIP package"""
    
    print("🚀 Creating ChatGPT Extension package...")
    
    # Get the build directory
    build_dir = Path(__file__).parent / "build"
    if not build_dir.exists():
        print("❌ Build directory not found!")
        return False
    
    # Read version from manifest
    manifest_path = build_dir / "manifest.json"
    if not manifest_path.exists():
        print("❌ manifest.json not found in build directory!")
        return False
    
    try:
        with open(manifest_path, 'r') as f:
            manifest = json.load(f)
        version = manifest.get('version', '1.0.0')
        extension_name = manifest.get('name', 'ChatGPT Extension')
        print(f"📦 Building {extension_name} v{version}")
    except Exception as e:
        print(f"❌ Error reading manifest: {e}")
        return False
    
    # Create package name
    package_name = f"chatgpt-extension-v{version}.zip"
    package_path = Path(__file__).parent / package_name
    
    # Remove existing package
    if package_path.exists():
        package_path.unlink()
        print(f"🧹 Removed existing {package_name}")
    
    # Only include essential files
    essential_files = {
        'manifest.json',
        'chatgpt-controller.js', 
        'service-worker.js',
        'popup.html'
    }
    
    def is_essential(file_path):
        """Check if file is essential for extension"""
        filename = Path(file_path).name
        return filename in essential_files or 'assets/' in str(file_path)
    
    def should_exclude(file_path):
        """Check if file should be excluded"""
        path_str = str(file_path).lower()
        for pattern in exclude_patterns:
            if pattern in path_str:
                return True
        return False
    
    # Create ZIP package
    try:
        with zipfile.ZipFile(package_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            file_count = 0
            
            # Walk through build directory
            for root, dirs, files in os.walk(build_dir):
                for file in files:
                    file_path = Path(root) / file
                    
                    # Calculate relative path from build directory
                    rel_path = file_path.relative_to(build_dir)
                    
                    # Only include essential files
                    if not is_essential(file_path):
                        print(f"  ❌ Excluded: {rel_path}")
                        continue
                    
                    print(f"  📄 Found: {rel_path}")
                    
                    # Add to ZIP
                    zipf.write(file_path, rel_path)
                    file_count += 1
                    print(f"  ✅ Added: {rel_path}")
            
            print(f"📦 Added {file_count} files to package")
    
    except Exception as e:
        print(f"❌ Error creating ZIP package: {e}")
        return False
    
    # Verify package
    if package_path.exists():
        size_mb = package_path.stat().st_size / (1024 * 1024)
        print(f"✅ Package created: {package_name}")
        print(f"📏 Size: {size_mb:.2f}MB")
        
        # Check Chrome Web Store size limit (100MB)
        if size_mb > 100:
            print("⚠️  WARNING: Package exceeds Chrome Web Store 100MB limit!")
            return False
        else:
            print("✅ Package size is within Chrome Web Store limits")
        
        # List package contents
        print("\n📋 Package contents:")
        try:
            with zipfile.ZipFile(package_path, 'r') as zipf:
                files = zipf.namelist()
                for file in sorted(files[:20]):  # Show first 20 files
                    print(f"  📄 {file}")
                if len(files) > 20:
                    print(f"  ... and {len(files) - 20} more files")
        except Exception as e:
            print(f"❌ Error listing package contents: {e}")
        
        print(f"\n🎉 Extension package ready!")
        print(f"📦 Package: {package_name}")
        print(f"🏪 Ready for Chrome Web Store submission")
        print(f"\n📋 Next steps:")
        print(f"  1. Test the extension by loading the build/ folder in Chrome")
        print(f"  2. Submit {package_name} to Chrome Web Store")
        
        return True
    else:
        print("❌ Package creation failed!")
        return False

if __name__ == "__main__":
    success = create_extension_package()
    sys.exit(0 if success else 1)