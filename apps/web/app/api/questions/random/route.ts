import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import {
  getRandomQuestion,
  RandomQuestionParamsSchema,
  incrementQuestionUsage,
} from '@/lib/db/question';
import { z } from 'zod';

// POST - Get random questions using weighted selection
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await req.json();
    const validatedParams = RandomQuestionParamsSchema.parse(body);
    
    const questions = await getRandomQuestion(validatedParams);
    
    // Optionally increment usage for each selected question
    if (body.trackUsage !== false) {
      await Promise.all(
        questions.map((q) => incrementQuestionUsage(q.id))
      );
    }
    
    return NextResponse.json({
      success: true,
      questions,
      count: questions.length,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error getting random questions:', error);
    return NextResponse.json(
      { error: 'Failed to get random questions' },
      { status: 500 }
    );
  }
}
