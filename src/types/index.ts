// Core Types for MCP NextGen Financial Intelligence

export interface AnalysisResult {
  content: string;
  confidence: number;
  sources: string[];
  timestamp: Date;
  analysisType: string;
  metadata?: Record<string, any>;
}

export interface AIProvider {
  name: string;
  analyze(prompt: string, model?: string): Promise<AnalysisResult>;
  isAvailable(): Promise<boolean>;
  getRemainingQuota(): Promise<number>;
  getModels(): string[];
}

export interface Analyst {
  name: string;
  specialty: string;
  analyze(input: string, context?: any): Promise<AnalysisResult>;
  getPersona(): string;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  source: string;
  url: string;
  publishedAt: Date;
  category: string;
  relevanceScore: number;
  sentiment?: number;
}

export interface ConsensusAnalysis {
  summary: string;
  consensus: string;
  confidence: number;
  disagreements: string[];
  analystOpinions: AnalystOpinion[];
  recommendations: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timeframe: string;
  lastUpdated: Date;
}

export interface AnalystOpinion {
  analyst: string;
  opinion: string;
  confidence: number;
  reasoning: string;
  supporting_evidence: string[];
}

export interface GeopoliticalEvent {
  event: string;
  region: string;
  impact_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  affected_markets: string[];
  probability: number;
  timeline: string;
  risk_factors: string[];
}

export interface SentimentData {
  overall_sentiment: number; // -1 to 1
  sentiment_trend: 'IMPROVING' | 'DETERIORATING' | 'STABLE';
  key_drivers: string[];
  sentiment_sources: string[];
  historical_comparison: number;
  confidence: number;
}

export type AnalysisDepth = 'quick' | 'standard' | 'deep';

export type AnalystType = 
  | 'political_analyst' 
  | 'economic_analyst' 
  | 'geopolitical_analyst' 
  | 'financial_analyst' 
  | 'crypto_analyst' 
  | 'tech_analyst' 
  | 'behavioral_analyst';

export interface ToolInput {
  [key: string]: any;
}

export interface ToolResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  isError?: boolean;
}

// News API Response Types
export interface RSSFeedItem {
  title: string;
  content: string;
  link: string;
  pubDate: string;
  source: string;
}

export interface NewsAPIResponse {
  articles: Array<{
    title: string;
    description: string;
    content: string;
    url: string;
    publishedAt: string;
    source: {
      name: string;
    };
  }>;
}

// Database Types
export interface HistoricalAnalysis {
  _id?: string;
  input: string;
  analysis: ConsensusAnalysis;
  timestamp: Date;
  analysts_used: AnalystType[];
  verification_score: number;
}

export interface CachedNews {
  key: string;
  data: NewsItem[];
  timestamp: Date;
  ttl: number;
}

// Verification Types
export interface VerificationResult {
  is_verified: boolean;
  confidence_score: number;
  verification_details: {
    source_credibility: number;
    cross_reference_score: number;
    fact_check_score: number;
  };
  issues_found: string[];
}

// Provider-specific types
export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
}

export interface AnthropicResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  id: string;
  model: string;
  role: string;
  stop_reason: string;
  stop_sequence: null | string;
  type: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface LocalModelResponse {
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

// Error Types
export class AIProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AIProviderError';
  }
}

export class AnalysisError extends Error {
  constructor(
    message: string,
    public analysisType: string,
    public input?: any
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value?: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}