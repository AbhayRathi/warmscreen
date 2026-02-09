import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getUserById } from '@/lib/db/user';
import {
  getQuestionById,
  updateQuestion,
  deleteQuestion,
  UpdateQuestionSchema,
} from '@/lib/db/question';
import { z } from 'zod';

interface Params {
  params: Promise<{ id: string }>;
}

// GET - Get a specific question by ID
export async function GET(
  req: NextRequest,
  context: Params
) {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const { id } = await context.params;
    const question = await getQuestionById(id);
    
    if (!question) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      question,
    });
  } catch (error) {
    console.error('Error fetching question:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question' },
      { status: 500 }
    );
  }
}

// PATCH - Update a question (ADMIN only)
export async function PATCH(
  req: NextRequest,
  context: Params
) {
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
    
    const { id } = await context.params;
    
    // Check if question exists
    const existingQuestion = await getQuestionById(id);
    
    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    const body = await req.json();
    const validatedData = UpdateQuestionSchema.parse(body);
    
    const question = await updateQuestion(id, validatedData);
    
    return NextResponse.json({
      success: true,
      question,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error updating question:', error);
    return NextResponse.json(
      { error: 'Failed to update question' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a question (ADMIN only)
export async function DELETE(
  req: NextRequest,
  context: Params
) {
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
    
    const { id } = await context.params;
    
    // Check if question exists
    const existingQuestion = await getQuestionById(id);
    
    if (!existingQuestion) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    await deleteQuestion(id);
    
    return NextResponse.json({
      success: true,
      message: 'Question deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting question:', error);
    return NextResponse.json(
      { error: 'Failed to delete question' },
      { status: 500 }
    );
  }
}
