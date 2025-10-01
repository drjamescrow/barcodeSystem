#!/usr/bin/env node
/**
 * Health Check Script for Multi-Marketplace Backend
 * 
 * This script performs comprehensive health checks for Kubernetes
 * readiness and liveness probes, ensuring the application is healthy
 * and ready to serve requests.
 * 
 * Checks performed:
 * - Database connectivity (PostgreSQL)
 * - Redis connectivity (caching and queues)
 * - Basic application health
 * - External service dependencies
 */

import { createConnection } from 'typeorm';
import Redis from 'ioredis';
import { performance } from 'perf_hooks';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  uptime: number;
  checks: {
    database: HealthStatus;
    redis: HealthStatus;
    memory: HealthStatus;
    application: HealthStatus;
  };
  details?: any;
}

interface HealthStatus {
  status: 'pass' | 'fail';
  responseTime?: number;
  error?: string;
  details?: any;
}

class HealthChecker {
  private redis: Redis | null = null;

  async checkDatabase(): Promise<HealthStatus> {
    const startTime = performance.now();
    
    try {
      // Check database connectivity
      // This assumes you're using TypeORM or similar
      const connection = await createConnection({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432'),
        username: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'marketplace',
        synchronize: false,
        logging: false,
      });

      await connection.query('SELECT 1');
      await connection.close();

      const responseTime = performance.now() - startTime;
      
      return {
        status: 'pass',
        responseTime: Math.round(responseTime),
        details: { connected: true }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'fail',
        responseTime: Math.round(responseTime),
        error: error instanceof Error ? error.message : 'Unknown database error',
        details: { connected: false }
      };
    }
  }

  async checkRedis(): Promise<HealthStatus> {
    const startTime = performance.now();
    
    try {
      this.redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        password: process.env.REDIS_PASSWORD,
        retryDelayOnFailover: 100,
        enableReadyCheck: false,
        maxRetriesPerRequest: 1,
      });

      await this.redis.ping();
      
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'pass',
        responseTime: Math.round(responseTime),
        details: { connected: true }
      };
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      return {
        status: 'fail',
        responseTime: Math.round(responseTime),
        error: error instanceof Error ? error.message : 'Unknown Redis error',
        details: { connected: false }
      };
    } finally {
      if (this.redis) {
        this.redis.disconnect();
      }
    }
  }

  checkMemory(): HealthStatus {
    const memoryUsage = process.memoryUsage();
    const maxMemory = parseInt(process.env.MAX_MEMORY || '1073741824'); // 1GB default
    const usedMemory = memoryUsage.heapUsed;
    const memoryPercent = (usedMemory / maxMemory) * 100;
    
    return {
      status: memoryPercent < 90 ? 'pass' : 'fail',
      details: {
        usedMemoryMB: Math.round(usedMemory / 1024 / 1024),
        maxMemoryMB: Math.round(maxMemory / 1024 / 1024),
        percentUsed: Math.round(memoryPercent),
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      }
    };
  }

  checkApplication(): HealthStatus {
    try {
      // Basic application health checks
      const uptime = process.uptime();
      const version = process.env.npm_package_version || '1.0.0';
      
      return {
        status: 'pass',
        details: {
          uptime: Math.round(uptime),
          version,
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid
        }
      };
    } catch (error) {
      return {
        status: 'fail',
        error: error instanceof Error ? error.message : 'Unknown application error'
      };
    }
  }

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = performance.now();
    
    const [database, redis, memory, application] = await Promise.allSettled([
      this.checkDatabase(),
      this.checkRedis(),
      Promise.resolve(this.checkMemory()),
      Promise.resolve(this.checkApplication())
    ]);

    const checks = {
      database: database.status === 'fulfilled' ? database.value : { status: 'fail' as const, error: 'Health check failed' },
      redis: redis.status === 'fulfilled' ? redis.value : { status: 'fail' as const, error: 'Health check failed' },
      memory: memory.status === 'fulfilled' ? memory.value : { status: 'fail' as const, error: 'Health check failed' },
      application: application.status === 'fulfilled' ? application.value : { status: 'fail' as const, error: 'Health check failed' }
    };

    const allHealthy = Object.values(checks).every(check => check.status === 'pass');
    const totalTime = performance.now() - startTime;

    return {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      checks,
      details: {
        totalCheckTime: Math.round(totalTime),
        environment: process.env.NODE_ENV || 'development'
      }
    };
  }
}

// Main execution
async function main() {
  const checker = new HealthChecker();
  
  try {
    const result = await checker.performHealthCheck();
    
    // Log the result
    console.log(JSON.stringify(result, null, 2));
    
    // Exit with appropriate code for Docker health check
    process.exit(result.status === 'healthy' ? 0 : 1);
  } catch (error) {
    console.error('Health check failed:', error);
    process.exit(1);
  }
}

// Handle script execution
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error during health check:', error);
    process.exit(1);
  });
}

export { HealthChecker };
export default main;