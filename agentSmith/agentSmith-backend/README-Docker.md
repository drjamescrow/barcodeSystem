# Docker Setup - Multi-Marketplace Backend

This document provides comprehensive instructions for building and deploying the multi-marketplace listing platform backend using Docker.

## 🐳 Docker Architecture

The production Dockerfile uses a multi-stage build approach optimized for:
- **Security**: Non-root user, minimal attack surface, Alpine Linux base
- **Performance**: Layer caching, dependency optimization, Node.js tuning
- **Size**: Minimal final image with only production dependencies
- **Monitoring**: Built-in health checks for Kubernetes deployment

## 📋 Prerequisites

- Docker 20.10+ and Docker Compose 2.0+
- Node.js 18+ (for local development)
- Git (for cloning the repository)

## 🚀 Quick Start

### Local Development with Docker Compose

1. **Start all services:**
   ```bash
   docker-compose up -d
   ```

2. **View logs:**
   ```bash
   docker-compose logs -f backend
   ```

3. **Access services:**
   - Backend API: http://localhost:3001
   - PostgreSQL: localhost:5432
   - Redis: localhost:6379
   - MinIO (S3): http://localhost:9000
   - PgAdmin: http://localhost:8080
   - Redis Commander: http://localhost:8081
   - Mailhog: http://localhost:8025

### Production Docker Build

1. **Build production image:**
   ```bash
   docker build -t marketplace-backend:latest .
   ```

2. **Run production container:**
   ```bash
   docker run -d \
     --name marketplace-backend \
     -p 3001:3001 \
     -e NODE_ENV=production \
     -e DB_HOST=your-db-host \
     -e DB_PASSWORD=your-db-password \
     -e REDIS_HOST=your-redis-host \
     -e JWT_SECRET=your-jwt-secret \
     marketplace-backend:latest
   ```

## 🏗️ Build Stages Explained

### Stage 1: Base Image
- Alpine Linux for minimal size and security
- Security updates and essential packages
- Non-root user creation
- Timezone configuration

### Stage 2: Dependencies
- Development and production dependencies
- NPM cache mounting for faster builds
- Prisma client generation

### Stage 3: Build
- TypeScript compilation
- Source code optimization
- Production dependency pruning

### Stage 4: Production Runtime
- Minimal final image
- Health check configuration
- Security hardening
- Optimized Node.js settings

## 🔧 Configuration

### Environment Variables

#### Required Variables
```env
NODE_ENV=production
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=marketplace
DB_USER=postgres
DB_PASSWORD=your-password
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-jwt-secret
```

#### AWS Configuration
```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=your-bucket-name
```

#### Optional Variables
```env
REDIS_PASSWORD=your-redis-password
MAX_MEMORY=1073741824
LOG_LEVEL=info
SENTRY_DSN=your-sentry-dsn
```

### Docker Compose Override

Create `docker-compose.override.yml` for custom configurations:

```yaml
version: '3.8'
services:
  backend:
    environment:
      - DEBUG=app:*
      - LOG_LEVEL=debug
    volumes:
      - ./custom-config:/app/config
```

## 🏥 Health Checks

The container includes comprehensive health checks:

- **Database connectivity** (PostgreSQL)
- **Cache connectivity** (Redis)
- **Memory usage** monitoring
- **Application health** verification

Health check endpoint: `GET /health`

### Manual Health Check
```bash
docker exec marketplace-backend node dist/health-check.js
```

## 📊 Monitoring and Logging

### Container Logs
```bash
# View real-time logs
docker-compose logs -f backend

# View specific number of lines
docker logs --tail 100 marketplace-backend

# Follow logs with timestamps
docker logs -f -t marketplace-backend
```

### Performance Monitoring
```bash
# Container resource usage
docker stats marketplace-backend

# Container processes
docker exec marketplace-backend ps aux
```

## 🔒 Security Features

### Container Security
- Non-root user execution (user: backend, uid: 1001)
- Minimal Alpine Linux base image
- Regular security updates
- Read-only root filesystem capability

### Application Security
- JWT authentication with refresh tokens
- Input validation with Zod schemas
- Rate limiting and CORS protection
- Helmet.js security headers
- Encrypted sensitive data storage

## 🚀 Production Deployment

### Kubernetes Deployment

1. **Build and tag image:**
   ```bash
   docker build -t your-registry/marketplace-backend:v1.0.0 .
   docker push your-registry/marketplace-backend:v1.0.0
   ```

2. **Deploy with Kubernetes:**
   ```yaml
   apiVersion: apps/v1
   kind: Deployment
   metadata:
     name: marketplace-backend
   spec:
     replicas: 3
     selector:
       matchLabels:
         app: marketplace-backend
     template:
       metadata:
         labels:
           app: marketplace-backend
       spec:
         containers:
         - name: backend
           image: your-registry/marketplace-backend:v1.0.0
           ports:
           - containerPort: 3001
           env:
           - name: NODE_ENV
             value: "production"
           livenessProbe:
             httpGet:
               path: /health
               port: 3001
             initialDelaySeconds: 40
             periodSeconds: 30
           readinessProbe:
             httpGet:
               path: /health
               port: 3001
             initialDelaySeconds: 10
             periodSeconds: 10
   ```

### Docker Swarm Deployment

```yaml
version: '3.8'
services:
  backend:
    image: marketplace-backend:latest
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    networks:
      - marketplace-network
```

## 🛠️ Development Workflow

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run with Docker (recommended)
docker-compose up -d
```

### Testing
```bash
# Run tests in container
docker-compose exec backend npm test

# Run tests with coverage
docker-compose exec backend npm run test:coverage
```

### Database Operations
```bash
# Run migrations
docker-compose exec backend npm run db:migrate

# Seed database
docker-compose exec backend npm run db:seed

# Reset database
docker-compose exec backend npm run db:reset
```

## 🐛 Troubleshooting

### Common Issues

1. **Container won't start:**
   ```bash
   docker logs marketplace-backend
   ```

2. **Database connection issues:**
   ```bash
   docker-compose exec backend ping postgres
   ```

3. **Permission errors:**
   ```bash
   docker-compose exec backend ls -la /app
   ```

4. **Memory issues:**
   ```bash
   docker stats --no-stream marketplace-backend
   ```

### Performance Optimization

1. **Increase Node.js memory:**
   ```env
   NODE_OPTIONS=--max-old-space-size=2048
   ```

2. **Enable clustering:**
   ```env
   NODE_CLUSTER=true
   NODE_CLUSTER_WORKERS=4
   ```

3. **Optimize Docker build:**
   ```bash
   docker build --no-cache -t marketplace-backend .
   ```

## 📚 Additional Resources

- [Docker Best Practices](https://docs.docker.com/develop/best-practices/)
- [Node.js Docker Guide](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [Kubernetes Health Checks](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Docker Security](https://docs.docker.com/engine/security/)

## 🆘 Support

For Docker-related issues:
1. Check container logs
2. Verify environment variables
3. Ensure all dependencies are running
4. Check network connectivity
5. Review health check output

## 📝 License

This Docker configuration is part of the AgentSmith Multi-Marketplace Platform and is licensed under MIT License.