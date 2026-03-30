import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

// Mock dependencies
vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

vi.mock('@/lib/auth/session', () => ({
  getSession: vi.fn().mockResolvedValue({ userId: 'test-user', isLoggedIn: true }),
}));

vi.mock('@/lib/env', () => ({
  isVoiceEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
}));

vi.mock('@/lib/services/transcription-service', () => ({
  transcribeAudio: vi.fn().mockResolvedValue({
    transcript: 'Hello world',
    language: 'en',
    durationSec: 5,
  }),
}));

vi.mock('@vercel/functions', () => ({
  waitUntil: vi.fn(),
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from '@/app/api/transcriptions/request/route';
import { isVoiceEnabled } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { waitUntil } from '@vercel/functions';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/transcriptions/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/transcriptions/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    vi.mocked(isVoiceEnabled).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9 });
    prismaMock.response.findUnique.mockResolvedValue(null);
  });

  it('returns 202 for valid request', async () => {
    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
        durationSec: 10,
      }),
    );

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.status).toBe('accepted');
    expect(data.responseId).toBe('resp-123');
  });

  it('returns 403 when voice is disabled', async () => {
    vi.mocked(isVoiceEnabled).mockReturnValue(false);

    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 15,
    });

    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(429);
  });

  it('returns 202 already_completed when transcript exists', async () => {
    prismaMock.response.findUnique.mockResolvedValue({
      id: 'resp-123',
      transcript: 'Previously transcribed text',
      audioUrl: 'https://cdn.example.com/existing.webm',
    });

    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.status).toBe('already_completed');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid audioUrl', async () => {
    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'not-a-url',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(400);
  });

  it('calls waitUntil for accepted requests', async () => {
    await POST(
      makeRequest({
        responseId: 'resp-wait-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
        durationSec: 10,
      }),
    );

    expect(waitUntil).toHaveBeenCalledTimes(1);
  });

  it('returns Retry-After header on 429', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 15,
    });

    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('15');
  });

  it('idempotency checks transcript not audioUrl', async () => {
    // Response has audioUrl but no transcript — should still be accepted
    prismaMock.response.findUnique.mockResolvedValue({
      id: 'resp-123',
      audioUrl: 'https://cdn.example.com/existing.webm',
      transcript: null,
    });

    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        audioUrl: 'https://cdn.example.com/audio.webm',
        mimeType: 'audio/webm',
      }),
    );

    expect(res.status).toBe(202);
    const data = await res.json();
    expect(data.status).toBe('accepted');
  });
});
