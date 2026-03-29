import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/db/prisma';
import pino from 'pino';

const logger = pino({ name: 'responses-draft' });

const DraftSchema = z.object({
  interviewId: z.string().min(1),
  questionId: z.string().min(1),
});

/**
 * POST /api/responses/draft
 *
 * Creates a draft (placeholder) Response row so that a valid responseId
 * exists before the candidate records and uploads audio.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = DraftSchema.parse(body);

    // Verify the interview exists and is IN_PROGRESS
    const interview = await prisma.interview.findUnique({
      where: { id: validated.interviewId },
      select: { id: true, status: true },
    });

    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 },
      );
    }

    if (interview.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Interview is not in progress (status: ${interview.status})` },
        { status: 400 },
      );
    }

    // Create a draft response with empty transcript (placeholder)
    // Return existing draft if one already exists for this question
    const existing = await prisma.response.findFirst({
      where: {
        interviewId: validated.interviewId,
        questionId: validated.questionId,
        transcript: '',
        audioUrl: null,
      },
      select: { id: true },
    });
    if (existing) {
      logger.info({ responseId: existing.id }, 'returning existing draft response');
      return NextResponse.json({ id: existing.id }, { status: 200 });
    }

    const response = await prisma.response.create({
      data: {
        interviewId: validated.interviewId,
        questionId: validated.questionId,
        transcript: '',
        duration: 0,
        scores: {},
        tags: [],
      },
    });

    logger.info(
      { responseId: response.id, interviewId: validated.interviewId },
      'draft response created',
    );

    return NextResponse.json({ id: response.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 },
      );
    }

    logger.error({ error }, 'draft response creation failed');
    return NextResponse.json(
      { error: 'Failed to create draft response' },
      { status: 500 },
    );
  }
}
