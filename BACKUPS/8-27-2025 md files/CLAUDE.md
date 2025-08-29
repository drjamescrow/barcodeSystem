# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a **Print on Demand System** for Shopify with three main components:

1. **Backend** (`backend/`) - Node.js/Express API with PostgreSQL database
2. **Shopify App** (`shopify-app/`) - React frontend with Fabric.js canvas design tools
3. **Admin Panel** (`admin-panel/`) - React admin interface for product and order management

### Key Technologies
- Backend: Node.js, Express, PostgreSQL, Cloudinary (image storage)
- Frontend: React, Fabric.js (canvas manipulation), Shopify Polaris
- Build Tools: Vite, Tailwind CSS
- Testing: Jest (backend), Vitest (frontend)

## Development Workflow

### Important Development Guidelines
- **Task Completion**: After completing each task on a to-do list, run syntax error checks (linting, type checking) before moving to the next task
- **Testing Strategy**: NO local testing - all testing is done live on Render after pushing to GitHub
- **UI Testing**: Use Playwright with admin dashboard credentials from environment variables:
  - Credentials are stored in Render environment variables
  - Access via: `process.env.TEST_ADMIN_USERNAME` and `process.env.TEST_ADMIN_PASSWORD`
  - This allows direct interaction with the live UI for testing and verification

## Common Development Commands

### Installation & Setup
```bash
# Install all dependencies
npm run install:all

# Install specific components
npm run install:backend
npm run install:frontend
```

### Development Servers (for local development only, not testing)
```bash
# Start backend API server
npm run dev:backend

# Start Shopify app frontend
npm run dev:shopify

# Start admin panel
npm run dev:admin
```

### Syntax Checking & Testing Workflow
```bash
# 1. Check syntax after each task (before committing)
cd backend && node -c server.js

# 2. After pushing to GitHub, ALWAYS:
#    - Wait 2 minutes for Render deployment to complete
#    - Verify deployment status before testing

# Check deployment status via Render MCP
mcp__render__list_deploys --serviceId=srv-d23deo2dbo4c73846dig --limit=1

# Look for:
# - "status": "live" (deployment complete)
# - "finishedAt": timestamp (recently completed)

# 3. Only then proceed with testing
# Testing is done live on Render - no local testing
```

### Building
```bash
# Build all components
npm run build:all

# Build specific components
npm run build:backend
npm run build:frontend
```

### Database Operations
```bash
# Run database migrations
cd backend && npm run migrate

# Seed database with test data
cd backend && npm run seed
```

## Project Structure

- **Database schema**: `database/schema.sql`
- **API routes**: Defined in `backend/server.js`
- **Canvas designer**: `shopify-app/src/components/FabricDecorator.jsx` (primary design interface)
- **Admin interface**: `admin-panel/src/components/AdminInterface.jsx`
- **Order management**: `admin-panel/src/pages/OrderManagement.jsx`
- **Deployment config**: `deployment/docker-compose.yml`, `render.yaml`

## Key Workflows

### Image Processing Pipeline
1. Client uploads artwork via `/api/upload-artwork` (authenticated)
2. Canvas design data processed with Fabric.js
3. Generate mockups via `/api/generate-mockup` (authenticated)
4. Create print-ready files with accurate positioning

### Product Creation Flow
1. Admin creates base product via admin panel
2. Add variants and print areas through interface
3. Deploy to Shopify store via GraphQL API (2025-07 version)
4. Update existing products via GraphQL mutations
5. Handle orders through webhook `/api/webhooks/orders/create`
6. Process fulfillments via `/api/webhooks/fulfillments/create`

## Environment Requirements
- Node.js 18+
- PostgreSQL 12+
- Cloudinary account for image storage
- Shopify Partner account for app development

## System Features

This system includes 15 major features, each documented in detail:

### Core Features
1. **[Admin Authentication](ADMIN_AUTHENTICATION.md)** - Secure cookie-based authentication with JWT tokens
2. **[Product Management](PRODUCT_MANAGEMENT.md)** - Complete CRUD system for base product templates
3. **[Variant Management](VARIANT_MANAGEMENT.md)** - SKU tracking, pricing, and inventory management
4. **[Print Area Management](PRINT_AREA_MANAGEMENT.md)** - Customizable print regions for design placement
5. **[Image Management](IMAGE_MANAGEMENT.md)** - Cloudinary integration for image storage and optimization

### Design & Integration Features
6. **[Canvas Designer](CANVAS_DESIGNER.md)** - Fabric.js-based design editor using FabricDecorator.jsx
7. **[Shopify Integration](SHOPIFY_INTEGRATION.md)** - GraphQL API (2025-07) integration with webhooks
8. **[Order Processing](ORDER_PROCESSING.md)** - Complete order and fulfillment management system

### Infrastructure Features  
9. **[Database Schema](DATABASE_SCHEMA.md)** - PostgreSQL schema with proper relationships and constraints
10. **[API Endpoints](API_ENDPOINTS.md)** - RESTful API architecture with authentication and validation
11. **[Cloudinary Integration](CLOUDINARY_INTEGRATION.md)** - Cloud image management with CDN delivery

### User Experience Features
12. **[Error Handling](ERROR_HANDLING.md)** - Comprehensive error boundaries and user-friendly messages
13. **[Pagination & Search](PAGINATION_SEARCH.md)** - Efficient navigation and real-time search capabilities
14. **[Form Validation](FORM_VALIDATION.md)** - Real-time validation with accessibility features

### Development Features
15. **[Cloud Architecture](admin-dashboard-todo.md)** - Cloud-based multi-tenant architecture with PostgreSQL

### Production Readiness & TODO Lists
16. **[Production Readiness](PRODUCTION_READINESS.md)** - 🔴 **CRITICAL: Security issues and technical debt that MUST be fixed before production deployment**
17. **[Order Processing TODO](order_processing_todo.md)** - ⛔ **NOT PRODUCTION READY** - Critical security vulnerabilities in order system, webhook handling, and fulfillment processing
18. **[Shopify App TODO](shopify-app-to-do-list.md)** - ⛔ **NOT PRODUCTION READY** - 317 console.logs, zero tests, multiple security issues in frontend app
19. **[Admin Dashboard TODO](admin-dashboard-todo.md)** - Comprehensive list of features and improvements needed for admin panel
20. **[Payment & Billing TODO](payment-billing-todo.md)** - 🔴 **NOT STARTED** - Complete payment system implementation required for Shopify Billing API and Stripe integration for order fulfillment charges

Each feature is fully documented with implementation details, code examples, and integration points. Refer to the individual feature files for comprehensive technical documentation.

## ⚠️ CRITICAL PRODUCTION BLOCKERS

**DO NOT DEPLOY TO PRODUCTION** until these critical issues are resolved:
- **Security**: Multiple critical vulnerabilities across all components
- **Console Logs**: 460+ debug statements exposing sensitive data
- **No Testing**: 0% test coverage across entire system
- **Webhook Security**: Can be bypassed, allowing fake orders
- **Authentication**: Missing or insecure across components
- **Error Recovery**: No retry mechanisms, orders will be lost
- **Performance**: Will crash under load, no optimization
- **No Payment System**: Cannot charge merchants or process payments
- **No Billing Integration**: Will fail Shopify app review without proper billing

See the TODO files above for detailed remediation plans.

## Render Platform Integration

Claude Code now has direct access to Render MCP server, enabling direct management of Render services for this project:

### Available Render Operations
- **Service Management**: List, create, and update web services and static sites
- **Database Operations**: Manage PostgreSQL instances and run queries directly
- **Monitoring**: Access logs, metrics (CPU, memory, HTTP requests), and deployment status
- **Environment Variables**: Update service environment variables without manual dashboard access
- **Deployments**: Track deploy status and trigger new deployments

### Common Render Commands via Claude Code
```bash
# View all services
mcp__render__list_services

# Get service logs
mcp__render__list_logs --resource <service-id>

# View service metrics
mcp__render__get_metrics --resourceId <service-id> --metricTypes cpu_usage memory_usage

# Update environment variables
mcp__render__update_environment_variables --serviceId <service-id> --envVars <vars>

# Query PostgreSQL database
mcp__render__query_render_postgres --postgresId <postgres-id> --sql <query>
```

This integration allows for seamless monitoring, debugging, and management of the production infrastructure directly through Claude Code without needing to access the Render dashboard.

## Recent Updates
- **GraphQL Migration**: Complete migration to Shopify GraphQL API 2025-07, REST API deprecated
- **FabricDecorator**: Replaced ProductDecorator.jsx with FabricDecorator.jsx as primary design interface
- **Order Management**: Full order and fulfillment management system with merchant request notes
- **Render MCP Integration**: Direct access to Render services for monitoring and management
- **Cloud Architecture**: All data stored in PostgreSQL cloud database, no localStorage fallback
- **Webhook Processing**: Complete order and fulfillment webhook handling with proper error recovery