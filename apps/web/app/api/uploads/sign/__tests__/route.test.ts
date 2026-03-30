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
  isAllowedMimeType: vi.fn((mime: string) =>
    ['audio/webm', 'audio/ogg', 'audio/mpeg'].includes(mime),
  ),
  getMaxAudioBytes: vi.fn(() => 25 * 1024 * 1024),
  isVoiceEnabled: vi.fn(() => true),
}));

vi.mock('@/lib/storage/s3', () => ({
  getSignedPutUrl: vi.fn().mockResolvedValue({
    uploadUrl: 'https://bucket.s3.amazonaws.com/key?signed=1',
    headers: { 'Content-Type': 'audio/webm', 'Content-Length': '1000' },
    publicUrl: 'https://cdn.example.com/key',
    ttlSec: 300,
  }),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ allowed: true, remaining: 9 })),
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from '@/app/api/uploads/sign/route';
import { checkRateLimit } from '@/lib/rate-limit';
import { isVoiceEnabled } from '@/lib/env';

function makeRequest(body: unknown, headers?: Record<string, string>): NextRequest {
  return new NextRequest('http://localhost/api/uploads/sign', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(headers ?? {}),
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/uploads/sign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
    vi.mocked(isVoiceEnabled).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockReturnValue({ allowed: true, remaining: 9 });
    // Default: response exists in DB with matching interviewId
    prismaMock.response.findUnique.mockResolvedValue({
      id: 'resp-456',
      interviewId: 'int-123',
    });
  });

  it('returns signed URL for valid request', async () => {
    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
        interviewId: 'int-123',
        responseId: 'resp-456',
      }),
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.uploadUrl).toContain('https://');
    expect(data.publicUrl).toContain('https://');
    expect(data.expiresInSec).toBe(300);
    expect(data.headers['Content-Type']).toBe('audio/webm');
  });

  it('returns 403 when voice is disabled', async () => {
    vi.mocked(isVoiceEnabled).mockReturnValue(false);

    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
      }),
    );

    expect(res.status).toBe(403);
  });

  it('returns 400 for unsupported MIME type', async () => {
    const res = await POST(
      makeRequest({
        fileName: 'recording.mp4',
        mimeType: 'video/mp4',
        contentLength: 1000,
        interviewId: 'int-123',
        responseId: 'resp-456',
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('Unsupported MIME type');
  });

  it('returns 400 for oversized file', async () => {
    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 30 * 1024 * 1024, // 30 MB
        interviewId: 'int-123',
        responseId: 'resp-456',
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('too large');
  });

  it('returns 400 for invalid file name', async () => {
    const res = await POST(
      makeRequest({
        fileName: '../../../etc/passwd',
        mimeType: 'audio/webm',
        contentLength: 1000,
      }),
    );

    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 30,
    });

    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
      }),
    );

    expect(res.status).toBe(429);
    const data = await res.json();
    expect(data.retryAfterSec).toBe(30);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when interviewId or responseId missing', async () => {
    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('interviewId and responseId are required');
  });

  it('returns 404 when responseId not found in DB', async () => {
    prismaMock.response.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
        interviewId: 'int-123',
        responseId: 'resp-nonexistent',
      }),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Not found');
  });

  it('returns 404 when responseId belongs to different interview', async () => {
    prismaMock.response.findUnique.mockResolvedValue({
      id: 'resp-456',
      interviewId: 'other-interview',
    });

    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
        interviewId: 'int-123',
        responseId: 'resp-456',
      }),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Not found');
  });

  it('returns Retry-After header on 429', async () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      retryAfterSec: 30,
    });

    const res = await POST(
      makeRequest({
        fileName: 'recording.webm',
        mimeType: 'audio/webm',
        contentLength: 1000,
      }),
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');
  });
});
