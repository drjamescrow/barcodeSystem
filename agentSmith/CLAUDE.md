# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AgentSmith is a multi-marketplace listing platform that helps sellers create product listings across Shopify, Etsy, and Amazon from a single input source. The platform can either generate downloadable spreadsheets or create listings directly via API integration.

## Repository Structure

The project follows a monorepo architecture with separate frontend and backend:

- `agentSmith-backend/` - Node.js/Express backend API with TypeScript, PostgreSQL, Redis, and AWS S3 integration
- `agentSmith-frontend/` - Next.js frontend application (currently empty, to be implemented)
- Various output files from specialized agents (product-manager, system-architect, ux-ui-designer, devops-engineer)

## Backend Development Commands

### Development
```bash
cd agentSmith-backend
npm run dev                    # Start development server with hot reload
npm run docker:dev            # Start full development stack with Docker Compose
npm run docker:logs           # View backend container logs
```

### Building and Testing
```bash
npm run build                  # Compile TypeScript to JavaScript
npm run test                   # Run Jest test suite
npm run test:watch            # Run tests in watch mode
npm run test:coverage         # Generate test coverage report
npm run lint                   # Run ESLint
npm run lint:fix              # Fix ESLint issues automatically
npm run format                # Format code with Prettier
```

### Database Operations
```bash
npm run db:generate           # Generate Prisma client
npm run db:migrate            # Run database migrations (development)
npm run db:migrate:prod       # Deploy migrations to production
npm run db:seed               # Seed database with sample data
npm run db:reset              # Reset database and run migrations
```

### Docker Operations
```bash
npm run docker:build         # Build production Docker image
npm run docker:run           # Run production container locally
npm run docker:down          # Stop and remove Docker Compose services
```

### Health Monitoring
```bash
npm run health               # Run health check script
```

## Architecture Overview

### Backend Technology Stack
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: PostgreSQL with Prisma ORM
- **Caching**: Redis for sessions and application cache
- **Queue System**: Bull/Redis for background job processing
- **File Storage**: AWS S3 with Sharp for image optimization
- **Authentication**: JWT tokens with refresh token support
- **Validation**: Zod schemas for input validation
- **Security**: Helmet, CORS, rate limiting, bcrypt

### Key Architectural Patterns
- **Multi-stage Docker builds** for production optimization
- **Microservices approach** with dedicated services for users, products, exports, integrations
- **Queue-based background processing** for CSV exports and API integrations
- **Multi-platform field mapping** system for Shopify/Etsy/Amazon requirements
- **Comprehensive health checks** for Kubernetes deployment readiness

### Database Design
The system uses 13 core tables with UUID primary keys, audit logging, and encryption support:
- Users, Products, ProductVariants, ProductImages
- Integrations, Exports, Templates
- Categories, PlatformMappings, AuditLogs

### External Integrations
- **Shopify Admin API** for direct listing creation
- **Etsy Open API** with OAuth 2.0 authentication
- **Amazon MWS/SP-API** for inventory management
- **AWS S3** for image storage and CDN
- **Stripe** for payment processing (enterprise features)

## Development Environment Setup

### Prerequisites
- Node.js 18+
- Docker 20.10+ and Docker Compose 2.0+
- PostgreSQL 14+ (or use Docker Compose)
- Redis 6+ (or use Docker Compose)

### Quick Start with Docker
```bash
cd agentSmith-backend
cp .env.example .env          # Configure environment variables
docker-compose up -d          # Start all services
```

This starts:
- Backend API on localhost:3001
- PostgreSQL on localhost:5432
- Redis on localhost:6379
- MinIO (S3 alternative) on localhost:9000
- PgAdmin on localhost:8080
- Redis Commander on localhost:8081
- Mailhog (email testing) on localhost:8025

### Production Deployment
The backend includes production-ready Docker configuration:
- Multi-stage builds for security and performance
- Non-root user execution (backend:1001)
- Health check endpoints for Kubernetes
- Comprehensive logging with Winston
- Security hardening with Alpine Linux

## Testing Strategy

- **Unit Tests**: Jest with TypeScript support
- **Integration Tests**: Supertest for API endpoints
- **Coverage**: Minimum 80% test coverage requirement
- **Health Checks**: Automated database and Redis connectivity testing

## Key Development Considerations

### Multi-Platform Data Mapping
Each marketplace (Shopify, Etsy, Amazon) has unique field requirements and validation rules. The platform handles this through:
- Universal product schema that maps to platform-specific formats
- Validation engine with platform-specific rules
- Template system for reusable configurations

### Background Job Processing
CSV exports and API integrations run as background jobs using Bull queues:
- Export jobs for generating platform-specific spreadsheets
- Sync jobs for real-time inventory management
- Retry mechanisms with exponential backoff

### Security Implementation
- JWT authentication with refresh tokens
- OAuth 2.0 for marketplace integrations
- Input validation with Zod schemas
- Encrypted storage for sensitive data (API keys, tokens)
- Rate limiting and CORS protection

## Environment Configuration

Key environment variables are documented in `agentSmith-backend/.env.example`:
- Database connection (PostgreSQL)
- Redis configuration
- AWS S3 credentials
- JWT secrets
- External API credentials (Shopify, Etsy, Amazon)
- Monitoring and logging settings

## Specialized Agents

This repository contains output from specialized AI agents in the root directory:
- `product-manager-output.md` - Product requirements and roadmap
- `system-architect-output.md` - Technical architecture specifications  
- `ux-ui-designer-output.md` - Design system and user experience guidelines
- `devops-engineer-output.md` - Docker and deployment infrastructure

These documents provide comprehensive guidance for understanding business requirements, technical decisions, design patterns, and deployment strategies.