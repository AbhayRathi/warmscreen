import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById, completeInterview } from '@/lib/db/interview';
import { getResponseCount } from '@/lib/db/response';
import { TARGET_QUESTIONS } from '@/lib/services/question-selection';

// POST /api/interviews/[id]/complete - Complete an interview
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
    
    // Parse optional final score from body
    let finalScore: number | undefined;
    try {
      const body = await req.json();
      if (typeof body.finalScore === 'number') {
        finalScore = body.finalScore;
      }
    } catch {
      // No body provided, which is fine
    }
    
    // Complete the interview
    const updatedInterview = await completeInterview(id, finalScore);
    
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
