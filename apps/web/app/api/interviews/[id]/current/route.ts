import { NextRequest, NextResponse } from 'next/server';
import { getInterviewWithQuestions } from '@/lib/db/interview';
import { getNextQuestion, getInterviewProgress } from '@/lib/services/question-selection';

// GET /api/interviews/[id]/current - Get current interview state and next question
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Get the interview with responses
    const interview = await getInterviewWithQuestions(id);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }
    
    // Get progress
    const progress = await getInterviewProgress(id);
    
    // Get next question (or null if complete)
    const currentQuestion = interview.status === 'IN_PROGRESS'
      ? await getNextQuestion(id, progress.current)
      : null;
    
    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        candidateId: interview.candidateId,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
      },
      currentQuestion,
      progress,
    });
  } catch (error) {
    console.error('Error getting current interview state:', error);
    return NextResponse.json(
      { error: 'Failed to get interview state' },
      { status: 500 }
    );
  }
}
