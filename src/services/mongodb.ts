import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config.js';
import { secureLogger as logger } from '../utils/logger.js';

/**
 * MongoDB Database Integration Service
 * Provides persistent storage for analysis results, user sessions, and system metrics
 */

// Analysis Result Schema
export interface IAnalysisResult extends Document {
  query: string;
  analysisType: string;
  result: any;
  metadata: {
    timestamp: Date;
    processingTime: number;
    tokensUsed?: number;
    provider: string;
    cached: boolean;
  };
  expiresAt: Date;
}

const AnalysisResultSchema = new Schema<IAnalysisResult>({
  query: { type: String, required: true, index: true },
  analysisType: { type: String, required: true, enum: ['consensus', 'breaking_news', 'complete_intelligence'] },
  result: { type: Schema.Types.Mixed, required: true },
  metadata: {
    timestamp: { type: Date, default: Date.now, index: true },
    processingTime: { type: Number, required: true },
    tokensUsed: { type: Number },
    provider: { type: String, required: true },
    cached: { type: Boolean, default: false }
  },
  expiresAt: { 
    type: Date, 
    default: () => new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    expires: 0 
  }
});

// User Session Schema for tracking API usage
export interface IUserSession extends Document {
  sessionId: string;
  ipAddress: string;
  userAgent?: string;
  requests: Array<{
    timestamp: Date;
    endpoint: string;
    query?: string;
    processingTime: number;
    success: boolean;
  }>;
  totalRequests: number;
  lastActivity: Date;
  createdAt: Date;
}

const UserSessionSchema = new Schema<IUserSession>({
  sessionId: { type: String, required: true, unique: true },
  ipAddress: { type: String, required: true, index: true },
  userAgent: { type: String },
  requests: [{
    timestamp: { type: Date, default: Date.now },
    endpoint: { type: String, required: true },
    query: { type: String },
    processingTime: { type: Number, required: true },
    success: { type: Boolean, required: true }
  }],
  totalRequests: { type: Number, default: 0 },
  lastActivity: { type: Date, default: Date.now, index: true },
  createdAt: { type: Date, default: Date.now }
});

// System Metrics Schema
export interface ISystemMetrics extends Document {
  timestamp: Date;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageProcessingTime: number;
    uniqueUsers: number;
    tokensUsed: number;
    aiProviderStats: Record<string, { requests: number; tokens: number; errors: number }>;
  };
  period: 'hour' | 'day' | 'week' | 'month';
}

const SystemMetricsSchema = new Schema<ISystemMetrics>({
  timestamp: { type: Date, required: true, index: true },
  metrics: {
    totalRequests: { type: Number, default: 0 },
    successfulRequests: { type: Number, default: 0 },
    failedRequests: { type: Number, default: 0 },
    averageProcessingTime: { type: Number, default: 0 },
    uniqueUsers: { type: Number, default: 0 },
    tokensUsed: { type: Number, default: 0 },
    aiProviderStats: { type: Schema.Types.Mixed, default: {} }
  },
  period: { type: String, required: true, enum: ['hour', 'day', 'week', 'month'] }
});

// Model exports
export const AnalysisResult = mongoose.model<IAnalysisResult>('AnalysisResult', AnalysisResultSchema);
export const UserSession = mongoose.model<IUserSession>('UserSession', UserSessionSchema);
export const SystemMetrics = mongoose.model<ISystemMetrics>('SystemMetrics', SystemMetricsSchema);

/**
 * MongoDB Database Manager
 */
export class MongoDBService {
  private static instance: MongoDBService;
  private connected = false;
  private connectionRetries = 0;
  private maxRetries = 5;

  private constructor() {}

  public static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  /**
   * Initialize MongoDB connection
   */
  public async connect(): Promise<boolean> {
    if (!config.database.mongoUri) {
      logger.warn('MongoDB URI not configured, skipping MongoDB connection');
      return false;
    }

    if (this.connected) {
      return true;
    }

    try {
      await mongoose.connect(config.database.mongoUri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        bufferCommands: false
      });

      this.connected = true;
      this.connectionRetries = 0;
      
      logger.info('MongoDB connected successfully', {
        database: mongoose.connection.db?.databaseName,
        host: mongoose.connection.host,
        port: mongoose.connection.port
      });

      // Set up connection event listeners
      mongoose.connection.on('error', (error) => {
        logger.error('MongoDB connection error:', error);
        this.connected = false;
      });

      mongoose.connection.on('disconnected', () => {
        logger.warn('MongoDB disconnected');
        this.connected = false;
        this.handleReconnection();
      });

      return true;
    } catch (error) {
      logger.error('MongoDB connection failed:', error);
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
      logger.error('Max MongoDB reconnection attempts reached');
      return;
    }

    this.connectionRetries++;
    const delay = Math.min(1000 * Math.pow(2, this.connectionRetries), 30000);
    
    logger.info(`Attempting MongoDB reconnection in ${delay}ms (attempt ${this.connectionRetries}/${this.maxRetries})`);
    
    setTimeout(async () => {
      await this.connect();
    }, delay);
  }

  /**
   * Check if MongoDB is connected
   */
  public isConnected(): boolean {
    return this.connected && mongoose.connection.readyState === 1;
  }

  /**
   * Store analysis result in MongoDB
   */
  public async storeAnalysisResult(
    query: string,
    analysisType: string,
    result: any,
    metadata: {
      processingTime: number;
      tokensUsed?: number;
      provider: string;
    }
  ): Promise<string | null> {
    if (!this.isConnected()) {
      logger.warn('MongoDB not connected, skipping analysis storage');
      return null;
    }

    try {
      const analysisResult = new AnalysisResult({
        query,
        analysisType,
        result,
        metadata: {
          ...metadata,
          timestamp: new Date(),
          cached: false
        }
      });

      await analysisResult.save();
      logger.info('Analysis result stored in MongoDB', { 
        id: analysisResult._id,
        type: analysisType,
        queryLength: query.length
      });

      return String(analysisResult._id);
    } catch (error) {
      logger.error('Failed to store analysis result in MongoDB:', error);
      return null;
    }
  }

  /**
   * Retrieve cached analysis result
   */
  public async getCachedAnalysis(query: string, analysisType: string): Promise<any | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const cached = await AnalysisResult.findOne({
        query,
        analysisType,
        expiresAt: { $gt: new Date() }
      }).sort({ 'metadata.timestamp': -1 });

      if (cached) {
        logger.info('Cache hit: Analysis result retrieved from MongoDB', {
          id: cached._id,
          type: analysisType,
          age: Date.now() - cached.metadata.timestamp.getTime()
        });
        return cached.result;
      }

      return null;
    } catch (error) {
      logger.error('Failed to retrieve cached analysis from MongoDB:', error);
      return null;
    }
  }

  /**
   * Track user session and API usage
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
    if (!this.isConnected()) {
      return;
    }

    try {
      const request = {
        timestamp: new Date(),
        endpoint,
        query,
        processingTime,
        success
      };

      await UserSession.findOneAndUpdate(
        { sessionId },
        {
          $set: {
            ipAddress,
            userAgent,
            lastActivity: new Date()
          },
          $push: { requests: request },
          $inc: { totalRequests: 1 },
          $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true, new: true }
      );

      logger.debug('User session tracked in MongoDB', { sessionId, endpoint, success });
    } catch (error) {
      logger.error('Failed to track user session in MongoDB:', error);
    }
  }

  /**
   * Get system analytics and metrics
   */
  public async getSystemMetrics(period: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<any> {
    if (!this.isConnected()) {
      return { error: 'Database not connected' };
    }

    try {
      const now = new Date();
      let startDate: Date;

      switch (period) {
        case 'hour':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case 'day':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Aggregate metrics from user sessions
      const [sessionMetrics] = await UserSession.aggregate([
        { $match: { lastActivity: { $gte: startDate } } },
        {
          $project: {
            requests: {
              $filter: {
                input: '$requests',
                cond: { $gte: ['$$this.timestamp', startDate] }
              }
            },
            ipAddress: 1
          }
        },
        {
          $unwind: '$requests'
        },
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successfulRequests: { $sum: { $cond: ['$requests.success', 1, 0] } },
            failedRequests: { $sum: { $cond: ['$requests.success', 0, 1] } },
            averageProcessingTime: { $avg: '$requests.processingTime' },
            uniqueUsers: { $addToSet: '$ipAddress' }
          }
        },
        {
          $project: {
            totalRequests: 1,
            successfulRequests: 1,
            failedRequests: 1,
            averageProcessingTime: { $round: ['$averageProcessingTime', 2] },
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        }
      ]);

      // Get analysis metrics
      const analysisMetrics = await AnalysisResult.aggregate([
        { $match: { 'metadata.timestamp': { $gte: startDate } } },
        {
          $group: {
            _id: '$metadata.provider',
            requests: { $sum: 1 },
            tokens: { $sum: '$metadata.tokensUsed' },
            errors: { $sum: { $cond: [{ $eq: ['$result.isError', true] }, 1, 0] } }
          }
        }
      ]);

      const aiProviderStats: Record<string, any> = {};
      analysisMetrics.forEach(stat => {
        aiProviderStats[stat._id] = {
          requests: stat.requests,
          tokens: stat.tokens || 0,
          errors: stat.errors
        };
      });

      return {
        period,
        timeRange: { start: startDate, end: now },
        metrics: {
          totalRequests: sessionMetrics?.totalRequests || 0,
          successfulRequests: sessionMetrics?.successfulRequests || 0,
          failedRequests: sessionMetrics?.failedRequests || 0,
          averageProcessingTime: sessionMetrics?.averageProcessingTime || 0,
          uniqueUsers: sessionMetrics?.uniqueUsers || 0,
          tokensUsed: Object.values(aiProviderStats).reduce((sum: number, stat: any) => sum + stat.tokens, 0),
          aiProviderStats
        }
      };
    } catch (error) {
      logger.error('Failed to get system metrics from MongoDB:', error);
      return { error: 'Failed to retrieve metrics' };
    }
  }

  /**
   * Clean up expired data
   */
  public async cleanup(): Promise<void> {
    if (!this.isConnected()) {
      return;
    }

    try {
      // MongoDB TTL index handles AnalysisResult cleanup automatically
      
      // Clean up old user sessions (older than 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await UserSession.deleteMany({ lastActivity: { $lt: thirtyDaysAgo } });

      // Clean up old system metrics (older than 1 year)
      const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      await SystemMetrics.deleteMany({ timestamp: { $lt: oneYearAgo } });

      logger.info('MongoDB cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup MongoDB:', error);
    }
  }

  /**
   * Disconnect from MongoDB
   */
  public async disconnect(): Promise<void> {
    if (this.connected) {
      await mongoose.disconnect();
      this.connected = false;
      logger.info('MongoDB disconnected');
    }
  }

  /**
   * Get connection health status
   */
  public getHealthStatus(): { status: string; details?: any } {
    if (!config.database.mongoUri) {
      return { status: 'not_configured' };
    }

    if (!this.connected) {
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
        database: mongoose.connection.db?.databaseName,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        readyState: mongoose.connection.readyState
      }
    };
  }
}

// Export singleton instance
export const mongoService = MongoDBService.getInstance();