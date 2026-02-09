import { NextRequest, NextResponse } from 'next/server';
import { getInterviewByCandidateIdWithQuestions } from '@/lib/db/interview';
import { getNextQuestion, getInterviewProgress } from '@/lib/services/question-selection';

// GET /api/interviews/[id]/session - Get interview session for candidate access
// Note: [id] here is the candidateId, not the interview id
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: candidateId } = await params;
    
    // Get the interview by candidate ID
    const interview = await getInterviewByCandidateIdWithQuestions(candidateId);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found for this candidate' },
        { status: 404 }
      );
    }
    
    // Get progress
    const progress = await getInterviewProgress(interview.id);
    
    // Get next question if in progress
    const currentQuestion = interview.status === 'IN_PROGRESS'
      ? await getNextQuestion(interview.id, progress.current)
      : null;
    
    // Format responses without sensitive data
    const responses = interview.responses.map((r) => ({
      id: r.id,
      questionId: r.questionId,
      transcript: r.transcript,
      duration: r.duration,
      createdAt: r.createdAt,
      question: r.question,
    }));
    
    return NextResponse.json({
      success: true,
      interview: {
        id: interview.id,
        candidateId: interview.candidateId,
        candidateName: interview.candidateName,
        position: interview.position,
        status: interview.status,
        scheduledAt: interview.scheduledAt,
        startedAt: interview.startedAt,
        completedAt: interview.completedAt,
      },
      responses,
      currentQuestion,
      progress,
    });
  } catch (error) {
    console.error('Error getting interview session:', error);
    return NextResponse.json(
      { error: 'Failed to get interview session' },
      { status: 500 }
    );
  }
}
