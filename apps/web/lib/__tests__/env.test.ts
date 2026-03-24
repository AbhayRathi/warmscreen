import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset modules between tests to re-evaluate env parsing
beforeEach(() => {
  vi.unstubAllEnvs();
});

describe('lib/env', () => {
  it('should return defaults when no env vars are set', async () => {
    vi.stubEnv('VOICE_ENABLED', undefined as unknown as string);
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');

    expect(voiceEnv.VOICE_ENABLED).toBe(false);
    expect(voiceEnv.STORAGE_PROVIDER).toBe('s3');
    expect(voiceEnv.STORAGE_BUCKET).toBe('warmscreen-audio');
    expect(voiceEnv.MAX_AUDIO_MB).toBe(25);
    expect(voiceEnv.AUDIO_MIME_ALLOWLIST).toEqual([
      'audio/webm',
      'audio/ogg',
      'audio/mpeg',
    ]);
    expect(voiceEnv.TRANSCRIPTION_JOB_TOKEN).toBe('');
  });

  it('should parse VOICE_ENABLED=true', async () => {
    vi.stubEnv('VOICE_ENABLED', 'true');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.VOICE_ENABLED).toBe(true);
  });

  it('should parse VOICE_ENABLED=1', async () => {
    vi.stubEnv('VOICE_ENABLED', '1');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.VOICE_ENABLED).toBe(true);
  });

  it('should parse VOICE_ENABLED=false', async () => {
    vi.stubEnv('VOICE_ENABLED', 'false');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.VOICE_ENABLED).toBe(false);
  });

  it('should respect custom MAX_AUDIO_MB', async () => {
    vi.stubEnv('MAX_AUDIO_MB', '50');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.MAX_AUDIO_MB).toBe(50);
  });

  it('should parse custom AUDIO_MIME_ALLOWLIST', async () => {
    vi.stubEnv('AUDIO_MIME_ALLOWLIST', 'audio/mp4,audio/wav');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.AUDIO_MIME_ALLOWLIST).toEqual(['audio/mp4', 'audio/wav']);
  });

  it('should respect STORAGE_PROVIDER=r2', async () => {
    vi.stubEnv('STORAGE_PROVIDER', 'r2');
    vi.resetModules();
    const { voiceEnv } = await import('@/lib/env');
    expect(voiceEnv.STORAGE_PROVIDER).toBe('r2');
  });
});

describe('isVoiceEnabled', () => {
  it('returns false by default', async () => {
    vi.stubEnv('VOICE_ENABLED', undefined as unknown as string);
    vi.resetModules();
    const { isVoiceEnabled } = await import('@/lib/env');
    expect(isVoiceEnabled()).toBe(false);
  });

  it('returns true when VOICE_ENABLED=true', async () => {
    vi.stubEnv('VOICE_ENABLED', 'true');
    vi.resetModules();
    const { isVoiceEnabled } = await import('@/lib/env');
    expect(isVoiceEnabled()).toBe(true);
  });
});

describe('isAllowedMimeType', () => {
  it('allows audio/webm', async () => {
    vi.resetModules();
    const { isAllowedMimeType } = await import('@/lib/env');
    expect(isAllowedMimeType('audio/webm')).toBe(true);
  });

  it('allows audio/ogg', async () => {
    vi.resetModules();
    const { isAllowedMimeType } = await import('@/lib/env');
    expect(isAllowedMimeType('audio/ogg')).toBe(true);
  });

  it('rejects video/mp4', async () => {
    vi.resetModules();
    const { isAllowedMimeType } = await import('@/lib/env');
    expect(isAllowedMimeType('video/mp4')).toBe(false);
  });

  it('rejects text/plain', async () => {
    vi.resetModules();
    const { isAllowedMimeType } = await import('@/lib/env');
    expect(isAllowedMimeType('text/plain')).toBe(false);
  });
});

describe('getMaxAudioBytes', () => {
  it('returns 25 MB by default', async () => {
    vi.resetModules();
    const { getMaxAudioBytes } = await import('@/lib/env');
    expect(getMaxAudioBytes()).toBe(25 * 1024 * 1024);
  });
});
