import { voiceEnv, getMaxAudioBytes } from '@/lib/env';
import pino from 'pino';

const logger = pino({ name: 'transcription-service' });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TranscribeParams {
  audioUrl: string;
  mimeType: string;
}

export interface TranscribeResult {
  transcript: string;
  language: string;
  durationSec: number;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1_000;
const TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Exponential backoff with jitter */
function backoffMs(attempt: number): number {
  const exp = BASE_DELAY_MS * Math.pow(2, attempt);
  const jitter = Math.random() * BASE_DELAY_MS;
  return exp + jitter;
}

/** Normalise whitespace in transcript text */
export function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Validate that a URL points to our own storage bucket.
 * Prevents SSRF by only allowing our known bucket domain / public base URL.
 */
export function isOwnStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const bucketHost = `${voiceEnv.STORAGE_BUCKET}.s3.${voiceEnv.STORAGE_REGION}.amazonaws.com`;
    const r2Host = voiceEnv.R2_ACCOUNT_ID
      ? `${voiceEnv.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      : null;
    const publicBaseHost = voiceEnv.STORAGE_PUBLIC_BASE_URL
      ? new URL(voiceEnv.STORAGE_PUBLIC_BASE_URL).host
      : null;

    return (
      parsed.host === bucketHost ||
      (r2Host !== null && parsed.host === r2Host) ||
      (publicBaseHost !== null && parsed.host === publicBaseHost)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Core transcription
// ---------------------------------------------------------------------------

/**
 * Download audio from our storage and transcribe via OpenAI Whisper.
 *
 * - Only fetches from our own bucket (anti-SSRF).
 * - Enforces MAX_AUDIO_MB size limit.
 * - Retries up to MAX_RETRIES with exponential backoff + jitter.
 * - Per-request timeout of TIMEOUT_MS.
 */
export async function transcribeAudio(
  params: TranscribeParams,
): Promise<TranscribeResult> {
  const { audioUrl, mimeType } = params;

  // Anti-SSRF: only fetch from our own storage
  if (!isOwnStorageUrl(audioUrl)) {
    throw new Error('Audio URL does not belong to our storage bucket');
  }

  logger.info({ audioUrl: audioUrl.substring(0, 80), mimeType }, 'transcription start');

  // ------- Download audio -------
  const controller = new AbortController();
  const downloadTimer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let audioResponse: Response;
  try {
    audioResponse = await fetch(audioUrl, { signal: controller.signal });
  } finally {
    clearTimeout(downloadTimer);
  }

  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: HTTP ${audioResponse.status}`);
  }

  const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());

  if (audioBuffer.byteLength > getMaxAudioBytes()) {
    throw new Error(
      `Audio file exceeds maximum size of ${voiceEnv.MAX_AUDIO_MB} MB`,
    );
  }

  // ------- Call Whisper with retries -------
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 0) {
        const delay = backoffMs(attempt - 1);
        logger.warn({ attempt, delayMs: delay }, 'transcription retry');
        await new Promise((r) => setTimeout(r, delay));
      }

      const result = await callWhisper(audioBuffer, mimeType);
      logger.info(
        { durationSec: result.durationSec, language: result.language },
        'transcription complete',
      );
      return result;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.error({ attempt, error: lastError.message }, 'whisper call failed');
    }
  }

  throw lastError ?? new Error('Transcription failed after retries');
}

// ---------------------------------------------------------------------------
// OpenAI Whisper call
// ---------------------------------------------------------------------------

async function callWhisper(
  audioBuffer: Buffer,
  mimeType: string,
): Promise<TranscribeResult> {
  // Dynamically import to reuse project's openai client pattern
  const { default: OpenAI } = await import('openai');

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY || '',
    timeout: TIMEOUT_MS,
  });

  // Build a File object from the buffer
  const ext = mimeType.split('/')[1] || 'webm';
  const file = new File([audioBuffer], `audio.${ext}`, { type: mimeType });

  const response = await client.audio.transcriptions.create({
    model: 'whisper-1',
    file,
    response_format: 'verbose_json',
  });

  const transcript = normalizeTranscript(
    (response as unknown as { text: string }).text ?? '',
  );
  const language =
    (response as unknown as { language?: string }).language ?? 'en';
  const durationSec = Math.round(
    (response as unknown as { duration?: number }).duration ?? 0,
  );

  return { transcript, language, durationSec };
}
