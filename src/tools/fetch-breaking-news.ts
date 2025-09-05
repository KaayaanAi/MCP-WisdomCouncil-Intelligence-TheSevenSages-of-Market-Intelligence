import { z } from 'zod';
import { newsFetcherService } from '../services/news-fetcher.js';
import { analystManager } from '../services/analysts.js';
import { secureLogger } from '../utils/logger.js';
import { ToolResponse, NewsItem } from '../types/index.js';

/**
 * Input validation schema for fetch_breaking_news tool
 */
const fetchBreakingNewsSchema = z.object({
  category: z.enum(["all", "stocks", "crypto", "forex", "commodities", "politics", "economics"])
    .optional()
    .default("all"),
  
  max_items: z.number()
    .min(1, "Maximum items must be at least 1")
    .max(50, "Maximum items cannot exceed 50")
    .optional()
    .default(10),
  
  time_range: z.enum(["1h", "6h", "12h", "24h"])
    .optional()
    .default("6h"),
  
  include_analysis: z.boolean()
    .optional()
    .default(true)
});

/**
 * Analyze news impact using our analyst system
 */
async function analyzeNewsImpact(newsItems: NewsItem[]): Promise<Record<string, any>[]> {
  const analyses: Record<string, any>[] = [];
  
  // Analyze up to 5 most relevant news items to avoid overwhelming the system
  const itemsToAnalyze = newsItems
    .sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
    .slice(0, 5);
  
  for (const item of itemsToAnalyze) {
    try {
      // Create a focused prompt for news impact analysis
      const impactPrompt = `Analyze the market impact of this news item:

Title: ${item.title}
Content: ${item.content}
Source: ${item.source}
Published: ${item.publishedAt.toLocaleString()}

Provide a brief impact assessment (50 words max) focusing on:
- Immediate market implications
- Affected sectors/assets
- Confidence level (0-100%)
- Impact severity (LOW/MEDIUM/HIGH)`;

      // Get quick analysis from the most relevant analyst
      const relevantAnalyst = determineRelevantAnalyst(item.title, item.content, item.category);
      const analyst = analystManager.getAnalystInfo(relevantAnalyst);
      
      if (analyst) {
        // Use a simplified analysis for speed
        const analysisResult = await analystManager.getConsensusAnalysis(
          impactPrompt,
          'quick',
          [relevantAnalyst]
        );
        
        analyses.push({
          newsId: item.id,
          title: item.title,
          analyst: analyst.name,
          impact: extractImpactSummary(analysisResult.consensus),
          confidence: analysisResult.confidence,
          severity: extractSeverity(analysisResult.consensus),
          affectedSectors: extractAffectedSectors(analysisResult.consensus)
        });
      } else {
        // Fallback basic analysis
        analyses.push({
          newsId: item.id,
          title: item.title,
          analyst: 'automated',
          impact: generateBasicImpact(item),
          confidence: 0.6,
          severity: 'MEDIUM',
          affectedSectors: []
        });
      }
      
    } catch (error) {
      secureLogger.warn(`News impact analysis failed for item ${item.id}`, { error });
      
      // Fallback analysis
      analyses.push({
        newsId: item.id,
        title: item.title,
        analyst: 'fallback',
        impact: 'Impact analysis unavailable - please review manually',
        confidence: 0.3,
        severity: 'UNKNOWN',
        affectedSectors: []
      });
    }
  }
  
  return analyses;
}

function determineRelevantAnalyst(title: string, content: string, category: string): string {
  const text = `${title} ${content}`.toLowerCase();
  
  // Category-based mapping
  if (category === 'crypto') return 'crypto_analyst';
  if (category === 'politics') return 'political_analyst';
  if (category === 'economics') return 'economic_analyst';
  
  // Keyword-based mapping
  if (text.includes('government') || text.includes('policy') || text.includes('regulation')) {
    return 'political_analyst';
  }
  if (text.includes('fed') || text.includes('interest') || text.includes('inflation') || text.includes('gdp')) {
    return 'economic_analyst';
  }
  if (text.includes('war') || text.includes('conflict') || text.includes('trade') || text.includes('sanctions')) {
    return 'geopolitical_analyst';
  }
  if (text.includes('crypto') || text.includes('bitcoin') || text.includes('blockchain')) {
    return 'crypto_analyst';
  }
  if (text.includes('ai') || text.includes('tech') || text.includes('innovation')) {
    return 'tech_analyst';
  }
  if (text.includes('sentiment') || text.includes('fear') || text.includes('panic') || text.includes('rally')) {
    return 'behavioral_analyst';
  }
  
  // Default to financial analyst
  return 'financial_analyst';
}

function extractImpactSummary(analysis: string): string {
  // Extract the first meaningful sentence or key finding
  const sentences = analysis.split(/[.!?]+/).filter(s => s.trim().length > 10);
  return sentences[0]?.trim().substring(0, 100) || 'Impact analysis pending';
}

function extractSeverity(analysis: string): string {
  const severityMatch = analysis.match(/(?:impact|severity)[:\s]*(?:level[:\s]*)?(low|medium|high|critical)/i);
  return severityMatch && severityMatch[1] ? severityMatch[1].toUpperCase() : 'MEDIUM';
}

function extractAffectedSectors(analysis: string): string[] {
  const commonSectors = [
    'technology', 'healthcare', 'finance', 'energy', 'retail',
    'manufacturing', 'transportation', 'real estate', 'commodities',
    'cryptocurrency', 'banking', 'automotive', 'defense'
  ];
  
  const text = analysis.toLowerCase();
  return commonSectors.filter(sector => text.includes(sector));
}

function generateBasicImpact(item: NewsItem): string {
  const { title, content, category } = item;
  const text = `${title} ${content}`.toLowerCase();
  
  // Basic sentiment and keyword analysis
  const positiveKeywords = ['growth', 'gain', 'rise', 'increase', 'positive', 'strong', 'bull'];
  const negativeKeywords = ['fall', 'drop', 'decline', 'loss', 'negative', 'weak', 'bear', 'crash'];
  
  const positiveCount = positiveKeywords.filter(kw => text.includes(kw)).length;
  const negativeCount = negativeKeywords.filter(kw => text.includes(kw)).length;
  
  let sentiment = 'neutral';
  if (positiveCount > negativeCount) sentiment = 'positive';
  if (negativeCount > positiveCount) sentiment = 'negative';
  
  return `Basic analysis suggests ${sentiment} impact on ${category} markets. Manual review recommended.`;
}

/**
 * Format breaking news response with rich formatting
 */
function formatNewsResponse(
  newsItems: NewsItem[],
  analyses: Record<string, any>[],
  category: string,
  timeRange: string,
  includeAnalysis: boolean,
  duration: number,
  sourceStatus: any
): string {
  const categoryEmojis: Record<string, string> = {
    'all': '🌐',
    'stocks': '📈',
    'crypto': '₿',
    'forex': '💱',
    'commodities': '🛢️',
    'politics': '🏛️',
    'economics': '📊'
  };

  const timeEmojis: Record<string, string> = {
    '1h': '⚡',
    '6h': '⏰',
    '12h': '🕐',
    '24h': '📅'
  };

  const severityEmojis: Record<string, string> = {
    'LOW': '🟢',
    'MEDIUM': '🟡',
    'HIGH': '🟠',
    'CRITICAL': '🔴',
    'UNKNOWN': '⚪'
  };

  let response = `# 📰 **Breaking Financial News Intelligence**

## 📊 **News Summary**
${categoryEmojis[category]} **Category**: ${category.toUpperCase()}
${timeEmojis[timeRange]} **Time Range**: ${timeRange}
🔢 **Items Found**: ${newsItems.length}
⚡ **Processing Time**: ${duration}ms
${includeAnalysis ? '🧠 **Impact Analysis**: ENABLED' : '📄 **Impact Analysis**: DISABLED'}

---

`;

  // Add news items
  newsItems.forEach((item, index) => {
    const analysis = analyses.find(a => a.newsId === item.id);
    const timeAgo = Math.floor((Date.now() - item.publishedAt.getTime()) / (1000 * 60));
    
    response += `## ${index + 1}. **${item.title}**

📅 **Published**: ${timeAgo < 60 ? `${timeAgo}m` : `${Math.floor(timeAgo/60)}h`} ago by **${item.source}**
🔗 **Link**: [View Article](${item.url})
📊 **Relevance Score**: ${((item.relevanceScore || 0) * 100).toFixed(0)}%

**Summary**: ${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}

`;

    if (includeAnalysis && analysis) {
      response += `### 🧠 **Impact Analysis** (${analysis.analyst.replace('_', ' ').toUpperCase()})
${severityEmojis[analysis.severity]} **Impact Severity**: ${analysis.severity}
📈 **Confidence**: ${(analysis.confidence * 100).toFixed(0)}%
💡 **Analysis**: ${analysis.impact}
${analysis.affectedSectors.length > 0 ? `🎯 **Affected Sectors**: ${analysis.affectedSectors.join(', ')}` : ''}

`;
    }

    response += '---\n\n';
  });

  // Add source status
  response += `## 🔧 **Data Source Status**

### 📡 **RSS Feeds**
- **Business**: ${sourceStatus.rss_feeds.business} feeds active
- **Crypto**: ${sourceStatus.rss_feeds.crypto} feeds active  
- **Politics**: ${sourceStatus.rss_feeds.politics} feeds active
- **Economics**: ${sourceStatus.rss_feeds.economics} feeds active

### 🔑 **API Status**
`;

  Object.entries(sourceStatus.api_quotas).forEach(([provider, status]: [string, any]) => {
    response += `- **${provider.toUpperCase()}**: ${status.remaining} requests remaining\n`;
  });

  response += `
### 💾 **Cache**
- **Cached Entries**: ${sourceStatus.cache_size}
- **Cache Hit Rate**: Optimized for 30-minute freshness

---

## 📈 **Market Intelligence Insights**

`;

  if (includeAnalysis && analyses.length > 0) {
    const severityCounts = analyses.reduce((acc, analysis) => {
      acc[analysis.severity] = (acc[analysis.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const avgConfidence = analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length;

    response += `### 🎯 **Overall Assessment**
- **Average Analysis Confidence**: ${(avgConfidence * 100).toFixed(0)}%
- **Impact Distribution**: ${Object.entries(severityCounts).map(([severity, count]) => `${severityEmojis[severity]} ${severity}: ${count}`).join(', ')}
- **Most Active Analyst**: ${getMostActiveAnalyst(analyses)}

### 🔮 **Key Market Signals**
`;

    // Extract key themes
    const allSectors = analyses.flatMap(a => a.affectedSectors);
    const sectorCounts = allSectors.reduce((acc, sector) => {
      acc[sector] = (acc[sector] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topSectors = Object.entries(sectorCounts)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([sector, count]) => `**${sector}** (${count} mentions)`);

    if (topSectors.length > 0) {
      response += `🎯 **Most Affected Sectors**: ${topSectors.join(', ')}\n`;
    }

    // High impact news
    const highImpactNews = analyses.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL');
    if (highImpactNews.length > 0) {
      response += `⚠️  **High Impact Alerts**: ${highImpactNews.length} news items require immediate attention\n`;
    }

    response += `📊 **Sentiment Overview**: ${calculateOverallSentiment(analyses)}\n`;
  } else {
    response += `⚠️ **Impact analysis disabled** - Enable with \`include_analysis: true\` for market impact insights\n`;
  }

  response += `

---
*🔒 Powered by MCP NextGen Financial Intelligence • Real-time News with AI-Enhanced Impact Analysis*`;

  return response;
}

function getMostActiveAnalyst(analyses: Record<string, any>[]): string {
  const analystCounts = analyses.reduce((acc, a) => {
    acc[a.analyst] = (acc[a.analyst] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const topAnalyst = Object.entries(analystCounts)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0];

  return topAnalyst ? topAnalyst[0].replace('_', ' ').toUpperCase() : 'N/A';
}

function calculateOverallSentiment(analyses: Record<string, any>[]): string {
  const impacts = analyses.map(a => a.impact.toLowerCase());
  
  let positiveSignals = 0;
  let negativeSignals = 0;
  
  impacts.forEach(impact => {
    if (impact.includes('positive') || impact.includes('gain') || impact.includes('rise')) {
      positiveSignals++;
    }
    if (impact.includes('negative') || impact.includes('fall') || impact.includes('decline')) {
      negativeSignals++;
    }
  });

  if (positiveSignals > negativeSignals) return '📈 Bullish bias detected';
  if (negativeSignals > positiveSignals) return '📉 Bearish bias detected';
  return '➡️ Mixed/Neutral sentiment';
}

/**
 * Fetch Breaking News Tool Implementation  
 * Priority Tool #2 - Data foundation providing prioritized market news
 */
export async function fetchBreakingNews(args: any): Promise<ToolResponse> {
  const startTime = Date.now();
  
  try {
    // Validate input parameters with strict security
    const validatedArgs = fetchBreakingNewsSchema.parse(args);
    const { category, max_items, time_range, include_analysis } = validatedArgs;
    
    secureLogger.info('Breaking news fetch initiated', {
      category,
      maxItems: max_items,
      timeRange: time_range,
      includeAnalysis: include_analysis
    });
    
    // Fetch news from our news service
    const newsItems = await newsFetcherService.fetchNews(
      category,
      max_items,
      time_range,
      true // Use cache
    );
    
    if (newsItems.length === 0) {
      const duration = Date.now() - startTime;
      secureLogger.info('No news items found', { category, timeRange: time_range, duration });
      
      return {
        content: [{ 
          type: "text", 
          text: `📰 **No Breaking News Found**

**Search Parameters:**
- Category: ${category}
- Time Range: ${time_range}  
- Max Items: ${max_items}

**Possible Reasons:**
- No news available in specified time range
- All news sources temporarily unavailable
- Category filter too restrictive

**Suggestions:**
- Try expanding time range (e.g., '12h' or '24h')
- Use 'all' category for broader results
- Check back in a few minutes

*News sources are continuously monitored - fresh content updates every 30 minutes*` 
        }]
      };
    }
    
    // Perform impact analysis if requested
    let analyses: Record<string, any>[] = [];
    if (include_analysis) {
      try {
        analyses = await analyzeNewsImpact(newsItems);
        secureLogger.info('News impact analysis completed', { 
          analyzedItems: analyses.length,
          totalNewsItems: newsItems.length 
        });
      } catch (error) {
        secureLogger.warn('Impact analysis failed, continuing without analysis', { error });
        // Continue without analysis rather than failing completely
      }
    }
    
    // Get source status for transparency
    const sourceStatus = newsFetcherService.getSourceStatus();
    
    const duration = Date.now() - startTime;
    const formattedResponse = formatNewsResponse(
      newsItems,
      analyses,
      category,
      time_range,
      include_analysis,
      duration,
      sourceStatus
    );
    
    secureLogger.info('Breaking news fetch completed', {
      duration,
      newsItems: newsItems.length,
      analysisCount: analyses.length,
      category,
      timeRange: time_range
    });
    
    return {
      content: [{ type: "text", text: formattedResponse }]
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    secureLogger.error('Breaking news fetch failed', { error, duration });
    
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**: ${validationErrors}\n\nValid parameters:\n• **category**: all, stocks, crypto, forex, commodities, politics, economics\n• **max_items**: 1-50 (default: 10)\n• **time_range**: 1h, 6h, 12h, 24h (default: 6h)\n• **include_analysis**: true/false (default: true)` 
        }],
        isError: true
      };
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `❌ **Breaking News Fetch Error**: ${error instanceof Error ? error.message : String(error)}\n\nThe news fetching system encountered an issue. This could be due to:\n• RSS feed connectivity issues\n• News API rate limits reached\n• Network connectivity problems\n• Temporary service overload\n\n**Available News Sources:**\n• RSS feeds (unlimited): Reuters, BBC, CNBC, MarketWatch, CoinTelegraph\n• APIs (quota limited): NewsAPI, GNews\n\nPlease try again in a few moments.` 
      }],
      isError: true
    };
  }
}