import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById } from '@/lib/db/interview';
import { getResponseCount } from '@/lib/db/response';
import { TARGET_QUESTIONS } from '@/lib/services/question-selection';
import { finalizeInterview } from '@/lib/agents/agent-factory';

// POST /api/interviews/[id]/complete - Complete an interview
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Completion now relies on agent-driven finalization in `finalizeInterview`,
    // so we no longer consume optional request body score overrides here.
    const { id } = await params;
    
    // Get the interview
    const interview = await getInterviewById(id);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }
    
    // Verify interview is IN_PROGRESS
    if (interview.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Interview cannot be completed. Current status: ${interview.status}` },
        { status: 400 }
      );
    }
    
    // Get response count
    const totalResponses = await getResponseCount(id);
    
    // Verify all required questions have been answered
    if (totalResponses < TARGET_QUESTIONS) {
      return NextResponse.json(
        { 
          error: `Interview cannot be completed. ${totalResponses}/${TARGET_QUESTIONS} questions answered.`,
          answeredCount: totalResponses,
          requiredCount: TARGET_QUESTIONS,
        },
        { status: 400 }
      );
    }
    
    // Trigger agent-based interview finalization
    await finalizeInterview(id);

    const updatedInterview = await getInterviewById(id);
    if (!updatedInterview) {
      return NextResponse.json(
        { error: 'Interview not found after completion' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      interview: updatedInterview,
      totalResponses,
    });
  } catch (error) {
    console.error('Error completing interview:', error);
    return NextResponse.json(
      { error: 'Failed to complete interview' },
      { status: 500 }
    );
  }
}
