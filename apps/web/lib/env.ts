import { z } from 'zod';

/**
 * Voice/Storage Environment Configuration with Zod validation
 *
 * Manages storage (S3/R2), audio validation, and transcription settings.
 * All values have sensible defaults for development; in production the
 * STORAGE_* and TRANSCRIPTION_JOB_TOKEN variables must be set.
 */
const voiceEnvSchema = z.object({
  VOICE_ENABLED: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),

  // Storage provider
  STORAGE_PROVIDER: z.enum(['s3', 'r2']).default('s3'),
  STORAGE_BUCKET: z.string().default('warmscreen-audio'),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  STORAGE_ACCESS_KEY_ID: z.string().default(''),
  STORAGE_SECRET_ACCESS_KEY: z.string().default(''),
  STORAGE_REGION: z.string().default('us-east-1'),
  R2_ACCOUNT_ID: z.string().default(''),

  // Audio constraints
  MAX_AUDIO_MB: z.coerce.number().int().min(1).max(100).default(25),
  AUDIO_MIME_ALLOWLIST: z
    .string()
    .default('audio/webm,audio/ogg,audio/mpeg')
    .transform((v) => v.split(',').map((s) => s.trim())),

  // Webhook auth
  TRANSCRIPTION_JOB_TOKEN: z.string().default(''),
});

export type VoiceEnv = z.infer<typeof voiceEnvSchema>;

function getVoiceEnv(): VoiceEnv {
  const result = voiceEnvSchema.safeParse({
    VOICE_ENABLED: process.env.VOICE_ENABLED,
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER,
    STORAGE_BUCKET: process.env.STORAGE_BUCKET,
    STORAGE_PUBLIC_BASE_URL: process.env.STORAGE_PUBLIC_BASE_URL,
    STORAGE_ACCESS_KEY_ID: process.env.STORAGE_ACCESS_KEY_ID,
    STORAGE_SECRET_ACCESS_KEY: process.env.STORAGE_SECRET_ACCESS_KEY,
    STORAGE_REGION: process.env.STORAGE_REGION,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    MAX_AUDIO_MB: process.env.MAX_AUDIO_MB,
    AUDIO_MIME_ALLOWLIST: process.env.AUDIO_MIME_ALLOWLIST,
    TRANSCRIPTION_JOB_TOKEN: process.env.TRANSCRIPTION_JOB_TOKEN,
  });

  if (!result.success) {
    console.warn(
      '[Voice] Invalid voice environment configuration:',
      result.error.message,
    );
    // Return safe defaults – voice features will be disabled
    return {
      VOICE_ENABLED: false,
      STORAGE_PROVIDER: 's3',
      STORAGE_BUCKET: 'warmscreen-audio',
      STORAGE_PUBLIC_BASE_URL: undefined,
      STORAGE_ACCESS_KEY_ID: '',
      STORAGE_SECRET_ACCESS_KEY: '',
      STORAGE_REGION: 'us-east-1',
      R2_ACCOUNT_ID: '',
      MAX_AUDIO_MB: 25,
      AUDIO_MIME_ALLOWLIST: ['audio/webm', 'audio/ogg', 'audio/mpeg'],
      TRANSCRIPTION_JOB_TOKEN: '',
    };
  }

  return result.data;
}

export const voiceEnv = getVoiceEnv();

// Warn about in-memory rate limiter in multi-instance deployments
if (voiceEnv.VOICE_ENABLED && !process.env.REDIS_URL) {
  console.warn(
    '[voice] REDIS_URL not set — rate limiting uses in-memory store, ineffective on multi-instance deployments.',
  );
}

/** Check whether voice features are enabled and properly configured */
export function isVoiceEnabled(): boolean {
  return voiceEnv.VOICE_ENABLED;
}

/** Check whether storage is configured (access key is set) */
export function isStorageConfigured(): boolean {
  return voiceEnv.STORAGE_ACCESS_KEY_ID.length > 0;
}

/** Maximum upload size in bytes */
export function getMaxAudioBytes(): number {
  return voiceEnv.MAX_AUDIO_MB * 1024 * 1024;
}

/** Validate a MIME type against the allowlist */
export function isAllowedMimeType(mime: string): boolean {
  return voiceEnv.AUDIO_MIME_ALLOWLIST.includes(mime);
}
