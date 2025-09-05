import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { config } from './config.js';
import { secureLogger } from './utils/logger.js';
import { ToolResponse } from './types/index.js';
import { multiAnalystConsensus } from './tools/multi-analyst-consensus.js';
import { fetchBreakingNews } from './tools/fetch-breaking-news.js';

/**
 * HTTP Server supporting both REST API and MCP protocol endpoints
 * Provides triple protocol support: STDIO MCP + HTTP REST + HTTP MCP
 */
export class FinancialIntelligenceHttpServer {
  private app: express.Application;
  
  constructor() {
    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }
  
  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization']
    }));
    
    // JSON parsing with size limits
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req: any, res, buf) => {
        req.rawBody = buf;
      }
    }));
    
    // JSON parsing error handler middleware
    this.app.use((err: any, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        secureLogger.error('JSON parsing error', { 
          error: err.message, 
          path: req.path,
          ip: req.ip 
        });
        res.status(400).json({
          error: true,
          message: 'Invalid JSON format. Please check your request body.',
          timestamp: new Date().toISOString()
        });
        return;
      }
      next(err);
    });
    
    // URL encoding
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // IP-based rate limiting
    const limiter = rateLimit({
      windowMs: config.security.rateLimitWindowMs,
      max: config.security.rateLimitMaxRequests,
      standardHeaders: true,
      legacyHeaders: false,
      keyGenerator: (req: Request) => {
        // Use X-Forwarded-For header if behind proxy, otherwise use IP
        return req.ip || 'unknown';
      },
      message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
      },
      handler: (req: Request, res: Response) => {
        secureLogger.warn('Rate limit exceeded', { 
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'unknown',
          path: req.path 
        });
        res.status(429).json({
          error: 'Too many requests from this IP, please try again later.',
          retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
        });
      }
    });
    
    this.app.use(limiter);
    
    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        secureLogger.info('HTTP Request', {
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'unknown'
        });
      });
      
      next();
    });
  }
  
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        services: {
          server: 'running',
          ai_providers: this.checkAIProvidersHealth(),
          databases: this.checkDatabaseHealth()
        }
      };
      
      res.json(healthStatus);
    });
    
    // REST API endpoints for individual tools
    this.app.post('/tools/:toolName', async (req: Request, res: Response) => {
      const { toolName } = req.params;
      
      if (!toolName) {
        res.status(400).json({
          error: true,
          message: 'Tool name is required',
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const args = req.body;
      
      try {
        const result = await this.executeToolRest(toolName, args);
        
        if (result.isError) {
          res.status(400).json({
            error: true,
            message: result.content[0]?.text || 'Tool execution failed',
            timestamp: new Date().toISOString()
          });
        } else {
          res.json({
            success: true,
            data: result.content[0]?.text || '',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        secureLogger.error(`REST API tool execution error: ${toolName}`, { error });
        res.status(500).json({
          error: true,
          message: 'Internal server error during tool execution',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // MCP Protocol endpoint (JSON-RPC 2.0)
    this.app.post('/mcp', async (req: Request, res: Response) => {
      try {
        const result = await this.handleMcpRequest(req.body);
        res.json(result);
      } catch (error) {
        secureLogger.error('MCP protocol error', { error });
        
        // JSON-RPC 2.0 error response
        res.json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Internal error',
            data: error instanceof Error ? error.message : String(error)
          },
          id: req.body.id || null
        });
      }
    });
    
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: true,
        message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
          'GET /health',
          'POST /tools/{toolName}',
          'POST /mcp'
        ]
      });
    });
  }
  
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      secureLogger.error('Unhandled HTTP error', { 
        error: error.message,
        stack: error.stack,
        path: req.path,
        method: req.method
      });
      
      res.status(500).json({
        error: true,
        message: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    });
  }
  
  private async executeToolRest(toolName: string, args: any): Promise<ToolResponse> {
    // Use the actual tool implementations
    switch (toolName) {
      case 'multi_analyst_consensus':
      case 'multi-analyst-consensus':
        return await multiAnalystConsensus(args);
        
      case 'fetch_breaking_news':
      case 'fetch-breaking-news':
        return await fetchBreakingNews(args);
        
      default:
        return {
          content: [{ type: "text", text: `❌ Unknown tool: ${toolName}` }],
          isError: true
        };
    }
  }
  
  private async handleMcpRequest(body: any): Promise<any> {
    const { jsonrpc, method, params, id } = body;
    
    // Validate JSON-RPC 2.0 format
    if (jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Invalid Request' },
        id
      };
    }
    
    try {
      switch (method) {
        case 'tools/list':
          return {
            jsonrpc: '2.0',
            result: {
              tools: [
                {
                  name: "multi_analyst_consensus",
                  description: "🧠 Get comprehensive market analysis from 7 specialized AI analysts with consensus mechanism",
                  inputSchema: {
                    type: "object",
                    properties: {
                      news_item: { type: "string", description: "The news item to analyze" },
                      analysis_depth: { type: "string", enum: ["quick", "standard", "deep"] },
                      sage_perspectives: { 
                        type: "array", 
                        items: { type: "string" },
                        description: "Optional analyst selection"
                      }
                    },
                    required: ["news_item"]
                  }
                },
                {
                  name: "fetch_breaking_news",
                  description: "📰 Fetch and analyze breaking financial news from multiple sources",
                  inputSchema: {
                    type: "object",
                    properties: {
                      category: { type: "string", enum: ["all", "stocks", "crypto", "forex", "commodities", "politics", "economics"] },
                      max_items: { type: "number", minimum: 1, maximum: 50 },
                      time_range: { type: "string", enum: ["1h", "6h", "12h", "24h"] },
                      include_analysis: { type: "boolean" }
                    }
                  }
                }
              ]
            },
            id
          };
          
        case 'tools/call':
          const { name, arguments: args } = params;
          const result = await this.executeToolRest(name, args);
          
          return {
            jsonrpc: '2.0',
            result,
            id
          };
          
        default:
          return {
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id
          };
      }
    } catch (error) {
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error)
        },
        id
      };
    }
  }
  
  
  private checkAIProvidersHealth(): Record<string, string> {
    const providers: Record<string, string> = {};
    
    if (config.aiProviders.openai.enabled) {
      providers.openai = 'configured';
    }
    if (config.aiProviders.gemini.enabled) {
      providers.gemini = 'configured';
    }
    if (config.aiProviders.deepseek.enabled) {
      providers.deepseek = 'configured';
    }
    if (config.aiProviders.groq.enabled) {
      providers.groq = 'configured';
    }
    if (config.aiProviders.openrouter.enabled) {
      providers.openrouter = 'configured';
    }
    
    return providers;
  }
  
  private checkDatabaseHealth(): Record<string, string> {
    const databases: Record<string, string> = {};
    
    if (config.database.mongoUri) {
      databases.mongodb = 'configured';
    }
    if (config.database.redisUrl) {
      databases.redis = 'configured';
    }
    
    return databases;
  }
  
  async start(): Promise<void> {
    return new Promise((resolve) => {
      const server = this.app.listen(config.httpPort, '0.0.0.0', () => {
        secureLogger.info(`MCP Financial Intelligence HTTP Server running`, {
          port: config.httpPort,
          endpoints: [
            `GET http://localhost:${config.httpPort}/health`,
            `POST http://localhost:${config.httpPort}/tools/{toolName}`,
            `POST http://localhost:${config.httpPort}/mcp`
          ]
        });
        resolve();
      });
      
      // Graceful shutdown
      process.on('SIGTERM', () => {
        secureLogger.info('SIGTERM received, shutting down HTTP server gracefully');
        server.close(() => {
          process.exit(0);
        });
      });
    });
  }
}

/**
 * Start the HTTP server (called from main index.ts when HTTP_MODE=true)
 */
export async function startHttpServer(): Promise<void> {
  try {
    const httpServer = new FinancialIntelligenceHttpServer();
    await httpServer.start();
  } catch (error) {
    secureLogger.error('Failed to start HTTP server', { error });
    process.exit(1);
  }
}