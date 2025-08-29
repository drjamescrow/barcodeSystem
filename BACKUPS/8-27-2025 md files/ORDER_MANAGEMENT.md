# Order Management System

## Overview
Complete order management interface for Shopify store owners to view, filter, and manage all print-on-demand orders assigned to the Indie Uprising fulfillment service.

## Core Functionality
- **Order Display**: View all orders with comprehensive details
- **Filtering**: Filter orders by status (All/In production)
- **Search**: Real-time search across order ID, tracking number, and product title
- **Pagination**: Navigate through large order sets efficiently
- **Sorting**: Sort by date or order status (ascending/descending)
- **Total Calculation**: Real-time total cost calculation across filtered orders

## Key Features

### **Navigation & Access**
- **Entry Point**: Orders button prominently displayed above products table on Dashboard
- **Back Navigation**: Return to Dashboard from Orders page
- **Route**: `/orders` in the Shopify app navigation

### **Order Display & Information**
- **Indie Uprising ID**: Internal tracking identifier for each order
- **Order ID**: Shopify order identification number
- **Order Date**: Smart date formatting (relative for recent orders, absolute for older)
- **Order Status**: Color-coded badges (Pending, Processing, Completed, Fulfilled, Failed)
- **Transaction ID**: Clickable transaction references
- **Total Cost**: Individual order pricing display
- **Invoice**: Document access button (functionality pending)

### **Filtering & Search Capabilities**
```javascript
// Status Filters
- All: Show all orders regardless of status
- In production: Show orders currently being processed

// Search Functionality
- Order ID matching
- Tracking number search
- Product title search
- Real-time filtering with 500ms debounce
```

### **Pagination & Navigation**
- **Items per page**: 25 orders per page (configurable)
- **Navigation controls**: Previous/Next arrows with disabled states
- **Item counter**: "1-25 out of 778" display format
- **Page tracking**: Current page state management

## Technical Implementation

### **Frontend Architecture**
```javascript
// React Component Structure
Orders.jsx
├── State Management (useState hooks)
├── Data Fetching (useEffect, API calls)  
├── Event Handlers (search, filter, pagination)
├── UI Components (Shopify Polaris)
└── Data Formatting (dates, status badges)
```

### **Backend API Integration**
```javascript
// Endpoint: GET /api/admin/orders
// Authentication: Shop token required
// Query Parameters:
{
  page: 1,           // Current page number
  limit: 25,         // Items per page
  sort: 'date',      // Sort field (date/status)
  order: 'desc',     // Sort direction (asc/desc)
  status: '',        // Filter by status
  search: ''         // Search term
}
```

### **Database Integration**
```sql
-- Primary Tables Used
print_queue (pq)         -- Order tracking and status
├── order_id            -- Shopify order ID
├── status              -- Current fulfillment status  
├── tracking_number     -- Shipping tracking
├── created_at          -- Order timestamp
└── shop_domain         -- Store identification

client_products (cp)     -- Product information
├── title               -- Product name
├── price               -- Order total cost
└── shopify_product_id  -- Shopify product reference
```

### **Data Processing & Formatting**
```javascript
// Status Badge Mapping
const statusColors = {
  'pending': 'attention',     // Yellow
  'processing': 'info',       // Blue  
  'completed': 'success',     // Green
  'fulfilled': 'success',     // Green
  'failed': 'critical'        // Red
};

// Date Formatting Logic
- Recent orders: "Feb 2 at 09:04 pm"
- Older orders: "Dec 29, 2024"
- Smart relative display based on time difference
```

## API Endpoints

### **GET /api/admin/orders**
**Purpose**: Fetch paginated order data for authenticated shop
**Authentication**: Required (shop token)
**Response Format**:
```json
{
  "orders": [
    {
      "id": 123,
      "indieuprising_id": 123,
      "order_id": 2186,
      "order_date": "2024-02-02T21:04:00Z",
      "status": "fulfilled",
      "transaction_id": "TXN123",
      "total_cost": 13.66,
      "tracking_number": "1Z999AA1234567890"
    }
  ],
  "total": 778,
  "page": 1,
  "limit": 25,
  "totalPages": 32
}
```

## User Interface Components

### **Header Section**
- **Title**: "Orders" with back navigation to Dashboard
- **Actions**: Export order documents (dropdown) + Create Order button
- **Total Display**: Running total of filtered order costs

### **Filter Controls**
- **Tabs**: All/In production status filtering
- **Search Bar**: Real-time search with clear button and search icon
- **Pagination**: Arrow navigation with item count display
- **Sort Options**: Date/Status dropdown with direction handling

### **Data Table**
- **Responsive Design**: Adapts to different screen sizes
- **Column Headers**: Sortable where applicable
- **Row Actions**: Interactive elements (transaction links, invoice buttons)
- **Loading States**: Skeleton loading during data fetching
- **Empty States**: Proper messaging when no orders found

## Future Enhancements

### **Export Functionality**
- PDF generation for order documents
- CSV export for order data analysis
- Bulk export options for selected date ranges

### **Order Creation**
- Manual order creation interface
- Product selection and customization
- Customer information input
- Direct fulfillment service integration

### **Advanced Filtering**
- Date range selection
- Customer-based filtering  
- Product-specific order views
- Revenue and analytics integration

## Error Handling & Loading States

### **API Error Handling**
```javascript
// Network errors, authentication failures
// Graceful degradation with user-friendly messages
// Retry mechanisms for transient failures
```

### **Loading States**
- **Initial Load**: Full table skeleton loading
- **Search/Filter**: Partial loading indicators
- **Pagination**: Smooth transitions without full reload
- **Export Operations**: Progress indicators

## Files Involved
- `shopify-app/src/pages/Orders.jsx`: Main Orders component
- `shopify-app/src/pages/Dashboard.jsx`: Orders button integration
- `shopify-app/src/App.jsx`: Route configuration
- `backend/server.js` (lines 3218-3359): Orders API endpoint
- `database/schema.sql`: print_queue and client_products tables

This order management system provides comprehensive order tracking and management capabilities specifically designed for print-on-demand fulfillment through the Indie Uprising service integration.