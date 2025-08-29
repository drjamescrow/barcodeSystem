# Cloudinary Integration

## Overview
Cloud-based image management using Cloudinary for storing, optimizing, and delivering all product images, design assets, and print files with global CDN distribution.

## Core Functionality
- Cloud storage for all images and print files
- Automatic optimization and format conversion
- Global CDN for fast delivery
- Upload handling with progress tracking
- Print file generation and storage

## Configuration
```bash
# Required environment variables
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key  
CLOUDINARY_API_SECRET=your_api_secret
```

## Implementation
```javascript
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});
```

## Upload Endpoints

### Artwork Upload
```javascript
POST /api/upload-artwork
- Accepts design files
- Stores in 'pod-designs' folder
- Returns secure URL
- Used for customer designs
```

### Product Image Upload
```javascript
POST /api/admin/products/:productId/images
- Product catalog images
- Multiple images per product
- Display order management
```

### Print File Generation
```javascript
POST /api/generate-print-file
- Creates high-res print files
- Stores in 'print-files' folder
- 300 DPI resolution
- CMYK color space ready
```

## Folder Structure
```
cloudinary/
├── products/          # Product catalog images
├── designs/           # Customer artwork
├── mockups/           # Generated mockups
├── print-files/       # Production files
└── variants/          # Variant-specific images
```

## Image Optimization

### Automatic Transformations
```javascript
// Original upload
https://res.cloudinary.com/[cloud]/image/upload/v1/products/tshirt.jpg

// Auto-optimized delivery
https://res.cloudinary.com/[cloud]/image/upload/q_auto,f_auto/v1/products/tshirt.jpg

// Responsive sizing
https://res.cloudinary.com/[cloud]/image/upload/w_auto,c_scale/v1/products/tshirt.jpg
```

### Quality Settings
- `q_auto` - Automatic quality optimization
- `f_auto` - Best format for browser (WebP/AVIF)
- `fl_progressive` - Progressive loading
- `w_auto` - Responsive width

## File Type Support
- **Images**: JPG, PNG, GIF, WebP, SVG
- **Documents**: PDF (for print files)
- **Max Size**: 10MB per upload
- **Formats**: Auto-conversion to optimal format

## Upload Implementation
```javascript
// Product image upload
const uploadProductImage = async (file, productId) => {
  const result = await cloudinary.uploader.upload(file.path, {
    folder: `products/${productId}`,
    resource_type: 'auto',
    quality: 'auto',
    fetch_format: 'auto'
  });
  
  return {
    url: result.secure_url,
    publicId: result.public_id
  };
};

// Print file generation
const generatePrintFile = async (canvasData, orderId) => {
  const result = await cloudinary.uploader.upload(dataUri, {
    folder: 'print-files',
    public_id: `order_${orderId}_print`,
    resource_type: 'image',
    quality: 100 // Max quality for print
  });
  
  return result.secure_url;
};
```

## Error Handling
```javascript
try {
  const result = await cloudinary.uploader.upload(file);
} catch (error) {
  if (error.http_code === 400) {
    // Invalid file format
  } else if (error.http_code === 413) {
    // File too large
  } else {
    // General upload error
  }
}
```

## Performance Features
- **Global CDN**: 60+ edge locations
- **Caching**: Automatic edge caching
- **Compression**: Lossless/lossy optimization
- **Lazy Loading**: Progressive image loading
- **Format Selection**: WebP/AVIF for modern browsers

## Security
- **Signed URLs**: Optional secure delivery
- **API Authentication**: Key/secret validation
- **Upload Validation**: File type and size limits
- **HTTPS Only**: Secure transmission

## Database Integration
```sql
-- Product images table stores Cloudinary URLs
product_images (
  image_url TEXT NOT NULL  -- Cloudinary secure_url
)

-- Client products store print files
client_products (
  print_file_url TEXT,     -- Cloudinary print file
  mockup_url TEXT          -- Cloudinary mockup
)
```

## Usage in Components

### Admin Panel
- Direct upload interface
- Drag-and-drop support
- Progress indicators
- Image preview

### Shopify App  
- FabricDecorator.jsx uses Cloudinary images
- Dynamic mockup generation
- Real-time preview

### Order Processing
- Print file retrieval
- Mockup display in order details
- Batch download support

## Best Practices
1. Always use secure URLs (https)
2. Implement upload progress indicators
3. Validate file types before upload
4. Use folders for organization
5. Apply auto-optimization transformations
6. Handle upload errors gracefully
7. Clean up temporary files

## Cost Optimization
- Use `q_auto` for automatic quality
- Enable `f_auto` for format optimization  
- Implement caching strategies
- Monitor bandwidth usage
- Clean up unused assets