# Product Management System

## Overview
Complete CRUD system for managing base product templates with title, description, pricing, and associated media. Cloud-based PostgreSQL storage with no localStorage fallback.

## Core Functionality
- Create, read, update, delete base products
- Product templates with variants and print areas
- Pagination and search across product catalog
- Real-time form validation with error feedback
- Cloud-based PostgreSQL data persistence

## Key Features
- **Product Creation**: Form-based product setup with validation
- **Product Listing**: Paginated list with search and filtering
- **Product Editing**: In-place editing with staged changes
- **Product Deletion**: Immediate deletion with confirmation dialogs
- **Bulk Operations**: Select multiple items for batch actions
- **Search & Filter**: Real-time search across all product fields

## Files Involved
- `backend/server.js` (lines 240-305, 464-481): API endpoints
- `admin-panel/src/components/AdminInterface.jsx`: Complete frontend interface
- `database/schema.sql`: Products table definition

## Database Schema
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints
```
POST /api/admin/products - Create new product
GET /api/admin/products - List all products with relationships
DELETE /api/admin/products/:id - Delete product (cascades to variants/areas)
```

## Form Validation Rules
- **Title**: Required, 3-255 characters
- **Base Price**: Required, > $0, < $10,000
- **Description**: Optional, < 1000 characters

## State Management
- **Cloud Storage**: All data stored in PostgreSQL database
- **Real-time Sync**: Direct database operations with immediate updates
- **Staged Changes**: Unsaved changes tracking with warnings
- **Optimistic Updates**: Immediate UI updates with rollback capability

## UI Features
- **Pagination**: 10 items per page with smart navigation
- **Search**: Real-time filtering by title, description, variants
- **Empty States**: Helpful messages for no products/search results
- **Loading States**: Progress indicators during operations
- **Error Handling**: User-friendly error messages with retry options

## Relationships
- **One-to-Many**: Products → Product Variants
- **One-to-Many**: Products → Print Areas  
- **One-to-Many**: Products → Product Images
- **Cascade Delete**: Removing product deletes all associated data