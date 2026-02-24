import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/lib/db/interview';
import { executeInterviewAnalysis } from '@/lib/agents/agent-factory';

/**
 * POST /api/interviews/[id]/analyze
 * 
 * Trigger agent analysis for all responses in an interview.
 * Requires authentication (session check).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get the interview
    const interview = await getInterviewById(id);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }
    
    // Check if interview has responses
    if (interview.responses.length === 0) {
      return NextResponse.json(
        { error: 'No responses to analyze' },
        { status: 400 }
      );
    }
    
    // Execute analysis for all responses
    const result = await executeInterviewAnalysis(id);
    
    return NextResponse.json({
      success: true,
      interviewId: result.interviewId,
      totalResponses: result.totalResponses,
      analyzedResponses: result.analyzedResponses,
      agentExecutions: result.agentExecutions,
      totalProcessingTime: result.totalProcessingTime,
      ...(result.errors.length > 0 && { errors: result.errors }),
    });
  } catch (error) {
    console.error('Error analyzing interview:', error);
    return NextResponse.json(
      { 
        error: 'Failed to analyze interview',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
