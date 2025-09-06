/**
 * Confidence Extraction Utility
 * Shared utility for extracting confidence values from AI-generated content
 */

/**
 * Extracts confidence value from content using regex pattern
 * @param content - The content string to search for confidence values
 * @param defaultValue - Default confidence value to return if none found
 * @returns Number between 0 and 1 representing confidence level
 */
export function extractConfidenceFromContent(content: string, defaultValue: number = 0.8): number {
  const confidenceRegex = /confidence[:\s]+(\d+(?:\.\d+)?)[%\s]/i;
  const confidenceMatch = confidenceRegex.exec(content);
  
  if (confidenceMatch?.[1]) {
    const confidence = parseFloat(confidenceMatch[1]);
    // Convert percentage to decimal if needed
    return confidence > 1 ? confidence / 100 : confidence;
  }
  
  return defaultValue;
}

/**
 * Provider-specific confidence extractors with their default values
 */
export const ProviderConfidenceExtractors = {
  openai: (content: string) => extractConfidenceFromContent(content, 0.8),
  gemini: (content: string) => extractConfidenceFromContent(content, 0.75),
  anthropic: (content: string) => extractConfidenceFromContent(content, 0.85),
  local: (content: string) => extractConfidenceFromContent(content, 0.7)
} as const;

export type ProviderType = keyof typeof ProviderConfidenceExtractors;