# Print Area Management System

## Overview
System for defining customizable print areas on products, including positioning, sizing, and design constraints for the canvas editor integration.

## Core Functionality
- Create, edit, delete print areas on products
- Define print area dimensions and positioning
- Set design constraints and limitations
- Integration with Fabric.js canvas system

## Key Features
- **Area Definition**: Precise positioning and sizing controls
- **Design Constraints**: Maximum dimensions and file requirements
- **Visual Preview**: Canvas integration for area visualization
- **Multiple Areas**: Support for front/back/sleeve print locations

## Files Involved
- `backend/server.js` (lines 385-463): Print area API endpoints
- `admin-panel/src/components/AdminInterface.jsx`: Print area management UI
- `shopify-app/src/components/FabricDecorator.jsx`: Canvas integration
- `database/schema.sql`: Print areas table definition

## Database Schema
```sql
CREATE TABLE print_areas (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    x_position INTEGER NOT NULL,
    y_position INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    max_width INTEGER,
    max_height INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);
```

## API Endpoints
```
POST /api/admin/products/:productId/print-areas - Create print area
PUT /api/admin/print-areas/:id - Update print area
DELETE /api/admin/print-areas/:id - Delete print area (staged)
```

## Print Area Properties
- **Name**: Descriptive label (e.g., "Front Center", "Back Full")
- **Position**: X/Y coordinates on product canvas
- **Dimensions**: Width/height of printable area
- **Constraints**: Maximum design dimensions
- **Type**: Area classification for design rules

## Canvas Integration
- **Fabric.js**: Canvas library for design editing
- **Positioning**: Precise pixel-level area definition
- **Constraints**: Automatic design scaling and validation
- **Preview**: Real-time design positioning feedback

## Validation Rules
- **Name**: Required, 3-100 characters
- **Position**: Non-negative integers
- **Dimensions**: > 0, reasonable maximums
- **Constraints**: Optional, must be <= area dimensions

## State Management
- **Staged Operations**: Areas marked for deletion until save
- **Real-time Preview**: Immediate canvas updates
- **Relationship Management**: Cascade with product deletion
- **Edit Mode**: In-place editing with gear icon access

## Design Workflow
1. **Area Creation**: Admin defines printable regions
2. **Canvas Setup**: Areas loaded into Fabric.js editor
3. **Design Constraints**: Automatic validation and scaling
4. **Print Generation**: Area data used for final artwork positioning