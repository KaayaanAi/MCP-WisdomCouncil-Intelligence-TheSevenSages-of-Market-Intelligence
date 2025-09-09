import { ToolResponse } from '../types/index.js';
import { secureLogger } from '../utils/logger.js';
import { StandardErrorHandler } from '../utils/error-handler.js';
import { SERVER_CONSTANTS } from '../constants/server-constants.js';
import { multiAnalystConsensus } from './multi-analyst-consensus.js';
import { fetchBreakingNews } from './fetch-breaking-news.js';

/**
 * Complete Financial Intelligence Analysis Tool
 * 
 * This unified tool combines all available analysis capabilities:
 * - 7 AI Analyst Consensus Analysis
 * - Breaking News Fetching and Impact Analysis
 * - Comprehensive Market Intelligence Report
 * 
 * Designed for maximum compatibility with Universal MCP Architecture
 * and optimized for n8n-nodes-mcp integration
 */

export interface CompleteAnalysisArgs {
  query: string;
  analysis_depth?: 'quick' | 'standard' | 'deep';
  include_news?: boolean;
  news_categories?: string[];
  max_news_items?: number;
  time_range?: '1h' | '6h' | '12h' | '24h';
  sage_perspectives?: string[];
}

export async function completeFinancialIntelligenceAnalysis(args: CompleteAnalysisArgs): Promise<ToolResponse> {
  const startTime = Date.now();
  
  try {
    const params = parseAnalysisParameters(args);
    
    secureLogger.info('Starting complete financial intelligence analysis', {
      query: args.query,
      depth: params.analysisDepth,
      includeNews: params.includeNews,
      categories: params.newsCategories
    });

    const results = initializeResultsObject(args.query, params.analysisDepth);
    const analysisResults = await executeAnalysisOperations(args, params);
    
    processAnalysisResults(analysisResults, results, args.query);
    
    results.unified_insights = generateUnifiedInsights(results);
    results.processing_time_ms = Date.now() - startTime;

    const responseText = formatCompleteAnalysisResponse(results);

    logSuccessfulCompletion(args.query, results);

    return {
      content: [{ 
        type: "text", 
        text: responseText 
      }],
      isError: false
    };

  } catch (error) {
    return handleAnalysisError(error, args.query, Date.now() - startTime);
  }
}

function parseAnalysisParameters(args: CompleteAnalysisArgs) {
  return {
    analysisDepth: args.analysis_depth || 'standard',
    includeNews: args.include_news ?? true,
    newsCategories: args.news_categories || ['all'],
    maxNewsItems: args.max_news_items || 10,
    timeRange: args.time_range || '6h',
    sagePersp: args.sage_perspectives
  };
}

function initializeResultsObject(query: string, analysisDepth: string) {
  return {
    query,
    timestamp: new Date().toISOString(),
    analysis_depth: analysisDepth,
    consensus_analysis: null as any,
    breaking_news: null as any,
    unified_insights: '',
    processing_time_ms: 0,
    status: 'success'
  };
}

async function executeAnalysisOperations(args: CompleteAnalysisArgs, params: any) {
  const analysisPromises: Promise<any>[] = [];

  // 1. Multi-Analyst Consensus Analysis
  analysisPromises.push(
    multiAnalystConsensus({
      news_item: args.query,
      analysis_depth: params.analysisDepth,
      ...(params.sagePersp && { sage_perspectives: params.sagePersp })
    }).then(result => ({ type: 'consensus', result }))
  );

  // 2. Breaking News Analysis (if requested)
  if (params.includeNews) {
    analysisPromises.push(
      fetchBreakingNews({
        category: params.newsCategories[0] || 'all',
        max_items: params.maxNewsItems,
        time_range: params.timeRange,
        include_analysis: true
      }).then(result => ({ type: 'news', result }))
    );
  }

  return await Promise.allSettled(analysisPromises);
}

function processAnalysisResults(analysisResults: PromiseSettledResult<any>[], results: any, query: string) {
  for (const result of analysisResults) {
    if (result.status === 'fulfilled') {
      const { type, result: toolResult } = result.value;
      
      if (type === 'consensus') {
        results.consensus_analysis = createAnalysisResult(toolResult, 'No analysis generated');
      } else if (type === 'news') {
        results.breaking_news = createAnalysisResult(toolResult, 'No news data retrieved');
      }
    } else {
      secureLogger.error('Analysis component failed', { 
        error: result.reason?.message || 'Unknown error',
        query 
      });
    }
  }
}

function createAnalysisResult(toolResult: any, defaultContent: string) {
  return {
    status: toolResult.isError ? 'error' : 'success',
    content: toolResult.content[0]?.text || defaultContent,
    isError: toolResult.isError
  };
}

function logSuccessfulCompletion(query: string, results: any) {
  secureLogger.info('Complete financial intelligence analysis completed', {
    query,
    processingTime: results.processing_time_ms,
    hasConsensus: !!results.consensus_analysis && !results.consensus_analysis.isError,
    hasNews: !!results.breaking_news && !results.breaking_news.isError
  });
}

function handleAnalysisError(error: unknown, query: string, duration: number): ToolResponse {
  const errorMessage = StandardErrorHandler.getErrorMessage(error);
  
  secureLogger.error('Complete financial intelligence analysis failed', {
    query,
    error: errorMessage,
    duration
  });

  return {
    content: [{ 
      type: "text", 
      text: `❌ **Complete Financial Intelligence Analysis Failed**\n\n**Query:** ${query}\n\n**Error:** ${errorMessage}\n\n**Processing Time:** ${duration}ms\n\n*Please try again with a simpler query or check system status.*`
    }],
    isError: true
  };
}

/**
 * Generates unified insights by combining consensus analysis and breaking news
 */
function generateUnifiedInsights(results: any): string {
  const insights = [];

  // Add consensus analysis summary if available
  if (results.consensus_analysis && !results.consensus_analysis.isError) {
    insights.push("📊 **7-Sage Consensus Analysis** completed successfully");
  }

  // Add news analysis summary if available  
  if (results.breaking_news && !results.breaking_news.isError) {
    insights.push("📰 **Breaking News Analysis** completed successfully");
  }

  // Add processing efficiency note
  if (results.processing_time_ms < 30000) {
    insights.push(`⚡ **High-Speed Analysis** completed in ${(results.processing_time_ms / 1000).toFixed(1)}s`);
  }

  // Add depth indicator
  insights.push(`🔍 **Analysis Depth:** ${results.analysis_depth.toUpperCase()} mode`);

  return insights.join(' | ');
}

/**
 * Formats the complete analysis response for optimal readability
 */
function formatCompleteAnalysisResponse(results: any): string {
  const sections = [];

  // Header
  sections.push(`# 🧠 Complete Financial Intelligence Analysis`);
  sections.push(`**Query:** ${results.query}`);
  sections.push(`**Analysis Completed:** ${results.timestamp}`);
  sections.push(`**Processing Time:** ${(results.processing_time_ms / 1000).toFixed(1)} seconds`);
  sections.push(`\n**Unified Insights:** ${results.unified_insights}`);
  sections.push(`\n---\n`);

  // Consensus Analysis Section
  if (results.consensus_analysis) {
    sections.push(`## 👥 7-Sage Consensus Analysis`);
    if (results.consensus_analysis.isError) {
      sections.push(`❌ **Analysis Error:** ${results.consensus_analysis.content}`);
    } else {
      sections.push(results.consensus_analysis.content);
    }
    sections.push(`\n---\n`);
  }

  // Breaking News Section
  if (results.breaking_news) {
    sections.push(`## 📰 Breaking News & Market Impact`);
    if (results.breaking_news.isError) {
      sections.push(`❌ **News Retrieval Error:** ${results.breaking_news.content}`);
    } else {
      sections.push(results.breaking_news.content);
    }
    sections.push(`\n---\n`);
  }

  // Footer
  sections.push(`## 📋 Analysis Summary`);
  
  const consensusStatus = getAnalysisStatus(results.consensus_analysis);
  const newsStatus = getAnalysisStatus(results.breaking_news);
  
  sections.push(`- **Consensus Analysis:** ${consensusStatus}`);
  sections.push(`- **Breaking News:** ${newsStatus}`);
  sections.push(`- **Total Processing Time:** ${(results.processing_time_ms / 1000).toFixed(1)}s`);
  sections.push(`- **Analysis Depth:** ${results.analysis_depth.toUpperCase()}`);
  
  sections.push(`\n*🤖 Generated by Universal MCP Financial Intelligence v${SERVER_CONSTANTS.VERSION}*`);

  return sections.join('\n');
}

/**
 * Helper function to get analysis status string
 */
function getAnalysisStatus(analysisResult: any): string {
  if (!analysisResult) {
    return '➖ Not Requested';
  }
  
  if (analysisResult.isError) {
    return '❌ Failed';
  }
  
  return '✅ Success';
}