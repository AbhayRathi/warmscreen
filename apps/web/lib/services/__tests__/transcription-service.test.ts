import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock env
vi.mock('@/lib/env', () => ({
  voiceEnv: {
    STORAGE_PROVIDER: 's3',
    STORAGE_BUCKET: 'test-bucket',
    STORAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
    STORAGE_ACCESS_KEY_ID: 'test-key',
    STORAGE_SECRET_ACCESS_KEY: 'test-secret',
    STORAGE_REGION: 'us-east-1',
    R2_ACCOUNT_ID: '',
    MAX_AUDIO_MB: 25,
    AUDIO_MIME_ALLOWLIST: ['audio/webm', 'audio/ogg', 'audio/mpeg'],
    TRANSCRIPTION_JOB_TOKEN: '',
  },
  getMaxAudioBytes: () => 25 * 1024 * 1024,
}));

// Mock OpenAI
const mockWhisperCreate = vi.fn().mockResolvedValue({
  text: '  Hello world.  This   is a test.  ',
  language: 'en',
  duration: 5.5,
});

vi.mock('openai', () => {
  class MockOpenAI {
    audio = {
      transcriptions: {
        create: mockWhisperCreate,
      },
    };
  }
  return { default: MockOpenAI };
});

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  normalizeTranscript,
  isOwnStorageUrl,
  transcribeAudio,
} from '@/lib/services/transcription-service';

describe('transcription-service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('normalizeTranscript', () => {
    it('trims leading/trailing whitespace', () => {
      expect(normalizeTranscript('  hello  ')).toBe('hello');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeTranscript('hello   world')).toBe('hello world');
    });

    it('collapses mixed whitespace (tabs, newlines)', () => {
      expect(normalizeTranscript('hello\t\n  world')).toBe('hello world');
    });

    it('returns empty for empty input', () => {
      expect(normalizeTranscript('')).toBe('');
    });
  });

  describe('isOwnStorageUrl', () => {
    it('accepts S3 bucket URL', () => {
      const url =
        'https://test-bucket.s3.us-east-1.amazonaws.com/interviews/123/resp.webm';
      expect(isOwnStorageUrl(url)).toBe(true);
    });

    it('accepts public base URL', () => {
      const url = 'https://cdn.example.com/interviews/123/resp.webm';
      expect(isOwnStorageUrl(url)).toBe(true);
    });

    it('rejects arbitrary URLs', () => {
      expect(isOwnStorageUrl('https://evil.com/audio.webm')).toBe(false);
    });

    it('rejects non-URL strings', () => {
      expect(isOwnStorageUrl('not a url')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(isOwnStorageUrl('')).toBe(false);
    });
  });

  describe('transcribeAudio', () => {
    it('rejects non-storage URLs (SSRF protection)', async () => {
      await expect(
        transcribeAudio({ audioUrl: 'https://evil.com/audio.webm', mimeType: 'audio/webm' }),
      ).rejects.toThrow('Audio URL does not belong to our storage bucket');
    });

    it('rejects oversized audio', async () => {
      const bigBuffer = Buffer.alloc(26 * 1024 * 1024); // 26 MB
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(bigBuffer.buffer),
      });

      await expect(
        transcribeAudio({
          audioUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test.webm',
          mimeType: 'audio/webm',
        }),
      ).rejects.toThrow('exceeds maximum size');
    });

    it('successfully transcribes valid audio', async () => {
      const audioData = Buffer.alloc(1000);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioData.buffer),
      });

      const result = await transcribeAudio({
        audioUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test.webm',
        mimeType: 'audio/webm',
      });

      expect(result.transcript).toBe('Hello world. This is a test.');
      expect(result.language).toBe('en');
      expect(result.durationSec).toBe(6); // Math.round(5.5)
    });

    it('retries on failure', async () => {
      const audioData = Buffer.alloc(1000);
      // First call succeeds for download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioData.buffer),
      });

      // Fail first, then succeed
      mockWhisperCreate
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({
          text: 'Retry worked',
          language: 'en',
          duration: 3.0,
        });

      const result = await transcribeAudio({
        audioUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test.webm',
        mimeType: 'audio/webm',
      });

      expect(result.transcript).toBe('Retry worked');
      expect(result.language).toBe('en');
    });

    it('throws on download failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(
        transcribeAudio({
          audioUrl: 'https://test-bucket.s3.us-east-1.amazonaws.com/test.webm',
          mimeType: 'audio/webm',
        }),
      ).rejects.toThrow('Failed to download audio');
    });
  });
});
