# API Endpoints

## Overview
Comprehensive API for print-on-demand system with admin authentication, product management, order processing, and Shopify GraphQL integration.

## Authentication

### Admin Authentication
```
POST /api/admin/login - Admin login
POST /api/admin/logout - Admin logout
GET /api/admin/auth/check - Verify authentication status
```

**Login Example:**
```json
POST /api/admin/login
{
  "username": "admin_username",
  "password": "secure_password"
}

Response:
{
  "success": true,
  "message": "Login successful"
}
```

## Product Management

### Products
```
GET /api/admin/products - List all products with variants and print areas
POST /api/admin/products - Create new product
DELETE /api/admin/products/:id - Delete product (cascades)
```

### Product Variants
```
POST /api/admin/products/:productId/variants - Create variant
PUT /api/admin/variants/:id - Update variant
DELETE /api/admin/variants/:id - Delete variant
GET /api/admin/variants/check-sku/:sku - Check SKU uniqueness
```

### Print Areas
```
POST /api/admin/products/:productId/print-areas - Create print area
PUT /api/admin/print-areas/:id - Update print area
DELETE /api/admin/print-areas/:id - Delete print area
```

### Product Images
```
POST /api/admin/products/:productId/images - Upload product image
DELETE /api/admin/images/:id - Delete image
```

## Shopify Integration

### Product Creation (GraphQL)
```
POST /api/create-shopify-product - Create Shopify product via GraphQL
PUT /api/update-shopify-product/:id - Update existing product
GET /api/admin/shopify-product/:id/pricing - Get product pricing
POST /api/admin/sync-product-status - Sync product status
```

### Client Products
```
GET /api/admin/client-products - List all client products
DELETE /api/admin/client-products/:id - Delete client product
```

## Order Management

### Orders
```
GET /api/admin/orders - List all orders with filters
GET /api/admin/orders/:id - Get order details
PUT /api/admin/orders/:id/status - Update order status
POST /api/admin/orders/:id/notes - Update merchant notes
```

### Fulfillments
```
POST /api/admin/fulfillments/accept - Accept fulfillment request
POST /api/admin/fulfillments/reject - Reject fulfillment request  
POST /api/admin/fulfillments/create - Create fulfillment with tracking
POST /api/admin/fulfillments/request - Request fulfillment (GraphQL)
```

## Webhooks

### Shopify Webhooks
```
POST /api/webhooks/orders/create - Process new orders
POST /api/webhooks/fulfillments/create - Process fulfillment updates
POST /api/webhooks/orders/updated - Handle order updates
POST /api/webhooks/app/uninstalled - Handle app uninstall
```

**Webhook Security:**
- HMAC verification required
- Shop domain validation
- Idempotent processing

## File Management

### Artwork & Mockups
```
POST /api/upload-artwork - Upload design artwork (authenticated)
POST /api/generate-mockup - Generate product mockup (authenticated)
POST /api/generate-print-file - Create print-ready file (authenticated)
```

**Upload Example:**
```javascript
POST /api/upload-artwork
Authorization: Bearer <token>
Content-Type: multipart/form-data

FormData:
- file: [image file]
- designData: {canvas JSON}
- productId: 123
```

## Response Formats

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed"
}
```

### Error Response
```json
{
  "success": false,
  "error": "Error description",
  "code": "ERROR_CODE",
  "details": {...}
}
```

## HTTP Status Codes
- **200**: Success
- **201**: Resource created
- **400**: Bad request / Validation error
- **401**: Authentication required
- **403**: Forbidden / CORS rejection
- **404**: Resource not found
- **409**: Conflict (duplicate)
- **429**: Rate limited
- **500**: Server error

## Authentication Middleware
All `/api/admin/*` endpoints require JWT authentication via httpOnly cookies:
- 24-hour session expiry
- Brute force protection (10 attempts, 30-min lockout)
- Secure cookies in production

## Request Validation
- **JSON Schema**: Body validation
- **Type Checking**: Parameter validation
- **File Limits**: 10MB max upload size
- **Rate Limiting**: IP-based throttling

## CORS Configuration
```javascript
Production Origins:
- https://pod-admin.onrender.com
- https://pod-shopify.onrender.com

Development Origins:  
- http://localhost:3000
- http://localhost:5173
```

## Security Features
- **JWT Authentication**: Secure token-based auth
- **HTTP-Only Cookies**: XSS protection
- **HMAC Verification**: Webhook security
- **Input Sanitization**: SQL injection prevention
- **Environment Variables**: No hardcoded secrets

## GraphQL Operations

### Product Creation
```graphql
mutation productCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      title
      status
    }
    userErrors {
      field
      message
    }
  }
}
```

### Fulfillment Creation
```graphql
mutation fulfillmentCreateV2($fulfillment: FulfillmentInput!) {
  fulfillmentCreateV2(fulfillment: $fulfillment) {
    fulfillment {
      id
      status
      trackingInfo {
        number
        url
      }
    }
    userErrors {
      field
      message
    }
  }
}
```

## Rate Limits
- **Login**: 10 attempts per 30 minutes
- **API Calls**: 100 requests per minute
- **File Uploads**: 10 per minute
- **Webhook Processing**: No limit (verified via HMAC)