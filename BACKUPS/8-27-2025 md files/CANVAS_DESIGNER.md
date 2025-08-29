# Canvas Designer System

## Overview
Advanced Fabric.js-based design editor enabling customers to create custom designs on product templates with real-time preview, text editing, and image manipulation.

## Core Functionality
- Interactive canvas editor with drag-and-drop design tools
- Text editing with font, size, and color customization
- Image upload and manipulation (resize, rotate, position)
- Real-time design preview on product mockups
- Export to print-ready formats

## Key Features
- **Fabric.js Integration**: Professional canvas editing library
- **Multi-layer Design**: Layered design elements with Z-index control
- **Text Tools**: Typography controls with Google Fonts integration
- **Image Tools**: Upload, resize, crop, and position images
- **Design Constraints**: Automatic validation within print areas
- **Live Preview**: Real-time mockup generation

## Files Involved
- `shopify-app/src/components/FabricDecorator.jsx`: Primary canvas component
- `shopify-app/src/pages/Designer.jsx`: Designer page wrapper
- `backend/server.js`: Design data API endpoints (authenticated)
- `shopify-app/src/services/api.js`: API service integration

## Canvas Architecture
```javascript
// Fabric.js canvas initialization
const canvas = new fabric.Canvas('design-canvas', {
  width: printArea.width,
  height: printArea.height,
  backgroundColor: 'transparent'
});
```

## Design Tools
- **Selection Tool**: Select and manipulate objects
- **Text Tool**: Add and edit text with formatting
- **Image Tool**: Upload and position images
- **Shape Tools**: Basic geometric shapes
- **Color Picker**: RGB/HSL color selection
- **Layer Management**: Bring to front/send to back

## Text Features
- **Font Selection**: Google Fonts integration
- **Typography**: Size, weight, style, alignment
- **Color Control**: Text color and stroke options
- **Effects**: Shadow, outline, gradient effects
- **Formatting**: Bold, italic, underline support

## Image Features
- **Upload Support**: JPG, PNG, SVG file types
- **Transformation**: Scale, rotate, skew, flip
- **Cropping**: Manual and aspect ratio cropping
- **Filters**: Brightness, contrast, saturation
- **Opacity**: Transparency controls

## Design Constraints
- **Print Area Bounds**: Designs confined to defined print areas
- **Resolution Limits**: Minimum DPI requirements for print quality
- **File Size**: Maximum design complexity limits
- **Color Space**: CMYK color validation for printing

## Data Format
```javascript
// Canvas JSON export format
{
  version: "4.6.0",
  objects: [
    {
      type: "text",
      text: "Custom Text",
      left: 100,
      top: 50,
      fontSize: 24,
      fill: "#000000"
    }
  ],
  background: "transparent"
}
```

## Export Pipeline
1. **Canvas Serialization**: Fabric.js JSON export
2. **Image Generation**: Canvas to high-resolution PNG/PDF
3. **Print File Creation**: CMYK conversion for production
4. **Mockup Generation**: Product visualization with accurate positioning

## Coordinate Systems
- **User Canvas**: 500x500 design canvas for user interaction
- **Admin Canvas**: 400x500 design canvas for admin interface
- **Garment Coordinates**: Variable dimensions based on product images
- **Position Conversion**: Automatic scaling between coordinate systems

## Performance Optimization
- **Object Pooling**: Reuse canvas objects for efficiency
- **Event Throttling**: Limit high-frequency events
- **Lazy Loading**: Load design elements on demand
- **Memory Management**: Dispose unused canvas resources

## Mobile Responsiveness
- **Touch Support**: Touch gesture handling
- **Responsive Layout**: Canvas scaling for mobile screens
- **Simplified Tools**: Mobile-optimized tool palette
- **Performance**: Reduced complexity for mobile devices