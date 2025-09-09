/**
 * Server Constants
 * 
 * Centralized configuration constants to eliminate hardcoded values
 * and provide a single source of truth for server configuration.
 */

export const SERVER_CONSTANTS = {
  /**
   * Server identification
   */
  NAME: 'mcp-nextgen-financial-intelligence',
  VERSION: '3.0.0',
  PROTOCOL_VERSION: '2024-11-05',

  /**
   * Default port configurations
   */
  PORTS: {
    HTTP_DEFAULT: 3001,
    WEBSOCKET_DEFAULT: 3003
  },

  /**
   * Request timeout configurations (in milliseconds)
   */
  TIMEOUTS: {
    HTTP_REQUEST: 30000,           // 30 seconds for HTTP requests
    ANALYSIS_QUICK: 30000,         // 30 seconds for quick analysis
    ANALYSIS_STANDARD: 60000,      // 60 seconds for standard analysis
    ANALYSIS_DEEP: 120000,         // 120 seconds for deep analysis
    WEBSOCKET_CONNECTION: 30000,   // 30 seconds for WebSocket connections
    TOOL_EXECUTION: 180000,        // 3 minutes for tool execution
    AI_PROVIDER_REQUEST: 45000     // 45 seconds for AI provider requests
  },

  /**
   * Server capabilities and feature flags
   */
  CAPABILITIES: {
    TOOLS: true,
    RESOURCES: false,
    PROMPTS: false,
    LOGGING: true
  },

  /**
   * Universal MCP Architecture configuration
   */
  UNIVERSAL_ARCHITECTURE: {
    PROTOCOLS_SUPPORTED: ['STDIO', 'HTTP REST', 'HTTP MCP', 'WebSocket MCP'],
    N8N_NODES_MCP_READY: true,
    QUAD_PROTOCOL_SUPPORT: true
  },

  /**
   * Available tools configuration
   */
  TOOLS: {
    COMPLETE_ANALYSIS: 'complete_financial_intelligence_analysis',
    MULTI_ANALYST: 'multi_analyst_consensus',
    BREAKING_NEWS: 'fetch_breaking_news'
  } as const,

  /**
   * Analysis depth options
   */
  ANALYSIS_DEPTHS: {
    QUICK: 'quick',
    STANDARD: 'standard',
    DEEP: 'deep'
  } as const,

  /**
   * News categories
   */
  NEWS_CATEGORIES: {
    ALL: 'all',
    STOCKS: 'stocks',
    CRYPTO: 'crypto',
    FOREX: 'forex',
    COMMODITIES: 'commodities',
    POLITICS: 'politics',
    ECONOMICS: 'economics'
  } as const,

  /**
   * Time range options
   */
  TIME_RANGES: {
    ONE_HOUR: '1h',
    SIX_HOURS: '6h',
    TWELVE_HOURS: '12h',
    TWENTY_FOUR_HOURS: '24h'
  } as const,

  /**
   * HTTP status codes commonly used
   */
  HTTP_STATUS: {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    METHOD_NOT_ALLOWED: 405,
    RATE_LIMITED: 429,
    INTERNAL_ERROR: 500,
    SERVICE_UNAVAILABLE: 503
  } as const,

  /**
   * JSON-RPC error codes
   */
  JSON_RPC_ERRORS: {
    PARSE_ERROR: -32700,
    INVALID_REQUEST: -32600,
    METHOD_NOT_FOUND: -32601,
    INVALID_PARAMS: -32602,
    INTERNAL_ERROR: -32603
  } as const,

  /**
   * Rate limiting defaults
   */
  RATE_LIMITS: {
    WINDOW_MS: 15 * 60 * 1000,     // 15 minutes
    MAX_REQUESTS: 100,              // Maximum requests per window
    MAX_REQUESTS_PER_TOOL: 20       // Maximum requests per tool per window
  },

  /**
   * Security configurations
   */
  SECURITY: {
    MAX_REQUEST_SIZE: '10mb',
    CORS_MAX_AGE: 86400,            // 24 hours
    HELMET_CSP_ENABLE: true
  },

  /**
   * Analyst types available
   */
  ANALYST_TYPES: [
    'political_analyst',
    'economic_analyst', 
    'geopolitical_analyst',
    'financial_analyst',
    'crypto_analyst',
    'tech_analyst',
    'behavioral_analyst'
  ] as const,

  /**
   * Default configurations
   */
  DEFAULTS: {
    ANALYSIS_DEPTH: 'standard',
    MAX_NEWS_ITEMS: 10,
    TIME_RANGE: '6h',
    NEWS_CATEGORY: 'all',
    INCLUDE_NEWS: true,
    INCLUDE_ANALYSIS: true
  },

  /**
   * Validation limits
   */
  VALIDATION: {
    MIN_INPUT_LENGTH: 10,
    MAX_INPUT_LENGTH: 5000,
    MAX_NEWS_ITEMS: 50,
    MIN_NEWS_ITEMS: 1,
    MAX_ANALYSTS: 7,
    INPUT_PATTERN: /^[a-zA-Z0-9\s\-_,.!?'"()[\]:;@#$%&+=*/\\|<>{}~`]+$/
  },

  /**
   * Server endpoints
   */
  ENDPOINTS: {
    ROOT: '/',
    TEST: '/test',
    ANALYZE: '/analyze',
    HEALTH: '/health',
    TOOLS: '/tools',
    MCP: '/mcp',
    MCP_INFO: '/mcp/info',
    MCP_TEST: '/mcp/test'
  }
} as const;

/**
 * Tool descriptions for consistent messaging
 */
export const TOOL_DESCRIPTIONS = {
  [SERVER_CONSTANTS.TOOLS.COMPLETE_ANALYSIS]: '🚀 Complete unified financial intelligence analysis combining 7 AI analysts consensus + breaking news analysis. One-stop solution for comprehensive market insights.',
  [SERVER_CONSTANTS.TOOLS.MULTI_ANALYST]: '🧠 Get comprehensive market analysis from 7 specialized AI analysts with consensus mechanism. Provides unified insights on market events, news, or conditions.',
  [SERVER_CONSTANTS.TOOLS.BREAKING_NEWS]: '📰 Fetch and analyze breaking financial news from multiple RSS feeds and APIs. Provides prioritized, relevant market news with impact assessment.'
} as const;

/**
 * Error messages for consistent error reporting
 */
export const ERROR_MESSAGES = {
  TOOL_NOT_FOUND: (toolName: string) => `Unknown tool: ${toolName}`,
  INVALID_JSON: 'Invalid JSON format. Please check your request body.',
  MISSING_REQUIRED_FIELD: (field: string) => `${field} is required`,
  RATE_LIMIT_EXCEEDED: 'Too many requests from this IP, please try again later.',
  INTERNAL_SERVER_ERROR: 'Internal server error',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
  ANALYSIS_FAILED: 'Analysis failed',
  NETWORK_ERROR: 'Failed to connect to the analysis server. Please try again.',
  AI_PROVIDER_UNAVAILABLE: 'AI provider temporarily unavailable',
  INVALID_ANALYSIS_DEPTH: 'Analysis depth must be quick, standard, or deep',
  INVALID_TIME_RANGE: 'Time range must be 1h, 6h, 12h, or 24h',
  INVALID_NEWS_CATEGORY: 'Invalid news category specified'
} as const;

/**
 * Success messages for consistent success reporting
 */
export const SUCCESS_MESSAGES = {
  ANALYSIS_COMPLETE: (depth: string) => `✅ Analysis Results (${depth.toUpperCase()})`,
  SERVER_STARTED: (protocols: string[]) => `Server started with protocols: ${protocols.join(', ')}`,
  HEALTH_CHECK_PASSED: 'All systems operational',
  N8N_COMPATIBLE: 'Server is fully n8n-nodes-MCP compatible',
  TOOL_EXECUTION_SUCCESS: (toolName: string, duration: number) => `✅ ${toolName} completed successfully in ${duration}ms`
} as const;