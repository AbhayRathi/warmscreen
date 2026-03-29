import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db/prisma';

/**
 * GET /api/transcriptions/status?responseId=X
 *
 * Lightweight polling endpoint for checking transcription status.
 * Returns { status: 'pending'|'completed'|'failed', transcript?: string }
 */
export async function GET(req: NextRequest) {
  const responseId = req.nextUrl.searchParams.get('responseId');
  if (!responseId) {
    return NextResponse.json(
      { error: 'responseId query parameter required' },
      { status: 400 },
    );
  }

  const response = await prisma.response.findUnique({
    where: { id: responseId },
    select: { transcript: true, audioUrl: true },
  });

  if (!response) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // If transcript is non-empty, transcription is complete
  if (response.transcript && response.transcript.length > 0) {
    return NextResponse.json({
      status: 'completed',
      transcript: response.transcript,
    });
  }

  // If audioUrl is set but no transcript, still processing
  if (response.audioUrl) {
    return NextResponse.json({ status: 'pending' });
  }

  // No audioUrl and no transcript — not yet started
  return NextResponse.json({ status: 'pending' });
}
