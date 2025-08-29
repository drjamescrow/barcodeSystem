# Shopify Integration System

## Overview
Complete Shopify app integration using GraphQL API (2025-07) with product synchronization, order processing, and webhook handling for seamless print-on-demand fulfillment.

## Core Functionality
- Shopify App authentication and installation
- Product catalog synchronization via GraphQL API
- Order and fulfillment webhook processing
- Customer design data management
- Print file generation for order fulfillment

## Key Features
- **App Installation**: OAuth-based Shopify app setup
- **GraphQL Integration**: Using Shopify GraphQL API 2025-07
- **Product Sync**: Automatic product creation with variants via GraphQL
- **Order Processing**: Webhook-driven order and fulfillment management
- **Design Storage**: Customer design persistence in PostgreSQL

## Files Involved
- `shopify-app/src/App.jsx`: Main Shopify app component
- `shopify-app/src/pages/Dashboard.jsx`: Store dashboard interface  
- `shopify-app/src/pages/Designer.jsx`: Canvas design interface
- `shopify-app/src/components/FabricDecorator.jsx`: Primary design component
- `shopify-app/src/services/productCreationService.js`: GraphQL product sync
- `backend/server.js`: Shopify GraphQL API integration

## GraphQL API Configuration
```javascript
// GraphQL endpoint and version
{
  "api_version": "2025-07",
  "endpoint": "https://{shop}.myshopify.com/admin/api/2025-07/graphql.json",
  "scopes": "read_products,write_products,read_orders,write_orders,write_fulfillments"
}
```

## API Endpoints
```
# Product Management (GraphQL)
POST /api/create-shopify-product - Create product via GraphQL
PUT /api/update-shopify-product/:id - Update product via GraphQL
GET /api/admin/shopify-product/:id/pricing - Get product pricing

# Order & Fulfillment Processing
POST /api/webhooks/orders/create - Process new orders
POST /api/webhooks/fulfillments/create - Process fulfillment updates
POST /api/fulfillment/callback - Handle fulfillment callbacks

# Status Management
POST /api/admin/sync-product-status - Sync product status with Shopify
```

## Product Synchronization (GraphQL)
- **GraphQL Mutations**: ProductCreate, ProductUpdate, ProductVariantsBulkCreate
- **Variant Management**: Color-first ordering with GraphQL bulk operations
- **Image Assignment**: Media operations via GraphQL
- **Metadata**: Metafields for custom design data
- **Fulfillment Service**: Assignment via GraphQL mutations
- **Inventory Management**: Disabled tracking (print-on-demand)

## Order Processing Workflow
1. **Webhook Receipt**: Order and fulfillment webhooks received
2. **Order Verification**: Validate shop and custom products
3. **Print Queue**: Add items to print_queue table
4. **Design Retrieval**: Load artwork from PostgreSQL
5. **Print File Generation**: Create 300 DPI production files
6. **Fulfillment Creation**: Create fulfillments via GraphQL
7. **Status Tracking**: Update order status in database

## Webhook Configuration
```javascript
// Registered webhooks
{
  "webhooks": [
    {
      "topic": "orders/create",
      "address": "https://pod-backend-yjyb.onrender.com/api/webhooks/orders/create"
    },
    {
      "topic": "fulfillments/create",
      "address": "https://pod-backend-yjyb.onrender.com/api/webhooks/fulfillments/create"
    }
  ]
}
```

## Authentication Flow
1. **App Installation**: OAuth flow with scopes
2. **Access Token**: Stored in PostgreSQL shops table
3. **Webhook Registration**: Automatic setup during OAuth
4. **Fulfillment Service**: Created via GraphQL

## Design Data Management
- **PostgreSQL Storage**: Artwork in client_products table
- **Canvas Data**: Fabric.js JSON with positioning
- **Order Association**: Linked via print_queue table
- **Cloudinary**: Image and print file storage
- **Version Control**: Tracked with timestamps

## Fulfillment Integration
- **GraphQL Fulfillments**: FulfillmentCreateV2 mutation
- **Order Routing**: Via fulfillment service assignment
- **Print Queue**: Managed in admin panel
- **Tracking Updates**: Via fulfillment webhooks
- **Merchant Notes**: Stored in orders table

## GraphQL Queries & Mutations
```graphql
# Product creation
mutation productCreate($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product { id title }
    userErrors { field message }
  }
}

# Fulfillment creation
mutation fulfillmentCreateV2($fulfillment: FulfillmentInput!) {
  fulfillmentCreateV2(fulfillment: $fulfillment) {
    fulfillment { id status }
    userErrors { field message }
  }
}
```

## Database Schema
```sql
-- Key tables for Shopify integration
shops (id, domain, access_token, fulfillment_service_id)
orders (id, shopify_order_id, status, merchant_request_notes)
print_queue (id, order_id, status, print_file_url)
client_products (id, shopify_product_id, artwork_config)
```