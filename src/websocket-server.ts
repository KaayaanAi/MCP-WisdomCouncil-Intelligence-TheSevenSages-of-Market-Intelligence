import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import WebSocket, { WebSocketServer } from 'ws';
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  JSONRPCMessage
} from "@modelcontextprotocol/sdk/types.js";

import { config, configForLogging } from "./config.js";
import { secureLogger } from "./utils/logger.js";
import { ToolResponse } from "./types/index.js";
import { StandardErrorHandler } from "./utils/error-handler.js";
import { SERVER_CONSTANTS } from "./constants/server-constants.js";

// Import shared definitions
import { TOOL_DEFINITIONS } from "./shared/tool-definitions.js";
import { UniversalToolExecutor } from "./shared/tool-executor.js";

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
        this.onerror?.(new Error(`Invalid JSON message: ${StandardErrorHandler.getErrorMessage(error)}`));
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
        name: SERVER_CONSTANTS.NAME,
        version: SERVER_CONSTANTS.VERSION
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    // List available tools
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOL_DEFINITIONS };
    });
    
    // Handle tool execution
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();
      
      try {
        secureLogger.info(`WebSocket MCP executing tool: ${name}`, { args });
        
        const result: ToolResponse = await UniversalToolExecutor.execute(name, args);
        
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
          error: StandardErrorHandler.getErrorMessage(error) 
        });
        
        return {
          content: [{ 
            type: "text", 
            text: `❌ **Error executing ${name}**: ${StandardErrorHandler.getErrorMessage(error)}` 
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