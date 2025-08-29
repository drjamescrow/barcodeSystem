# Product Variant Management System

## Overview
Complete system for managing product variants with SKU tracking, pricing, and inventory management. Supports size/color combinations with conflict detection and bulk operations.

## Core Functionality
- Create, edit, delete product variants
- SKU conflict detection across all products
- Size and color attribute management
- Individual variant pricing and inventory
- Staged operations with save confirmation

## Key Features
- **Variant Creation**: Form-based variant creation with attribute selection
- **SKU Management**: Automatic and manual SKU generation with conflict warnings
- **Attribute System**: Predefined size/color options with extensibility
- **Bulk Operations**: Create multiple variants efficiently
- **Validation**: Real-time form validation and error feedback

## Files Involved
- `backend/server.js` (lines 306-384): API endpoints for variant CRUD
- `admin-panel/src/components/AdminInterface.jsx`: Frontend variant management
- `database/schema.sql`: Product variants table definition

## Database Schema
```sql
CREATE TABLE product_variants (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) UNIQUE NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    price DECIMAL(10,2) NOT NULL,
    inventory_quantity INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints
```
POST /api/admin/products/:productId/variants - Create variant
PUT /api/admin/variants/:id - Update variant
DELETE /api/admin/variants/:id - Delete variant (staged)
GET /api/admin/variants/check-sku/:sku - Check SKU availability
```

## SKU System
- **Auto-generation**: Based on product title + attributes
- **Manual Override**: Custom SKU input with validation
- **Conflict Detection**: Real-time checking across all products
- **Format**: Standardized naming convention

## Validation Rules
- **SKU**: Required, unique across system, 3-100 characters
- **Size**: Optional, predefined options (XS, S, M, L, XL, XXL)
- **Color**: Optional, predefined options (Black, White, Red, Blue, etc.)
- **Price**: Required, > $0, < $10,000
- **Inventory**: Optional, >= 0

## State Management
- **Staged Changes**: Variants marked for deletion until save
- **Optimistic Updates**: Immediate UI feedback
- **Bulk Operations**: Efficient creation of multiple variants
- **Rollback**: Ability to cancel unsaved changes

## UI Features
- **Attribute Dropdowns**: Size and color selection
- **SKU Preview**: Real-time SKU generation display
- **Conflict Warnings**: Visual indicators for SKU conflicts
- **Batch Creation**: Quick variant generation tools
- **Inline Editing**: Direct editing in variant list