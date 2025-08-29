# Database Schema

## Overview
PostgreSQL database schema for enterprise print-on-demand system with proper relationships, constraints, and indexing for optimal performance.

## Core Tables

### shops
```sql
CREATE TABLE shops (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    access_token TEXT,
    fulfillment_service_id VARCHAR(255),
    location_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### products
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

### product_variants
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

### print_areas
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

### product_images
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

### client_products
```sql
CREATE TABLE client_products (
    id SERIAL PRIMARY KEY,
    shop_id INTEGER REFERENCES shops(id),
    shopify_product_id VARCHAR(255),
    product_id INTEGER REFERENCES products(id),
    artwork_config JSONB,
    print_file_url TEXT,
    mockup_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### client_product_variants
```sql
CREATE TABLE client_product_variants (
    id SERIAL PRIMARY KEY,
    client_product_id INTEGER REFERENCES client_products(id) ON DELETE CASCADE,
    shopify_variant_id VARCHAR(255),
    size VARCHAR(50),
    color VARCHAR(100),
    sku VARCHAR(100),
    price DECIMAL(10,2),
    option1 VARCHAR(255),
    option2 VARCHAR(255),
    option3 VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### orders
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    shopify_order_id VARCHAR(255) UNIQUE NOT NULL,
    shop_id INTEGER REFERENCES shops(id),
    order_number VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending',
    merchant_request_notes TEXT,
    total_price DECIMAL(10,2),
    currency VARCHAR(10),
    customer_info JSONB,
    shipping_address JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### fulfillments
```sql
CREATE TABLE fulfillments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    shopify_fulfillment_id VARCHAR(255),
    shopify_fulfillment_order_id VARCHAR(255),
    status VARCHAR(50),
    tracking_number VARCHAR(255),
    tracking_company VARCHAR(100),
    tracking_urls TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### print_queue
```sql
CREATE TABLE print_queue (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id),
    line_item_id VARCHAR(255),
    client_product_id INTEGER REFERENCES client_products(id),
    variant_id VARCHAR(255),
    quantity INTEGER DEFAULT 1,
    status VARCHAR(50) DEFAULT 'pending',
    print_file_url TEXT,
    mockup_url TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### order_line_items
```sql
CREATE TABLE order_line_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    shopify_line_item_id VARCHAR(255),
    shopify_product_id VARCHAR(255),
    shopify_variant_id VARCHAR(255),
    title VARCHAR(255),
    variant_title VARCHAR(255),
    sku VARCHAR(100),
    quantity INTEGER,
    price DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

## Key Relationships
- **shops → client_products**: One shop has many products
- **products → product_variants**: One product has many variants
- **products → print_areas**: One product has many print areas  
- **products → product_images**: One product has many images
- **client_products → client_product_variants**: One product has many variants
- **orders → order_line_items**: One order has many line items
- **orders → fulfillments**: One order can have multiple fulfillments
- **orders → print_queue**: One order has many print queue items

## Indexes for Performance
```sql
-- Product lookups
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_print_areas_product_id ON print_areas(product_id);
CREATE INDEX idx_product_images_product_id ON product_images(product_id);

-- Order processing
CREATE INDEX idx_orders_shopify_id ON orders(shopify_order_id);
CREATE INDEX idx_orders_shop_id ON orders(shop_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_print_queue_order_id ON print_queue(order_id);
CREATE INDEX idx_print_queue_status ON print_queue(status);

-- Shopify lookups
CREATE INDEX idx_client_products_shopify_id ON client_products(shopify_product_id);
CREATE INDEX idx_client_product_variants_shopify_id ON client_product_variants(shopify_variant_id);

-- SKU searches
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
CREATE INDEX idx_client_product_variants_sku ON client_product_variants(sku);
```

## JSONB Data Structures

### artwork_config (client_products)
```json
{
  "canvas": {
    "version": "4.6.0",
    "objects": [...],
    "background": "transparent"
  },
  "printArea": "front_center",
  "dimensions": {
    "width": 500,
    "height": 500
  }
}
```

### customer_info (orders)
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "+1234567890"
}
```

### shipping_address (orders)
```json
{
  "name": "John Doe",
  "address1": "123 Main St",
  "address2": "Apt 4B",
  "city": "New York",
  "province": "NY",
  "country": "US",
  "zip": "10001"
}
```

## Constraints & Validation
- **Foreign Keys**: Enforce referential integrity
- **UNIQUE**: Prevent duplicates (shopify_order_id, sku)
- **NOT NULL**: Required fields (titles, prices)
- **CASCADE DELETE**: Clean up related records
- **CHECK**: Validate prices > 0, quantities >= 0

## Database Configuration
- **Hosting**: PostgreSQL on Render
- **Connection**: SSL required in production
- **Pooling**: PgBouncer for connection management
- **Backups**: Daily automated backups
- **Version**: PostgreSQL 14+