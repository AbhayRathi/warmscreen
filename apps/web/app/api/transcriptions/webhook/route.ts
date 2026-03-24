import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { voiceEnv, isVoiceEnabled } from '@/lib/env';
import { checkRateLimit } from '@/lib/rate-limit';
import prisma from '@/lib/db/prisma';
import pino from 'pino';

const logger = pino({ name: 'transcriptions-webhook' });

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const WebhookSchema = z.object({
  responseId: z.string().min(1),
  transcript: z.string().min(1),
  language: z.string().optional(),
  durationSec: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Idempotency tracker
// ---------------------------------------------------------------------------

const processedWebhooks = new Set<string>();

// ---------------------------------------------------------------------------
// Rate-limit config
// ---------------------------------------------------------------------------

const WEBHOOK_RATE_LIMIT = { maxRequests: 30, windowSec: 60 };

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

    // Authenticate via internal job token
    const token = req.headers.get('x-internal-job-token');
    if (
      !voiceEnv.TRANSCRIPTION_JOB_TOKEN ||
      !token ||
      token !== voiceEnv.TRANSCRIPTION_JOB_TOKEN
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Rate limit
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
    const rl = checkRateLimit(`webhook:${ip}`, WEBHOOK_RATE_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Too many requests', retryAfterSec: rl.retryAfterSec },
        { status: 429 },
      );
    }

    // Parse body
    const body = await req.json();
    const validated = WebhookSchema.parse(body);

    // Idempotency: skip duplicate webhooks
    if (processedWebhooks.has(validated.responseId)) {
      logger.info(
        { responseId: validated.responseId },
        'duplicate webhook ignored',
      );
      return NextResponse.json({ status: 'duplicate' });
    }

    // Update response
    await prisma.response.update({
      where: { id: validated.responseId },
      data: {
        transcript: validated.transcript,
        ...(validated.durationSec !== undefined
          ? { duration: validated.durationSec }
          : {}),
      },
    });

    // Mark as processed
    processedWebhooks.add(validated.responseId);

    logger.info(
      { responseId: validated.responseId, language: validated.language },
      'webhook processed',
    );

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }

    logger.error({ error }, 'webhook processing failed');
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
