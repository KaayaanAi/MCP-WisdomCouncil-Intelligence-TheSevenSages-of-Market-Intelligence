#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";

import { config, configForLogging } from "./config.js";
import { secureLogger } from "./utils/logger.js";
import { ToolResponse } from "./types/index.js";

// Import shared definitions
import { TOOL_DEFINITIONS } from "./shared/tool-definitions.js";
import { UniversalToolExecutor } from "./shared/tool-executor.js";

/**
 * MCP NextGen Financial Intelligence Server
 * Provides advanced financial analysis through 7 specialized AI analyst personas
 */
class FinancialIntelligenceServer {
  private readonly server: Server;
  
  constructor() {
    this.server = new Server(
      {
        name: "mcp-nextgen-financial-intelligence",
        version: "3.0.0"
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );
    
    this.setupHandlers();
  }
  
  private setupHandlers(): void {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return { tools: TOOL_DEFINITIONS };
    });
    
    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const startTime = Date.now();
      
      try {
        secureLogger.info(`Executing tool: ${name}`, { args });
        
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
        secureLogger.error(`Tool execution error: ${name}`, { error: error instanceof Error ? error.message : String(error) });
        
        return {
          content: [{ 
            type: "text", 
            text: `❌ **Error executing ${name}**: ${error instanceof Error ? error.message : String(error)}` 
          }],
          isError: true
        };
      }
    });
  }
  
  
  async start(): Promise<void> {
    // Check for Universal mode (all protocols)
    if (config.universalMode) {
      secureLogger.info("Universal mode requested, starting all protocol servers");
      await this.startUniversalMode();
      return;
    }
    
    // Check if WebSocket mode is requested
    if (config.websocketMode) {
      secureLogger.info("WebSocket mode requested, starting WebSocket MCP server");
      const { startWebSocketServer } = await import('./websocket-server.js');
      await startWebSocketServer();
      return;
    }
    
    // Check if HTTP mode is requested
    if (config.httpMode) {
      secureLogger.info("HTTP mode requested, starting HTTP server instead");
      const { startHttpServer } = await import('./http-server.js');
      await startHttpServer();
      return;
    }
    
    // Start STDIO MCP server (default)
    secureLogger.info("Starting MCP Financial Intelligence Server", {
      mode: 'STDIO',
      config: configForLogging
    });
    
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    
    secureLogger.info("MCP Financial Intelligence Server running on STDIO");
  }

  private async startUniversalMode(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    try {
      // Start HTTP server (includes REST API + MCP endpoint + web interface)
      secureLogger.info("Universal Mode: Starting HTTP server...");
      const { FinancialIntelligenceHttpServer } = await import('./http-server.js');
      const httpServer = new FinancialIntelligenceHttpServer();
      promises.push(httpServer.start());
      
      // Start WebSocket MCP server
      secureLogger.info("Universal Mode: Starting WebSocket MCP server...");
      const { FinancialIntelligenceWebSocketServer } = await import('./websocket-server.js');
      const wsServer = new FinancialIntelligenceWebSocketServer();
      promises.push(wsServer.start());
      
      // Wait for both servers to start
      await Promise.all(promises);
      
      secureLogger.info("Universal Mode: All servers started successfully", {
        protocols: ['STDIO', 'HTTP REST', 'HTTP MCP', 'WebSocket MCP'],
        endpoints: [
          `HTTP: http://localhost:${config.httpPort}`,
          `HTTP MCP: http://localhost:${config.httpPort}/mcp`,
          `WebSocket MCP: ws://localhost:${config.websocketPort}`,
          'STDIO: Direct connection via MCP client'
        ]
      });
      
      // STDIO server also runs in universal mode for direct MCP connections
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
    } catch (error) {
      secureLogger.error("Failed to start universal mode servers", { error });
      throw error;
    }
  }
}

// Error handling and graceful shutdown
process.on('SIGINT', () => {
  secureLogger.info('Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  secureLogger.info('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
  secureLogger.error('Unhandled Rejection at:', { promise, reason });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  secureLogger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  process.exit(1);
});

// Start the server
async function main(): Promise<void> {
  try {
    const server = new FinancialIntelligenceServer();
    await server.start();
  } catch (error) {
    secureLogger.error("Failed to start server:", { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  }
}

main().catch((error) => {
  secureLogger.error("Server startup error:", { error: error instanceof Error ? error.message : String(error) });
  process.exit(1);
});