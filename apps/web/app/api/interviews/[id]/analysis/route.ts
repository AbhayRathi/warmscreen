import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getInterviewById } from '@/lib/db/interview';
import { getInterviewAnalysis } from '@/lib/services/scoring-service';

// Valid ID pattern (CUID format: alphanumeric with underscores, typically 25 chars)
const VALID_ID_PATTERN = /^[a-zA-Z0-9_-]{10,50}$/;

/**
 * GET /api/interviews/[id]/analysis
 * Get full interview analysis with scored responses and breakdown
 */
export async function GET(
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
    const interviewCheck = await getInterviewById(interviewId);
    if (!interviewCheck) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }

    if (interviewCheck.recruiterId !== session.userId) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Get full analysis
    const analysis = await getInterviewAnalysis(interviewId);

    return NextResponse.json({
      success: true,
      interview: analysis.interview,
      scoredResponses: analysis.scoredResponses,
      totalResponses: analysis.totalResponses,
      isFullyScored: analysis.isFullyScored,
    });
  } catch (error) {
    console.error('Error getting interview analysis:', error);
    return NextResponse.json(
      { error: 'Failed to get interview analysis' },
      { status: 500 }
    );
  }
}
