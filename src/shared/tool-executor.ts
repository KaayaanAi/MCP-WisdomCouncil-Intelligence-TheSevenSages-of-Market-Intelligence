import { ToolResponse } from "../types/index.js";

// Import tool implementations
import { multiAnalystConsensus } from "../tools/multi-analyst-consensus.js";
import { fetchBreakingNews } from "../tools/fetch-breaking-news.js";
import { completeFinancialIntelligenceAnalysis } from "../tools/complete-financial-intelligence-analysis.js";

/**
 * Universal tool executor - centralizes tool execution logic across all server implementations
 * Eliminates code duplication between STDIO, HTTP, and WebSocket servers
 */
export class UniversalToolExecutor {
  /**
   * Execute a tool by name with the provided arguments
   * @param toolName - Name of the tool to execute
   * @param args - Arguments to pass to the tool
   * @returns Promise<ToolResponse> - The tool execution result
   * @throws Error - If tool name is unknown or execution fails
   */
  static async execute(toolName: string, args: any): Promise<ToolResponse> {
    switch (toolName) {
      case "complete_financial_intelligence_analysis":
        return await completeFinancialIntelligenceAnalysis(args as any);
        
      case "multi_analyst_consensus":
        return await multiAnalystConsensus(args);
        
      case "fetch_breaking_news":
        return await fetchBreakingNews(args);
        
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get list of available tool names
   * @returns string[] - Array of tool names
   */
  static getToolNames(): string[] {
    return [
      "complete_financial_intelligence_analysis",
      "multi_analyst_consensus", 
      "fetch_breaking_news"
    ];
  }

  /**
   * Check if a tool exists
   * @param toolName - Name of the tool to check
   * @returns boolean - True if tool exists
   */
  static hasToolName(toolName: string): boolean {
    return this.getToolNames().includes(toolName);
  }
}