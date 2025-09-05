import winston from 'winston';
import { config, redactSensitiveData } from '../config.js';

// Create Winston logger with secure configuration
const logger = winston.createLogger({
  level: config.security.logLevel,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ level, message, timestamp, ...meta }) => {
      const metaString = Object.keys(meta).length ? ` ${redactSensitiveData(meta)}` : '';
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
    })
  ),
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file transport for production
if (config.nodeEnv === 'production') {
  logger.add(new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error'
  }));
  
  logger.add(new winston.transports.File({
    filename: 'logs/combined.log'
  }));
}

/**
 * Secure logger that automatically redacts sensitive information
 */
export const secureLogger = {
  error: (message: string, data?: any) => {
    logger.error(message, data ? redactSensitiveData(data) : undefined);
  },
  
  warn: (message: string, data?: any) => {
    logger.warn(message, data ? redactSensitiveData(data) : undefined);
  },
  
  info: (message: string, data?: any) => {
    logger.info(message, data ? redactSensitiveData(data) : undefined);
  },
  
  debug: (message: string, data?: any) => {
    logger.debug(message, data ? redactSensitiveData(data) : undefined);
  },
  
  // Special method for logging tool executions
  toolExecution: (toolName: string, input: any, duration: number, success: boolean) => {
    const logData = {
      tool: toolName,
      input: redactSensitiveData(input),
      duration: `${duration}ms`,
      success
    };
    
    if (success) {
      logger.info(`Tool executed successfully: ${toolName}`, logData);
    } else {
      logger.error(`Tool execution failed: ${toolName}`, logData);
    }
  },
  
  // Method for logging AI provider usage
  aiProviderCall: (provider: string, model: string, success: boolean, tokensUsed?: number) => {
    const logData = {
      provider,
      model,
      success,
      tokensUsed: tokensUsed || 'unknown'
    };
    
    logger.info(`AI provider call: ${provider}`, logData);
  }
};

export default secureLogger;