import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { SERVER_CONSTANTS, TOOL_DESCRIPTIONS } from "../constants/server-constants.js";

/**
 * Centralized tool definitions to eliminate code duplication across server implementations
 * These definitions are used by STDIO, HTTP, and WebSocket servers
 */
export const TOOL_DEFINITIONS: Tool[] = [
  {
    name: SERVER_CONSTANTS.TOOLS.COMPLETE_ANALYSIS,
    description: TOOL_DESCRIPTIONS[SERVER_CONSTANTS.TOOLS.COMPLETE_ANALYSIS],
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The financial question, market event, or condition to analyze comprehensively"
        },
        analysis_depth: {
          type: "string",
          enum: [SERVER_CONSTANTS.ANALYSIS_DEPTHS.QUICK, SERVER_CONSTANTS.ANALYSIS_DEPTHS.STANDARD, SERVER_CONSTANTS.ANALYSIS_DEPTHS.DEEP],
          description: "Depth of analysis: 'quick' (30s), 'standard' (60s), 'deep' (120s)"
        },
        include_news: {
          type: "boolean",
          description: "Whether to include breaking news analysis (default: true)"
        },
        news_categories: {
          type: "array",
          items: {
            type: "string",
            enum: Object.values(SERVER_CONSTANTS.NEWS_CATEGORIES)
          },
          description: "News categories to include (default: ['all'])"
        },
        max_news_items: {
          type: "number",
          minimum: 1,
          maximum: 50,
          description: "Maximum news items to analyze (default: 10)"
        },
        time_range: {
          type: "string",
          enum: Object.values(SERVER_CONSTANTS.TIME_RANGES),
          description: "Time range for news analysis (default: '6h')"
        },
        sage_perspectives: {
          type: "array",
          items: {
            type: "string",
            enum: SERVER_CONSTANTS.ANALYST_TYPES
          },
          description: "Optional: Specify which analysts to include (default: all 7)"
        }
      },
      required: ["query"]
    }
  },
  {
    name: SERVER_CONSTANTS.TOOLS.MULTI_ANALYST,
    description: TOOL_DESCRIPTIONS[SERVER_CONSTANTS.TOOLS.MULTI_ANALYST],
    inputSchema: {
      type: "object",
      properties: {
        news_item: {
          type: "string",
          description: "The news item, market event, or condition to analyze"
        },
        analysis_depth: {
          type: "string",
          enum: [SERVER_CONSTANTS.ANALYSIS_DEPTHS.QUICK, SERVER_CONSTANTS.ANALYSIS_DEPTHS.STANDARD, SERVER_CONSTANTS.ANALYSIS_DEPTHS.DEEP],
          description: "Depth of analysis: 'quick' (30s), 'standard' (60s), 'deep' (120s)"
        },
        sage_perspectives: {
          type: "array",
          items: {
            type: "string",
            enum: SERVER_CONSTANTS.ANALYST_TYPES
          },
          description: "Optional: Specify which analysts to include (default: all 7)"
        }
      },
      required: ["news_item"]
    }
  },
  {
    name: SERVER_CONSTANTS.TOOLS.BREAKING_NEWS,
    description: TOOL_DESCRIPTIONS[SERVER_CONSTANTS.TOOLS.BREAKING_NEWS],
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
          enum: Object.values(SERVER_CONSTANTS.TIME_RANGES),
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