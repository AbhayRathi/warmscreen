import { z } from 'zod';

/**
 * Environment configuration for AI/OpenAI integration
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
    // In development or when API key is not set, return defaults for graceful degradation
    if (!process.env.OPENAI_API_KEY) {
      return {
        OPENAI_API_KEY: '',
        OPENAI_MODEL: 'gpt-4o-mini',
        OPENAI_MAX_TOKENS: 500,
        isConfigured: false,
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
