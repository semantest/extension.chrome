# Chrome Web Store Asset Production Instructions

## Required Assets for Store Submission

### 1. Screenshots (1280x800 PNG) - 5 Required

**Files Needed**:
- screenshot1.png - Main interface with folders
- screenshot2.png - Template library in action
- screenshot3.png - Quick actions and automation  
- screenshot4.png - Export dialog with options
- screenshot5.png - Search functionality with results

**Source**: Use detailed specifications in:
- `screenshot1-specification.md`
- `screenshot2-specification.md`
- `screenshot3-specification.md`
- `screenshot4-specification.md` 
- `screenshot5-specification.md`

**Production Steps**:
1. Open design tool (Figma/Sketch/Adobe XD)
2. Create 1280x800 canvas at 144 DPI
3. Follow exact specifications from .md files
4. Export as PNG, high quality
5. Verify file size under 5MB each

### 2. Small Promotional Tile (440x280 PNG)

**File Needed**: `small-promo-tile.png`

**Source**: Convert existing `promotional-tile-440x280.svg`

**Conversion Instructions**:
```bash
# Using Inkscape
inkscape promotional-tile-440x280.svg -o small-promo-tile.png -w 440 -h 280 -d 150

# Using ImageMagick  
convert -density 150 promotional-tile-440x280.svg -resize 440x280 small-promo-tile.png

# Online converter
Upload SVG to cloudconvert.com or convertio.co
```

### 3. Large Promotional Tile (920x680 PNG) - NEW DESIGN

**File Needed**: `large-promo-tile.png`

**Design Specifications**:
- **Dimensions**: 920x680 pixels
- **Theme**: Expand current promotional tile design
- **Content**: Feature showcase with more detail
- **Style**: Professional, consistent with brand

**Recommended Layout**:
- Top section: Logo and main tagline (larger)
- Middle section: 4 key features with icons and descriptions
- Bottom section: Strong call-to-action
- Background: Enhanced gradient with more visual elements

## Asset Quality Requirements

### Technical Specifications
- **Format**: PNG (required)
- **Quality**: High resolution, crisp text
- **File Size**: Under 5MB each
- **Color Mode**: RGB
- **Transparency**: Use where appropriate

### Content Guidelines  
- Show actual extension functionality
- Use realistic professional examples
- Maintain consistent branding
- Clear, readable text at all sizes
- Professional presentation

### Chrome Web Store Compliance
- No misleading claims
- Accurate feature representation
- Professional quality
- Consistent with extension description

## Production Timeline

**Priority Order**:
1. **Screenshots 1-5** (required for store approval)
2. **Small promo tile** (convert from existing SVG)  
3. **Large promo tile** (new design creation)

**Estimated Time**:
- Screenshots: 4-6 hours (skilled designer)
- Small tile: 30 minutes (conversion)
- Large tile: 2-3 hours (new design)

## File Delivery

**Naming Convention**:
```
screenshot1.png
screenshot2.png  
screenshot3.png
screenshot4.png
screenshot5.png
small-promo-tile.png
large-promo-tile.png
```

**Location**: Save to `/extension.chrome/store-listing/assets/`

## Quality Checklist

### Before Delivery
- [ ] All files exactly correct dimensions
- [ ] PNG format with appropriate compression
- [ ] Text clearly readable at actual size
- [ ] Consistent color scheme (#1E40AF blue)
- [ ] Professional presentation
- [ ] File sizes under limits
- [ ] Filenames match exactly

### Chrome Store Ready
- [ ] Screenshots show real functionality
- [ ] Promotional tiles are compelling
- [ ] All assets load correctly
- [ ] Mobile preview looks good
- [ ] Desktop preview looks professional

---

**Status**: Instructions ready for design team to produce final PNG assets for Chrome Web Store submission! 🚀

**Note**: These instructions provide everything needed to create the required PNG files from existing specifications and designs.