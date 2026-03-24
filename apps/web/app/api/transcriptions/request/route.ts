import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isVoiceEnabled } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import { getSession } from '@/lib/auth/session';
import { transcribeAudio } from '@/lib/services/transcription-service';
import prisma from '@/lib/db/prisma';
import pino from 'pino';

const logger = pino({ name: 'transcriptions-request' });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const RequestSchema = z.object({
  responseId: z.string().min(1),
  audioUrl: z.string().url(),
  mimeType: z.string().min(1),
  durationSec: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// In-flight job tracker (idempotency)
// ---------------------------------------------------------------------------

const inflightJobs = new Set<string>();

// ---------------------------------------------------------------------------
// Rate-limit config
// ---------------------------------------------------------------------------

const TRANSCRIPTION_RATE_LIMIT = { maxRequests: 10, windowSec: 60 };

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

    // Auth
    const session = await getSession();
    const userId = session?.userId ?? 'anonymous';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rateLimitKey = `transcribe:${userId}:${ip}`;

    // Rate limit
    const rl = checkRateLimit(rateLimitKey, TRANSCRIPTION_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    // Parse body
    const body = await req.json();
    const validated = RequestSchema.parse(body);

    // Idempotency: skip if already in-flight or completed
    if (inflightJobs.has(validated.responseId)) {
      logger.info({ responseId: validated.responseId }, 'duplicate request – already in-flight');
      return NextResponse.json(
        { status: 'already_in_progress', responseId: validated.responseId },
        { status: 202 },
      );
    }

    // Check if transcript already exists
    const existing = await prisma.response.findUnique({
      where: { id: validated.responseId },
      select: { audioUrl: true },
    });

    if (existing?.audioUrl) {
      logger.info({ responseId: validated.responseId }, 'duplicate request – already transcribed');
      return NextResponse.json(
        { status: 'already_completed', responseId: validated.responseId },
        { status: 202 },
      );
    }

    // Mark in-flight
    inflightJobs.add(validated.responseId);

    logger.info(
      { responseId: validated.responseId, mimeType: validated.mimeType },
      'transcription enqueued',
    );

    // Fire-and-forget async transcription
    (async () => {
      try {
        const result = await transcribeAudio({
          audioUrl: validated.audioUrl,
          mimeType: validated.mimeType,
        });

        await prisma.response.update({
          where: { id: validated.responseId },
          data: {
            audioUrl: validated.audioUrl,
            transcript: result.transcript,
            duration: result.durationSec || validated.durationSec || 0,
          },
        });

        logger.info({ responseId: validated.responseId }, 'transcription persisted');
      } catch (err) {
        logger.error(
          { responseId: validated.responseId, error: (err as Error).message },
          'transcription failed',
        );
      } finally {
        inflightJobs.delete(validated.responseId);
      }
    })();

    return NextResponse.json(
      { status: 'accepted', responseId: validated.responseId },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }

    logger.error({ error }, 'transcription request failed');
    return NextResponse.json(
      { error: 'Failed to enqueue transcription' },
      { status: 500 },
    );
  }
}
