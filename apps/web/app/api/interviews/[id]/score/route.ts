import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getInterviewById } from '@/lib/db/interview';
import { scoreInterview } from '@/lib/services/scoring-service';

// Valid ID pattern (CUID format: alphanumeric with underscores, typically 25 chars)
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{10,50}$/;

/**
 * POST /api/interviews/[id]/score
 * Score an entire interview and generate hiring decision
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: interviewId } = await params;
    
    // Validate ID format
    if (!interviewId || !VALID_ID_PATTERN.test(interviewId)) {
      return NextResponse.json(
        { error: 'Invalid interview ID format' },
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

    // Verify interview exists and user owns it
    const interview = await getInterviewById(interviewId);
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }

    if (interview.recruiterId !== session.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if interview has responses
    if (!interview.responses || interview.responses.length === 0) {
      return NextResponse.json(
        { error: 'Interview has no responses to score' },
        { status: 400 }
      );
    }

    // Score the interview
    const result = await scoreInterview(interviewId);

    return NextResponse.json({
      success: true,
      interviewId: result.interviewId,
      overallScore: result.overallScore,
      categoryBreakdown: result.categoryBreakdown,
      decision: result.decision,
      confidence: result.confidence,
      explainability: result.explainability,
    });
  } catch (error) {
    console.error('Error scoring interview:', error);
    return NextResponse.json(
      { error: 'Failed to score interview' },
      { status: 500 }
    );
  }
}
