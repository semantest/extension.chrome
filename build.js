#!/usr/bin/env node

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 Starting Chrome Extension build...');

const buildDir = path.join(__dirname, 'build');
const srcDir = path.join(__dirname, 'src');
const assetsDir = path.join(__dirname, 'assets');

async function build() {
  try {
    // Clean build directory
    console.log('🧹 Cleaning build directory...');
    await fs.remove(buildDir);
    await fs.ensureDir(buildDir);

    // Run TypeScript compilation
    console.log('📦 Compiling TypeScript...');
    try {
      execSync('npx tsc', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      console.error('❌ TypeScript compilation failed:', error.message);
      process.exit(1);
    }

    // Copy manifest with corrected paths
    console.log('📋 Copying manifest...');
    const manifestBuild = path.join(__dirname, 'manifest-build.json');
    if (await fs.pathExists(manifestBuild)) {
      await fs.copy(manifestBuild, path.join(buildDir, 'manifest.json'));
    } else {
      // Fallback to original manifest (may need path fixes)
      await fs.copy(path.join(__dirname, 'manifest.json'), path.join(buildDir, 'manifest.json'));
      console.log('⚠️  Using original manifest - paths may need adjustment');
    }

    // Copy HTML files
    console.log('📄 Copying HTML files...');
    const htmlFiles = await fs.readdir(srcDir);
    for (const file of htmlFiles) {
      if (file.endsWith('.html')) {
        await fs.copy(path.join(srcDir, file), path.join(buildDir, file));
        console.log(`  ✅ Copied ${file}`);
      }
    }

    // Copy assets
    console.log('🎨 Copying assets...');
    if (await fs.pathExists(assetsDir)) {
      await fs.copy(assetsDir, path.join(buildDir, 'assets'));
      console.log('  ✅ Assets copied');
    } else {
      console.log('  ⚠️  Assets directory not found');
    }

    // Verify critical files
    console.log('🔍 Verifying build output...');
    const manifest = path.join(buildDir, 'manifest.json');
    if (await fs.pathExists(manifest)) {
      const manifestContent = await fs.readJson(manifest);
      console.log(`  ✅ Manifest: ${manifestContent.name} v${manifestContent.version}`);
      
      // Check for required files mentioned in manifest
      const requiredFiles = [
        manifestContent.background?.service_worker,
        manifestContent.action?.default_popup,
        ...(manifestContent.content_scripts?.[0]?.js || [])
      ].filter(Boolean);

      for (const file of requiredFiles) {
        const filePath = path.join(buildDir, file);
        if (await fs.pathExists(filePath)) {
          console.log(`  ✅ Found: ${file}`);
        } else {
          console.log(`  ❌ Missing: ${file}`);
        }
      }
    } else {
      console.error('❌ manifest.json not found in build output');
      process.exit(1);
    }

    // Create ZIP package
    console.log('📦 Creating ZIP package...');
    const packageName = `semantest-extension-v${JSON.parse(await fs.readFile(manifest)).version}.zip`;
    
    try {
      // Use built-in zip or system zip
      execSync(`cd ${buildDir} && zip -r ../${packageName} . -x "*.map" "*.ts"`, { stdio: 'inherit' });
      console.log(`  ✅ Package created: ${packageName}`);
    } catch (error) {
      console.log('  ⚠️  System zip not available, creating directory listing instead');
      const files = await getAllFiles(buildDir);
      console.log('  📁 Build contents:', files.map(f => f.replace(buildDir + '/', '')));
    }

    // Final summary
    console.log('\n🎉 Build completed successfully!');
    console.log(`📂 Build directory: ${buildDir}`);
    console.log(`📦 Package: ${packageName}`);
    console.log('\n📋 Next steps:');
    console.log('1. Test extension: Load unpacked in Chrome from build/ directory');
    console.log('2. Submit to Chrome Web Store: Upload the ZIP file');

  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

async function getAllFiles(dir) {
  const files = [];
  const items = await fs.readdir(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = await fs.stat(fullPath);
    
    if (stat.isDirectory()) {
      const subFiles = await getAllFiles(fullPath);
      files.push(...subFiles);
    } else {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Run build if called directly
if (require.main === module) {
  build().catch(console.error);
}

module.exports = { build };