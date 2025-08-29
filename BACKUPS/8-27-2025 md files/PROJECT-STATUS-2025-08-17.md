Shopify Fulfillment Service App – Project Overview & Technical Documentation

Last updated: 2025-08

📌 Project Purpose

We are building a Shopify Fulfillment Service App that:

Integrates with Shopify via the Fulfillment Service API (GraphQL).

Provides a custom print queue where merchants' fulfillment orders flow in.

Allows admins to manage fulfillment state (accept/reject/cancel/fulfill).

Groups multi-line-item orders under a single fulfillment order in our DB/UI.

Runs on Render with:

A Node/Express backend.

A React frontend (admin panel).

BullMQ workers for background processing.

Redis for job queues and deduplication.

This is not an order management app — it does not modify or cancel Shopify orders.
It only responds to fulfillment orders and manages our own fulfillment workflow.

⚙️ Current Tech Stack

Shopify API: GraphQL Admin API, schema version 2025-07 (latest stable).

Important: All interactions are via GraphQL only. REST must not be reintroduced.

Node.js 18+ on Render.

PostgreSQL for persistence.

Redis (Render managed) for BullMQ queues and in-memory deduplication.

BullMQ for async workers (slow jobs, retries, rate limiting).

Express backend with:

Webhook verification (verifyShopifyWebhook + HMAC).

Unified webhook handler (/api/webhooks/fulfillment/:action).

Admin API endpoints for the React panel.

React (Vite) frontend.

Helmet CSP configured for embedded Shopify app (via frame-ancestors).

CORS allowlist with Shopify + admin panel origins.

📡 Shopify Webhooks

We subscribe to the following fulfillment lifecycle topics:

fulfillment_orders/fulfill_request

fulfillment_orders/fulfill_request_accepted

fulfillment_orders/fulfill_request_rejected

fulfillment_orders/cancellation_request

fulfillment_orders/cancellation_request_accepted

fulfillment_orders/cancellation_request_rejected

fulfillment_orders/hold

fulfillment_orders/release_hold

fulfillment_orders/moved

Webhook Handler Consolidation

Single route: /api/webhooks/fulfillment/:action

One handler (handleFulfillmentWebhook) processes all simple lifecycle events.

Complex webhooks (request_submitted, order_routed) remain custom, since they require DB writes.

Always return 200 OK within 5s (Shopify requirement).

Deduplication & retries handled via Redis + BullMQ.

🗃 Database Schema

Two main tables:

fulfillment_orders

Represents a Shopify fulfillment order (one per order per service location).

CREATE TABLE fulfillment_orders (
  id SERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE,
  order_name VARCHAR(50),
  fulfillment_order_id VARCHAR(255), -- Shopify GID
  shop_domain VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  shop_email VARCHAR(255),
  shipping_address JSONB,
  status VARCHAR(50) DEFAULT 'pending',
  tracking_number VARCHAR(100),
  tracking_company VARCHAR(100),
  tracking_url VARCHAR(500),
  notes TEXT,
  exception_notes TEXT,
  shipped_at TIMESTAMP,
  delivered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

print_queue_items

Represents line items of each fulfillment order.

CREATE TABLE print_queue_items (
  id SERIAL PRIMARY KEY,
  fulfillment_order_id INTEGER REFERENCES fulfillment_orders(id) ON DELETE CASCADE,
  line_item_id BIGINT NOT NULL,
  client_product_id INTEGER REFERENCES client_products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  artwork_config JSON,
  print_file_url VARCHAR(500),
  mockup_url VARCHAR(500),
  product_title VARCHAR(255),
  variant_details JSONB,
  shopify_product_url VARCHAR(500),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(fulfillment_order_id, line_item_id)
);


Why this structure?

Orders are grouped as a single parent (fulfillment_orders).

Each line item is a child (print_queue_items).

Matches Shopify’s fulfillment model (fulfillment orders are containers of line items).

Enables single-fulfillment per order with multiple items.

🔄 Background Processing

Deduplication: Prevents duplicate jobs when Shopify retries webhooks.

BullMQ queues:

webhookQueue – all webhook jobs.

shopifyQueue – outbound Shopify API mutations (with concurrency = 2.5).

heavyQueue – slow tasks like mockup/image generation.

Redis:

Persistent (paid Render plan).

Configured with maxmemory-policy=noeviction (important for BullMQ).

Worker behavior:

Logs concurrency config at startup.

Handles graceful shutdown (SIGTERM).

🔒 Security & Compliance

Webhook security:

HMAC verification middleware (X-Shopify-Hmac-Sha256).

Shopify shop domain bound to each webhook request.

OAuth scopes (minimized to fulfillment-only):

read_fulfillments

write_fulfillments

read_assigned_fulfillment_orders

write_assigned_fulfillment_orders

read_merchant_managed_fulfillment_orders

write_merchant_managed_fulfillment_orders

Privacy compliance:

Currently at Level 1 PII access.

Do not expect customer name in all cases.

Use fulfillmentOrder.destination fields for shipping info.

Fallback to customer_name from order-level only if permitted.

🎨 Admin Panel (React)

Order Queue View:

One row per fulfillment order.

Badge for number of items.

Expandable list of items.

Order Details View:

Shows all line items.

Single fulfillment form (tracking/shipping applies to all).

Combined file download for multiple items.

Batch Operations:

Work at the fulfillment order level (not per line item).

Cancelling/fulfilling in bulk applies to all items.

📋 Key Decisions (with rationale)

GraphQL-only (no REST)
Prevents drift, ensures alignment with Shopify 2025+ strategy.

Unified webhook handler
Simplifies maintenance, avoids code duplication.

Queue-based architecture
Ensures 5s webhook SLA compliance, retries, and concurrency control.

Grouped fulfillment orders
Matches Shopify model, reduces shipping complexity/cost.

Deduplication layer
Essential due to Shopify’s retry mechanism.

No order cancellation
“Cancelled” in admin panel → reject/close fulfillment request, never cancel Shopify order.

🚨 Common Pitfalls to Avoid

Do not confuse:
fulfillmentOrder.destination (shipping info, GraphQL)
vs. order.shipping_address (REST — not to be used).

Do not compare location by name.
Always use location GIDs.

Do not return 400/500 to Shopify on webhook errors.
Always return 200 to avoid retries.

Do not use REST endpoints anywhere — this project is 100% GraphQL 2025-07.

✅ Current Status

Fulfillment service created & registered in Shopify.

Webhooks subscribed and routed correctly.

Deduplication, BullMQ queues, Redis configured (noeviction).

Database schema migrated to parent/child tables.

Admin panel shows grouped multi-item orders.

Privacy Level 1 compliance (no guaranteed access to customer name).

Render deploys:

backend (Express API).

frontend (React panel).

worker (BullMQ jobs).

🔮 Next Steps

Improve error dashboards/log visibility in admin.

Expand schema validation with Zod for webhook payloads.

Automate retries & alerting for failed Shopify API mutations.

Build test fixtures with mock Shopify FO payloads for CI validation.