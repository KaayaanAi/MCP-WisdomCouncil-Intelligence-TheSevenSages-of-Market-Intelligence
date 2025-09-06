import { secureLogger } from '../utils/logger.js';

/**
 * Query Classification Interface
 */
export interface QueryClassification {
  type: 'historical_data' | 'current_data' | 'future_prediction' | 'analysis_request';
  dataType: 'economic' | 'financial' | 'political' | 'crypto' | 'general';
  timeframe: 'past' | 'present' | 'future' | 'unknown';
  requiresSpecificData: boolean;
  specificDataRequested?: string[];
}

/**
 * Data Availability Check Result
 */
export interface DataAvailabilityResult {
  available: boolean;
  dataType: string;
  reason: string;
  alternativeResponse: string;
  suggestedAction: string;
}

/**
 * Preventive Validation Result
 */
export interface PreventiveValidationResult {
  allowAnalysis: boolean;
  blockReason?: string;
  requiredResponse?: string;
  classification: QueryClassification;
  dataAvailability: DataAvailabilityResult[];
  structuredResponse?: StructuredResponse;
}

/**
 * Structured Response Interface
 */
export interface StructuredResponse {
  dataAvailability: string;
  analysis: string;
  predictions?: string;
  disclaimer: string;
  timestamp: string;
}

/**
 * Preventive Validation Service
 * Prevents AI fabrication by validating queries BEFORE AI analysis
 * 
 * CORE PRINCIPLE: Block fabrication attempts, don't fix them after
 */
export class PreventiveValidationService {
  // private readonly _CURRENT_TIME = new Date(); // Reserved for future temporal validations
  private readonly ECONOMIC_DATA_PATTERNS = [
    /(?:nfp|non.?farm|payroll|job|employment).*?(?:number|data|figure|result)/i,
    /(?:inflation|cpi|pce).*?(?:rate|number|data|figure|result)/i,
    /(?:gdp|gross domestic product).*?(?:growth|rate|number|data|figure|result)/i,
    /(?:unemployment|jobless).*?(?:rate|number|data|figure|result)/i,
    /(?:interest rate|fed rate|federal funds rate).*?(?:decision|announcement|change)/i
  ];

  private readonly FUTURE_DATA_PATTERNS = [
    /(?:today'?s|this morning'?s|current).*?(?:nfp|employment|inflation|gdp)/i,
    /(?:just released|latest|current).*?(?:economic|jobs|employment|inflation)/i,
    /(?:what is|what are|current|latest).*?(?:unemployment rate|inflation rate|job growth)/i
  ];

  private readonly FABRICATION_TRIGGERS = [
    // UNIVERSAL ECONOMIC DATA BLOCKING PATTERNS
    // These patterns block ANY attempt to request current economic data
    
    // Generic "What is" patterns for current data
    /what\s+is\s+(?:current|latest|today'?s)\s+(?:inflation|unemployment|interest|gdp)\s*(?:rate|number|data)/i,
    /what\s+are\s+(?:current|latest|today'?s)\s+(?:inflation|unemployment|interest|fed)\s*(?:rates?|numbers?)/i,
    /what\s+is\s+(?:current|latest|today'?s)\s+(?:bitcoin|ethereum|nasdaq|dow)\s*(?:price|level|value)?/i,
    
    // "Give me" patterns for current data
    /give\s+me.*?(?:current|latest|today'?s).*?(?:numbers|data|figures|rates?|prices?|levels?)/i,
    /tell\s+me.*?(?:current|latest|today'?s).*?(?:numbers|data|figures|rates?|prices?|levels?)/i,
    /show\s+me.*?(?:current|latest|today'?s).*?(?:numbers|data|figures|rates?|prices?|levels?)/i,
    
    // Direct economic metric requests
    /(?:current|latest|today'?s|present)\s+(?:inflation|unemployment|interest|gdp|cpi|pce)\s*(?:rate|number|data|figure|growth|level)/i,
    /(?:current|latest|today'?s|present)\s+(?:nfp|non.?farm|payroll|job|employment)\s*(?:number|data|figure|result|report|growth)/i,
    
    // Market price requests
    /(?:current|latest|today'?s|present)\s+(?:price|level|value)\s+(?:of|for)\s+(?:bitcoin|btc|ethereum|eth|s&p|nasdaq|dow)/i,
    /(?:bitcoin|btc|ethereum|eth)\s+(?:current|latest|today'?s|present)\s*(?:price|level|value|rate)?/i,
    /(?:s&p|sp500|nasdaq|dow)\s+(?:current|latest|today'?s|present)\s*(?:price|level|value|index)?/i,
    
    // "How much" patterns
    /how\s+much\s+(?:is|are)\s+(?:inflation|unemployment|interest|gdp|bitcoin|ethereum|s&p|nasdaq)/i,
    /how\s+high\s+(?:is|are)\s+(?:inflation|unemployment|interest|rates?)/i,
    /how\s+low\s+(?:is|are)\s+(?:unemployment|rates?)/i,
    
    // Released/announced patterns (claiming current data exists)
    /(?:just\s+)?(?:released|announced|published|reported)\s+(?:today|this\s+morning|earlier)/i,
    /(?:today'?s|latest)\s+(?:nfp|jobs|employment|inflation)\s+(?:report|data)/i,
    
    // Temporal current data patterns
    /(?:as\s+of\s+)?(?:today|now|currently|right\s+now|at\s+present)/i,
    /real.?time.*?(?:data|price|rate|level)/i,
    /live.*?(?:data|price|rate|level)/i,
    
    // UNIVERSAL FINANCIAL DATA BLOCKING
    // Block requests for specific financial numbers/prices regardless of asset
    /current.*?(?:price|level|rate|value)\s*(?:of|for|is)/i,
    /latest.*?(?:price|level|rate|value|number|figure)/i,
    /today'?s.*?(?:price|level|rate|value|number|figure)/i,
    
    // Question patterns about specific values
    /what.*?(?:price|rate|level|value).*?(?:today|now|currently|right\s+now)/i,
    /where.*?(?:price|rate|level|index).*?(?:today|now|currently|right\s+now)/i,
    /when.*?(?:released|announced).*?(?:today|this\s+morning)/i
  ];

  /**
   * Main validation entry point - called BEFORE AI analysis
   */
  public async validateQuery(query: string, context?: any): Promise<PreventiveValidationResult> {
    const startTime = Date.now();
    
    secureLogger.info('PreventiveValidation: Analyzing query', { 
      queryLength: query.length,
      hasContext: !!context 
    });

    // STEP 0: UNIVERSAL FABRICATION CHECK (0ms blocking goal)
    // Check for fabrication triggers FIRST for immediate blocking
    const universalBlockResult = this.universalFabricationCheck(query);
    if (universalBlockResult.shouldBlock) {
      const blockDuration = Date.now() - startTime;
      
      secureLogger.info('UNIVERSAL BLOCK: Query blocked immediately', {
        duration: `${blockDuration}ms`,
        trigger: universalBlockResult.trigger,
        blockReason: universalBlockResult.reason
      });

      return {
        allowAnalysis: false,
        blockReason: universalBlockResult.reason,
        requiredResponse: universalBlockResult.standardResponse,
        classification: { type: 'current_data', dataType: 'economic', timeframe: 'present', requiresSpecificData: true },
        dataAvailability: [{
          available: false,
          dataType: universalBlockResult.dataType,
          reason: universalBlockResult.reason,
          alternativeResponse: universalBlockResult.standardResponse,
          suggestedAction: universalBlockResult.suggestedSources
        }],
        structuredResponse: {
          dataAvailability: `❌ UNIVERSAL BLOCK: Request for current ${universalBlockResult.dataType} data blocked`,
          analysis: `BLOCKED: ${universalBlockResult.reason}`,
          disclaimer: `UNIVERSAL TRUTH VALIDATION: ${universalBlockResult.standardResponse}`,
          timestamp: `Blocked in ${blockDuration}ms at: ${new Date().toISOString()}`
        }
      };
    }

    // Step 1: Classify the query (only if not universally blocked)
    const classification = this.classifyQuery(query);
    
    // Step 2: Check data availability for the classification
    const dataAvailability = this.checkDataAvailability(classification);
    
    // Step 3: Determine if analysis should be blocked
    const validationResult = this.makeValidationDecision(query, classification, dataAvailability);
    
    const totalDuration = Date.now() - startTime;
    secureLogger.info('PreventiveValidation: Validation complete', {
      duration: `${totalDuration}ms`,
      allowAnalysis: validationResult.allowAnalysis,
      blockReason: validationResult.blockReason,
      classification: classification.type,
      dataType: classification.dataType
    });

    return validationResult;
  }

  /**
   * Classify the type of query to understand intent
   */
  private classifyQuery(query: string): QueryClassification {
    // Check for specific data requests
    const specificDataRequested: string[] = [];
    
    // Economic data detection
    this.ECONOMIC_DATA_PATTERNS.forEach(pattern => {
      const match = pattern.exec(query);
      if (match) {
        specificDataRequested.push(match[0]);
      }
    });

    // Determine query type
    let type: QueryClassification['type'] = 'analysis_request';
    let timeframe: QueryClassification['timeframe'] = 'unknown';

    // Check for current/future data requests
    if (this.FUTURE_DATA_PATTERNS.some(pattern => pattern.test(query))) {
      type = 'current_data';
      timeframe = 'present';
    }

    // Check for prediction requests
    if (/(?:predict|forecast|expect|will be|going to|outlook)/i.test(query)) {
      type = 'future_prediction';
      timeframe = 'future';
    }

    // Check for historical requests
    if (/(?:last|previous|historical|past|yesterday|last week|last month)/i.test(query)) {
      type = 'historical_data';
      timeframe = 'past';
    }

    // Determine data type
    let dataType: QueryClassification['dataType'] = 'general';
    if (/(?:nfp|employment|jobs|unemployment|inflation|gdp|interest rate|fed)/i.test(query)) {
      dataType = 'economic';
    } else if (/(?:stocks|markets|trading|bonds|forex|sp500|nasdaq)/i.test(query)) {
      dataType = 'financial';
    } else if (/(?:bitcoin|crypto|ethereum|blockchain|defi)/i.test(query)) {
      dataType = 'crypto';
    } else if (/(?:election|policy|government|regulation|political)/i.test(query)) {
      dataType = 'political';
    }

    return {
      type,
      dataType,
      timeframe,
      requiresSpecificData: specificDataRequested.length > 0,
      ...(specificDataRequested.length > 0 && { specificDataRequested })
    };
  }

  /**
   * Check if requested data is actually available
   */
  private checkDataAvailability(classification: QueryClassification): DataAvailabilityResult[] {
    const results: DataAvailabilityResult[] = [];
    
    // For current economic data requests
    if (classification.type === 'current_data' && classification.dataType === 'economic') {
      // Check if specific economic data is available RIGHT NOW
      const economicDataAvailable = this.checkEconomicDataAvailability();
      
      results.push({
        available: economicDataAvailable.available,
        dataType: 'economic',
        reason: economicDataAvailable.reason,
        alternativeResponse: economicDataAvailable.alternativeResponse,
        suggestedAction: economicDataAvailable.suggestedAction
      });
    }

    // For real-time market data
    if (classification.dataType === 'financial' && classification.timeframe === 'present') {
      results.push({
        available: false, // We don't have real-time market data
        dataType: 'financial',
        reason: 'Real-time market data not available in this system',
        alternativeResponse: 'I cannot provide current market prices or real-time financial data. I can analyze trends and provide general market commentary based on recent patterns.',
        suggestedAction: 'Use a financial data provider for current market prices'
      });
    }

    // For crypto data
    if (classification.dataType === 'crypto' && classification.timeframe === 'present') {
      results.push({
        available: false,
        dataType: 'crypto',
        reason: 'Real-time cryptocurrency data not available',
        alternativeResponse: 'I cannot provide current cryptocurrency prices or real-time blockchain data. I can discuss general crypto trends and analysis patterns.',
        suggestedAction: 'Check a cryptocurrency exchange or data provider for current prices'
      });
    }

    return results;
  }

  /**
   * Check if economic data is actually available right now
   */
  private checkEconomicDataAvailability(): DataAvailabilityResult {
    // Economic data is typically released during business hours
    // NFP: First Friday of month at 8:30 AM ET (1:30 PM UTC, 4:30 PM Kuwait)
    // Inflation: Mid-month around 8:30 AM ET
    // Most data: Tuesday-Friday, 8:30 AM - 10:00 AM ET
    
    // Even during business hours, we don't have a real data feed
    // This system CANNOT provide real economic data numbers
    return {
      available: false,
      dataType: 'economic',
      reason: 'Economic data requires official sources and real-time feeds not available in this system',
      alternativeResponse: 'I cannot provide current economic data numbers. Economic data is released by official sources like the Bureau of Labor Statistics, Federal Reserve, etc. I can discuss expected trends and analysis patterns.',
      suggestedAction: 'Check official economic data sources (BLS.gov, FRED, Reuters, Bloomberg) for current releases'
    };
  }

  /**
   * Make the final validation decision
   */
  private makeValidationDecision(
    query: string, 
    classification: QueryClassification, 
    dataAvailability: DataAvailabilityResult[]
  ): PreventiveValidationResult {
    
    // HARD STOP: Block current data requests for unavailable data
    const unavailableData = dataAvailability.filter(d => !d.available);
    
    if (unavailableData.length > 0 && classification.type === 'current_data') {
      const firstUnavailable = unavailableData[0];
      if (!firstUnavailable) {
        throw new Error('Unexpected: unavailableData array is empty after filtering');
      }
      const structuredResponse = this.createDataUnavailableResponse(classification, firstUnavailable);
      
      return {
        allowAnalysis: false,
        blockReason: 'Requested current data is not available - preventing fabrication',
        requiredResponse: firstUnavailable.alternativeResponse,
        classification,
        dataAvailability,
        structuredResponse
      };
    }

    // HARD STOP: Block fabrication trigger patterns
    if (this.FABRICATION_TRIGGERS.some(pattern => pattern.test(query))) {
      const structuredResponse = this.createFabricationBlockResponse(classification);
      
      return {
        allowAnalysis: false,
        blockReason: 'Query pattern indicates request for specific data that would lead to fabrication',
        requiredResponse: structuredResponse?.analysis || 'Analysis blocked to prevent fabrication',
        classification,
        dataAvailability,
        structuredResponse
      };
    }

    // ALLOW: Analysis and prediction requests (with proper disclaimers)
    if (classification.type === 'future_prediction' || classification.type === 'analysis_request') {
      return {
        allowAnalysis: true,
        classification,
        dataAvailability,
        structuredResponse: this.createAnalysisResponse(classification)
      };
    }

    // ALLOW: Historical analysis (with disclaimers about data sources)
    if (classification.type === 'historical_data') {
      return {
        allowAnalysis: true,
        classification,
        dataAvailability,
        structuredResponse: this.createHistoricalResponse(classification)
      };
    }

    // Default: Allow with maximum caution
    return {
      allowAnalysis: true,
      classification,
      dataAvailability,
      structuredResponse: this.createCautiousResponse(classification)
    };
  }

  /**
   * Create structured response for data unavailable cases
   */
  private createDataUnavailableResponse(
    classification: QueryClassification, 
    dataResult: DataAvailabilityResult
  ): StructuredResponse {
    const timestamp = new Date().toISOString();
    
    return {
      dataAvailability: `BLOCKED REQUEST: Current ${classification.dataType} data not available`,
      analysis: `BLOCKED: ${dataResult.reason}`,
      disclaimer: `SYSTEM BLOCK: Request refused to prevent data fabrication. ${dataResult.suggestedAction}`,
      timestamp: `Request blocked at: ${timestamp}`
    };
  }

  /**
   * Create structured response blocking fabrication attempts
   */
  private createFabricationBlockResponse(classification: QueryClassification): StructuredResponse {
    const timestamp = new Date().toISOString();
    
    return {
      dataAvailability: `BLOCKED REQUEST: Current ${classification.dataType} data not available`,
      analysis: `BLOCKED: System cannot provide current ${classification.dataType} data`,
      disclaimer: `SYSTEM BLOCK: Request refused to prevent AI fabrication`,
      timestamp: `Request blocked at: ${timestamp}`
    };
  }

  /**
   * Create structured response for allowed analysis
   */
  private createAnalysisResponse(classification: QueryClassification): StructuredResponse {
    const timestamp = new Date().toISOString();
    
    return {
      dataAvailability: `✅ **ANALYSIS MODE**: This request is for analysis or predictions, which can be provided with appropriate disclaimers.`,
      analysis: `Analysis proceeding for ${classification.dataType} ${classification.type} request.`,
      ...(classification.type === 'future_prediction' && {
        predictions: `🔮 **PREDICTIONS**: All forward-looking statements are forecasts only and subject to significant uncertainty.`
      }),
      disclaimer: `⚠️ **ANALYSIS DISCLAIMER**: This analysis contains predictions and interpretations only. No specific current data numbers are provided. Always verify with official sources.`,
      timestamp: `Analysis started at: ${timestamp}`
    };
  }

  /**
   * Create structured response for historical data
   */
  private createHistoricalResponse(classification: QueryClassification): StructuredResponse {
    const timestamp = new Date().toISOString();
    
    return {
      dataAvailability: `✅ **HISTORICAL ANALYSIS**: Request for historical data analysis approved with source disclaimers.`,
      analysis: `Historical ${classification.dataType} analysis proceeding with available information.`,
      disclaimer: `📚 **HISTORICAL DATA DISCLAIMER**: Historical references are based on general knowledge and may not include the most recent updates. Verify specific historical data with official sources.`,
      timestamp: `Analysis started at: ${timestamp}`
    };
  }

  /**
   * Create cautious response for unclear requests
   */
  private createCautiousResponse(classification: QueryClassification): StructuredResponse {
    const timestamp = new Date().toISOString();
    
    return {
      dataAvailability: `⚠️ **CAUTIOUS MODE**: Query classification unclear, proceeding with maximum caution.`,
      analysis: `Analysis proceeding with heightened caution for ${classification.dataType} content.`,
      disclaimer: `⚠️ **CAUTION DISCLAIMER**: This analysis avoids specific current data numbers and focuses on general trends and frameworks only. Verify all information with appropriate sources.`,
      timestamp: `Cautious analysis started at: ${timestamp}`
    };
  }

  /**
   * Utility: Check if today is first Friday of month (NFP release)
   */
  // Reserved for future NFP data detection
  // Reserved for future NFP data detection functionality
  // private _isFirstFridayOfMonth(date: Date): boolean {
  //   const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  //   const firstFriday = new Date(firstDay);
  //   
  //   while (firstFriday.getDay() !== 5) {
  //     firstFriday.setDate(firstFriday.getDate() + 1);
  //   }
  //   
  //   return date.toDateString() === firstFriday.toDateString();
  // }

  /**
   * Utility: Check if this is inflation release week (typically mid-month)
   */
  // Reserved for future inflation data detection
  // Reserved for future inflation data detection functionality
  // private _isInflationReleaseWeek(date: Date): boolean {
  //   const dayOfMonth = date.getDate();
  //   return dayOfMonth >= 10 && dayOfMonth <= 16; // Rough inflation release window
  // }

  /**
   * UNIVERSAL FABRICATION CHECK - Fast 0ms blocking for ALL data fabrication attempts
   * This is the core universal truth validation method
   */
  private universalFabricationCheck(query: string): {
    shouldBlock: boolean;
    reason: string;
    trigger: string;
    dataType: string;
    standardResponse: string;
    suggestedSources: string;
  } {
    const normalizedQuery = query.toLowerCase().trim();
    
    // UNIVERSAL BLOCKING LOGIC: Check ALL fabrication triggers
    for (let i = 0; i < this.FABRICATION_TRIGGERS.length; i++) {
      const pattern = this.FABRICATION_TRIGGERS[i];
      if (pattern && pattern.test(normalizedQuery)) {
        // Determine data type from the trigger
        let dataType = 'economic';
        if (/bitcoin|ethereum|crypto|btc|eth/.test(normalizedQuery)) {
          dataType = 'cryptocurrency';
        } else if (/s&p|nasdaq|dow|stock|market/.test(normalizedQuery)) {
          dataType = 'financial market';
        }
        
        return {
          shouldBlock: true,
          reason: `Universal truth validation blocks all requests for current ${dataType} data`,
          trigger: `Pattern #${i + 1}: ${pattern?.source.substring(0, 50)}...`,
          dataType,
          standardResponse: `I cannot provide current ${dataType} data as this system prevents data fabrication. For accurate current data, please consult official sources.`,
          suggestedSources: this.getOfficialSources(dataType)
        };
      }
    }
    
    // ADDITIONAL UNIVERSAL CHECKS: Catch any remaining current data requests
    const universalCurrentDataPatterns = [
      /\b(?:current|latest|today'?s|now)\b.*?\b(?:price|rate|level|value|number|data)\b/i,
      /\b(?:what\s+is|tell\s+me|give\s+me)\b.*?\b(?:current|latest|today'?s)\b/i,
      /\b(?:as\s+of\s+today|right\s+now|at\s+present)\b/i
    ];
    
    for (const pattern of universalCurrentDataPatterns) {
      if (pattern.test(normalizedQuery)) {
        return {
          shouldBlock: true,
          reason: 'Universal truth validation blocks all current data requests without verified sources',
          trigger: `Universal pattern: ${pattern.source}`,
          dataType: 'general',
          standardResponse: 'I cannot provide current data as this system prevents data fabrication. For accurate current information, please consult official sources.',
          suggestedSources: 'Official government sources, verified financial data providers, or authoritative news outlets'
        };
      }
    }
    
    return {
      shouldBlock: false,
      reason: '',
      trigger: '',
      dataType: '',
      standardResponse: '',
      suggestedSources: ''
    };
  }
  
  /**
   * Get official sources for different data types
   */
  private getOfficialSources(dataType: string): string {
    const sources: { [key: string]: string } = {
      'economic': 'Federal Reserve Economic Data (FRED), Bureau of Labor Statistics (BLS.gov), Bureau of Economic Analysis (BEA.gov)',
      'financial market': 'Your broker, Yahoo Finance, Bloomberg, Reuters, official exchange websites',
      'cryptocurrency': 'CoinMarketCap, CoinGecko, major cryptocurrency exchanges (Coinbase, Binance, Kraken)',
      'general': 'Official government sources, verified financial data providers, authoritative news outlets'
    };
    
    return sources[dataType] || 'Official government sources, verified financial data providers, authoritative news outlets';
  }

  /**
   * Test method to check if query would trigger fabrication blocks
   */
  public testForFabricationRisk(query: string): {
    wouldBlock: boolean;
    reason: string;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  } {
    const classification = this.classifyQuery(query);
    const dataAvailability = this.checkDataAvailability(classification);
    
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let wouldBlock = false;
    let reason = 'Query appears safe for analysis';

    if (this.FABRICATION_TRIGGERS.some(pattern => pattern.test(query))) {
      wouldBlock = true;
      riskLevel = 'CRITICAL';
      reason = 'Query matches fabrication trigger patterns';
    } else if (classification.type === 'current_data' && dataAvailability.some(d => !d.available)) {
      wouldBlock = true;
      riskLevel = 'HIGH';
      reason = 'Requests current data that is not available';
    } else if (classification.requiresSpecificData) {
      riskLevel = 'MEDIUM';
      reason = 'Requests specific data - heightened caution needed';
    }

    return { wouldBlock, reason, riskLevel };
  }
}

// Export singleton instance
export const preventiveValidationService = new PreventiveValidationService();