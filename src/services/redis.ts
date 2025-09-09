import * as Redis from 'ioredis';
import { config } from '../config.js';
import { secureLogger as logger } from '../utils/logger.js';

/**
 * Redis Caching Service
 * Provides high-performance caching for analysis results, session data, and temporary storage
 */

export interface CacheEntry {
  data: any;
  metadata: {
    timestamp: number;
    ttl: number;
    provider: string;
    tokensUsed?: number;
    processingTime: number;
  };
}

export interface SessionData {
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
  requestCount: number;
  lastActivity: number;
  createdAt: number;
}

/**
 * Redis Cache Manager
 */
export class RedisService {
  private static instance: RedisService;
  private client: Redis.Redis | null = null;
  private connected = false;
  private connectionRetries = 0;
  private maxRetries = 5;
  private readonly defaultTTL = 12 * 60 * 60; // 12 hours in seconds

  private constructor() {}

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  /**
   * Initialize Redis connection
   */
  public async connect(): Promise<boolean> {
    if (!config.database.redisUrl) {
      logger.warn('Redis URL not configured, skipping Redis connection');
      return false;
    }

    if (this.connected && this.client) {
      return true;
    }

    try {
      this.client = new Redis.Redis(config.database.redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        connectTimeout: 5000,
        commandTimeout: 5000,
        keyPrefix: 'mcp:financial:',
        family: 4,
        keepAlive: 30000
      });

      // Set up event listeners
      this.client.on('connect', () => {
        logger.info('Redis connecting...');
      });

      this.client.on('ready', () => {
        this.connected = true;
        this.connectionRetries = 0;
        logger.info('Redis connected successfully', {
          host: this.client?.options.host,
          port: this.client?.options.port,
          db: this.client?.options.db
        });
      });

      this.client.on('error', (error: any) => {
        logger.error('Redis connection error:', error);
        this.connected = false;
      });

      this.client.on('close', () => {
        logger.warn('Redis connection closed');
        this.connected = false;
        this.handleReconnection();
      });

      this.client.on('reconnecting', (delay: any) => {
        logger.info(`Redis reconnecting in ${delay}ms`);
      });

      // Test connection
      await this.client.connect();
      await this.client.ping();

      return true;
    } catch (error) {
      logger.error('Redis connection failed:', error);
      this.connected = false;
      await this.handleReconnection();
      return false;
    }
  }

  /**
   * Handle reconnection with exponential backoff
   */
  private async handleReconnection(): Promise<void> {
    if (this.connectionRetries >= this.maxRetries) {
      logger.error('Max Redis reconnection attempts reached');
      return;
    }

    this.connectionRetries++;
    const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000);
    
    logger.info(`Attempting Redis reconnection in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
    
    setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  /**
   * Check if Redis is connected
   */
  public isConnected(): boolean {
    return this.connected && this.client?.status === 'ready';
  }

  /**
   * Generate cache key for analysis results
   */
  private generateCacheKey(query: string, analysisType: string): string {
    const hash = Buffer.from(query).toString('base64').slice(0, 32);
    return `analysis:${analysisType}:${hash}`;
  }

  /**
   * Store analysis result in Redis cache
   */
  public async cacheAnalysisResult(
    query: string,
    analysisType: string,
    result: any,
    metadata: {
      processingTime: number;
      tokensUsed?: number;
      provider: string;
    },
    ttl?: number
  ): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      logger.warn('Redis not connected, skipping cache storage');
      return false;
    }

    try {
      const cacheKey = this.generateCacheKey(query, analysisType);
      const cacheEntry: CacheEntry = {
        data: result,
        metadata: {
          ...metadata,
          timestamp: Date.now(),
          ttl: ttl || this.defaultTTL
        }
      };

      const serialized = JSON.stringify(cacheEntry);
      await this.client.setex(cacheKey, ttl || this.defaultTTL, serialized);

      logger.info('Analysis result cached in Redis', {
        key: cacheKey,
        type: analysisType,
        size: serialized.length,
        ttl: ttl || this.defaultTTL
      });

      return true;
    } catch (error) {
      logger.error('Failed to cache analysis result in Redis:', error);
      return false;
    }
  }

  /**
   * Retrieve cached analysis result from Redis
   */
  public async getCachedAnalysis(query: string, analysisType: string): Promise<any | null> {
    if (!this.isConnected() || !this.client) {
      return null;
    }

    try {
      const cacheKey = this.generateCacheKey(query, analysisType);
      const cached = await this.client.get(cacheKey);

      if (!cached) {
        return null;
      }

      const cacheEntry: CacheEntry = JSON.parse(cached);
      const age = Date.now() - cacheEntry.metadata.timestamp;

      logger.info('Cache hit: Analysis result retrieved from Redis', {
        key: cacheKey,
        type: analysisType,
        age,
        provider: cacheEntry.metadata.provider
      });

      return cacheEntry.data;
    } catch (error) {
      logger.error('Failed to retrieve cached analysis from Redis:', error);
      return null;
    }
  }

  /**
   * Store user session data
   */
  public async setSessionData(sessionId: string, data: SessionData, ttl: number = 24 * 60 * 60): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      return false;
    }

    try {
      const sessionKey = `session:${sessionId}`;
      await this.client.setex(sessionKey, ttl, JSON.stringify(data));
      
      logger.debug('Session data cached in Redis', { sessionId, ttl });
      return true;
    } catch (error) {
      logger.error('Failed to store session data in Redis:', error);
      return false;
    }
  }

  /**
   * Retrieve user session data
   */
  public async getSessionData(sessionId: string): Promise<SessionData | null> {
    if (!this.isConnected() || !this.client) {
      return null;
    }

    try {
      const sessionKey = `session:${sessionId}`;
      const data = await this.client.get(sessionKey);
      
      if (!data) {
        return null;
      }

      return JSON.parse(data);
    } catch (error) {
      logger.error('Failed to retrieve session data from Redis:', error);
      return null;
    }
  }

  /**
   * Update user session activity
   */
  public async updateSessionActivity(sessionId: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      return false;
    }

    try {
      const sessionData = await this.getSessionData(sessionId);
      if (sessionData) {
        sessionData.lastActivity = Date.now();
        sessionData.requestCount++;
        await this.setSessionData(sessionId, sessionData);
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to update session activity in Redis:', error);
      return false;
    }
  }

  /**
   * Store temporary data with TTL
   */
  public async setTempData(key: string, data: any, ttl: number): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      return false;
    }

    try {
      const tempKey = `temp:${key}`;
      await this.client.setex(tempKey, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      logger.error('Failed to store temporary data in Redis:', error);
      return false;
    }
  }

  /**
   * Retrieve temporary data
   */
  public async getTempData(key: string): Promise<any | null> {
    if (!this.isConnected() || !this.client) {
      return null;
    }

    try {
      const tempKey = `temp:${key}`;
      const data = await this.client.get(tempKey);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      logger.error('Failed to retrieve temporary data from Redis:', error);
      return null;
    }
  }

  /**
   * Rate limiting support
   */
  public async checkRateLimit(identifier: string, limit: number, windowSeconds: number): Promise<{ allowed: boolean; count: number; resetTime: number }> {
    if (!this.isConnected() || !this.client) {
      return { allowed: true, count: 0, resetTime: 0 };
    }

    try {
      const rateLimitKey = `rate_limit:${identifier}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSeconds;

      // Use Redis pipeline for atomic operations
      const pipeline = this.client.pipeline();
      pipeline.zremrangebyscore(rateLimitKey, '-inf', windowStart);
      pipeline.zcard(rateLimitKey);
      pipeline.zadd(rateLimitKey, now, `${now}-${Math.random()}`);
      pipeline.expire(rateLimitKey, windowSeconds);
      
      const results = await pipeline.exec();
      
      if (!results || results.some(([err]: any) => err)) {
        throw new Error('Redis pipeline operation failed');
      }

      const count = (results[1] && results[1][1]) as number || 0;
      const allowed = count < limit;
      const resetTime = now + windowSeconds;

      logger.debug('Rate limit check', { identifier, count, limit, allowed });

      return { allowed, count, resetTime };
    } catch (error) {
      logger.error('Failed to check rate limit in Redis:', error);
      return { allowed: true, count: 0, resetTime: 0 };
    }
  }

  /**
   * Get cache statistics
   */
  public async getCacheStats(): Promise<any> {
    if (!this.isConnected() || !this.client) {
      return { error: 'Redis not connected' };
    }

    try {
      const info = await this.client.info('memory');
      const keyspace = await this.client.info('keyspace');
      const stats = await this.client.info('stats');

      // Parse Redis info strings
      const parseInfo = (infoStr: string) => {
        const lines = infoStr.split('\r\n');
        const result: any = {};
        lines.forEach(line => {
          if (line.includes(':')) {
            const [key, value] = line.split(':');
            if (key && value !== undefined) {
              result[key] = isNaN(Number(value)) ? value : Number(value);
            }
          }
        });
        return result;
      };

      const memoryInfo = parseInfo(info);
      const keyspaceInfo = parseInfo(keyspace);
      const statsInfo = parseInfo(stats);

      // Get analysis cache counts
      const analysisKeys = await this.client.keys('analysis:*');
      const sessionKeys = await this.client.keys('session:*');
      const tempKeys = await this.client.keys('temp:*');

      return {
        memory: {
          used: memoryInfo.used_memory_human,
          peak: memoryInfo.used_memory_peak_human,
          rss: memoryInfo.used_memory_rss_human
        },
        connections: statsInfo.connected_clients,
        commands_processed: statsInfo.total_commands_processed,
        keyspace: keyspaceInfo,
        cache_counts: {
          analysis: analysisKeys.length,
          sessions: sessionKeys.length,
          temporary: tempKeys.length,
          total: analysisKeys.length + sessionKeys.length + tempKeys.length
        }
      };
    } catch (error) {
      logger.error('Failed to get Redis cache stats:', error);
      return { error: 'Failed to retrieve cache statistics' };
    }
  }

  /**
   * Clear all cached data (use with caution)
   */
  public async clearCache(pattern?: string): Promise<boolean> {
    if (!this.isConnected() || !this.client) {
      return false;
    }

    try {
      if (pattern) {
        const keys = await this.client.keys(pattern || '*');
        if (keys.length > 0) {
          await this.client.del(...keys);
          logger.info(`Cleared ${keys.length} cache entries matching pattern: ${pattern}`);
        }
      } else {
        await this.client.flushdb();
        logger.info('Cleared all cache data');
      }
      
      return true;
    } catch (error) {
      logger.error('Failed to clear cache:', error);
      return false;
    }
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<{ status: string; latency?: number; details?: any }> {
    if (!this.isConnected() || !this.client) {
      return { 
        status: 'disconnected',
        details: { 
          retries: this.connectionRetries,
          maxRetries: this.maxRetries 
        }
      };
    }

    try {
      const start = Date.now();
      await this.client.ping();
      const latency = Date.now() - start;

      return {
        status: 'connected',
        latency,
        details: {
          host: this.client.options.host,
          port: this.client.options.port,
          db: this.client.options.db
        }
      };
    } catch (error) {
      logger.error('Redis health check failed:', error);
      return { 
        status: 'error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }

  /**
   * Disconnect from Redis
   */
  public async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.connected = false;
      this.client = null;
      logger.info('Redis disconnected');
    }
  }

  /**
   * Get connection health status
   */
  public getHealthStatus(): { status: string; details?: any } {
    if (!config.database.redisUrl) {
      return { status: 'not_configured' };
    }

    if (!this.connected || !this.client) {
      return { 
        status: 'disconnected', 
        details: { 
          retries: this.connectionRetries,
          maxRetries: this.maxRetries
        }
      };
    }

    return { 
      status: 'connected',
      details: {
        host: this.client.options.host,
        port: this.client.options.port,
        db: this.client.options.db,
        status: this.client.status
      }
    };
  }
}

// Export singleton instance
export const redisService = RedisService.getInstance();