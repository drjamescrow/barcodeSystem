# Print on Demand System

A comprehensive Shopify app for custom product creation with canvas-based design tools.

## Features
- Canvas-based product decorator with drag/drop artwork positioning
- Multi-color product creation with primary color selection
- Real-time mockup generation with accurate positioning
- Product editing and updating capabilities
- Admin product management
- Shopify integration with proper variant ordering
- High-resolution print file generation
- Color-specific image assignment

## Quick Start
1. Clone repository
2. Set up environment variables (see `.env.example`)
3. Run `npm run install:all`
4. Deploy to Render
5. Configure Shopify app in Partner Dashboard

## Documentation
- [Project Guide](CLAUDE.md) - Complete development documentation
- [Production Checklist](shopify-app-to-do-list.md) - Pre-launch requirements
- Feature docs available in individual .md files

## Tech Stack
- Backend: Node.js, Express, PostgreSQL, Sharp (image processing)
- Frontend: React, Fabric.js, Shopify Polaris, Tailwind CSS
- Hosting: Render
- Storage: Cloudinary
- Authentication: JWT tokens