# =============================================================================
# Multi-Marketplace Listing Platform Backend - Production Dockerfile
# =============================================================================
# This Dockerfile creates a production-ready container for a Node.js/TypeScript
# backend with Express.js, supporting PostgreSQL, Redis, AWS S3, and Bull queues.
#
# Architecture: Multi-stage build optimized for security, performance, and size
# Security: Non-root user, minimal attack surface, vulnerability scanning
# Performance: Node.js optimizations, efficient caching, minimal layers
# =============================================================================

# =============================================================================
# STAGE 1: Base Image with Security Hardening
# =============================================================================
FROM node:20-alpine AS base

# Install security updates and essential system packages
# - dumb-init: Proper signal handling for containerized Node.js apps
# - ca-certificates: Required for HTTPS connections to external APIs
RUN apk update && apk upgrade && \
    apk add --no-cache \
        dumb-init \
        ca-certificates \
        tzdata && \
    # Remove package cache to reduce image size
    rm -rf /var/cache/apk/*

# Set timezone to UTC for consistent logging and timestamps
ENV TZ=UTC

# Create application user for security (non-root)
# Using specific UID/GID for consistency across environments
RUN addgroup -g 1001 -S nodejs && \
    adduser -S backend -u 1001 -G nodejs

# Set working directory with proper ownership
WORKDIR /app
RUN chown -R backend:nodejs /app

# =============================================================================
# STAGE 2: Dependencies Installation
# =============================================================================
FROM base AS dependencies

# Switch to application user for dependency installation
USER backend

# Set Node.js environment for dependency resolution
ENV NODE_ENV=development

# Copy package files with proper ownership
# Using COPY --chown for security and efficiency
COPY --chown=backend:nodejs package*.json ./

# Install all dependencies (including devDependencies for TypeScript compilation)
# Using npm ci for deterministic, faster, and more reliable installs
# Cache mount for faster subsequent builds
RUN --mount=type=cache,target=/home/backend/.npm,uid=1001,gid=1001 \
    npm ci --only=production=false --silent

# =============================================================================
# STAGE 3: Build Stage - TypeScript Compilation
# =============================================================================
FROM dependencies AS build

# Copy TypeScript configuration
COPY --chown=backend:nodejs tsconfig.json ./
COPY --chown=backend:nodejs tsconfig.build.json ./

# Copy source code
COPY --chown=backend:nodejs src/ ./src/
COPY --chown=backend:nodejs prisma/ ./prisma/

# Install TypeScript globally for compilation
USER root
RUN npm install -g typescript@latest
USER backend

# Generate Prisma client for database access
RUN npx prisma generate

# Compile TypeScript to JavaScript
# Using production build optimizations
RUN npm run build

# Remove development dependencies to reduce final image size
RUN npm prune --production --silent

# =============================================================================
# STAGE 4: Production Runtime Image
# =============================================================================
FROM base AS production

# Production environment variables
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=1024 --enable-source-maps"

# Switch to application user
USER backend

# Copy compiled application from build stage
COPY --from=build --chown=backend:nodejs /app/dist ./dist
COPY --from=build --chown=backend:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=backend:nodejs /app/package*.json ./

# Copy Prisma schema and generated client
COPY --from=build --chown=backend:nodejs /app/prisma ./prisma

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/uploads && \
    chmod 755 /app/logs /app/uploads

# =============================================================================
# Application Configuration
# =============================================================================

# Expose application port (configurable via environment)
EXPOSE 3001

# Health check endpoint for Kubernetes readiness/liveness probes
# Checks database connectivity, Redis connectivity, and basic app health
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node dist/health-check.js || exit 1

# =============================================================================
# Security Labels and Metadata
# =============================================================================
LABEL \
    org.opencontainers.image.title="Multi-Marketplace Backend" \
    org.opencontainers.image.description="Production Node.js backend for multi-marketplace listing platform" \
    org.opencontainers.image.vendor="AgentSmith Platform" \
    org.opencontainers.image.version="1.0.0" \
    org.opencontainers.image.schema-version="1.0" \
    org.opencontainers.image.licenses="MIT" \
    security.non-root="true" \
    security.user="backend"

# =============================================================================
# Container Startup Configuration
# =============================================================================

# Use dumb-init for proper signal handling in containers
# This ensures graceful shutdowns and proper process management
ENTRYPOINT ["dumb-init", "--"]

# Default command to start the application
# Can be overridden for different deployment scenarios
CMD ["node", "dist/server.js"]

# =============================================================================
# Production Optimizations and Features
# =============================================================================
#
# Security Features:
# - Non-root user execution
# - Minimal base image (Alpine Linux)
# - Regular security updates
# - Proper signal handling with dumb-init
# - Restricted file permissions
#
# Performance Features:
# - Multi-stage builds for minimal image size
# - Layer caching optimization
# - Node.js memory optimization flags
# - Efficient dependency installation
# - Source maps enabled for debugging
#
# Monitoring Features:
# - Built-in health checks
# - Structured logging directory
# - Kubernetes-ready probes
# - Proper timezone handling
#
# Development Features:
# - TypeScript compilation
# - Prisma ORM integration
# - Environment-specific configurations
# - Docker build caching
#
# Integration Features:
# - PostgreSQL database connectivity
# - Redis caching and queue support
# - AWS S3 file storage
# - External API integrations (Shopify, Etsy, Amazon)
# - JWT authentication support
#
# Deployment Features:
# - Kubernetes deployment ready
# - Environment variable configuration
# - Graceful shutdown handling
# - Log aggregation support
# - Horizontal scaling support
# =============================================================================