import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getInterviewById } from '@/lib/db/interview';
import { createResponse } from '@/lib/db/response';
import { incrementQuestionUsage } from '@/lib/db/question';
import { getNextQuestion, getInterviewProgress, isInterviewComplete } from '@/lib/services/question-selection';

const SubmitResponseSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  transcript: z.string().min(1, 'Transcript is required'),
  duration: z.number().int().min(0, 'Duration must be a positive integer'),
});

// POST /api/interviews/[id]/responses - Submit a response
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Parse and validate input
    const body = await req.json();
    const validatedData = SubmitResponseSchema.parse(body);
    
    // Get the interview
    const interview = await getInterviewById(id);
    
    if (!interview) {
      return NextResponse.json(
        { error: 'Interview not found' },
        { status: 404 }
      );
    }
    
    // Check interview is IN_PROGRESS
    if (interview.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: `Cannot submit response. Interview status: ${interview.status}` },
        { status: 400 }
      );
    }
    
    // Create the response
    const response = await createResponse({
      interviewId: id,
      questionId: validatedData.questionId,
      transcript: validatedData.transcript,
      duration: validatedData.duration,
    });
    
    // Increment question usage counter
    await incrementQuestionUsage(validatedData.questionId);
    
    // Get progress
    const progress = await getInterviewProgress(id);
    
    // Check if interview should be auto-completed
    const isComplete = await isInterviewComplete(id);
    
    // Get next question (or null if complete)
    const nextQuestion = isComplete
      ? null
      : await getNextQuestion(id, progress.current);
    
    return NextResponse.json({
      success: true,
      response: {
        id: response.id,
        questionId: response.questionId,
        duration: response.duration,
        createdAt: response.createdAt,
      },
      nextQuestion,
      progress,
      isComplete,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error submitting response:', error);
    return NextResponse.json(
      { error: 'Failed to submit response' },
      { status: 500 }
    );
  }
}
