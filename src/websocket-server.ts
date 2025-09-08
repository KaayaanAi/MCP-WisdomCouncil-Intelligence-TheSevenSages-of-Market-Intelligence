import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import WebSocket, { WebSocketServer } from 'ws';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  Tool,
  JSONRPCMessage
} from "@modelcontextprotocol/sdk/types.js";

import { config, configForLogging } from "./config.js";
import { secureLogger } from "./utils/logger.js";
import { ToolResponse } from "./types/index.js";

// Import tools
import { multiAnalystConsensus } from "./tools/multi-analyst-consensus.js";
import { fetchBreakingNews } from "./tools/fetch-breaking-news.js";

/**
 * Custom WebSocket Transport implementation for MCP Server
 * Bridges WebSocket connections to MCP protocol
 */
class WebSocketMcpTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;  
  onmessage?: (message: JSONRPCMessage) => void;

  constructor(private readonly ws: WebSocket) {
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as JSONRPCMessage;
        this.onmessage?.(message);
      } catch (error) {
        this.onerror?.(new Error(`Invalid JSON message: ${error instanceof Error ? error.message : String(error)}`));
      }
    });

    this.ws.on('close', () => {
      this.onclose?.();
    });

    this.ws.on('error', (error) => {
      this.onerror?.(error);
    });
  }

  async start(): Promise<void> {
    // WebSocket is already connected when this transport is created
    return Promise.resolve();
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      if (this.ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      
      this.ws.once('close', () => resolve());
      this.ws.close();
    });
  }

  async send(message: JSONRPCMessage): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not open'));
        return;
      }

      this.ws.send(JSON.stringify(message), (error) => {
        if (error) {
          reject(new Error(`WebSocket send failed: ${error.message}`));
        } else {
          resolve();
        }
      });
    });
  }
}

/**
 * WebSocket MCP Server for real-time financial intelligence
 * Provides native WebSocket MCP protocol support for n8n-nodes-mcp and other real-time clients
 */
export class FinancialIntelligenceWebSocketServer {
  private readonly wsServer: WebSocketServer;
  private readonly connections: Set<WebSocket> = new Set();
  private readonly mcpServers: Map<WebSocket, Server> = new Map();
  
  constructor() {
    this.wsServer = new WebSocketServer({ 
      port: config.websocketPort,
      perMessageDeflate: false
    });
    
    this.setupConnectionHandlers();
  }
  
  private setupConnectionHandlers(): void {
    this.wsServer.on('connection', (ws: WebSocket, request) => {
      const clientInfo = {
        ip: request.socket.remoteAddress,
        userAgent: request.headers['user-agent'] || 'unknown'
      };
      
      secureLogger.info('WebSocket MCP client connected', clientInfo);
      
      // Add to active connections
      this.connections.add(ws);
      
      // Create MCP server instance for this connection
      const mcpServer = this.createMcpServerInstance();
      this.mcpServers.set(ws, mcpServer);
      
      // Create custom WebSocket MCP transport
      const transport = new WebSocketMcpTransport(ws);
      
      // Connect MCP server to WebSocket transport
      mcpServer.connect(transport).catch((error) => {
        secureLogger.error('Failed to connect MCP server to WebSocket transport', { 
          error: error.message,
          ...clientInfo 
        });
        ws.close();
      });
      
      // Handle connection close
      ws.on('close', (code, reason) => {
        secureLogger.info('WebSocket MCP client disconnected', { 
          code, 
          reason: reason.toString(),
          ...clientInfo 
        });
        
        this.connections.delete(ws);
        this.mcpServers.delete(ws);
      });
      
      // Handle connection errors
      ws.on('error', (error) => {
        secureLogger.error('WebSocket connection error', { 
          error: error.message,
          ...clientInfo 
        });
        
        this.connections.delete(ws);
        this.mcpServers.delete(ws);
      });
    });
    
    this.wsServer.on('error', (error) => {
      secureLogger.error('WebSocket server error', { 
        error: error.message, 
        port: config.websocketPort,
        code: (error as any).code 
      });
    });
  }
  
  private createMcpServerInstance(): Server {
    const server = new Server(
      {
        name: "mcp-nextgen-financial-intelligence",
        version: "2.0.2"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools: Tool[] = [
        {
          name: "multi_analyst_consensus",
          description: "🧠 Get comprehensive market analysis from 7 specialized AI analysts with consensus mechanism. Provides unified insights on market events, news, or conditions.",
          inputSchema: {
            type: "object",
            properties: {
              news_item: {
                type: "string",
                description: "The news item, market event, or condition to analyze"
              },
              analysis_depth: {
                type: "string",
                enum: ["quick", "standard", "deep"],
                description: "Depth of analysis: 'quick' (30s), 'standard' (60s), 'deep' (120s)"
              },
              sage_perspectives: {
                type: "array",
                items: {
                  type: "string",
                  enum: [
                    "political_analyst",
                    "economic_analyst", 
                    "geopolitical_analyst",
                    "financial_analyst",
                    "crypto_analyst",
                    "tech_analyst",
                    "behavioral_analyst"
                  ]
                },
                description: "Optional: Specify which analysts to include (default: all 7)"
              }
            },
            required: ["news_item"]
          }
        },
        {
          name: "fetch_breaking_news",
          description: "📰 Fetch and analyze breaking financial news from multiple RSS feeds and APIs. Provides prioritized, relevant market news with impact assessment.",
          inputSchema: {
            type: "object",
            properties: {
              category: {
                type: "string",
                enum: ["all", "stocks", "crypto", "forex", "commodities", "politics", "economics"],
                description: "News category to fetch (default: 'all')"
              },
              max_items: {
                type: "number",
                minimum: 1,
                maximum: 50,
                description: "Maximum number of news items to return (default: 10)"
              },
              time_range: {
                type: "string",
                enum: ["1h", "6h", "12h", "24h"],
                description: "Time range for news items (default: '6h')"
              },
              include_analysis: {
                type: "boolean",
                description: "Whether to include impact analysis for each news item (default: true)"
              }
            }
          }
        }
      ];
      
      return { tools };
    });
    
    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();
      
      try {
        secureLogger.info(`WebSocket MCP executing tool: ${name}`, { args });
        
        let result: ToolResponse;
        
        switch (name) {
          case "multi_analyst_consensus":
            result = await multiAnalystConsensus(args);
            break;
            
          case "fetch_breaking_news":
            result = await fetchBreakingNews(args);
            break;
            
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
        
        const duration = Date.now() - startTime;
        secureLogger.toolExecution(name, args, duration, true);
        
        return {
          content: result.content,
          isError: result.isError
        };
        
      } catch (error) {
        const duration = Date.now() - startTime;
        secureLogger.toolExecution(name, args, duration, false);
        secureLogger.error(`WebSocket MCP tool execution error: ${name}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `❌ **Error executing ${name}**: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
    });
    
    return server;
  }
  
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.wsServer.on('listening', () => {
        secureLogger.info("MCP Financial Intelligence WebSocket Server running", {
          mode: 'WebSocket MCP',
          port: config.websocketPort,
          endpoint: `ws://localhost:${config.websocketPort}`,
          config: configForLogging
        });
        resolve();
      });
      
      this.wsServer.on('error', (error) => {
        secureLogger.error('WebSocket server startup error', { 
          error: error.message, 
          port: config.websocketPort 
        });
        reject(error);
      });
    });
  }
  
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      // Close all active connections
      for (const ws of this.connections) {
        ws.close();
      }
      
      // Close the server
      this.wsServer.close(() => {
        secureLogger.info('WebSocket MCP server stopped gracefully');
        resolve();
      });
    });
  }
  
  getConnectionCount(): number {
    return this.connections.size;
  }
}

/**
 * Start the WebSocket MCP server (called from main index.ts when WEBSOCKET_MODE=true)
 */
export async function startWebSocketServer(): Promise<void> {
  try {
    const wsServer = new FinancialIntelligenceWebSocketServer();
    await wsServer.start();
    
    // Graceful shutdown handlers
    process.on('SIGTERM', async () => {
      secureLogger.info('SIGTERM received, shutting down WebSocket server gracefully');
      await wsServer.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      secureLogger.info('SIGINT received, shutting down WebSocket server gracefully');
      await wsServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    secureLogger.error('Failed to start WebSocket server', { error });
    process.exit(1);
  }
}