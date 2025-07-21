# Semantest Extension Icon Design Guidelines

## Overview
The Semantest extension icon represents our AI-powered web automation tool with a modern, professional design that aligns with ChatGPT's visual language while maintaining its own unique identity.

## Design Concept

### Core Elements
1. **Hexagonal Container**: Represents structure, connectivity, and technical precision
2. **S Letterform**: The Semantest brand initial, styled with flowing curves
3. **Green Color Palette**: Aligns with ChatGPT's accent color (#10a37f)
4. **Layered Design**: Creates depth and visual interest at all sizes

### Color Palette
```css
/* Primary Colors */
--semantest-primary: #10a37f;
--semantest-dark: #0d8f6f;
--semantest-light: #0fa57a;

/* Supporting Colors */
--white: #ffffff;
--black: #000000;

/* Opacity Values */
--shadow-opacity: 0.2;
--highlight-opacity: 0.15;
--glow-opacity: 0.3;
```

## Size-Specific Guidelines

### 16x16 Icon
- **Purpose**: Browser toolbar, tabs, small UI elements
- **Design**: Simplified single-color approach
- **Key Features**:
  - Bold outer circle with subtle stroke
  - Simplified hexagon shape
  - Clear S letterform with increased stroke width
  - High contrast for visibility

### 48x48 Icon
- **Purpose**: Extension management page, medium displays
- **Design**: Balanced detail with clarity
- **Key Features**:
  - Gradient background for depth
  - Subtle shadow effects
  - Decorative corner dots
  - Inner glow for dimension

### 128x128 Icon
- **Purpose**: Chrome Web Store, large displays, marketing
- **Design**: Full detail and visual effects
- **Key Features**:
  - Multi-layer gradient background
  - Complex shadow and lighting effects
  - Rounded hexagon corners
  - Shine overlay effect
  - Brand mark detail

## Technical Specifications

### SVG Structure
```xml
<svg width="[size]" height="[size]" viewBox="0 0 [size] [size]">
  <defs>
    <!-- Gradients, filters, and effects -->
  </defs>
  <!-- Background circle -->
  <!-- Logo container group -->
  <!-- S letterform -->
  <!-- Decorative elements -->
  <!-- Highlight effects -->
</svg>
```

### Export Requirements
1. **SVG Master Files**: Scalable source files
2. **PNG Exports**: For production use
   - 16x16 PNG (1x and 2x for retina)
   - 32x32 PNG (for some contexts)
   - 48x48 PNG (1x and 2x)
   - 128x128 PNG (for store listing)

### Optimization Guidelines
- Remove unnecessary SVG attributes
- Optimize paths and reduce points
- Use CSS classes for repeated styles
- Minimize file size while maintaining quality

## Usage Guidelines

### Do's
✅ Use on white or light backgrounds
✅ Maintain aspect ratio
✅ Use official color palette
✅ Include adequate padding
✅ Test at actual size

### Don'ts
❌ Alter colors without approval
❌ Add additional effects
❌ Rotate or skew the icon
❌ Use on busy backgrounds
❌ Remove core elements

## Accessibility Considerations

### Contrast Requirements
- Minimum contrast ratio of 3:1 against backgrounds
- Test with color blindness simulators
- Ensure visibility in both light and dark themes

### Alternative Formats
- Provide monochrome versions for high contrast mode
- Include descriptive alt text where applicable
- Test with screen readers

## Implementation Notes

### Chrome Extension Manifest
```json
{
  "icons": {
    "16": "assets/icon-16.png",
    "32": "assets/icon-32.png",
    "48": "assets/icon-48.png",
    "128": "assets/icon-128.png"
  }
}
```

### CSS Usage
```css
.semantest-icon {
  background-image: url('icon-48.png');
  background-size: contain;
  width: 48px;
  height: 48px;
}

/* Retina display support */
@media (-webkit-min-device-pixel-ratio: 2) {
  .semantest-icon {
    background-image: url('icon-48@2x.png');
  }
}
```

## Version History

### v2.0.0 (Current)
- Complete redesign with hexagonal motif
- Aligned with ChatGPT color palette
- Improved contrast and visibility
- Added layered effects for larger sizes

### Future Considerations
- Dark mode variant
- Animated version for loading states
- Holiday/special event variations
- Partner co-branding templates

## File Deliverables

### Source Files
- `icon-16.svg` - Toolbar size
- `icon-48.svg` - Medium size
- `icon-128.svg` - Store listing size
- `icon-source.sketch/fig` - Design source file

### Production Files
- PNG exports at 1x and 2x resolution
- ICO file for Windows compatibility
- ICNS file for macOS compatibility

## Brand Alignment

The Semantest icon maintains visual consistency with:
- ChatGPT's green accent color
- Modern, clean aesthetic
- Technical yet approachable design
- Clear, recognizable silhouette

---

Last Updated: January 2025
Design Version: 2.0.0
Designer: Semantest UX Team