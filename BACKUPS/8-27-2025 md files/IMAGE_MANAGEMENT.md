# Image Management System

## Overview
Comprehensive image handling system with Cloudinary integration for product images, design assets, and print-ready file generation with automatic optimization.

## Core Functionality
- Upload and store product images via Cloudinary
- Image optimization and format conversion
- Staged image operations with rollback capability
- Integration with product catalog and design system

## Key Features
- **Cloud Storage**: Cloudinary CDN integration
- **Image Optimization**: Automatic compression and format selection
- **Staged Operations**: Images marked for deletion until save
- **Multiple Formats**: Support for JPG, PNG, SVG, PDF
- **Responsive Delivery**: Automatic sizing and optimization

## Files Involved
- `backend/server.js` (lines 482-520): Image upload API endpoints
- `admin-panel/src/components/AdminInterface.jsx`: Image upload UI
- `shopify-app/src/components/FabricDecorator.jsx`: Design asset integration
- `database/schema.sql`: Product images table definition

## Database Schema
```sql
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints
```
POST /api/upload-artwork - Upload design artwork files
POST /api/admin/products/:productId/images - Upload product images
DELETE /api/admin/images/:id - Delete image (staged)
```

## Cloudinary Configuration
```javascript
// Required environment variables
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

## Image Processing Pipeline
1. **Upload**: Client sends image to backend endpoint
2. **Cloudinary**: Image stored in cloud with optimization
3. **Database**: URL and metadata saved to product_images
4. **Delivery**: CDN serves optimized images globally

## Optimization Features
- **Auto Format**: WebP/AVIF for modern browsers, fallback to JPG/PNG
- **Quality**: Automatic quality adjustment (q_auto)
- **Compression**: Lossless and lossy compression options
- **Responsive**: Multiple sizes generated automatically
- **Lazy Loading**: Progressive image loading support

## File Upload Validation
- **Size Limits**: Maximum file size restrictions
- **Format Support**: JPG, PNG, SVG, PDF accepted
- **Resolution**: Minimum/maximum pixel dimensions
- **Compression**: Automatic optimization on upload

## State Management
- **Staged Deletions**: Images marked for removal until save
- **Upload Progress**: Real-time upload status feedback
- **Error Handling**: Comprehensive upload error management
- **Rollback**: Ability to cancel unsaved image changes

## Integration Points
- **Product Catalog**: Main product images for listings
- **Design System**: Artwork and design assets
- **Print Generation**: High-resolution files for printing
- **Shopify Sync**: Product images synchronized to store