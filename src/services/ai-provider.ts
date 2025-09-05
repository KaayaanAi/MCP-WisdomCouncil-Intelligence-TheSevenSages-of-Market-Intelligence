import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';
import { secureLogger } from '../utils/logger.js';
import { 
  AIProvider, 
  AnalysisResult, 
  AIProviderError,
  OpenAIResponse,
  GeminiResponse,
  AnthropicResponse,
  LocalModelResponse
} from '../types/index.js';

/**
 * Base AI Provider class with common functionality
 */
abstract class BaseAIProvider implements AIProvider {
  protected http: AxiosInstance;
  protected quotaUsed: number = 0;
  protected lastQuotaReset: Date = new Date();
  
  constructor(
    public name: string,
    protected apiKey: string,
    protected baseURL: string
  ) {
    this.http = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    // Add request interceptor for logging
    this.http.interceptors.request.use((request) => {
      secureLogger.debug(`AI Provider request: ${this.name}`, {
        url: request.url,
        method: request.method
      });
      return request;
    });
    
    // Add response interceptor for quota tracking
    this.http.interceptors.response.use(
      (response) => {
        this.quotaUsed++;
        return response;
      },
      (error) => {
        this.quotaUsed++;
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  }
  
  abstract analyze(prompt: string, model?: string): Promise<AnalysisResult>;
  abstract getModels(): string[];
  
  async isAvailable(): Promise<boolean> {
    try {
      // Simple availability check - attempt a minimal request
      await this.testConnection();
      return true;
    } catch (error) {
      secureLogger.warn(`AI Provider ${this.name} unavailable`, { error });
      return false;
    }
  }
  
  async getRemainingQuota(): Promise<number> {
    // Reset quota daily (simplified implementation)
    const now = new Date();
    if (now.getDate() !== this.lastQuotaReset.getDate()) {
      this.quotaUsed = 0;
      this.lastQuotaReset = now;
    }
    
    // Return estimated remaining quota (provider-specific limits)
    return Math.max(0, this.getMaxDailyQuota() - this.quotaUsed);
  }
  
  protected abstract testConnection(): Promise<void>;
  protected abstract getMaxDailyQuota(): number;
}

/**
 * OpenAI Provider Implementation
 */
export class OpenAIProvider extends BaseAIProvider {
  constructor(apiKey: string) {
    super('openai', apiKey, 'https://api.openai.com/v1');
    if (this.http.defaults.headers) {
      this.http.defaults.headers['Authorization'] = `Bearer ${apiKey}`;
    }
  }
  
  async analyze(prompt: string, model: string = process.env.OPENAI_MODEL || 'gpt-4o-mini'): Promise<AnalysisResult> {
    try {
      const response = await this.http.post<OpenAIResponse>('/chat/completions', {
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a specialized financial analyst AI. Provide detailed, accurate analysis with confidence scores and supporting evidence.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });
      
      const content = response.data.choices[0]?.message?.content || '';
      const tokensUsed = response.data.usage?.total_tokens || 0;
      
      secureLogger.aiProviderCall('openai', model, true, tokensUsed);
      
      return {
        content,
        confidence: this.extractConfidence(content),
        sources: ['OpenAI Analysis'],
        timestamp: new Date(),
        analysisType: 'financial_intelligence',
        metadata: {
          model,
          tokensUsed,
          provider: 'openai'
        }
      };
      
    } catch (error: any) {
      secureLogger.aiProviderCall('openai', model, false);
      throw new AIProviderError(
        `OpenAI API error: ${error.message}`,
        'openai',
        error.response?.status
      );
    }
  }
  
  getModels(): string[] {
    return ['gpt-4o-mini', 'gpt-4o', 'gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'];
  }
  
  protected async testConnection(): Promise<void> {
    await this.http.get('/models');
  }
  
  protected getMaxDailyQuota(): number {
    return 10000; // Conservative estimate for OpenAI
  }
  
  private extractConfidence(content: string): number {
    // Simple confidence extraction from content
    const confidenceRegex = /confidence[:\s]+(\d+(?:\.\d+)?)[%\s]/i;
    const confidenceMatch = confidenceRegex.exec(content);
    if (confidenceMatch?.[1]) {
      const confidence = parseFloat(confidenceMatch[1]);
      return confidence > 1 ? confidence / 100 : confidence;
    }
    return 0.8; // Default confidence
  }
}

/**
 * Gemini Provider Implementation
 */
export class GeminiProvider extends BaseAIProvider {
  constructor(apiKey: string) {
    super('gemini', apiKey, 'https://generativelanguage.googleapis.com/v1beta');
  }
  
  async analyze(prompt: string, model: string = 'gemini-pro'): Promise<AnalysisResult> {
    try {
      const response = await this.http.post<GeminiResponse>(
        `/models/${model}:generateContent?key=${this.apiKey}`,
        {
          contents: [{
            parts: [{
              text: `As a specialized financial analyst AI, provide detailed analysis for: ${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000
          }
        }
      );
      
      const content = response.data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      secureLogger.aiProviderCall('gemini', model, true);
      
      return {
        content,
        confidence: this.extractConfidence(content),
        sources: ['Gemini Analysis'],
        timestamp: new Date(),
        analysisType: 'financial_intelligence',
        metadata: {
          model,
          provider: 'gemini'
        }
      };
      
    } catch (error: any) {
      secureLogger.aiProviderCall('gemini', model, false);
      throw new AIProviderError(
        `Gemini API error: ${error.message}`,
        'gemini',
        error.response?.status
      );
    }
  }
  
  getModels(): string[] {
    return ['gemini-pro', 'gemini-1.5-pro'];
  }
  
  protected async testConnection(): Promise<void> {
    await this.http.get(`/models?key=${this.apiKey}`);
  }
  
  protected getMaxDailyQuota(): number {
    return 1000; // Gemini free tier limit
  }
  
  private extractConfidence(content: string): number {
    const confidenceRegex = /confidence[:\s]+(\d+(?:\.\d+)?)[%\s]/i;
    const confidenceMatch = confidenceRegex.exec(content);
    if (confidenceMatch?.[1]) {
      const confidence = parseFloat(confidenceMatch[1]);
      return confidence > 1 ? confidence / 100 : confidence;
    }
    return 0.75;
  }
}

/**
 * Anthropic Claude Provider Implementation
 */
export class AnthropicProvider extends BaseAIProvider {
  constructor(apiKey: string) {
    super('anthropic', apiKey, 'https://api.anthropic.com/v1');
    if (this.http.defaults.headers) {
      this.http.defaults.headers['x-api-key'] = apiKey;
      this.http.defaults.headers['anthropic-version'] = '2023-06-01';
    }
  }
  
  async analyze(prompt: string, model: string = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307'): Promise<AnalysisResult> {
    try {
      const response = await this.http.post<AnthropicResponse>('/messages', {
        model,
        max_tokens: 2000,
        temperature: 0.7,
        system: 'You are a specialized financial analyst AI. Provide detailed, accurate analysis with confidence scores and supporting evidence.',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });
      
      const content = response.data.content[0]?.text || '';
      const tokensUsed = response.data.usage.input_tokens + response.data.usage.output_tokens;
      
      secureLogger.aiProviderCall('anthropic', model, true, tokensUsed);
      
      return {
        content,
        confidence: this.extractConfidence(content),
        sources: ['Anthropic Claude Analysis'],
        timestamp: new Date(),
        analysisType: 'financial_intelligence',
        metadata: {
          model,
          tokensUsed,
          provider: 'anthropic',
          inputTokens: response.data.usage.input_tokens,
          outputTokens: response.data.usage.output_tokens
        }
      };
      
    } catch (error: any) {
      secureLogger.aiProviderCall('anthropic', model, false);
      throw new AIProviderError(
        `Anthropic API error: ${error.message}`,
        'anthropic',
        error.response?.status
      );
    }
  }
  
  getModels(): string[] {
    return [
      'claude-3-haiku-20240307',    // Most cost-effective
      'claude-3-sonnet-20240229',   // Balanced performance/cost
      'claude-3-opus-20240229'      // Highest performance
    ];
  }
  
  protected async testConnection(): Promise<void> {
    // Simple test with minimal token usage
    await this.http.post('/messages', {
      model: 'claude-3-haiku-20240307',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }]
    });
  }
  
  protected getMaxDailyQuota(): number {
    return 5000; // Conservative estimate for Claude
  }
  
  private extractConfidence(content: string): number {
    const confidenceRegex = /confidence[:\s]+(\d+(?:\.\d+)?)[%\s]/i;
    const confidenceMatch = confidenceRegex.exec(content);
    if (confidenceMatch?.[1]) {
      const confidence = parseFloat(confidenceMatch[1]);
      return confidence > 1 ? confidence / 100 : confidence;
    }
    return 0.85; // Default confidence for Claude
  }
}

/**
 * Local Model Provider (Ollama) Implementation
 */
export class LocalModelProvider extends BaseAIProvider {
  constructor(baseURL: string = process.env.LOCAL_MODEL_URL || 'http://localhost:11434') {
    super('local', '', baseURL);
    // No API key needed for local models
  }
  
  async analyze(prompt: string, model: string = process.env.LOCAL_MODEL_NAME || 'llama2'): Promise<AnalysisResult> {
    try {
      const response = await this.http.post<LocalModelResponse>('/api/generate', {
        model,
        prompt: `You are a specialized financial analyst AI. Provide detailed, accurate analysis with confidence scores and supporting evidence.\n\n${prompt}`,
        stream: false
      });
      
      const content = response.data.response || '';
      
      secureLogger.aiProviderCall('local', model, true);
      
      return {
        content,
        confidence: this.extractConfidence(content),
        sources: ['Local Model Analysis'],
        timestamp: new Date(),
        analysisType: 'financial_intelligence',
        metadata: {
          model,
          provider: 'local',
          totalDuration: response.data.total_duration,
          evalCount: response.data.eval_count
        }
      };
      
    } catch (error: any) {
      secureLogger.aiProviderCall('local', model, false);
      throw new AIProviderError(
        `Local model error: ${error.message}`,
        'local',
        error.response?.status || 500
      );
    }
  }
  
  getModels(): string[] {
    return [
      'llama2',           // General purpose
      'codellama',        // Code-focused
      'mistral',          // Efficient alternative
      'llama2:13b',       // Larger model
      'codellama:13b'     // Larger code model
    ];
  }
  
  protected async testConnection(): Promise<void> {
    await this.http.get('/api/tags');
  }
  
  protected getMaxDailyQuota(): number {
    return 50000; // High quota for local models (limited by hardware only)
  }
  
  private extractConfidence(content: string): number {
    const confidenceRegex = /confidence[:\s]+(\d+(?:\.\d+)?)[%\s]/i;
    const confidenceMatch = confidenceRegex.exec(content);
    if (confidenceMatch?.[1]) {
      const confidence = parseFloat(confidenceMatch[1]);
      return confidence > 1 ? confidence / 100 : confidence;
    }
    return 0.7; // Default confidence for local models
  }
}

/**
 * AI Provider Manager with fallback chain
 */
export class AIProviderManager {
  private readonly providers: Map<string, AIProvider> = new Map();
  private fallbackChain: string[] = [];
  
  constructor() {
    this.initializeProviders();
  }
  
  private initializeProviders(): void {
    // Initialize enabled providers
    if (config.aiProviders.openai.enabled && config.aiProviders.openai.apiKey) {
      this.providers.set('openai', new OpenAIProvider(config.aiProviders.openai.apiKey));
      secureLogger.debug('OpenAI provider initialized');
    }
    
    if (config.aiProviders.anthropic.enabled && config.aiProviders.anthropic.apiKey) {
      this.providers.set('anthropic', new AnthropicProvider(config.aiProviders.anthropic.apiKey));
      secureLogger.debug('Anthropic provider initialized');
    }
    
    if (config.aiProviders.gemini.enabled && config.aiProviders.gemini.apiKey) {
      this.providers.set('gemini', new GeminiProvider(config.aiProviders.gemini.apiKey));
      secureLogger.debug('Gemini provider initialized');
    }
    
    if (config.aiProviders.local.enabled && config.aiProviders.local.url) {
      this.providers.set('local', new LocalModelProvider(config.aiProviders.local.url));
      secureLogger.debug('Local model provider initialized');
    }
    
    // Note: DeepSeek, Groq, and OpenRouter providers can be added here when needed
    
    // Determine primary provider based on AI_PROVIDER env var or automatic detection
    const preferredProvider = config.aiProvider || this.detectBestAvailableProvider();
    const finalPrimaryProvider = this.providers.has(preferredProvider) ? preferredProvider : config.primaryProvider;
    
    // Setup fallback chain with intelligent ordering (cost-effective first)
    this.fallbackChain = this.buildOptimalFallbackChain(finalPrimaryProvider);
    
    secureLogger.info('AI Provider Manager initialized', {
      availableProviders: Array.from(this.providers.keys()),
      primaryProvider: finalPrimaryProvider,
      fallbackChain: this.fallbackChain,
      totalProviders: this.providers.size
    });
  }
  
  /**
   * Automatically detect the best available provider based on API keys
   */
  private detectBestAvailableProvider(): string {
    // Priority order: cost-effective and reliable providers first
    const providerPriority = ['anthropic', 'openai', 'local', 'gemini'];
    
    for (const provider of providerPriority) {
      if (this.providers.has(provider)) {
        secureLogger.info(`Auto-detected primary provider: ${provider}`);
        return provider;
      }
    }
    
    // Fallback to first available provider
    const firstAvailable = Array.from(this.providers.keys())[0];
    if (firstAvailable) {
      secureLogger.info(`Using first available provider: ${firstAvailable}`);
      return firstAvailable;
    }
    
    return 'openai'; // Default fallback
  }
  
  /**
   * Build an optimal fallback chain prioritizing cost-effectiveness
   */
  private buildOptimalFallbackChain(primaryProvider: string): string[] {
    const costOptimizedOrder = [
      'local',      // Free (if available)
      'anthropic',  // Cost-effective with Haiku
      'openai',     // Reliable, moderate cost
      'gemini',     // Google's offering
      'deepseek',   // Alternative option
      'groq',       // High-speed option
      'openrouter'  // Router/proxy option
    ];
    
    // Start with primary provider
    const chain = [primaryProvider];
    
    // Add other available providers in cost-optimized order
    for (const provider of costOptimizedOrder) {
      if (provider !== primaryProvider && this.providers.has(provider)) {
        chain.push(provider);
      }
    }
    
    return chain;
  }
  
  async analyze(prompt: string, preferredProvider?: string, model?: string): Promise<AnalysisResult> {
    const providersToTry = preferredProvider && this.providers.has(preferredProvider)
      ? [preferredProvider, ...this.fallbackChain.filter(p => p !== preferredProvider)]
      : this.fallbackChain;
    
    let lastError: Error | null = null;
    
    for (const providerName of providersToTry) {
      const provider = this.providers.get(providerName);
      if (!provider) continue;
      
      try {
        // Check availability first
        if (!(await provider.isAvailable())) {
          continue;
        }
        
        // Check quota
        const remainingQuota = await provider.getRemainingQuota();
        if (remainingQuota <= 0) {
          secureLogger.warn(`Provider ${providerName} quota exhausted`);
          continue;
        }
        
        // Attempt analysis
        const result = await provider.analyze(prompt, model);
        secureLogger.info(`Analysis successful with provider: ${providerName}`);
        return result;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        secureLogger.warn(`Provider ${providerName} failed`, { error: lastError.message });
        continue;
      }
    }
    
    // All providers failed
    throw new AIProviderError(
      `All AI providers failed. Last error: ${lastError?.message || 'Unknown error'}`,
      'all',
      500
    );
  }
  
  async getAvailableProviders(): Promise<string[]> {
    const available: string[] = [];
    
    for (const [name, provider] of this.providers) {
      if (await provider.isAvailable()) {
        available.push(name);
      }
    }
    
    return available;
  }
  
  async getProviderStatus(): Promise<Record<string, any>> {
    const status: Record<string, any> = {};
    
    for (const [name, provider] of this.providers) {
      try {
        const isAvailable = await provider.isAvailable();
        const remainingQuota = await provider.getRemainingQuota();
        
        status[name] = {
          available: isAvailable,
          remainingQuota,
          models: provider.getModels()
        };
      } catch (error) {
        status[name] = {
          available: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }
    
    return status;
  }
}

// Export singleton instance
export const aiProviderManager = new AIProviderManager();