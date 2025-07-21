# Icon Conversion Guide for Chrome Web Store

## Required PNG Icons from SVGs

### Extension Icons (Required)
Convert these SVG files to PNG:
- `/extension.chrome/assets/icon-16.svg` → `icon16.png` (16x16)
- `/extension.chrome/assets/icon-48.svg` → `icon48.png` (48x48)
- `/extension.chrome/assets/icon-128.svg` → `icon128.png` (128x128)

### Store Listing Icons (Required)
Additional sizes needed for Chrome Web Store:
- `icon32.png` (32x32) - Scale from icon-48.svg
- `icon64.png` (64x64) - Scale from icon-128.svg
- `icon256.png` (256x256) - Scale from icon-128.svg
- `icon512.png` (512x512) - Scale from icon-128.svg

## Conversion Instructions

### Using Command Line (ImageMagick)
```bash
# Convert SVG to PNG with specific size
convert icon-16.svg -resize 16x16 icon16.png
convert icon-48.svg -resize 48x48 icon48.png
convert icon-128.svg -resize 128x128 icon128.png

# Create additional sizes
convert icon-48.svg -resize 32x32 icon32.png
convert icon-128.svg -resize 64x64 icon64.png
convert icon-128.svg -resize 256x256 icon256.png
convert icon-128.svg -resize 512x512 icon512.png
```

### Using Online Tools
1. **SVG to PNG Converter**: https://svgtopng.com/
2. **CloudConvert**: https://cloudconvert.com/svg-to-png
3. **Convertio**: https://convertio.co/svg-png/

### Quality Guidelines
- **Transparency**: Maintain transparent background
- **Anti-aliasing**: Enable for smooth edges
- **Color Profile**: sRGB for web compatibility
- **Optimization**: Use PNG optimization tools after conversion

## Verification Checklist
- [ ] All PNG files created in correct sizes
- [ ] Icons look crisp at each resolution
- [ ] Transparent backgrounds preserved
- [ ] File sizes optimized (use TinyPNG if needed)
- [ ] Icons match brand colors (#10a37f primary)

## Store Listing Requirements
- **Small Tile**: 440x280 PNG (we have promotional-tile-440x280.svg)
- **Large Tile**: 920x680 PNG (optional but recommended)
- **Marquee**: 1400x560 PNG (optional for featured apps)

## Notes
- Current PNG icons already exist at: `/extension.chrome/assets/icon*.png`
- Verify these match the SVG designs before upload
- Chrome Web Store prefers PNG format for all graphics