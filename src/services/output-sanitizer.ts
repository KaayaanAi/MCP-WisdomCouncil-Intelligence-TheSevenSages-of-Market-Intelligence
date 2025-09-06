import { secureLogger } from '../utils/logger.js';

/**
 * Output Sanitization Result
 */
export interface SanitizationResult {
  sanitizedContent: string;
  flagsRemoved: string[];
  numericDataBlocked: number;
  confidenceScoresFiltered: number;
  isSafe: boolean;
  originalLength: number;
  sanitizedLength: number;
}

/**
 * AI Output Sanitizer
 * CRITICAL SECURITY LAYER: Removes all fabricated numbers and unreliable data
 * 
 * This service acts as the FINAL GUARDIAN against AI fabrication
 * No specific numbers, prices, or confidence scores leave the system without verification
 */
export class OutputSanitizerService {
  
  // Patterns for detecting fabricated numerical data
  private readonly FABRICATED_NUMBER_PATTERNS = [
    // Specific economic data patterns
    /unemployment\s+rate[\s:]*\d+\.?\d*%?/gi,
    /inflation\s+rate[\s:]*\d+\.?\d*%?/gi,
    /gdp\s+growth[\s:]*\d+\.?\d*%?/gi,
    /interest\s+rate[\s:]*\d+\.?\d*%?/gi,
    /nfp[\s:]*\d+[,\d]*\s*jobs?/gi,
    /job\s+growth[\s:]*\d+[,\d]*\s*jobs?/gi,
    
    // Market price patterns  
    /bitcoin[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /btc[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /ethereum[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /eth[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /s&p\s*500[\s:]*\d+[,\d]*\.?\d*/gi,
    /sp500[\s:]*\d+[,\d]*\.?\d*/gi,
    /nasdaq[\s:]*\d+[,\d]*\.?\d*/gi,
    /dow[\s:]*\d+[,\d]*\.?\d*/gi,
    
    // Generic price/value patterns
    /current\s+price[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /price[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /value[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /level[\s:]*\d+[,\d]*\.?\d*/gi,
    
    // Resistance/support levels (specific trading numbers)
    /resistance[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /support[\s:]*\$?\d+[,\d]*\.?\d*/gi,
    /target[\s:]*\$?\d+[,\d]*\.?\d*/gi
  ];
  
  // Patterns for unreliable confidence scores
  private readonly CONFIDENCE_SCORE_PATTERNS = [
    /confidence\s+score[\s:]*\d+\.?\d*%?/gi,
    /confidence[\s:]*\d+\.?\d*%/gi,
    /\d+\.?\d*%\s+confidence/gi
  ];
  
  // Patterns for fabricated specific dates
  private readonly SPECIFIC_DATE_PATTERNS = [
    /released\s+on\s+[a-z]+\s+\d{1,2},?\s+\d{4}/gi,
    /announced\s+on\s+[a-z]+\s+\d{1,2},?\s+\d{4}/gi,
    /\d{1,2}\/\d{1,2}\/\d{4}\s+release/gi,
    /\d{4}-\d{2}-\d{2}\s+data/gi
  ];

  /**
   * Main sanitization method - removes all fabricated content
   */
  public sanitizeOutput(content: string, _allowAnalysis: boolean = true): SanitizationResult {
    let sanitizedContent = content;
    const flagsRemoved: string[] = [];
    let numericDataBlocked = 0;
    let confidenceScoresFiltered = 0;

    const originalLength = content.length;

    try {
      // PHASE 1: Remove fabricated numerical data
      for (const pattern of this.FABRICATED_NUMBER_PATTERNS) {
        const matches = sanitizedContent.match(pattern);
        if (matches) {
          numericDataBlocked += matches.length;
          sanitizedContent = sanitizedContent.replace(pattern, '[SPECIFIC DATA REMOVED - Use official sources]');
          flagsRemoved.push(`Removed ${matches.length} fabricated number(s): ${pattern.source.substring(0, 50)}...`);
        }
      }

      // PHASE 2: Remove unreliable confidence scores
      for (const pattern of this.CONFIDENCE_SCORE_PATTERNS) {
        const matches = sanitizedContent.match(pattern);
        if (matches) {
          confidenceScoresFiltered += matches.length;
          sanitizedContent = sanitizedContent.replace(pattern, '[CONFIDENCE ASSESSMENT REMOVED]');
          flagsRemoved.push(`Removed ${matches.length} confidence score(s)`);
        }
      }

      // PHASE 3: Remove specific fabricated dates
      for (const pattern of this.SPECIFIC_DATE_PATTERNS) {
        const matches = sanitizedContent.match(pattern);
        if (matches) {
          sanitizedContent = sanitizedContent.replace(pattern, '[SPECIFIC DATE REMOVED - Check official sources]');
          flagsRemoved.push(`Removed ${matches.length} specific date reference(s)`);
        }
      }

      // PHASE 4: Add safety disclaimers if content was modified
      if (flagsRemoved.length > 0) {
        sanitizedContent = this.addSafetyDisclaimer(sanitizedContent);
      }

      // PHASE 5: Final safety check
      const isSafe = this.performFinalSafetyCheck(sanitizedContent);

      const result: SanitizationResult = {
        sanitizedContent,
        flagsRemoved,
        numericDataBlocked,
        confidenceScoresFiltered,
        isSafe,
        originalLength,
        sanitizedLength: sanitizedContent.length
      };

      // Log sanitization results
      if (flagsRemoved.length > 0) {
        secureLogger.warn('AI Output Sanitized', {
          numericDataBlocked,
          confidenceScoresFiltered,
          flagsRemovedCount: flagsRemoved.length,
          contentReduction: `${originalLength} → ${sanitizedContent.length} chars`
        });
      }

      return result;

    } catch (error) {
      secureLogger.error('Output sanitization failed', { error });
      
      // FAILSAFE: Block all output if sanitization fails
      return {
        sanitizedContent: '❌ **SYSTEM ERROR**: Output sanitization failed. Response blocked for safety.',
        flagsRemoved: ['Sanitization system error'],
        numericDataBlocked: 0,
        confidenceScoresFiltered: 0,
        isSafe: false,
        originalLength,
        sanitizedLength: 0
      };
    }
  }

  /**
   * Add safety disclaimer to sanitized content
   */
  private addSafetyDisclaimer(content: string): string {
    const disclaimer = `

---
⚠️ **DATA INTEGRITY NOTICE**: Specific numbers and data points have been removed from this analysis to prevent fabrication. For actual economic data, market prices, and statistics, please consult official sources:
- Economic Data: FRED (Federal Reserve Economic Data), BLS.gov
- Market Data: Your broker, Yahoo Finance, Bloomberg, Reuters
- News: Official financial news sources

This analysis provides frameworks and general trends only.`;

    return content + disclaimer;
  }

  /**
   * Final safety check for any remaining fabricated content
   */
  private performFinalSafetyCheck(content: string): boolean {
    // Check for any remaining specific numbers that might have slipped through
    const dangerousPatterns = [
      /\$\d+[,\d]*\.?\d+/g,  // Dollar amounts
      /\d+\.\d+%(?!\s*confidence)/g,  // Percentage values (not confidence)
      /\d{1,2}:\d{2}\s*[ap]m\s+[a-z]/gi,  // Specific times with context
      /\d+[,\d]+\s+jobs/gi,  // Job numbers
      /rate\s+of\s+\d+\.?\d*%/gi  // Specific rates
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(content)) {
        secureLogger.warn('Final safety check found potential fabrication', {
          pattern: pattern.source
        });
        return false;
      }
    }

    // Additional check: ensure no confidence scores remain
    if (/confidence.*\d+%/gi.test(content) || /\d+%.*confidence/gi.test(content)) {
      return false;
    }

    return true;
  }

  /**
   * Emergency block function - completely blocks output with safety message
   */
  public emergencyBlock(reason: string): SanitizationResult {
    secureLogger.error('Emergency output block activated', { reason });
    
    return {
      sanitizedContent: `❌ **SYSTEM SAFETY BLOCK**: ${reason}

This request has been blocked by the AI safety system to prevent data fabrication.

For reliable financial data, please use:
- Federal Reserve Economic Data (FRED)
- Bureau of Labor Statistics (BLS.gov)  
- Your financial broker or official market data sources
- Verified financial news outlets

The system is designed to provide analysis frameworks only, never specific current data.`,
      flagsRemoved: [`Emergency block: ${reason}`],
      numericDataBlocked: 0,
      confidenceScoresFiltered: 0,
      isSafe: false,
      originalLength: 0,
      sanitizedLength: 0
    };
  }

  /**
   * Test method to check if content would be blocked
   */
  public testForFabrication(content: string): {
    wouldBlock: boolean;
    issues: string[];
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const issues: string[] = [];
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';

    // Check for fabricated numbers
    let fabricationCount = 0;
    for (const pattern of this.FABRICATED_NUMBER_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        fabricationCount += matches.length;
        issues.push(`Found ${matches.length} potential fabricated number(s)`);
      }
    }

    // Check for confidence scores
    let confidenceCount = 0;
    for (const pattern of this.CONFIDENCE_SCORE_PATTERNS) {
      const matches = content.match(pattern);
      if (matches) {
        confidenceCount += matches.length;
        issues.push(`Found ${matches.length} confidence score(s)`);
      }
    }

    // Determine risk level
    if (fabricationCount > 5 || confidenceCount > 3) {
      riskLevel = 'CRITICAL';
    } else if (fabricationCount > 2 || confidenceCount > 1) {
      riskLevel = 'HIGH';
    } else if (fabricationCount > 0 || confidenceCount > 0) {
      riskLevel = 'MEDIUM';
    }

    const wouldBlock = riskLevel === 'CRITICAL' || fabricationCount > 3;

    return {
      wouldBlock,
      issues,
      riskLevel
    };
  }
}

// Export singleton instance
export const outputSanitizer = new OutputSanitizerService();