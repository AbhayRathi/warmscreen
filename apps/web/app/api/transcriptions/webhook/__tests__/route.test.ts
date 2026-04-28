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

vi.mock('@/lib/env', () => ({
  voiceEnv: {
    TRANSCRIPTION_JOB_TOKEN: 'test-secret-token',
  },
  isVoiceEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 29 })),
}));

vi.mock('@/lib/agents/agent-factory', () => ({
  analyzeResponse: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from '@/app/api/transcriptions/webhook/route';
import { isVoiceEnabled } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';

function makeRequest(
  body: unknown,
  headers?: Record<string, string>,
): NextRequest {
  return new NextRequest('http://localhost/api/transcriptions/webhook', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/transcriptions/webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    vi.mocked(isVoiceEnabled).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 29 });
    prismaMock.response.update.mockResolvedValue({
      id: 'resp-123',
      transcript: 'Hello world',
    });
  });

  it('returns 401 when token is missing', async () => {
    const res = await POST(
      makeRequest({
        responseId: 'resp-123',
        transcript: 'Hello world',
      }),
    );

    expect(res.status).toBe(401);
  });

  it('returns 401 when token is wrong', async () => {
    const res = await POST(
      makeRequest(
        {
          responseId: 'resp-123',
          transcript: 'Hello world',
        },
        { 'x-internal-job-token': 'wrong-token' },
      ),
    );

    expect(res.status).toBe(401);
  });

  it('updates response with valid token', async () => {
    const res = await POST(
      makeRequest(
        {
          responseId: 'resp-123',
          transcript: 'Hello world',
          language: 'en',
          durationSec: 5,
        },
        { 'x-internal-job-token': 'test-secret-token' },
      ),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');

    expect(prismaMock.response.update).toHaveBeenCalledWith({
      where: { id: 'resp-123' },
      data: {
        transcript: 'Hello world',
        duration: 5,
      },
    });
  });

  it('ignores duplicate webhooks', async () => {
    const headers = { 'x-internal-job-token': 'test-secret-token' };
    const body = { responseId: 'dup-resp-1', transcript: 'Dup test' };

    await POST(makeRequest(body, headers));
    const res2 = await POST(makeRequest(body, headers));

    expect(res2.status).toBe(200);
    const data = await res2.json();
    expect(data.status).toBe('duplicate');

    // Should only update once
    expect(prismaMock.response.update).toHaveBeenCalledTimes(1);
  });

  it('returns 403 when voice is disabled', async () => {
    vi.mocked(isVoiceEnabled).mockReturnValue(false);

    const res = await POST(
      makeRequest(
        { responseId: 'resp-123', transcript: 'Hello' },
        { 'x-internal-job-token': 'test-secret-token' },
      ),
    );

    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 10,
    });

    const res = await POST(
      makeRequest(
        { responseId: 'resp-123', transcript: 'Hello' },
        { 'x-internal-job-token': 'test-secret-token' },
      ),
    );

    expect(res.status).toBe(429);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(
      makeRequest(
        {},
        { 'x-internal-job-token': 'test-secret-token' },
      ),
    );

    expect(res.status).toBe(400);
  });
});
