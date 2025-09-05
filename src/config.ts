import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables
dotenv.config();

// Define configuration schema for validation
const configSchema = z.object({
  // Server Configuration
  httpMode: z.boolean().default(false),
  httpPort: z.number().min(1000).max(65535).default(3001),
  nodeEnv: z.enum(['development', 'production', 'test']).default('development'),
  
  // AI Provider Configuration
  aiProviders: z.object({
    openai: z.object({
      apiKey: z.string().min(1),
      enabled: z.boolean().default(true),
      model: z.string().optional()
    }),
    anthropic: z.object({
      apiKey: z.string().optional(),
      enabled: z.boolean().default(false),
      model: z.string().optional()
    }),
    gemini: z.object({
      apiKey: z.string().optional(),
      enabled: z.boolean().default(false),
      model: z.string().optional()
    }),
    local: z.object({
      url: z.string().optional(),
      enabled: z.boolean().default(false),
      model: z.string().optional()
    }),
    deepseek: z.object({
      apiKey: z.string().optional(),
      enabled: z.boolean().default(false)
    }),
    groq: z.object({
      apiKey: z.string().optional(),
      enabled: z.boolean().default(false)
    }),
    openrouter: z.object({
      apiKey: z.string().optional(),
      enabled: z.boolean().default(false)
    })
  }),
  
  // Enhanced provider selection with automatic detection
  aiProvider: z.enum(['openai', 'anthropic', 'gemini', 'local', 'deepseek', 'groq', 'openrouter']).optional(),
  primaryProvider: z.enum(['openai', 'anthropic', 'gemini', 'local', 'deepseek', 'groq', 'openrouter']).default('openai'),
  fallbackProviders: z.array(z.enum(['openai', 'anthropic', 'gemini', 'local', 'deepseek', 'groq', 'openrouter'])).default(['anthropic', 'gemini', 'deepseek']),
  
  // Database Configuration
  database: z.object({
    mongoUri: z.string().url().optional(),
    redisUrl: z.string().url().optional()
  }),
  
  // News API Configuration
  newsApis: z.object({
    newsapi: z.object({
      key: z.string().optional(),
      enabled: z.boolean().default(false)
    }),
    gnews: z.object({
      key: z.string().optional(),
      enabled: z.boolean().default(false)
    }),
    currents: z.object({
      key: z.string().optional(),
      enabled: z.boolean().default(false)
    })
  }),
  
  // Security Configuration
  security: z.object({
    rateLimitWindowMs: z.number().positive().default(900000), // 15 minutes
    rateLimitMaxRequests: z.number().positive().default(100),
    logLevel: z.enum(['error', 'warn', 'info', 'debug']).default('info')
  }),
  
  // TradingView Configuration
  tradingView: z.object({
    webhookSecret: z.string().optional()
  }),
  
  // Analysis Configuration
  analysis: z.object({
    defaultDepth: z.enum(['quick', 'standard', 'deep']).default('standard'),
    maxNewsAgeHours: z.number().positive().default(24),
    cacheDurationHours: z.number().positive().default(12),
    tripleVerificationThreshold: z.number().min(0).max(1).default(0.7)
  })
});

/**
 * Redacts sensitive data from objects for secure logging
 */
export function redactSensitiveData(obj: any): string {
  if (typeof obj !== 'object' || obj === null) {
    return String(obj);
  }
  
  const sensitiveKeys = [
    'apikey', 'api_key', 'api-key',
    'token', 'secret', 'password', 'pass',
    'authorization', 'auth', 'credential'
  ];
  
  const redacted = JSON.stringify(obj, (key, value) => {
    if (typeof key === 'string') {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey))) {
        return '[REDACTED]';
      }
    }
    return value;
  });
  
  return redacted;
}

/**
 * Validates required environment variables are present
 */
function validateEnvironment(): void {
  const requiredVars = ['OPENAI_API_KEY'];
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
}

/**
 * Parses and validates configuration from environment variables
 */
function parseConfig() {
  validateEnvironment();
  
  const rawConfig = {
    httpMode: process.env.HTTP_MODE === 'true',
    httpPort: parseInt(process.env.HTTP_PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'development',
    
    aiProviders: {
      openai: {
        apiKey: process.env.OPENAI_API_KEY || '',
        enabled: !!process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL
      },
      anthropic: {
        apiKey: process.env.ANTHROPIC_API_KEY,
        enabled: !!process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL
      },
      gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        enabled: !!process.env.GEMINI_API_KEY,
        model: process.env.GEMINI_MODEL
      },
      local: {
        url: process.env.LOCAL_MODEL_URL,
        enabled: !!process.env.LOCAL_MODEL_URL,
        model: process.env.LOCAL_MODEL_NAME
      },
      deepseek: {
        apiKey: process.env.DEEPSEEK_API_KEY,
        enabled: !!process.env.DEEPSEEK_API_KEY
      },
      groq: {
        apiKey: process.env.GROQ_API_KEY,
        enabled: !!process.env.GROQ_API_KEY
      },
      openrouter: {
        apiKey: process.env.OPENROUTER_API_KEY,
        enabled: !!process.env.OPENROUTER_API_KEY
      }
    },
    
    // Enhanced provider selection
    aiProvider: process.env.AI_PROVIDER,
    primaryProvider: process.env.PRIMARY_AI_PROVIDER || 'openai',
    fallbackProviders: process.env.FALLBACK_AI_PROVIDERS?.split(',') || ['anthropic', 'gemini', 'deepseek'],
    
    database: {
      mongoUri: process.env.MONGODB_URI,
      redisUrl: process.env.REDIS_URL
    },
    
    newsApis: {
      newsapi: {
        key: process.env.NEWSAPI_KEY,
        enabled: !!process.env.NEWSAPI_KEY
      },
      gnews: {
        key: process.env.GNEWS_API_KEY,
        enabled: !!process.env.GNEWS_API_KEY
      },
      currents: {
        key: process.env.CURRENTS_API_KEY,
        enabled: !!process.env.CURRENTS_API_KEY
      }
    },
    
    security: {
      rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
      rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
      logLevel: process.env.LOG_LEVEL || 'info'
    },
    
    tradingView: {
      webhookSecret: process.env.TRADINGVIEW_WEBHOOK_SECRET
    },
    
    analysis: {
      defaultDepth: process.env.DEFAULT_ANALYSIS_DEPTH || 'standard',
      maxNewsAgeHours: parseInt(process.env.MAX_NEWS_AGE_HOURS || '24', 10),
      cacheDurationHours: parseInt(process.env.CACHE_DURATION_HOURS || '12', 10),
      tripleVerificationThreshold: parseFloat(process.env.TRIPLE_VERIFICATION_THRESHOLD || '0.7')
    }
  };
  
  // Validate configuration against schema
  return configSchema.parse(rawConfig);
}

export type Config = z.infer<typeof configSchema>;

// Export validated configuration
export const config: Config = parseConfig();

// Export configuration for logging (with sensitive data redacted)
export const configForLogging = redactSensitiveData(config);