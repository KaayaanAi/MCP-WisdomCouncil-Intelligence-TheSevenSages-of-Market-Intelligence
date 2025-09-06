import { secureLogger } from '../utils/logger.js';

/**
 * Economic Event Interface
 */
export interface EconomicEvent {
  id: string;
  name: string;
  scheduledTime: Date;
  timezone: string;
  description: string;
  category: 'employment' | 'inflation' | 'gdp' | 'monetary_policy' | 'earnings' | 'other';
  importance: 'low' | 'medium' | 'high' | 'critical';
  isReleased: boolean;
  actualValue?: number;
  forecastValue?: number;
  previousValue?: number;
}

/**
 * Temporal Context Interface
 */
export interface TemporalContext {
  currentDateTime: Date;
  timezone: string;
  marketHours: {
    isOpen: boolean;
    nextOpen?: Date;
    nextClose?: Date;
  };
  upcomingEvents: EconomicEvent[];
  recentEvents: EconomicEvent[];
}

/**
 * Data Validation Interface
 */
export interface DataValidationResult {
  isValid: boolean;
  confidence: number;
  flags: ValidationFlag[];
  correctedContent?: string;
}

export interface ValidationFlag {
  type: 'temporal_inconsistency' | 'data_fabrication' | 'prediction_mislabeled' | 'confidence_issue';
  severity: 'warning' | 'error' | 'critical';
  message: string;
  suggestedFix?: string;
}

/**
 * Temporal Context Service
 * Prevents data fabrication and ensures temporal awareness in financial analysis
 */
export class TemporalContextService {
  private currentContext: TemporalContext | null = null;
  private readonly KUWAIT_TIMEZONE = 'Asia/Kuwait'; // +3 GMT
  // private readonly _US_MARKET_TIMEZONE = 'America/New_York'; // EST/EDT - Reserved for future timezone conversions

  constructor() {
    // Initialize with minimal context synchronously
    this.currentContext = {
      currentDateTime: new Date(),
      timezone: this.KUWAIT_TIMEZONE,
      marketHours: { isOpen: false },
      upcomingEvents: [],
      recentEvents: []
    };
  }

  /**
   * Initialize temporal context with current time and market conditions
   */
  private async initializeContextAsync(): Promise<void> {
    try {
      const now = new Date();
      
      this.currentContext = {
        currentDateTime: now,
        timezone: this.KUWAIT_TIMEZONE,
        marketHours: this.calculateMarketHours(now),
        upcomingEvents: await this.fetchUpcomingEvents(),
        recentEvents: await this.fetchRecentEvents()
      };

      secureLogger.info('Temporal context initialized', {
        currentTime: now.toISOString(),
        timezone: this.KUWAIT_TIMEZONE,
        upcomingEventsCount: this.currentContext.upcomingEvents.length
      });
    } catch (error) {
      secureLogger.error('Failed to initialize temporal context', { error });
      // Create minimal context as fallback
      this.currentContext = {
        currentDateTime: new Date(),
        timezone: this.KUWAIT_TIMEZONE,
        marketHours: { isOpen: false },
        upcomingEvents: [],
        recentEvents: []
      };
    }
  }

  /**
   * Get current temporal context
   */
  public getCurrentContext(): TemporalContext {
    if (!this.currentContext) {
      this.initializeContextAsync().catch(error => {
        secureLogger.error('Failed to initialize context', { error });
      });
    }
    
    const currentTime = new Date();
    // Always return fresh context with current time
    return {
      ...this.currentContext,
      currentDateTime: currentTime,
      marketHours: this.calculateMarketHours(currentTime)
    } as TemporalContext;
  }

  /**
   * Generate temporal-aware prompt prefix
   */
  public generateTemporalPrompt(): string {
    const context = this.getCurrentContext();
    const kuwaitTime = context.currentDateTime.toLocaleString('en-US', {
      timeZone: this.KUWAIT_TIMEZONE,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    });

    const upcomingEventsText = context.upcomingEvents
      .slice(0, 3)
      .map(event => {
        const eventTime = event.scheduledTime.toLocaleString('en-US', {
          timeZone: this.KUWAIT_TIMEZONE,
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        return `• ${event.name} - Scheduled: ${eventTime} Kuwait time (${event.isReleased ? 'RELEASED' : 'UPCOMING'})`;
      })
      .join('\n');

    return `CRITICAL TEMPORAL CONTEXT - YOU MUST FOLLOW THESE RULES:

📅 CURRENT TIME: ${kuwaitTime}
🕐 Current Kuwait Time: ${context.currentDateTime.toLocaleString('en-US', { timeZone: this.KUWAIT_TIMEZONE })}

🚫 FORBIDDEN ACTIONS:
- NEVER claim future events already happened
- NEVER invent specific economic data numbers (jobs, inflation, GDP, etc.)
- NEVER state unreleased data as fact
- NEVER predict specific numbers for unreleased economic events

✅ REQUIRED ACTIONS:
- Always verify if economic events have been officially released
- Label all predictions clearly as "PREDICTION:" or "FORECAST:"
- Use phrases like "Expected to be released at..." for future events
- Include confidence scores (0-100%) for all predictions
- Add disclaimers for all forward-looking statements

📊 UPCOMING ECONOMIC EVENTS:
${upcomingEventsText || 'No major events scheduled in next 24 hours'}

🏦 MARKET STATUS: ${context.marketHours.isOpen ? 'OPEN' : 'CLOSED'}

ALWAYS remember: Today is ${kuwaitTime}. Do NOT claim future events already happened!

---

Your analysis request:`;
  }

  /**
   * Validate analysis content for temporal consistency and data fabrication
   */
  public validateAnalysisContent(content: string, _originalInput: string): DataValidationResult {
    const flags: ValidationFlag[] = [];
    let correctedContent = content;
    const context = this.getCurrentContext();

    // Check for temporal inconsistencies
    this.checkTemporalConsistency(content, context, flags);
    
    // Check for data fabrication
    this.checkDataFabrication(content, flags);
    
    // Check prediction labeling
    this.checkPredictionLabeling(content, flags);
    
    // Check confidence scores
    this.checkConfidenceScores(content, flags);

    // Apply corrections if needed
    if (flags.some(f => f.severity === 'critical' || f.severity === 'error')) {
      correctedContent = this.applyCorrections(content, flags);
    }

    // Calculate overall confidence
    const confidence = this.calculateValidationConfidence(flags);

    secureLogger.info('Content validation completed', {
      flagCount: flags.length,
      criticalFlags: flags.filter(f => f.severity === 'critical').length,
      confidence
    });

    const result: DataValidationResult = {
      isValid: flags.filter(f => f.severity === 'critical').length === 0,
      confidence,
      flags
    };
    
    if (correctedContent !== content) {
      result.correctedContent = correctedContent;
    }
    
    return result;
  }

  /**
   * Check for temporal inconsistencies
   */
  private checkTemporalConsistency(content: string, _context: TemporalContext, flags: ValidationFlag[]): void {
    
    // Check for phrases claiming future events as past
    const futurePastPhrases = [
      /(?:was|were|has been|have been|showed|reported|announced|released).*?(?:today|this morning|earlier)/i,
      /(?:today's|this morning's).*?(?:nfp|jobs|employment|inflation|gdp).*?(?:came in|was|reported|showed)/i,
      /(?:the|this).*?(?:nfp|jobs report|inflation data|gdp).*?(?:showed|revealed|came in at)/i
    ];

    futurePastPhrases.forEach(pattern => {
      if (pattern.test(content)) {
        flags.push({
          type: 'temporal_inconsistency',
          severity: 'critical',
          message: 'Claims future economic event as already happened',
          suggestedFix: 'Use "Expected to be released at..." or "Forecast:" instead'
        });
      }
    });

    // Check for specific data claims during non-release times
    const dataClaimPatterns = [
      /(?:nfp|jobs|employment).*?(?:\d{1,3},?\d{3}|\d+k|\d+\.\d+%)/i,
      /inflation.*?(?:\d+\.\d+%|\d+%)/i,
      /gdp.*?(?:\d+\.\d+%|\d+%)/i
    ];

    dataClaimPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        flags.push({
          type: 'data_fabrication',
          severity: 'critical',
          message: 'Specific economic data numbers provided without verification',
          suggestedFix: 'Use forecasts with clear "PREDICTION:" labels'
        });
      }
    });
  }

  /**
   * Check for data fabrication
   */
  private checkDataFabrication(content: string, flags: ValidationFlag[]): void {
    // Look for suspiciously specific numbers
    const specificNumberPatterns = [
      /\b(?:235,000|275,000|185,000|205,000)\s*(?:jobs|positions)\b/i,
      /\b(?:3\.2|4\.1|2\.8|5\.3)%\s*(?:inflation|unemployment)\b/i,
      /\b(?:2\.1|1\.8|3\.5|4\.2)%\s*(?:gdp|growth)\b/i
    ];

    specificNumberPatterns.forEach(pattern => {
      if (pattern.test(content)) {
        flags.push({
          type: 'data_fabrication',
          severity: 'error',
          message: 'Suspiciously specific economic data without source verification',
          suggestedFix: 'Replace with general ranges or clear predictions'
        });
      }
    });

    // Check for missing sources on specific claims  
    if (/\b\d+(?:,\d+|\.\d+)?k?\s*jobs\b/i.test(content) && !/(?:source|report|according to|forecast|prediction)/i.test(content)) {
      flags.push({
        type: 'data_fabrication',
        severity: 'error',
        message: 'Specific job numbers without source attribution',
        suggestedFix: 'Add source or label as prediction'
      });
    }
  }

  /**
   * Check prediction labeling
   */
  private checkPredictionLabeling(content: string, flags: ValidationFlag[]): void {
    // Look for predictions that should be labeled
    const predictionKeywords = [
      /(?:expect|anticipate|predict|forecast|likely|should|may|might|could).*?(?:\d+(?:,\d+|\.\d+)?)/i,
      /(?:will|going to|about to).*?(?:rise|fall|increase|decrease|improve|worsen)/i
    ];

    let hasPredictionContent = false;
    predictionKeywords.forEach(pattern => {
      if (pattern.test(content)) {
        hasPredictionContent = true;
      }
    });

    if (hasPredictionContent && !/(?:PREDICTION:|FORECAST:|predicted|forecasted)/i.test(content)) {
      flags.push({
        type: 'prediction_mislabeled',
        severity: 'warning',
        message: 'Predictive content not clearly labeled',
        suggestedFix: 'Add "PREDICTION:" or "FORECAST:" labels'
      });
    }
  }

  /**
   * Check confidence scores
   */
  private checkConfidenceScores(content: string, flags: ValidationFlag[]): void {
    const confidencePattern = /confidence[:\s]*(\d+(?:\.\d+)?)[%\s]/i;
    const match = confidencePattern.exec(content);

    if (!match) {
      flags.push({
        type: 'confidence_issue',
        severity: 'warning',
        message: 'No confidence score provided',
        suggestedFix: 'Include confidence percentage for predictions'
      });
    } else if (match[1]) {
      const confidence = parseFloat(match[1]);
      if (confidence > 95) {
        flags.push({
          type: 'confidence_issue',
          severity: 'warning',
          message: 'Unrealistically high confidence score',
          suggestedFix: 'Use more realistic confidence levels (60-90%)'
        });
      }
    }
  }

  /**
   * Apply corrections to content
   */
  private applyCorrections(content: string, flags: ValidationFlag[]): string {
    let corrected = content;

    // Add disclaimer prefix for critical issues
    const criticalFlags = flags.filter(f => f.severity === 'critical');
    if (criticalFlags.length > 0) {
      corrected = `⚠️ **ANALYSIS DISCLAIMER**: This analysis contains predictions and forecasts only. Economic data will be released at scheduled times.\n\n${corrected}`;
    }

    // Replace specific numbers with ranges for data fabrication
    corrected = corrected.replace(/\b(\d{2,3},?\d{3})\s*jobs\b/gi, 'approximately $1 jobs (forecast)');
    corrected = corrected.replace(/\b(\d+\.\d+)%\s*(inflation|unemployment)\b/gi, 'approximately $1% $2 (forecast)');

    // Add prediction labels
    corrected = corrected.replace(/(expect|anticipate|predict|forecast|likely)([^.!?]*[.!?])/gi, 'PREDICTION: $1$2');

    return corrected;
  }

  /**
   * Calculate validation confidence
   */
  private calculateValidationConfidence(flags: ValidationFlag[]): number {
    let confidence = 1.0;

    flags.forEach(flag => {
      switch (flag.severity) {
        case 'critical':
          confidence -= 0.3;
          break;
        case 'error':
          confidence -= 0.2;
          break;
        case 'warning':
          confidence -= 0.1;
          break;
      }
    });

    return Math.max(0, confidence);
  }

  /**
   * Calculate market hours status
   */
  private calculateMarketHours(currentTime: Date): TemporalContext['marketHours'] {
    // Simplified US market hours (9:30 AM - 4:00 PM ET = 4:30 PM - 11:00 PM Kuwait)
    const kuwaitTime = new Date(currentTime.toLocaleString('en-US', { timeZone: this.KUWAIT_TIMEZONE }));
    const hour = kuwaitTime.getHours();
    const dayOfWeek = kuwaitTime.getDay(); // 0 = Sunday, 6 = Saturday

    // Weekend check
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { isOpen: false };
    }

    // Market hours in Kuwait time (4:30 PM - 11:00 PM)
    const isOpen = hour >= 16 && hour < 23 && (hour > 16 || kuwaitTime.getMinutes() >= 30);

    const marketHours: TemporalContext['marketHours'] = { isOpen };
    
    if (!isOpen) {
      marketHours.nextOpen = this.calculateNextMarketOpen(currentTime);
    }
    
    if (isOpen) {
      marketHours.nextClose = this.calculateNextMarketClose(currentTime);
    }
    
    return marketHours;
  }

  /**
   * Calculate next market open time
   */
  private calculateNextMarketOpen(currentTime: Date): Date {
    const nextOpen = new Date(currentTime);
    nextOpen.setHours(16, 30, 0, 0); // 4:30 PM Kuwait time

    // If market opening has passed today, move to next trading day
    if (nextOpen <= currentTime) {
      nextOpen.setDate(nextOpen.getDate() + 1);
      
      // Skip weekends
      while (nextOpen.getDay() === 0 || nextOpen.getDay() === 6) {
        nextOpen.setDate(nextOpen.getDate() + 1);
      }
    }

    return nextOpen;
  }

  /**
   * Calculate next market close time
   */
  private calculateNextMarketClose(currentTime: Date): Date {
    const nextClose = new Date(currentTime);
    nextClose.setHours(23, 0, 0, 0); // 11:00 PM Kuwait time
    return nextClose;
  }

  /**
   * Fetch upcoming economic events (mock implementation)
   */
  private async fetchUpcomingEvents(): Promise<EconomicEvent[]> {
    // In a real implementation, this would fetch from an economic calendar API
    const now = new Date();
    
    // Mock upcoming NFP event (first Friday of each month at 3:30 PM Kuwait time)
    const nextNFP = this.calculateNextNFP(now);
    
    return [
      {
        id: 'nfp_monthly',
        name: 'Non-Farm Payrolls (NFP)',
        scheduledTime: nextNFP,
        timezone: this.KUWAIT_TIMEZONE,
        description: 'US employment data release',
        category: 'employment',
        importance: 'critical',
        isReleased: nextNFP <= now,
        forecastValue: 180000 // Example forecast
      }
    ];
  }

  /**
   * Fetch recent economic events (mock implementation)
   */
  private async fetchRecentEvents(): Promise<EconomicEvent[]> {
    // Mock recent events
    return [];
  }

  /**
   * Calculate next NFP release date
   */
  private calculateNextNFP(currentTime: Date): Date {
    const nextMonth = new Date(currentTime.getFullYear(), currentTime.getMonth() + 1, 1);
    
    // Find first Friday of next month
    const firstFriday = new Date(nextMonth);
    while (firstFriday.getDay() !== 5) {
      firstFriday.setDate(firstFriday.getDate() + 1);
    }
    
    // Set time to 3:30 PM Kuwait time
    firstFriday.setHours(15, 30, 0, 0);
    
    return firstFriday;
  }

  /**
   * Check if a specific event has been released
   */
  public isEventReleased(eventName: string): boolean {
    const context = this.getCurrentContext();
    const event = [...context.upcomingEvents, ...context.recentEvents]
      .find(e => e.name.toLowerCase().includes(eventName.toLowerCase()));
    
    return event ? event.isReleased : false;
  }

  /**
   * Add temporal disclaimer to analysis
   */
  public addTemporalDisclaimer(content: string): string {
    const context = this.getCurrentContext();
    const timestamp = context.currentDateTime.toLocaleString('en-US', {
      timeZone: this.KUWAIT_TIMEZONE,
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });

    return `${content}

---
⏰ **Analysis Timestamp**: ${timestamp}
⚠️ **Important Disclaimer**: This analysis contains predictions and forecasts only. Economic data releases occur at scheduled times. Never rely on specific numbers for unreleased economic events.`;
  }
}

// Export singleton instance
export const temporalContextService = new TemporalContextService();