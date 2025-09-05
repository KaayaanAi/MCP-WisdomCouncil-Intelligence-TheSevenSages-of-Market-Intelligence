import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

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
    // Simple web testing interface
    this.app.get('/', (req: Request, res: Response) => {
      res.send(this.getTestingInterface());
    });
    
    // Testing endpoint specifically
    this.app.get('/test', (req: Request, res: Response) => {
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
    this.app.get('/health', (req: Request, res: Response) => {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.1',
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
          'GET / - Web testing interface',
          'GET /test - Web testing interface', 
          'POST /analyze - Simple analysis endpoint',
          'GET /health - System health check',
          'POST /tools/{toolName} - REST API for tools',
          'POST /mcp - JSON-RPC 2.0 MCP protocol'
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
          data: error instanceof Error ? error.message : String(error)
        },
        id
      };
    }
  }
  
  private getTestingInterface(): string {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MCP NextGen Financial Intelligence - Test Interface</title>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh; 
                padding: 20px;
            }
            .container { 
                max-width: 1200px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                overflow: hidden;
            }
            .header { 
                background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
                color: white; 
                padding: 30px; 
                text-align: center; 
            }
            .header h1 { font-size: 2.5em; margin-bottom: 10px; }
            .header p { opacity: 0.9; font-size: 1.1em; }
            .content { padding: 30px; }
            .form-group { margin-bottom: 25px; }
            .form-group label { 
                display: block; 
                margin-bottom: 8px; 
                font-weight: 600; 
                color: #2c3e50;
                font-size: 1.1em;
            }
            .form-control { 
                width: 100%; 
                padding: 15px; 
                border: 2px solid #e1e8ed; 
                border-radius: 8px; 
                font-size: 16px;
                transition: border-color 0.3s ease;
            }
            .form-control:focus { 
                outline: none; 
                border-color: #3498db; 
                box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.1);
            }
            textarea.form-control { 
                min-height: 120px; 
                resize: vertical; 
                font-family: inherit;
            }
            select.form-control { height: 50px; }
            .btn { 
                background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                color: white; 
                padding: 15px 30px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 600;
                cursor: pointer; 
                transition: all 0.3s ease;
                display: inline-block;
                text-decoration: none;
            }
            .btn:hover { 
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(52, 152, 219, 0.4);
            }
            .btn:disabled { 
                opacity: 0.6; 
                cursor: not-allowed; 
                transform: none;
            }
            .loading { display: none; color: #3498db; margin: 20px 0; text-align: center; }
            .loading.show { display: block; }
            .result { 
                margin-top: 30px; 
                padding: 25px; 
                background: #f8f9fa; 
                border-radius: 8px; 
                border-left: 4px solid #3498db;
                display: none; 
            }
            .result.show { display: block; }
            .result.error { 
                background: #fee; 
                border-left-color: #e74c3c;
            }
            .result h3 { 
                margin-bottom: 15px; 
                color: #2c3e50;
                font-size: 1.3em;
            }
            .result-content { 
                white-space: pre-wrap; 
                line-height: 1.6; 
                font-size: 14px;
            }
            .timestamp { 
                color: #7f8c8d; 
                font-size: 0.9em; 
                margin-top: 15px; 
                font-style: italic;
            }
            .examples { 
                background: #f1f2f6; 
                padding: 20px; 
                border-radius: 8px; 
                margin-bottom: 25px;
            }
            .examples h3 { 
                color: #2c3e50; 
                margin-bottom: 15px;
                font-size: 1.2em;
            }
            .example-btn { 
                background: #ecf0f1; 
                color: #2c3e50; 
                padding: 8px 15px; 
                margin: 5px; 
                border: 1px solid #bdc3c7; 
                border-radius: 5px; 
                cursor: pointer; 
                font-size: 13px;
                transition: all 0.2s ease;
            }
            .example-btn:hover { 
                background: #d5dbdb; 
                border-color: #95a5a6;
            }
            @media (max-width: 768px) {
                .container { margin: 10px; }
                .header { padding: 20px; }
                .header h1 { font-size: 2em; }
                .content { padding: 20px; }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🧠 MCP Financial Intelligence</h1>
                <p>Test Interface - Advanced AI Financial Analysis with Temporal Awareness</p>
            </div>
            <div class="content">
                <div class="examples">
                    <h3>📋 Example Questions</h3>
                    <button type="button" class="example-btn" onclick="setExample('What is the impact of upcoming NFP data on USD?')">NFP Impact Analysis</button>
                    <button type="button" class="example-btn" onclick="setExample('How will Federal Reserve policy affect crypto markets?')">Fed Policy & Crypto</button>
                    <button type="button" class="example-btn" onclick="setExample('Analyze the geopolitical risks affecting oil prices')">Geopolitical Oil Analysis</button>
                    <button type="button" class="example-btn" onclick="setExample('What are the implications of AI developments on tech stocks?')">AI Tech Impact</button>
                    <button type="button" class="example-btn" onclick="setExample('Behavioral analysis of current market sentiment')">Market Sentiment</button>
                </div>
                
                <form id="analysisForm">
                    <div class="form-group">
                        <label for="question">Financial Question or Market Event</label>
                        <textarea id="question" name="question" class="form-control" placeholder="Enter your financial question, market event, or news to analyze..." required></textarea>
                    </div>
                    <div class="form-group">
                        <label for="depth">Analysis Depth</label>
                        <select id="depth" name="depth" class="form-control">
                            <option value="quick">⚡ Quick Analysis (30s) - Basic overview</option>
                            <option value="standard" selected>🔍 Standard Analysis (60s) - Comprehensive insights</option>
                            <option value="deep">🔬 Deep Analysis (120s) - Detailed multi-perspective</option>
                        </select>
                    </div>
                    <button type="submit" class="btn" id="analyzeBtn">
                        🚀 Analyze with 7 AI Sages
                    </button>
                </form>
                
                <div id="loading" class="loading">
                    <p>🤖 Consulting with 7 specialized AI analysts...</p>
                    <p><small>This may take 30-120 seconds depending on analysis depth</small></p>
                </div>
                
                <div id="result" class="result">
                    <h3 id="resultTitle">Analysis Results</h3>
                    <div id="resultContent" class="result-content"></div>
                    <div id="timestamp" class="timestamp"></div>
                </div>
            </div>
        </div>

        <script>
            function setExample(text) {
                document.getElementById('question').value = text;
            }

            document.getElementById('analysisForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const question = document.getElementById('question').value;
                const depth = document.getElementById('depth').value;
                const analyzeBtn = document.getElementById('analyzeBtn');
                const loading = document.getElementById('loading');
                const result = document.getElementById('result');
                const resultContent = document.getElementById('resultContent');
                const resultTitle = document.getElementById('resultTitle');
                const timestamp = document.getElementById('timestamp');
                
                // Show loading state
                analyzeBtn.disabled = true;
                analyzeBtn.textContent = '🔄 Analyzing...';
                loading.classList.add('show');
                result.classList.remove('show', 'error');
                
                try {
                    const response = await fetch('/analyze', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ question, depth })
                    });
                    
                    const data = await response.json();
                    
                    if (data.success) {
                        resultTitle.textContent = \`✅ Analysis Results (\${depth.toUpperCase()})\`;
                        resultContent.textContent = data.analysis;
                        timestamp.textContent = \`Generated: \${new Date(data.timestamp).toLocaleString()}\`;
                        result.classList.add('show');
                    } else {
                        resultTitle.textContent = '❌ Analysis Error';
                        resultContent.textContent = data.message;
                        timestamp.textContent = \`Error Time: \${new Date(data.timestamp).toLocaleString()}\`;
                        result.classList.add('show', 'error');
                    }
                } catch (error) {
                    resultTitle.textContent = '❌ Network Error';
                    resultContent.textContent = 'Failed to connect to the analysis server. Please try again.';
                    timestamp.textContent = \`Error Time: \${new Date().toLocaleString()}\`;
                    result.classList.add('show', 'error');
                }
                
                // Reset button state
                analyzeBtn.disabled = false;
                analyzeBtn.textContent = '🚀 Analyze with 7 AI Sages';
                loading.classList.remove('show');
            });
        </script>
    </body>
    </html>
    `;
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