import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  prismaMock,
  resetMocks,
} from '@/lib/test-utils/prisma-mock';

vi.mock('@/lib/db/prisma', () => ({
  default: prismaMock,
}));

vi.mock('pino', () => ({
  default: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { POST } from '@/app/api/responses/draft/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/responses/draft', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/responses/draft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMocks();
  });

  it('creates draft response and returns id', async () => {
    prismaMock.interview.findUnique.mockResolvedValue({
      id: 'int-123',
      status: 'IN_PROGRESS',
    });
    prismaMock.response.create.mockResolvedValue({
      id: 'resp-new-456',
      interviewId: 'int-123',
      questionId: 'q-789',
      transcript: '',
      duration: 0,
    });

    const res = await POST(
      makeRequest({
        interviewId: 'int-123',
        questionId: 'q-789',
      }),
    );

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe('resp-new-456');

    expect(prismaMock.response.create).toHaveBeenCalledWith({
      data: {
        interviewId: 'int-123',
        questionId: 'q-789',
        transcript: '',
        duration: 0,
        scores: {},
        tags: [],
      },
    });
  });

  it('returns 400 for missing interviewId', async () => {
    const res = await POST(makeRequest({ questionId: 'q-789' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing questionId', async () => {
    const res = await POST(makeRequest({ interviewId: 'int-123' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty body', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 404 when interview not found', async () => {
    prismaMock.interview.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        interviewId: 'nonexistent',
        questionId: 'q-789',
      }),
    );

    expect(res.status).toBe(404);
    const data = await res.json();
    expect(data.error).toBe('Interview not found');
  });

  it('returns 400 when interview not in progress', async () => {
    prismaMock.interview.findUnique.mockResolvedValue({
      id: 'int-123',
      status: 'COMPLETED',
    });

    const res = await POST(
      makeRequest({
        interviewId: 'int-123',
        questionId: 'q-789',
      }),
    );

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('not in progress');
  });
});
