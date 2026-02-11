import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getResponseById } from '@/lib/db/response';
import { getInterviewById } from '@/lib/db/interview';
import { scoreResponse } from '@/lib/services/scoring-service';

// Valid ID pattern (CUID format: alphanumeric with underscores, typically 25 chars)
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{10,50}$/;

/**
 * POST /api/responses/[id]/score
 * Score a single interview response using AI analysis
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: responseId } = await params;
    
    // Validate ID format
    if (!responseId || !VALID_ID_PATTERN.test(responseId)) {
      return NextResponse.json(
        { error: 'Invalid response ID format' },
        { status: 400 }
      );
    }
    
    // Verify authentication
    const session = await getSession();
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify response exists
    const response = await getResponseById(responseId);
    if (!response) {
      return NextResponse.json(
        { error: 'Response not found' },
        { status: 404 }
      );
    }

    // Verify user owns the interview
    const interview = await getInterviewById(response.interviewId);
    if (!interview || interview.recruiterId !== session.userId) {
      return NextResponse.json(
        { error: 'Interview not found or access denied' },
        { status: 404 }
      );
    }

    // Score the response
    const result = await scoreResponse(responseId);

    return NextResponse.json({
      success: true,
      responseId: result.responseId,
      scores: result.scores,
      sentiment: result.sentiment,
      confidence: result.confidence,
      strengths: result.strengths,
      weaknesses: result.weaknesses,
      summary: result.summary,
    });
  } catch (error) {
    console.error('Error scoring response:', error);
    return NextResponse.json(
      { error: 'Failed to score response' },
      { status: 500 }
    );
  }
}
