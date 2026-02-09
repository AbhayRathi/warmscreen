import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/db/user';
import {
  getAllQuestions,
  createQuestion,
  QuestionFiltersSchema,
  CreateQuestionSchema,
  getUniquePositions,
  getUniqueCategories,
} from '@/lib/db/question';
import { z } from 'zod';

// GET - List all questions with optional filters and pagination
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { searchParams } = new URL(req.url);
    
    const filters = {
      category: searchParams.get('category') || undefined,
      difficulty: searchParams.get('difficulty') || undefined,
      position: searchParams.get('position') || undefined,
      page: parseInt(searchParams.get('page') || '1', 10),
      limit: parseInt(searchParams.get('limit') || '20', 10),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: searchParams.get('sortOrder') || 'desc',
    };
    
    const validatedFilters = QuestionFiltersSchema.parse(filters);
    const result = await getAllQuestions(validatedFilters);
    
    // Also get available filter options
    const [positions, categories] = await Promise.all([
      getUniquePositions(),
      getUniqueCategories(),
    ]);
    
    return NextResponse.json({
      success: true,
      ...result,
      filterOptions: {
        positions,
        categories,
        difficulties: ['EASY', 'MEDIUM', 'HARD', 'EXPERT'],
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}

// POST - Create a new question (ADMIN only)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Check if user is ADMIN
    const user = await getUserById(session.userId);
    
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }
    
    const body = await req.json();
    const validatedData = CreateQuestionSchema.parse(body);
    
    const question = await createQuestion(validatedData, session.userId);
    
    return NextResponse.json({
      success: true,
      question,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating question:', error);
    return NextResponse.json(
      { error: 'Failed to create question' },
      { status: 500 }
    );
  }
}
