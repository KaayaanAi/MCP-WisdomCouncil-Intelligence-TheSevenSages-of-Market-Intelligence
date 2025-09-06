import { z } from 'zod';
import { analystManager } from '../services/analysts.js';
import { secureLogger } from '../utils/logger.js';
import { config } from '../config.js';
import { ToolResponse, AnalysisDepth, ConsensusAnalysis } from '../types/index.js';
import { preventiveValidationService } from '../services/preventive-validation.js';
import { outputSanitizer } from '../services/output-sanitizer.js';

/**
 * Input validation schema for multi_analyst_consensus tool
 */
const multiAnalystConsensusSchema = z.object({
  news_item: z.string()
    .min(10, "News item must be at least 10 characters")
    .max(5000, "News item cannot exceed 5000 characters")
    .regex(/^[a-zA-Z0-9\s\-_,.!?'"()[\]:;@#$%&+=*/\\|<>{}~`]+$/, "News item contains invalid characters"),
  
  analysis_depth: z.enum(["quick", "standard", "deep"])
    .optional()
    .default("standard"),
  
  sage_perspectives: z.array(z.enum([
    "political_analyst",
    "economic_analyst", 
    "geopolitical_analyst",
    "financial_analyst",
    "crypto_analyst",
    "tech_analyst",
    "behavioral_analyst"
  ]))
    .optional()
    .refine(arr => !arr || arr.length <= 7, "Cannot specify more than 7 analysts")
    .refine(arr => !arr || new Set(arr).size === arr.length, "Cannot specify duplicate analysts")
});

/**
 * Triple verification system for analysis results
 */
async function tripleVerification(analysis: ConsensusAnalysis, originalInput: string): Promise<{
  verified: boolean;
  confidence: number;
  issues: string[];
}> {
  const issues: string[] = [];
  let totalScore = 0;
  
  try {
    // Verification 1: Source credibility check
    const sourceScore = verifySourceCredibility(analysis);
    totalScore += sourceScore;
    
    if (sourceScore < 0.6) {
      issues.push("Low source credibility detected");
    }
    
    // Verification 2: Cross-reference analysis consistency
    const consistencyScore = verifyCrossReferenceConsistency(analysis);
    totalScore += consistencyScore;
    
    if (consistencyScore < 0.6) {
      issues.push("Inconsistencies found between analyst opinions");
    }
    
    // Verification 3: Confidence scoring validation
    const confidenceScore = verifyConfidenceScoring(analysis);
    totalScore += confidenceScore;
    
    if (confidenceScore < 0.6) {
      issues.push("Confidence scoring appears unreliable");
    }
    
    const finalScore = totalScore / 3;
    const isVerified = finalScore >= config.analysis.tripleVerificationThreshold;
    
    secureLogger.info('Triple verification completed', {
      originalInputLength: originalInput.length,
      finalScore,
      isVerified,
      issueCount: issues.length
    });
    
    return {
      verified: isVerified,
      confidence: finalScore,
      issues
    };
    
  } catch (error) {
    secureLogger.error('Triple verification failed', { error });
    return {
      verified: false,
      confidence: 0,
      issues: ['Triple verification system error']
    };
  }
}

function verifySourceCredibility(analysis: ConsensusAnalysis): number {
  // Check if analysis has proper analyst attribution
  const hasValidAnalysts = analysis.analystOpinions.length > 0;
  const analystConfidenceAvg = analysis.analystOpinions.reduce((sum, op) => sum + op.confidence, 0) / analysis.analystOpinions.length;
  
  // Check for proper reasoning and evidence
  const hasProperReasoning = analysis.analystOpinions.every(op => 
    op.reasoning && op.reasoning.length > 10
  );
  
  let score = 0.3; // Base score
  if (hasValidAnalysts) score += 0.3;
  if (analystConfidenceAvg > 0.7) score += 0.2;
  if (hasProperReasoning) score += 0.2;
  
  return Math.min(1.0, score);
}

function verifyCrossReferenceConsistency(analysis: ConsensusAnalysis): number {
  // Check for major disagreements vs consensus
  const majorDisagreements = analysis.disagreements.length;
  const analystCount = analysis.analystOpinions.length;
  
  // Check confidence spread
  const confidences = analysis.analystOpinions.map(op => op.confidence);
  const avgConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  const confidenceSpread = Math.max(...confidences) - Math.min(...confidences);
  
  let score = 0.5; // Base score
  
  // Lower score for too many disagreements
  if (majorDisagreements / analystCount > 0.5) {
    score -= 0.2;
  }
  
  // Lower score for very wide confidence spread
  if (confidenceSpread > 0.4) {
    score -= 0.2;
  }
  
  // Higher score for good consensus
  if (avgConfidence > 0.75 && confidenceSpread < 0.3) {
    score += 0.3;
  }
  
  return Math.max(0, Math.min(1.0, score));
}

function verifyConfidenceScoring(analysis: ConsensusAnalysis): number {
  // Check if confidence scores are realistic and well-distributed
  const confidences = analysis.analystOpinions.map(op => op.confidence);
  
  // Check for unrealistic patterns
  const allSameConfidence = confidences.every(conf => Math.abs(conf - (confidences[0] || 0)) < 0.05);
  const allVeryHighConfidence = confidences.every(conf => conf > 0.95);
  const allVeryLowConfidence = confidences.every(conf => conf < 0.3);
  
  let score = 0.7; // Base score
  
  if (allSameConfidence || allVeryHighConfidence || allVeryLowConfidence) {
    score -= 0.4; // Suspicious patterns
  }
  
  // Check overall consensus confidence against individual confidences
  const avgIndividualConfidence = confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  const consensusConfidence = analysis.confidence;
  
  if (Math.abs(consensusConfidence - avgIndividualConfidence) > 0.3) {
    score -= 0.2; // Consensus confidence doesn't match individual confidences
  }
  
  return Math.max(0, Math.min(1.0, score));
}

/**
 * Format the consensus analysis into a beautiful, user-friendly response
 */
function formatConsensusResponse(
  analysis: ConsensusAnalysis,
  verificationResult: { verified: boolean; confidence: number; issues: string[] },
  analysisDepth: AnalysisDepth,
  duration: number
): string {
  const riskEmoji = {
    'LOW': '🟢',
    'MEDIUM': '🟡', 
    'HIGH': '🟠',
    'CRITICAL': '🔴'
  };
  
  const depthEmoji = {
    'quick': '⚡',
    'standard': '🔍',
    'deep': '🔬'
  };

  const rawResponse = `# 🧠 **Multi-Analyst Consensus Intelligence Report**

## 📊 **Executive Summary**
${analysis.summary}

${verificationResult.verified ? '✅' : '⚠️'} **Verification Status**: ${verificationResult.verified ? 'VERIFIED' : 'REQUIRES REVIEW'} ([CONFIDENCE ASSESSMENT REMOVED])

---

## 🎯 **Consensus Analysis**
${analysis.consensus}

**Overall Confidence**: [CONFIDENCE ASSESSMENT REMOVED]
**Risk Level**: ${riskEmoji[analysis.riskLevel]} **${analysis.riskLevel}**
**Monitoring Timeframe**: ${analysis.timeframe}

---

## 👥 **Analyst Perspectives** (${analysis.analystOpinions.length}/7 Sages)

${analysis.analystOpinions.map(opinion => `
### ${opinion.analyst.replace('_', ' ').toUpperCase()} 
**Confidence**: [CONFIDENCE ASSESSMENT REMOVED]
**Opinion**: ${opinion.opinion}
**Key Reasoning**: ${opinion.reasoning}
${opinion.supporting_evidence.length > 0 ? `**Evidence**: ${opinion.supporting_evidence.slice(0, 2).join(', ')}` : ''}
`).join('\n')}

---

## 🎯 **Key Recommendations**
${analysis.recommendations.map((rec, idx) => `${idx + 1}. ${rec}`).join('\n')}

${analysis.disagreements.length > 0 ? `
## ⚠️ **Areas of Disagreement**
${analysis.disagreements.map((disagreement) => `• ${disagreement}`).join('\n')}
` : ''}

${!verificationResult.verified && verificationResult.issues.length > 0 ? `
## 🔍 **Verification Issues**
${verificationResult.issues.map(issue => `• ${issue}`).join('\n')}
` : ''}

---

## 📈 **Analysis Metadata**
- **Analysis Depth**: ${depthEmoji[analysisDepth]} ${analysisDepth.toUpperCase()}
- **Processing Time**: ${duration}ms
- **Analysts Consulted**: ${analysis.analystOpinions.length}
- **Report Generated**: ${analysis.lastUpdated.toLocaleString()}
- **Triple Verification**: ${verificationResult.verified ? 'PASSED' : 'FLAGGED'}

---
*🔒 Powered by MCP NextGen Financial Intelligence • AI-Enhanced Analysis with Human-Grade Insights*`;

  // CRITICAL: Sanitize ALL output before returning to user
  const sanitizationResult = outputSanitizer.sanitizeOutput(rawResponse);
  
  // Log sanitization results
  if (sanitizationResult.flagsRemoved.length > 0) {
    secureLogger.warn('Consensus response sanitized', {
      numericDataBlocked: sanitizationResult.numericDataBlocked,
      confidenceScoresFiltered: sanitizationResult.confidenceScoresFiltered,
      flagsRemoved: sanitizationResult.flagsRemoved.length
    });
  }

  // Return sanitized content
  return sanitizationResult.sanitizedContent;
}

/**
 * Multi-Analyst Consensus Tool Implementation
 * Priority Tool #1 - Core feature providing comprehensive market intelligence
 */
export async function multiAnalystConsensus(args: any): Promise<ToolResponse> {
  const startTime = Date.now();
  
  try {
    // Validate input parameters with strict security
    const validatedArgs = multiAnalystConsensusSchema.parse(args);
    const { news_item, analysis_depth, sage_perspectives } = validatedArgs;
    
    secureLogger.info('Multi-analyst consensus initiated', {
      analysisDepth: analysis_depth,
      analystCount: sage_perspectives?.length || 7,
      inputLength: news_item.length
    });
    
    // CRITICAL: Check preventive validation BEFORE any analysis
    const validationResult = await preventiveValidationService.validateQuery(news_item);
    
    // HARD STOP: If validation blocks analysis, return refusal immediately
    if (!validationResult.allowAnalysis) {
      const duration = Date.now() - startTime;
      
      secureLogger.info('Analysis blocked by preventive validation', {
        blockReason: validationResult.blockReason,
        duration,
        queryType: validationResult.classification.type
      });
      
      // Return structured refusal response
      const refusalResponse = validationResult.structuredResponse;
      if (!refusalResponse) {
        throw new Error('Validation blocked but no structured response provided');
      }
      
      return {
        content: [{ 
          type: "text", 
          text: `❌ **ANALYSIS BLOCKED**\n\n**REASON**: ${validationResult.blockReason}\n\n**RESPONSE**: ${refusalResponse.analysis}\n\n**ALTERNATIVE**: ${refusalResponse.disclaimer}\n\n---\n*Request processed in ${duration}ms - Analysis prevented to avoid data fabrication*`
        }],
        isError: false // Not an error - intentional block
      };
    }
    
    // Only proceed with analysis if validation allows it
    secureLogger.info('Validation passed, proceeding with analysis', {
      classificationType: validationResult.classification.type,
      dataType: validationResult.classification.dataType
    });
    
    // Get consensus analysis from analyst manager
    const analysis = await analystManager.getConsensusAnalysis(
      news_item,
      analysis_depth,
      sage_perspectives
    );
    
    // Run triple verification
    const verificationResult = await tripleVerification(analysis, news_item);
    
    // If verification fails and this is a deep analysis, attempt reanalysis
    if (!verificationResult.verified && analysis_depth === 'deep') {
      secureLogger.warn('Deep analysis failed verification, attempting reanalysis');
      
      // Rerun with all analysts for better verification
      const reanalysis = await analystManager.getConsensusAnalysis(
        news_item,
        analysis_depth
      );
      
      const reverification = await tripleVerification(reanalysis, news_item);
      
      if (reverification.verified || reverification.confidence > verificationResult.confidence) {
        const duration = Date.now() - startTime;
        const formattedResponse = formatConsensusResponse(reanalysis, reverification, analysis_depth, duration);
        
        secureLogger.info('Multi-analyst consensus completed (reanalyzed)', {
          duration,
          verified: reverification.verified,
          confidence: reverification.confidence
        });
        
        return {
          content: [{ type: "text", text: formattedResponse }]
        };
      }
    }
    
    const duration = Date.now() - startTime;
    const formattedResponse = formatConsensusResponse(analysis, verificationResult, analysis_depth, duration);
    
    secureLogger.info('Multi-analyst consensus completed', {
      duration,
      verified: verificationResult.verified,
      confidence: verificationResult.confidence,
      analystCount: analysis.analystOpinions.length
    });
    
    return {
      content: [{ type: "text", text: formattedResponse }]
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    secureLogger.error('Multi-analyst consensus failed', { error, duration });
    
    if (error instanceof z.ZodError) {
      const validationErrors = error.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
      return {
        content: [{ 
          type: "text", 
          text: `❌ **Input Validation Error**: ${validationErrors}\n\nPlease ensure:\n• News item is 10-5000 characters\n• Analysis depth is 'quick', 'standard', or 'deep'\n• Analyst selection contains valid analyst names (no duplicates)` 
        }],
        isError: true
      };
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `❌ **Multi-Analyst Consensus Error**: ${error instanceof Error ? error.message : String(error)}\n\nThe analysis system encountered an issue. This could be due to:\n• AI provider availability\n• Network connectivity\n• System overload\n\nPlease try again in a few moments.` 
      }],
      isError: true
    };
  }
}