import { NextRequest, NextResponse } from 'next/server';
import { getInterviewById, startInterview } from '@/lib/db/interview';
import { getNextQuestion } from '@/lib/services/question-selection';

// POST /api/interviews/[id]/start - Start an interview
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
    
    // Verify interview is in SCHEDULED status
    if (interview.status !== 'SCHEDULED') {
      return NextResponse.json(
        { error: `Interview cannot be started. Current status: ${interview.status}` },
        { status: 400 }
      );
    }
    
    // Start the interview
    const updatedInterview = await startInterview(id);
    
    // Get the first question
    const firstQuestion = await getNextQuestion(id, 0);
    
    return NextResponse.json({
      success: true,
      interview: updatedInterview,
      firstQuestion,
    });
  } catch (error) {
    console.error('Error starting interview:', error);
    return NextResponse.json(
      { error: 'Failed to start interview' },
      { status: 500 }
    );
  }
}
