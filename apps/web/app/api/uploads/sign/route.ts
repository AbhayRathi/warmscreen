import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/auth/session';
import { getSignedPutUrl } from '@/lib/storage/s3';
import { isAllowedMimeType, getMaxAudioBytes, isVoiceEnabled } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/db/prisma';
import pino from 'pino';

const logger = pino({ name: 'uploads-sign' });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const SAFE_FILENAME = /^[a-zA-Z0-9_-]+\.[a-zA-Z0-9]+$/;

const SignRequestSchema = z.object({
  fileName: z
    .string()
    .min(1)
    .max(255)
    .refine((n) => SAFE_FILENAME.test(n), 'Invalid file name'),
  mimeType: z.string().min(1),
  contentLength: z.number().int().positive(),
  interviewId: z.string().min(1).optional(),
  responseId: z.string().min(1).optional(),
});

// ---------------------------------------------------------------------------
// Rate-limit config (per user+IP)
// ---------------------------------------------------------------------------

const SIGN_RATE_LIMIT = { maxRequests: 10, windowSec: 60 };

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // Feature gate
    if (!isVoiceEnabled()) {
      return NextResponse.json(
        { error: 'Voice features are disabled' },
        { status: 403 },
      );
    }

    // Auth: recruiter session OR candidate (interview path is public)
    const session = await getSession();
    const userId = session?.userId ?? 'anonymous';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateLimitKey = `sign:${userId}:${ip}`;

    // Rate limit
    const rl = checkRateLimit(rateLimitKey, SIGN_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.retryAfterSec ?? 0)) } },
      );
    }

    // Parse body
    const body = await req.json();
    const validated = SignRequestSchema.parse(body);

    // Validate MIME
    if (!isAllowedMimeType(validated.mimeType)) {
      return NextResponse.json(
        {
          error: `Unsupported MIME type: ${validated.mimeType}`,
          allowed: ['audio/webm', 'audio/ogg', 'audio/mpeg'],
        },
        { status: 400 },
      );
    }

    // Validate size
    if (validated.contentLength > getMaxAudioBytes()) {
      return NextResponse.json(
        { error: `File too large. Maximum size: ${getMaxAudioBytes() / 1024 / 1024} MB` },
        { status: 400 },
      );
    }

    // Build storage key with strict prefix
    const interviewId = validated.interviewId;
    const responseId = validated.responseId;

    if (!interviewId || !responseId) {
      return NextResponse.json(
        { error: 'interviewId and responseId are required' },
        { status: 400 },
      );
    }

    // Validate that the response exists and belongs to the interview
    const existingResponse = await prisma.response.findUnique({
      where: { id: responseId },
      select: { id: true, interviewId: true },
    });
    if (!existingResponse || existingResponse.interviewId !== interviewId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const ext = validated.fileName.split('.').pop() || 'webm';
    const key = `interviews/${interviewId}/responses/${responseId}.${ext}`;

    const result = await getSignedPutUrl({
      key,
      contentType: validated.mimeType,
      contentLength: validated.contentLength,
    });

    logger.info(
      {
        userId: userId.substring(0, 8),
        mimeType: validated.mimeType,
        size: validated.contentLength,
        key,
      },
      'signed upload URL issued',
    );

    return NextResponse.json({
      uploadUrl: result.uploadUrl,
      publicUrl: result.publicUrl,
      headers: result.headers,
      expiresInSec: result.ttlSec,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }

    logger.error({ error }, 'sign request failed');
    return NextResponse.json(
      { error: 'Failed to generate signed URL' },
      { status: 500 },
    );
  }
}
