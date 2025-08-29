# Order Processing & Fulfillment System

## Overview
Complete order and fulfillment management system for print-on-demand orders. Handles the entire workflow from Shopify order receipt through production, fulfillment, and tracking updates.

## Core Functionality
- **Webhook Processing**: Order and fulfillment webhook handling
- **Print Queue Management**: Centralized queue for production tracking
- **Fulfillment Management**: GraphQL-based fulfillment creation and updates
- **Merchant Notes**: Request notes from merchants for special instructions
- **Status Tracking**: Real-time order and fulfillment status management
- **Exception Handling**: Comprehensive error recovery and re-request flow

## Order Workflow States
1. **Pending**: Order received, awaiting fulfillment request
2. **Requested**: Fulfillment requested, awaiting acceptance
3. **In Production**: Order accepted and being processed
4. **Shipped**: Fulfillment created with tracking
5. **Delivered**: Order successfully delivered
6. **Cancelled**: Order or fulfillment cancelled
7. **Failed**: Processing error requiring attention

## Key Features

### Order Management
- **Order List**: Paginated view with search and filters
- **Order Details**: Complete order information with line items
- **Merchant Notes**: Display and management of request notes
- **Status Updates**: Manual and automatic status changes
- **Print File Access**: Direct links to production files

### Fulfillment Processing
- **GraphQL Integration**: Using FulfillmentCreateV2 mutation
- **Request Management**: Accept/reject fulfillment requests
- **Tracking Updates**: Automatic tracking synchronization
- **Re-request Handling**: Automatic retry after cancellation
- **Webhook Processing**: Real-time fulfillment updates

### Admin Interface
- **Order Queue**: Production queue management
- **Fulfillment Actions**: Accept, reject, create fulfillments
- **Status Tracking**: Visual status indicators
- **Batch Operations**: Bulk processing capabilities
- **Exception Management**: Error handling and recovery

## Technical Architecture

### Database Schema
```sql
-- Orders table with merchant notes
orders (
  id SERIAL PRIMARY KEY,
  shopify_order_id VARCHAR(255) UNIQUE,
  shop_id INTEGER REFERENCES shops(id),
  order_number VARCHAR(50),
  status VARCHAR(50),
  merchant_request_notes TEXT,  -- Stores merchant instructions
  total_price DECIMAL(10,2),
  currency VARCHAR(10),
  customer_info JSONB,
  shipping_address JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Fulfillment tracking
fulfillments (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  shopify_fulfillment_id VARCHAR(255),
  shopify_fulfillment_order_id VARCHAR(255),
  status VARCHAR(50),
  tracking_number VARCHAR(255),
  tracking_company VARCHAR(100),
  tracking_urls TEXT[],
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)

-- Print queue for production
print_queue (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id),
  line_item_id VARCHAR(255),
  status VARCHAR(50),
  print_file_url TEXT,
  mockup_url TEXT,
  quantity INTEGER,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### API Endpoints

#### Order Management
- `GET /api/admin/orders` - List all orders with filters
- `GET /api/admin/orders/:id` - Get order details
- `PUT /api/admin/orders/:id/status` - Update order status
- `POST /api/admin/orders/:id/notes` - Update merchant notes

#### Fulfillment Operations
- `POST /api/admin/fulfillments/accept` - Accept fulfillment request
- `POST /api/admin/fulfillments/reject` - Reject fulfillment request
- `POST /api/admin/fulfillments/create` - Create fulfillment with tracking
- `POST /api/admin/fulfillments/request` - Request fulfillment (GraphQL)

#### Webhook Handlers
- `POST /api/webhooks/orders/create` - Process new orders
- `POST /api/webhooks/fulfillments/create` - Process fulfillment updates
- `POST /api/webhooks/orders/updated` - Handle order updates

### GraphQL Operations

```graphql
# Accept fulfillment request
mutation fulfillmentOrderAcceptFulfillmentRequest {
  fulfillmentOrderAcceptFulfillmentRequest(
    id: "gid://shopify/FulfillmentOrder/..."
    message: "Accepted for processing"
  ) {
    fulfillmentOrder { id status }
  }
}

# Create fulfillment
mutation fulfillmentCreateV2 {
  fulfillmentCreateV2(fulfillment: {
    lineItemsByFulfillmentOrder: [{
      fulfillmentOrderId: "..."
      fulfillmentOrderLineItems: [...]
    }]
    trackingInfo: {
      company: "Carrier Name"
      number: "TRACKING123"
      url: "https://tracking.url"
    }
  }) {
    fulfillment { id status }
  }
}
```

## Webhook Processing Flow

1. **Order Creation**: 
   - Receives order via webhook
   - Creates database records
   - Waits for fulfillment request

2. **Fulfillment Request**:
   - Receives fulfillment order
   - Displays in admin panel
   - Shows merchant notes if present

3. **Fulfillment Processing**:
   - Admin accepts/rejects request
   - Creates fulfillment with tracking
   - Updates order status

4. **Status Updates**:
   - Webhook receives updates
   - Syncs database status
   - Updates UI in real-time

## Error Handling

### Common Issues
- **Missing Merchant Notes**: Shows migration guide in UI
- **Failed Fulfillments**: Automatic re-request capability
- **Webhook Failures**: Retry mechanism with exponential backoff
- **GraphQL Errors**: Detailed error logging and recovery

### Recovery Mechanisms
- **Re-request Flow**: After rejection/cancellation
- **Manual Override**: Admin can force status changes
- **Webhook Replay**: Re-process failed webhooks
- **Data Validation**: Prevents corrupt data entry

## Files Involved
- `backend/server.js` - API endpoints and webhook handlers
- `admin-panel/src/pages/OrderManagement.jsx` - Main order interface
- `admin-panel/src/components/OrderDetails.jsx` - Order detail view
- `admin-panel/src/components/OrderList.jsx` - Order listing component
- `database/schema.sql` - Database structure

## Recent Updates
- **Merchant Notes**: Full support for request notes from merchants
- **GraphQL Migration**: Complete migration from REST to GraphQL
- **Fulfillment Flow**: Proper accept/reject/create workflow
- **Error Recovery**: Robust handling of edge cases
- **UI Improvements**: Better status visualization and notes display