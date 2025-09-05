import { aiProviderManager } from './ai-provider.js';
import { secureLogger } from '../utils/logger.js';
import { 
  Analyst, 
  AnalysisResult, 
  ConsensusAnalysis, 
  AnalystOpinion,
  AnalysisDepth 
} from '../types/index.js';

/**
 * Base Analyst class with common functionality
 */
abstract class BaseAnalyst implements Analyst {
  constructor(
    public name: string,
    public specialty: string,
    protected persona: string
  ) {}
  
  async analyze(input: string, context?: any): Promise<AnalysisResult> {
    const prompt = this.buildPrompt(input, context);
    
    try {
      const result = await aiProviderManager.analyze(prompt);
      
      // Enhance result with analyst-specific metadata
      return {
        ...result,
        analysisType: `${this.name}_analysis`,
        metadata: {
          ...result.metadata,
          analyst: this.name,
          specialty: this.specialty
        }
      };
      
    } catch (error) {
      secureLogger.error(`Analysis failed for ${this.name}`, { error, input: input.substring(0, 100) });
      throw error;
    }
  }
  
  getPersona(): string {
    return this.persona;
  }
  
  protected abstract buildPrompt(input: string, context?: any): string;
  
  protected getBasePrompt(): string {
    return `You are ${this.persona}. 
    
CRITICAL REQUIREMENTS:
- Provide specific, actionable insights related to your expertise
- Include a confidence score (0-100%) for your analysis
- Cite reasoning and supporting evidence
- Identify potential risks and opportunities
- Keep analysis focused and concise (under 300 words)
- End with a clear recommendation or key takeaway

Your specialty: ${this.specialty}`;
  }
}

/**
 * Political Analyst - Government policies, elections, regulatory changes
 */
export class PoliticalAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'political_analyst',
      'Government policies, elections, regulatory changes',
      'a seasoned political analyst with 15+ years experience in government affairs and policy analysis'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

POLITICAL ANALYSIS REQUEST:
${input}

Focus on:
- Government policy implications
- Regulatory impact on markets
- Political stability factors
- Election cycle effects
- Partisan dynamics
- Policy probability assessments

Provide specific political risk scores and timeline estimates where applicable.`;
  }
}

/**
 * Economic Analyst - GDP, inflation, interest rates, employment data
 */
export class EconomicAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'economic_analyst',
      'Macroeconomic indicators, central bank policies',
      'a macroeconomic analyst specializing in central bank policy and economic indicators'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

ECONOMIC ANALYSIS REQUEST:
${input}

Focus on:
- Macroeconomic impact assessment
- Interest rate implications
- Inflation/deflation pressures
- Employment market effects
- GDP growth projections
- Central bank policy responses
- Economic cycle positioning

Include specific economic metrics and forecasts where relevant.`;
  }
}

/**
 * Geopolitical Analyst - International relations, conflicts, trade wars
 */
export class GeopoliticalAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'geopolitical_analyst',
      'International relations, conflicts, trade wars',
      'a geopolitical risk analyst with expertise in international relations and global conflict assessment'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

GEOPOLITICAL ANALYSIS REQUEST:
${input}

Focus on:
- International conflict implications
- Trade relationship impacts
- Supply chain disruption risks
- Regional stability assessment
- Diplomatic tension effects
- Cross-border investment flows
- Global alliance implications

Provide specific geopolitical risk ratings and affected regions.`;
  }
}

/**
 * Financial Analyst - Traditional markets, stocks, bonds, forex
 */
export class FinancialAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'financial_analyst',
      'Traditional markets, cross-asset analysis',
      'a senior financial markets analyst with expertise in equity, bond, and forex markets'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

FINANCIAL MARKETS ANALYSIS REQUEST:
${input}

Focus on:
- Stock market implications
- Bond market effects
- Currency impact analysis
- Sector rotation implications
- Liquidity considerations
- Market sentiment shifts
- Technical and fundamental factors
- Cross-asset correlations

Include specific market targets, support/resistance levels, and sector recommendations.`;
  }
}

/**
 * Crypto Analyst - Blockchain, DeFi, NFTs, cryptocurrency markets
 */
export class CryptoAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'crypto_analyst',
      'Blockchain, DeFi, cryptocurrency markets',
      'a cryptocurrency and blockchain technology analyst specializing in digital asset markets'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

CRYPTOCURRENCY ANALYSIS REQUEST:
${input}

Focus on:
- Bitcoin and major altcoin implications
- DeFi protocol impacts
- Blockchain adoption effects
- Regulatory crypto impacts
- On-chain analytics insights
- Institutional crypto adoption
- NFT and Web3 implications
- Cross-chain ecosystem effects

Include specific crypto market predictions and adoption metrics.`;
  }
}

/**
 * Tech Analyst - AI developments, technological disruption
 */
export class TechAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'tech_analyst',
      'AI developments, technological disruption',
      'a technology sector analyst specializing in AI, emerging tech, and digital transformation'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

TECHNOLOGY ANALYSIS REQUEST:
${input}

Focus on:
- AI and automation impacts
- Tech sector implications
- Digital transformation effects
- Innovation adoption rates
- Technology disruption risks
- Platform economy changes
- Cybersecurity implications
- Tech regulation impacts

Include specific technology trends and disruption timelines.`;
  }
}

/**
 * Behavioral Analyst - Market psychology, sentiment analysis
 */
export class BehavioralAnalyst extends BaseAnalyst {
  constructor() {
    super(
      'behavioral_analyst',
      'Market psychology, sentiment analysis',
      'a behavioral finance analyst specializing in market psychology and investor sentiment'
    );
  }
  
  protected buildPrompt(input: string, context?: any): string {
    return `${this.getBasePrompt()}

BEHAVIORAL ANALYSIS REQUEST:
${input}

Focus on:
- Market sentiment shifts
- Investor psychology patterns
- Fear/greed cycle positioning
- Behavioral biases in play
- Crowd psychology dynamics
- Contrarian signal identification
- Social media sentiment
- Market narrative analysis

Include specific sentiment scores and behavioral pattern predictions.`;
  }
}

/**
 * Analyst Manager - Coordinates all 7 analysts and builds consensus
 */
export class AnalystManager {
  private analysts: Map<string, Analyst> = new Map();
  
  constructor() {
    this.initializeAnalysts();
  }
  
  private initializeAnalysts(): void {
    const analystInstances = [
      new PoliticalAnalyst(),
      new EconomicAnalyst(),
      new GeopoliticalAnalyst(),
      new FinancialAnalyst(),
      new CryptoAnalyst(),
      new TechAnalyst(),
      new BehavioralAnalyst()
    ];
    
    analystInstances.forEach(analyst => {
      this.analysts.set(analyst.name, analyst);
    });
    
    secureLogger.info('Analyst Manager initialized', {
      analystCount: this.analysts.size,
      analysts: Array.from(this.analysts.keys())
    });
  }
  
  async getConsensusAnalysis(
    input: string, 
    depth: AnalysisDepth = 'standard',
    selectedAnalysts?: string[]
  ): Promise<ConsensusAnalysis> {
    const startTime = Date.now();
    
    // Determine which analysts to use
    const analystsToUse = selectedAnalysts 
      ? selectedAnalysts.filter(name => this.analysts.has(name))
      : Array.from(this.analysts.keys());
    
    if (analystsToUse.length === 0) {
      throw new Error('No valid analysts specified');
    }
    
    secureLogger.info(`Starting consensus analysis with ${analystsToUse.length} analysts`, {
      analysts: analystsToUse,
      depth,
      inputLength: input.length
    });
    
    // Get analysis from each analyst
    const analystOpinions: AnalystOpinion[] = [];
    const analysisPromises = analystsToUse.map(async (analystName) => {
      const analyst = this.analysts.get(analystName)!;
      
      try {
        const result = await analyst.analyze(input, { depth });
        
        // Extract key components from analysis
        const opinion = this.extractOpinion(result.content);
        const confidence = result.confidence;
        const reasoning = this.extractReasoning(result.content);
        const evidence = this.extractEvidence(result.content);
        
        return {
          analyst: analyst.name,
          opinion,
          confidence,
          reasoning,
          supporting_evidence: evidence
        };
        
      } catch (error) {
        secureLogger.error(`Analyst ${analystName} failed`, { error });
        
        // Return a failure opinion
        return {
          analyst: analyst.name,
          opinion: `Analysis unavailable due to error: ${error instanceof Error ? error.message : String(error)}`,
          confidence: 0,
          reasoning: 'Technical failure during analysis',
          supporting_evidence: []
        };
      }
    });
    
    // Wait for all analyses to complete
    const opinions = await Promise.all(analysisPromises);
    analystOpinions.push(...opinions.filter(opinion => opinion.confidence > 0));
    
    // Build consensus
    const consensus = await this.buildConsensus(analystOpinions, input);
    const duration = Date.now() - startTime;
    
    secureLogger.info(`Consensus analysis completed`, {
      duration: `${duration}ms`,
      analystCount: analystOpinions.length,
      consensusConfidence: consensus.confidence
    });
    
    return consensus;
  }
  
  private async buildConsensus(opinions: AnalystOpinion[], originalInput: string): Promise<ConsensusAnalysis> {
    // Calculate overall confidence (weighted average)
    const totalWeight = opinions.reduce((sum, op) => sum + op.confidence, 0);
    const averageConfidence = totalWeight / opinions.length;
    
    // Identify areas of agreement and disagreement
    const agreements: string[] = [];
    const disagreements: string[] = [];
    
    // Simple consensus building (can be enhanced with more sophisticated algorithms)
    const consensusPrompt = `Based on the following expert analyses, provide a unified consensus summary:

${opinions.map(op => `
**${op.analyst.toUpperCase()}** (Confidence: ${(op.confidence * 100).toFixed(0)}%)
${op.opinion}
Reasoning: ${op.reasoning}
`).join('\n')}

Original Input: ${originalInput}

Provide a consensus that:
1. Synthesizes common themes
2. Highlights key disagreements
3. Provides unified recommendations
4. Assesses overall risk level (LOW/MEDIUM/HIGH/CRITICAL)
5. Suggests appropriate timeframe for monitoring

Format as clear, actionable summary under 400 words.`;
    
    try {
      const consensusResult = await aiProviderManager.analyze(consensusPrompt);
      
      return {
        summary: this.extractSummary(consensusResult.content),
        consensus: consensusResult.content,
        confidence: averageConfidence,
        disagreements,
        analystOpinions: opinions,
        recommendations: this.extractRecommendations(consensusResult.content),
        riskLevel: this.extractRiskLevel(consensusResult.content),
        timeframe: this.extractTimeframe(consensusResult.content),
        lastUpdated: new Date()
      };
      
    } catch (error) {
      secureLogger.error('Consensus building failed', { error });
      
      // Fallback consensus
      return {
        summary: `Analysis completed with ${opinions.length} expert perspectives. Average confidence: ${(averageConfidence * 100).toFixed(0)}%`,
        consensus: 'Consensus building failed due to technical issues. Individual analyst opinions available.',
        confidence: averageConfidence,
        disagreements: ['Consensus building system unavailable'],
        analystOpinions: opinions,
        recommendations: ['Review individual analyst opinions', 'Retry analysis when system is available'],
        riskLevel: 'MEDIUM',
        timeframe: '24-48 hours',
        lastUpdated: new Date()
      };
    }
  }
  
  // Helper methods for extracting information from analysis content
  private extractOpinion(content: string): string {
    // Extract main opinion/conclusion (first paragraph or key finding)
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines[0] || content.substring(0, 200);
  }
  
  private extractReasoning(content: string): string {
    const reasoningMatch = content.match(/(?:reasoning|rationale|because|due to|analysis shows)[:\s]*([^.!?]*[.!?])/i);
    return reasoningMatch && reasoningMatch[1] ? reasoningMatch[1].trim() : 'See full analysis for reasoning';
  }
  
  private extractEvidence(content: string): string[] {
    const evidence: string[] = [];
    const bulletPoints = content.match(/[-•*]\s*([^\n]+)/g);
    if (bulletPoints) {
      evidence.push(...bulletPoints.map(bp => bp.replace(/[-•*]\s*/, '').trim()));
    }
    return evidence.slice(0, 3); // Top 3 pieces of evidence
  }
  
  private extractSummary(content: string): string {
    const lines = content.split('\n').filter(line => line.trim().length > 0);
    return lines[0] ? lines[0].substring(0, 150) : 'Multi-analyst consensus analysis completed';
  }
  
  private extractRecommendations(content: string): string[] {
    const recommendations: string[] = [];
    const recMatch = content.match(/(?:recommend|suggest|advise)[:\s]*([^.!?]*[.!?])/gi);
    if (recMatch) {
      recommendations.push(...recMatch.map(r => r.trim()).slice(0, 3));
    }
    return recommendations.length > 0 ? recommendations : ['Monitor situation closely', 'Review in 24-48 hours'];
  }
  
  private extractRiskLevel(content: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const riskMatch = content.match(/risk[:\s]*(?:level[:\s]*)?(low|medium|high|critical)/i);
    if (riskMatch && riskMatch[1]) {
      return riskMatch[1].toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    }
    return 'MEDIUM'; // Default
  }
  
  private extractTimeframe(content: string): string {
    const timeMatch = content.match(/(?:timeframe|timeline|monitor|watch)[:\s]*([^.!?]*[.!?])/i);
    return timeMatch && timeMatch[1] ? timeMatch[1].trim() : '24-48 hours';
  }
  
  getAvailableAnalysts(): string[] {
    return Array.from(this.analysts.keys());
  }
  
  getAnalystInfo(analystName: string): { name: string; specialty: string; persona: string } | null {
    const analyst = this.analysts.get(analystName);
    if (!analyst) return null;
    
    return {
      name: analyst.name,
      specialty: analyst.specialty,
      persona: analyst.getPersona()
    };
  }
}

// Export singleton instance
export const analystManager = new AnalystManager();