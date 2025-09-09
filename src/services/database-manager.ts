import { mongoService } from './mongodb.js';
import { redisService } from './redis.js';
import { secureLogger as logger } from '../utils/logger.js';

/**
 * Unified Database Manager
 * Coordinates MongoDB and Redis services for optimal performance and data persistence
 */

export interface AnalysisMetadata {
  processingTime: number;
  tokensUsed?: number;
  provider: string;
}

export interface DatabaseHealth {
  mongodb: { status: string; details?: any };
  redis: { status: string; details?: any };
  overall: 'healthy' | 'degraded' | 'down';
}

/**
 * Database Manager - Unified interface for all database operations
 */
export class DatabaseManager {
  private static instance: DatabaseManager;
  private initialized = false;
  private readonly cacheFirstTypes = ['consensus', 'breaking_news', 'complete_intelligence'];

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  /**
   * Initialize all database connections
   */
  public async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    logger.info('Initializing database services...');

    try {
      // Initialize connections in parallel
      const [mongoConnected, redisConnected] = await Promise.all([
        mongoService.connect(),
        redisService.connect()
      ]);

      if (mongoConnected || redisConnected) {
        logger.info('Database services initialized', {
          mongodb: mongoConnected ? 'connected' : 'unavailable',
          redis: redisConnected ? 'connected' : 'unavailable'
        });
      } else {
        logger.warn('No database services available - running in memory-only mode');
      }

      this.initialized = true;

      // Start background cleanup task
      this.startCleanupTask();

    } catch (error) {
      logger.error('Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Start periodic cleanup task
   */
  private startCleanupTask(): void {
    // Run cleanup every 6 hours
    const cleanupInterval = 6 * 60 * 60 * 1000;
    
    setInterval(async () => {
      try {
        logger.info('Starting periodic database cleanup...');
        await Promise.all([
          mongoService.cleanup(),
          redisService.clearCache('temp:*') // Clear only temporary data
        ]);
        logger.info('Periodic database cleanup completed');
      } catch (error) {
        logger.error('Periodic database cleanup failed:', error);
      }
    }, cleanupInterval);
  }

  /**
   * Store analysis result with intelligent caching strategy
   */
  public async storeAnalysisResult(
    query: string,
    analysisType: string,
    result: any,
    metadata: AnalysisMetadata
  ): Promise<{ cached: boolean; stored: boolean; id?: string }> {
    const operations: Promise<any>[] = [];
    let cached = false;
    let stored = false;
    let id: string | undefined;

    try {
      // Cache in Redis for fast retrieval (if available)
      if (redisService.isConnected() && this.cacheFirstTypes.includes(analysisType)) {
        operations.push(
          redisService.cacheAnalysisResult(query, analysisType, result, metadata)
            .then(success => { cached = success; })
            .catch(error => logger.warn('Redis caching failed:', error))
        );
      }

      // Store in MongoDB for persistence and analytics (if available)
      if (mongoService.isConnected()) {
        operations.push(
          mongoService.storeAnalysisResult(query, analysisType, result, metadata)
            .then(resultId => { 
              stored = !!resultId; 
              id = resultId || undefined;
            })
            .catch(error => logger.warn('MongoDB storage failed:', error))
        );
      }

      // Execute operations in parallel
      if (operations.length > 0) {
        await Promise.allSettled(operations);
      }

      logger.debug('Analysis result storage completed', {
        type: analysisType,
        cached,
        stored,
        queryLength: query.length
      });

      return { cached, stored, ...(id && { id }) };

    } catch (error) {
      logger.error('Failed to store analysis result:', error);
      return { cached: false, stored: false };
    }
  }

  /**
   * Retrieve cached analysis result with fallback strategy
   */
  public async getCachedAnalysis(query: string, analysisType: string): Promise<any | null> {
    try {
      // Try Redis first for fastest retrieval
      if (redisService.isConnected()) {
        const redisResult = await redisService.getCachedAnalysis(query, analysisType);
        if (redisResult) {
          logger.debug('Cache hit from Redis', { type: analysisType });
          return redisResult;
        }
      }

      // Fallback to MongoDB
      if (mongoService.isConnected()) {
        const mongoResult = await mongoService.getCachedAnalysis(query, analysisType);
        if (mongoResult) {
          logger.debug('Cache hit from MongoDB', { type: analysisType });
          
          // Backfill Redis cache if available
          if (redisService.isConnected()) {
            redisService.cacheAnalysisResult(
              query, 
              analysisType, 
              mongoResult,
              { processingTime: 0, provider: 'cache' }
            ).catch(error => logger.debug('Redis backfill failed:', error));
          }
          
          return mongoResult;
        }
      }

      logger.debug('Cache miss', { type: analysisType, queryHash: query.slice(0, 50) });
      return null;

    } catch (error) {
      logger.error('Failed to retrieve cached analysis:', error);
      return null;
    }
  }

  /**
   * Track user session across both databases
   */
  public async trackUserSession(
    sessionId: string,
    ipAddress: string,
    userAgent: string,
    endpoint: string,
    query: string | undefined,
    processingTime: number,
    success: boolean
  ): Promise<void> {
    const operations: Promise<void>[] = [];

    try {
      // Update Redis session (fast, temporary)
      if (redisService.isConnected()) {
        operations.push(
          (async () => {
            const sessionData = await redisService.getSessionData(sessionId) || {
              sessionId,
              ipAddress,
              userAgent,
              requestCount: 0,
              lastActivity: Date.now(),
              createdAt: Date.now()
            };

            sessionData.lastActivity = Date.now();
            sessionData.requestCount++;
            
            await redisService.setSessionData(sessionId, sessionData);
          })().catch(error => logger.debug('Redis session tracking failed:', error))
        );
      }

      // Store in MongoDB (persistent, for analytics)
      if (mongoService.isConnected()) {
        operations.push(
          mongoService.trackUserSession(
            sessionId, ipAddress, userAgent, endpoint, query, processingTime, success
          ).catch(error => logger.debug('MongoDB session tracking failed:', error))
        );
      }

      await Promise.allSettled(operations);

    } catch (error) {
      logger.error('Failed to track user session:', error);
    }
  }

  /**
   * Check rate limiting using Redis (with MongoDB fallback)
   */
  public async checkRateLimit(
    identifier: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<{ allowed: boolean; count: number; resetTime: number }> {
    try {
      if (redisService.isConnected()) {
        return await redisService.checkRateLimit(identifier, limit, windowSeconds);
      }

      // Fallback: allow request if no caching available
      logger.debug('Rate limiting unavailable - allowing request', { identifier });
      return { allowed: true, count: 0, resetTime: 0 };

    } catch (error) {
      logger.error('Rate limit check failed:', error);
      return { allowed: true, count: 0, resetTime: 0 };
    }
  }

  /**
   * Get comprehensive system metrics
   */
  public async getSystemMetrics(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    try {
      const results: any = {
        databases: this.getHealthStatus(),
        period
      };

      // Get MongoDB analytics
      if (mongoService.isConnected()) {
        const mongoMetrics = await mongoService.getSystemMetrics(period);
        results.mongodb = mongoMetrics;
      }

      // Get Redis cache stats
      if (redisService.isConnected()) {
        const redisStats = await redisService.getCacheStats();
        results.redis = redisStats;
      }

      return results;

    } catch (error) {
      logger.error('Failed to get system metrics:', error);
      return { error: 'Failed to retrieve system metrics' };
    }
  }

  /**
   * Get database health status
   */
  public getHealthStatus(): DatabaseHealth {
    const mongoHealth = mongoService.getHealthStatus();
    const redisHealth = redisService.getHealthStatus();

    let overall: 'healthy' | 'degraded' | 'down' = 'down';

    if (mongoHealth.status === 'connected' && redisHealth.status === 'connected') {
      overall = 'healthy';
    } else if (mongoHealth.status === 'connected' || redisHealth.status === 'connected') {
      overall = 'degraded';
    }

    return {
      mongodb: mongoHealth,
      redis: redisHealth,
      overall
    };
  }

  /**
   * Perform health checks on all database services
   */
  public async performHealthCheck(): Promise<any> {
    const checks: any = {
      timestamp: new Date().toISOString(),
      services: {}
    };

    try {
      // MongoDB health check
      if (mongoService.isConnected()) {
        checks.services.mongodb = { status: 'connected', details: mongoService.getHealthStatus() };
      } else {
        checks.services.mongodb = { status: 'disconnected' };
      }

      // Redis health check
      if (redisService.isConnected()) {
        const redisHealth = await redisService.healthCheck();
        checks.services.redis = redisHealth;
      } else {
        checks.services.redis = { status: 'disconnected' };
      }

      // Overall status
      const connectedServices = Object.values(checks.services).filter(
        (service: any) => service.status === 'connected'
      ).length;

      checks.overall = {
        status: connectedServices === 2 ? 'healthy' : connectedServices === 1 ? 'degraded' : 'down',
        connectedServices,
        totalServices: 2
      };

      return checks;

    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Graceful shutdown of all database connections
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down database services...');
    
    try {
      await Promise.all([
        mongoService.disconnect(),
        redisService.disconnect()
      ]);
      
      this.initialized = false;
      logger.info('Database services shut down successfully');
      
    } catch (error) {
      logger.error('Database shutdown failed:', error);
    }
  }

  /**
   * Check if any database service is available
   */
  public isAvailable(): boolean {
    return mongoService.isConnected() || redisService.isConnected();
  }

  /**
   * Check if caching is available
   */
  public isCachingAvailable(): boolean {
    return redisService.isConnected() || mongoService.isConnected();
  }

  /**
   * Check if persistent storage is available
   */
  public isPersistenceAvailable(): boolean {
    return mongoService.isConnected();
  }

  /**
   * Clear all caches (use with extreme caution)
   */
  public async clearAllCaches(): Promise<{ redis: boolean; mongodb: boolean }> {
    const results = {
      redis: false,
      mongodb: false
    };

    try {
      if (redisService.isConnected()) {
        results.redis = await redisService.clearCache();
      }

      // MongoDB cache clearing would require deleting analysis results
      // This is intentionally not implemented for safety
      if (mongoService.isConnected()) {
        logger.warn('MongoDB cache clearing not implemented for safety');
        results.mongodb = false;
      }

      logger.info('Cache clearing completed', results);
      return results;

    } catch (error) {
      logger.error('Cache clearing failed:', error);
      return results;
    }
  }
}

// Export singleton instance
export const databaseManager = DatabaseManager.getInstance();