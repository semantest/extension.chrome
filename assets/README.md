# Semantest Extension Assets

## 🎨 Icon Assets

This directory contains all visual assets for the Semantest Chrome extension.

### Icon Files

#### SVG Source Files (Scalable)
- **`icon-16.svg`** - 16x16px toolbar icon
- **`icon-48.svg`** - 48x48px medium size icon  
- **`icon-128.svg`** - 128x128px store listing icon

#### PNG Exports (Required by Chrome)
- **`icon16.png`** - 16x16px (existing)
- **`icon32.png`** - 32x32px (existing)
- **`icon48.png`** - 48x48px (existing)
- **`icon128.png`** - 128x128px (existing)

### Design System

The Semantest icon features:
- **Hexagonal container** representing connectivity and structure
- **S letterform** for the Semantest brand
- **Green gradient** (#10a37f to #0d8f6f) matching ChatGPT's color palette
- **Layered design** with shadows and highlights for depth

### Color Palette

```css
/* Primary Brand Colors */
#10a37f - Semantest Green (Primary)
#0d8f6f - Semantest Dark Green
#0fa57a - Semantest Light Green

/* Supporting Colors */
#ffffff - White (Logo container)
#000000 - Black (Shadows at 20% opacity)
```

### Usage in Extension

The manifest.json references these icons:
```json
{
  "icons": {
    "16": "assets/icon16.png",
    "32": "assets/icon32.png", 
    "48": "assets/icon48.png",
    "128": "assets/icon128.png"
  }
}
```

### Converting SVG to PNG

To generate PNG files from the SVG sources:

```bash
# Using ImageMagick
convert -background transparent icon-16.svg -resize 16x16 icon16.png
convert -background transparent icon-48.svg -resize 48x48 icon48.png
convert -background transparent icon-128.svg -resize 128x128 icon128.png

# For retina displays (optional)
convert -background transparent icon-16.svg -resize 32x32 icon16@2x.png
convert -background transparent icon-48.svg -resize 96x96 icon48@2x.png
```

### Icon Guidelines

See [`icon-design-guidelines.md`](./icon-design-guidelines.md) for:
- Detailed design specifications
- Size-specific optimizations
- Brand usage guidelines
- Accessibility considerations
- Technical implementation notes

### Future Assets

Planned additions:
- Dark mode icon variants
- Loading/animation sprites
- Promotional banners (440x280, 920x680)
- Screenshot templates
- Social media assets

---

Last Updated: January 2025