# Chrome Extension Build Script

## Quick Start

```bash
# Make script executable
chmod +x build.sh

# Build and package extension
./build.sh

# Clean build artifacts
./build.sh --clean
```

## What the Script Does

### 🔧 Build Process:
1. **Cleans** previous builds
2. **Compiles** TypeScript (if available)
3. **Copies** necessary files to build directory
4. **Creates** Chrome Web Store ready ZIP package

### 📦 File Handling:
- ✅ **Includes**: JavaScript, HTML, CSS, manifest.json, assets
- ❌ **Excludes**: Tests, docs, TypeScript source, config files

### 🚫 Excluded Files:
- `*.test.js`, `*.spec.js` - Test files
- `*.ts` - TypeScript source files
- `*.map` - Source maps
- `README*`, `*.md` - Documentation
- `node_modules/` - Dependencies
- `coverage/`, `docs/` - Development artifacts
- `.git*`, `.env*` - Version control and secrets
- `jest.config.*`, `tsconfig.*` - Config files

### 📏 Chrome Web Store Compliance:
- ✅ Size limit check (<100MB)
- ✅ Clean file structure
- ✅ Only production files included
- ✅ Proper manifest validation

## Output

Creates: `semantest-extension-v{VERSION}.zip`

The ZIP file is ready for immediate upload to Chrome Web Store!

## Usage Options

```bash
./build.sh           # Standard build
./build.sh --help    # Show help
./build.sh --clean   # Clean artifacts
./build.sh --verbose # Verbose output
```

## Integration with npm

Add to `package.json`:

```json
{
  "scripts": {
    "build": "./build.sh",
    "build:clean": "./build.sh --clean",
    "package": "./build.sh"
  }
}
```

Then use: `npm run build`