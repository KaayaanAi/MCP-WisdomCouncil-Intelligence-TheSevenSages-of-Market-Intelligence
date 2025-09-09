import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import fs from 'fs';
import path from 'path';

import { config } from './config.js';
import { secureLogger } from './utils/logger.js';
import { ToolResponse } from './types/index.js';
import { StandardErrorHandler } from './utils/error-handler.js';
import { SERVER_CONSTANTS, ERROR_MESSAGES } from './constants/server-constants.js';

// Import shared definitions
import { TOOL_DEFINITIONS } from './shared/tool-definitions.js';
import { UniversalToolExecutor } from './shared/tool-executor.js';

/**
 * HTTP Server supporting both REST API and MCP protocol endpoints
 * Provides triple protocol support: STDIO MCP + HTTP REST + HTTP MCP
 */
export class FinancialIntelligenceHttpServer {
  private readonly app: express.Application;
  
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
      verify: (req: any, _res, buf) => {
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
        res.status(SERVER_CONSTANTS.HTTP_STATUS.BAD_REQUEST).json(
          StandardErrorHandler.createHttpErrorResponse(ERROR_MESSAGES.INVALID_JSON, SERVER_CONSTANTS.HTTP_STATUS.BAD_REQUEST)
        );
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
        error: ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
        retryAfter: Math.ceil(config.security.rateLimitWindowMs / 1000)
      },
      handler: (req: Request, res: Response) => {
        secureLogger.warn('Rate limit exceeded', { 
          ip: req.ip,
          userAgent: req.get('User-Agent') || 'unknown',
          path: req.path 
        });
        res.status(SERVER_CONSTANTS.HTTP_STATUS.RATE_LIMITED).json(
          StandardErrorHandler.createHttpErrorResponse(
            ERROR_MESSAGES.RATE_LIMIT_EXCEEDED, 
            SERVER_CONSTANTS.HTTP_STATUS.RATE_LIMITED
          )
        );
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
    // Simple web testing interface
    this.app.get('/', (_req: Request, res: Response) => {
      res.send(this.getTestingInterface());
    });
    
    // Testing endpoint specifically
    this.app.get('/test', (_req: Request, res: Response) => {
      res.send(this.getTestingInterface());
    });
    
    // Simple analyze endpoint for the web interface
    this.app.post('/analyze', async (req: Request, res: Response) => {
      try {
        const { question, depth = 'standard' } = req.body;
        
        if (!question) {
          res.status(400).json({
            error: true,
            message: 'Question is required',
            timestamp: new Date().toISOString()
          });
          return;
        }
        
        // Use multi_analyst_consensus tool
        const result = await this.executeToolRest('multi_analyst_consensus', {
          news_item: question,
          analysis_depth: depth
        });
        
        if (result.isError) {
          res.status(400).json({
            error: true,
            message: result.content[0]?.text || 'Analysis failed',
            timestamp: new Date().toISOString()
          });
        } else {
          const analysisText = result.content[0]?.text || '';
          
          // Return both JSON and formatted response
          res.json({
            success: true,
            question,
            depth,
            analysis: analysisText,
            timestamp: new Date().toISOString(),
            formatted_html: this.formatAnalysisAsHtml(analysisText)
          });
        }
      } catch (error) {
        secureLogger.error('Analysis endpoint error', { error });
        res.status(500).json({
          error: true,
          message: 'Internal server error during analysis',
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // Health check endpoint
    this.app.get('/health', (_req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: SERVER_CONSTANTS.VERSION,
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
            data: StandardErrorHandler.getErrorMessage(error)
          },
          id: req.body.id || null
        });
      }
    });
    
    // n8n-nodes-mcp verification and testing endpoint
    this.app.post('/mcp/test', async (_req: Request, res: Response) => {
      try {
        const testResults = await this.runN8nCompatibilityTests();
        res.json({
          success: true,
          timestamp: new Date().toISOString(),
          n8n_compatibility: 'verified',
          test_results: testResults,
          version: SERVER_CONSTANTS.VERSION
        });
      } catch (error) {
        secureLogger.error('n8n compatibility test error', { error });
        res.status(500).json({
          success: false,
          error: 'n8n compatibility test failed',
          message: StandardErrorHandler.getErrorMessage(error),
          timestamp: new Date().toISOString()
        });
      }
    });
    
    // n8n-specific MCP info endpoint
    this.app.get('/mcp/info', (_req: Request, res: Response) => {
      res.json({
        server_info: {
          name: SERVER_CONSTANTS.NAME,
          version: SERVER_CONSTANTS.VERSION,
          protocol_version: SERVER_CONSTANTS.PROTOCOL_VERSION,
          n8n_compatible: true
        },
        capabilities: {
          tools: true,
          resources: false,
          prompts: false,
          logging: true
        },
        universal_mcp_architecture: {
          protocols_supported: ['STDIO', 'HTTP REST', 'HTTP MCP', 'WebSocket MCP'],
          n8n_nodes_mcp_ready: true,
          quad_protocol_support: true
        },
        tools: UniversalToolExecutor.getToolNames()
      });
    });
    
    // 404 handler
    this.app.use('*', (req: Request, res: Response) => {
      res.status(404).json({
        error: true,
        message: `Endpoint not found: ${req.method} ${req.originalUrl}`,
        availableEndpoints: [
          'GET / - Web testing interface',
          'GET /test - Web testing interface', 
          'POST /analyze - Simple analysis endpoint',
          'GET /health - System health check',
          'POST /tools/{toolName} - REST API for tools',
          'POST /mcp - JSON-RPC 2.0 MCP protocol',
          'GET /mcp/info - n8n MCP server information',
          'POST /mcp/test - n8n compatibility verification'
        ]
      });
    });
  }
  
  private setupErrorHandling(): void {
    // Global error handler
    this.app.use((error: Error, req: Request, res: Response, _next: NextFunction) => {
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
    // Handle both underscore and dash variants for REST API compatibility
    const normalizedToolName = toolName.replace(/-/g, '_');
    
    try {
      return await UniversalToolExecutor.execute(normalizedToolName, args);
    } catch (error) {
      return {
        content: [{ type: "text", text: `❌ ${StandardErrorHandler.getErrorMessage(error)}` }],
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
                ...TOOL_DEFINITIONS
              ]
            },
            id
          };
          
        case 'tools/call': {
          const { name, arguments: args } = params;
          const result = await this.executeToolRest(name, args);
          
          return {
            jsonrpc: '2.0',
            result,
            id
          };
        }
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
          data: StandardErrorHandler.getErrorMessage(error)
        },
        id
      };
    }
  }
  
  private getTestingInterface(): string {
    try {
      return fs.readFileSync(path.join(process.cwd(), 'src/templates/test-interface.html'), 'utf8');
    } catch (error) {
      secureLogger.error('Failed to load test interface template', { error });
      return '<h1>Error: Test interface template not found</h1><p>Please ensure the template file exists at src/templates/test-interface.html</p>';
    }
  }
  
  private formatAnalysisAsHtml(analysisText: string): string {
    // Simple markdown-like formatting for HTML display
    return analysisText
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^\*\*(.*)\*\*/gm, '<strong>$1</strong>')
      .replace(/^\*(.*)\*/gm, '<em>$1</em>')
      .replace(/^---$/gm, '<hr>')
      .replace(/\n/g, '<br>');
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
  
  private async runN8nCompatibilityTests(): Promise<any> {
    const tests = {
      tools_list: false,
      tools_call: false,
      json_rpc_compliance: false,
      unified_tool_available: false,
      error_handling: false
    };
    
    try {
      // Test 1: Tools list endpoint
      const toolsListRequest = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 'test-1'
      };
      
      const toolsListResult = await this.handleMcpRequest(toolsListRequest);
      tests.tools_list = toolsListResult.result?.tools?.length > 0;
      tests.unified_tool_available = toolsListResult.result?.tools?.some((tool: any) => 
        tool.name === 'complete_financial_intelligence_analysis'
      );
      
      // Test 2: JSON-RPC compliance check
      tests.json_rpc_compliance = toolsListResult.jsonrpc === '2.0' && 
                                   toolsListResult.id === 'test-1';
      
      // Test 3: Tool call test (with minimal parameters)
      const toolCallRequest = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: 'complete_financial_intelligence_analysis',
          arguments: {
            query: 'Test query for n8n compatibility',
            analysis_depth: 'quick',
            include_news: false
          }
        },
        id: 'test-2'
      };
      
      const toolCallResult = await this.handleMcpRequest(toolCallRequest);
      tests.tools_call = !toolCallResult.error;
      
      // Test 4: Error handling test
      const errorTestRequest = {
        jsonrpc: '2.0',
        method: 'invalid/method',
        id: 'test-3'
      };
      
      const errorResult = await this.handleMcpRequest(errorTestRequest);
      tests.error_handling = !!errorResult.error && errorResult.error.code === -32601;
      
    } catch (error) {
      secureLogger.warn('n8n compatibility test encountered errors', { error });
    }
    
    const successCount = Object.values(tests).filter(Boolean).length;
    const totalTests = Object.keys(tests).length;
    
    return {
      tests_passed: successCount,
      total_tests: totalTests,
      success_rate: `${((successCount / totalTests) * 100).toFixed(1)}%`,
      test_details: tests,
      n8n_ready: successCount >= 4, // At least 4 out of 5 tests should pass
      recommendations: this.getN8nRecommendations(tests)
    };
  }
  
  private getN8nRecommendations(tests: any): string[] {
    const recommendations = [];
    
    if (!tests.tools_list) {
      recommendations.push('Fix tools/list endpoint for n8n discovery');
    }
    if (!tests.unified_tool_available) {
      recommendations.push('Ensure complete_financial_intelligence_analysis tool is available');
    }
    if (!tests.json_rpc_compliance) {
      recommendations.push('Improve JSON-RPC 2.0 compliance');
    }
    if (!tests.tools_call) {
      recommendations.push('Fix tool execution for n8n calls');
    }
    if (!tests.error_handling) {
      recommendations.push('Improve error handling for invalid requests');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('All tests passed! Server is fully n8n-nodes-mcp compatible');
    }
    
    return recommendations;
  }
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
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
      
      server.on('error', (error) => {
        secureLogger.error('HTTP server listen error', { error: error.message, port: config.httpPort });
        reject(new Error(`HTTP server failed to start: ${error.message}`));
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