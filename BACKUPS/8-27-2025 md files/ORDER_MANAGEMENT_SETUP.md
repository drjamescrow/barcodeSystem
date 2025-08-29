# Order Management System Setup Guide

## Overview
The order management system has been successfully implemented with comprehensive features for processing print-on-demand orders.

## Setup Instructions

### 1. Install Dependencies

```bash
# Admin Panel - Install new dependencies for ZIP and file downloads
cd admin-panel
npm install

# Backend - No new dependencies needed
cd ../backend
```

### 2. Database Setup

Run the updated schema to add new order management tables and fields:

```bash
# Connect to your PostgreSQL database and run:
psql -U your_username -d your_database -f database/schema.sql
```

Or if using the setup script:
```bash
./setup-database.bat
```

### 3. Environment Configuration

Ensure your `.env` files are configured properly:

**Backend `.env`:**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/database
JWT_SECRET=your-jwt-secret
SHOPIFY_API_KEY=your-shopify-api-key
SHOPIFY_API_SECRET=your-shopify-api-secret
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
CLOUDINARY_CLOUD_NAME=your-cloudinary-name
CLOUDINARY_API_KEY=your-cloudinary-key
CLOUDINARY_API_SECRET=your-cloudinary-secret
```

**Admin Panel `.env`:**
```env
VITE_API_URL=http://localhost:3000
```

### 4. Testing the System

#### Start the Services:
```bash
# Terminal 1 - Backend
cd backend
npm run dev

# Terminal 2 - Admin Panel
cd admin-panel
npm run dev
```

#### Access the System:
1. Open Admin Panel: http://localhost:5173
2. Login with admin credentials
3. Navigate to "Orders" tab

## Features Implemented

### Order Queue
- ✅ Comprehensive order listing with filters
- ✅ Status tabs (All, Pending, In Production, Shipped, Exception)
- ✅ Search functionality
- ✅ Sortable columns
- ✅ Pagination
- ✅ Multi-select for batch operations

### Order Details
- ✅ Complete order information display
- ✅ Customer and shipping details
- ✅ Product mockup preview
- ✅ Inline status editing
- ✅ Exception reporting and resolution
- ✅ Activity log tracking
- ✅ Print file download with dynamic naming

### Batch Operations
- ✅ Bulk status updates
- ✅ Bulk print file downloads (ZIP)
- ✅ CSV export
- ✅ Packing slip preparation (template ready)

### ShipStation Integration (Demo Mode)
- ✅ Package configuration interface
- ✅ Weight auto-calculation based on product type
- ✅ Shipping rate comparison (simulated)
- ✅ Label purchase workflow (demo)
- ✅ Tracking information display

### Dynamic Print File Naming
- ✅ Template system: `{order_id}_{product_type}_{size}_{color}_{print_area}_{date}.png`
- ✅ Applied during download (original files preserved)
- ✅ Ready for automation integration

## Order Workflow

1. **Order Receipt**: Webhook captures Shopify orders automatically
2. **Queue Entry**: Orders appear in admin panel with status "Pending"
3. **Production**: Admin marks orders as "In Production"
4. **Print Files**: Download individually or bulk with dynamic naming
5. **Shipping**: Configure package and purchase label via ShipStation
6. **Tracking**: Automatic status update to "Shipped" with tracking info
7. **Completion**: Mark as "Delivered" when confirmed

## API Endpoints

### Order Management
- `GET /api/admin/orders` - List all orders with filters
- `GET /api/admin/orders/:id` - Get order details
- `PUT /api/admin/orders/:id/status` - Update order status
- `POST /api/admin/orders/:id/exception` - Report exception
- `PUT /api/admin/orders/:id/exception/resolve` - Resolve exception
- `PUT /api/admin/orders/:id/shipping` - Update shipping info
- `DELETE /api/admin/orders/:id` - Cancel order

### Batch Operations
- `POST /api/admin/orders/batch/status` - Bulk status update
- `POST /api/admin/orders/bulk-download` - Bulk print file download
- `GET /api/admin/orders/:id/print-file` - Get print file with dynamic name

## Testing Workflow

### Create Test Order
1. Create a product in the Shopify app decorator
2. Place a test order in Shopify
3. Order will appear in admin panel queue

### Process Test Order
1. Select order in queue
2. Click eye icon to view details
3. Update status to "In Production"
4. Download print file (note dynamic naming)
5. Go to Shipping tab
6. Configure package and get rates
7. Purchase label (demo mode)
8. Order automatically marked as "Shipped"

### Batch Operations Test
1. Select multiple orders with checkboxes
2. Use batch operations toolbar
3. Test bulk status update
4. Test bulk download (creates ZIP file)
5. Test CSV export

## ShipStation Production Setup (Future)

To enable real ShipStation integration:

1. **Get ShipStation API Keys**:
   - Login to ShipStation account
   - Go to Settings → API Settings
   - Generate API Key and Secret

2. **Add to Backend .env**:
   ```env
   SHIPSTATION_API_KEY=your-api-key
   SHIPSTATION_API_SECRET=your-api-secret
   ```

3. **Implement ShipStation API Endpoints**:
   - Replace demo rates with real API calls
   - Implement actual label purchase
   - Set up webhook for tracking updates

## Troubleshooting

### Orders Not Appearing
- Check webhook configuration in Shopify
- Verify shop is active in database
- Check webhook logs in backend

### Print Files Not Downloading
- Verify Cloudinary URLs are accessible
- Check browser console for CORS issues
- Ensure files were created during product design

### Database Errors
- Run migration scripts to update schema
- Check PostgreSQL connection
- Verify all new columns exist

### Authentication Issues
- Clear browser localStorage
- Re-login to admin panel
- Check JWT token expiration

## Future Enhancements

1. **Real ShipStation Integration**
2. **Automated Print Queue Processing**
3. **Email Notifications**
4. **Advanced Analytics Dashboard**
5. **Multi-Location Support**
6. **Custom Packing Slip Templates**
7. **Barcode Scanning Integration**
8. **Quality Control Workflow**

## Support

For issues or questions:
- Check backend logs: `backend/logs/`
- Review browser console for frontend errors
- Verify all services are running
- Ensure database migrations completed