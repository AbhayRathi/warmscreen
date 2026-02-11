import { z } from 'zod';

/**
 * Environment configuration for AI/OpenAI integration
 * 
 * SECURITY NOTE: When OPENAI_API_KEY is not set, AI features are disabled
 * and default/fallback scores are returned. The isConfigured flag is used
 * to track this state, and isOpenAIConfigured() must be called before
 * attempting any AI operations.
 */
const envSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_MAX_TOKENS: z.coerce.number().default(500),
});

// Parse environment variables, with validation
function getAIEnv() {
  const result = envSchema.safeParse({
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_MAX_TOKENS: process.env.OPENAI_MAX_TOKENS,
  });

  if (!result.success) {
    // When API key is not set, AI features are disabled (not just degraded)
    // The isConfigured: false flag ensures no API calls are attempted
    if (!process.env.OPENAI_API_KEY) {
      console.warn('[AI] OPENAI_API_KEY not configured - AI scoring features will be disabled');
      return {
        OPENAI_API_KEY: '', // Empty key - isOpenAIConfigured() will return false
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_MAX_TOKENS: 500,
        isConfigured: false, // This flag prevents AI API calls
      };
    }
    throw new Error(`Invalid AI environment configuration: ${result.error.message}`);
  }

  return {
    ...result.data,
    isConfigured: true,
  };
}

export const aiEnv = getAIEnv();

/**
 * Check if OpenAI is properly configured
 */
export function isOpenAIConfigured(): boolean {
  return aiEnv.isConfigured && aiEnv.OPENAI_API_KEY.length > 0;
}
