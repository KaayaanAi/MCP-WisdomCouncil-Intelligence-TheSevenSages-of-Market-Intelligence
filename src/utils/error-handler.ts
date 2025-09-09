import { ToolResponse } from '../types/index.js';

/**
 * Standardized Error Handler Utilities
 * 
 * Provides consistent error handling patterns across the entire application
 * to eliminate code duplication and improve type safety.
 */
export class StandardErrorHandler {
  /**
   * Extract error message from various error types
   * @param error - Error of unknown type
   * @returns Standardized error message string
   */
  static getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === 'string') return error;
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    }
    return 'Unknown error occurred';
  }

  /**
   * Create standardized ToolResponse for errors
   * @param error - Error of unknown type
   * @param toolName - Name of the tool that encountered the error
   * @param includeDebugInfo - Whether to include additional debug information
   * @returns Standardized ToolResponse with error formatting
   */
  static createToolErrorResponse(
    error: unknown, 
    toolName: string, 
    includeDebugInfo: boolean = false
  ): ToolResponse {
    const message = this.getErrorMessage(error);
    let errorText = `❌ **Error executing ${toolName}**: ${message}`;
    
    if (includeDebugInfo && error instanceof Error && error.stack) {
      errorText += `\n\n**Debug Information:**\n${error.stack}`;
    }
    
    return {
      content: [{ 
        type: "text", 
        text: errorText 
      }],
      isError: true
    };
  }

  /**
   * Create standardized JSON-RPC 2.0 error response
   * @param error - Error of unknown type
   * @param id - Request ID from JSON-RPC request
   * @param code - Optional error code (defaults to -32603 Internal error)
   * @returns JSON-RPC 2.0 compliant error response
   */
  static createJsonRpcError(error: unknown, id: any, code: number = -32603) {
    return {
      jsonrpc: '2.0',
      error: {
        code,
        message: code === -32603 ? 'Internal error' : this.getErrorMessage(error),
        data: this.getErrorMessage(error)
      },
      id: id || null
    };
  }

  /**
   * Create standardized HTTP error response
   * @param error - Error of unknown type
   * @param statusCode - HTTP status code
   * @returns Standardized HTTP error response object
   */
  static createHttpErrorResponse(error: unknown, statusCode: number = 500) {
    return {
      error: true,
      message: statusCode >= 500 ? 'Internal server error' : this.getErrorMessage(error),
      details: statusCode >= 500 ? undefined : this.getErrorMessage(error),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Enhanced tool error response with user-friendly context
   * @param error - Error of unknown type
   * @param toolName - Name of the tool that encountered the error
   * @param userContext - Additional context for the user
   * @returns ToolResponse with enhanced error messaging
   */
  static createEnhancedToolErrorResponse(
    error: unknown,
    toolName: string,
    userContext?: string
  ): ToolResponse {
    const message = this.getErrorMessage(error);
    let errorText = `❌ **${toolName} Error**: ${message}`;
    
    if (userContext) {
      errorText += `\n\n${userContext}`;
    }
    
    // Add common troubleshooting context
    errorText += `\n\nThis could be due to:\n• AI provider availability\n• Network connectivity\n• System overload\n\nPlease try again in a few moments.`;
    
    return {
      content: [{ 
        type: "text", 
        text: errorText 
      }],
      isError: true
    };
  }

  /**
   * Log and return error response for consistent error handling
   * @param error - Error of unknown type
   * @param toolName - Name of the tool that encountered the error
   * @param logger - Logger instance to use
   * @param args - Tool arguments for logging context
   * @returns ToolResponse with logged error
   */
  static logAndReturnError(
    error: unknown,
    toolName: string,
    logger: any,
    args?: any
  ): ToolResponse {
    logger.error(`Tool execution error: ${toolName}`, { 
      error: this.getErrorMessage(error), 
      args,
      timestamp: new Date().toISOString()
    });
    
    return this.createToolErrorResponse(error, toolName);
  }

  /**
   * Validate that an error is safe to return to the client
   * (removes sensitive information from error messages)
   * @param error - Error of unknown type
   * @returns Sanitized error message
   */
  static sanitizeErrorMessage(error: unknown): string {
    const message = this.getErrorMessage(error);
    
    // Remove potentially sensitive patterns
    return message
      .replace(/api[_-]?key[s]?[:=]\s*[^\s]+/gi, 'api_key=***')
      .replace(/token[:=]\s*[^\s]+/gi, 'token=***')
      .replace(/password[:=]\s*[^\s]+/gi, 'password=***')
      .replace(/secret[:=]\s*[^\s]+/gi, 'secret=***')
      .replace(/bearer\s+[^\s]+/gi, 'bearer ***');
  }

  /**
   * Check if error indicates a retryable condition
   * @param error - Error of unknown type
   * @returns True if the error suggests a retry might succeed
   */
  static isRetryableError(error: unknown): boolean {
    const message = this.getErrorMessage(error).toLowerCase();
    
    const retryablePatterns = [
      'timeout',
      'network',
      'connection',
      'rate limit',
      'quota exceeded',
      'service unavailable',
      'temporary',
      'try again'
    ];
    
    return retryablePatterns.some(pattern => message.includes(pattern));
  }
}

/**
 * Specialized error handler for analysis operations
 */
export class AnalysisErrorHandler extends StandardErrorHandler {
  /**
   * Create analysis-specific error response
   * @param error - Error of unknown type
   * @param analysisType - Type of analysis that failed
   * @param input - Input that caused the error (sanitized)
   * @returns ToolResponse with analysis-specific error context
   */
  static createAnalysisErrorResponse(
    error: unknown,
    analysisType: string,
    input?: any
  ): ToolResponse {
    const message = this.sanitizeErrorMessage(error);
    const errorText = `❌ **${analysisType} Analysis Failed**: ${message}
    
**Analysis Type**: ${analysisType}
${input ? `**Input Length**: ${String(input).length} characters` : ''}

**Troubleshooting Steps**:
1. Check your internet connection
2. Verify the input format is correct
3. Try reducing the input size if it's very large
4. Wait a moment and try again

If the problem persists, the AI providers may be experiencing high load.`;

    return {
      content: [{ 
        type: "text", 
        text: errorText 
      }],
      isError: true
    };
  }
}