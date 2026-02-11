import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createInterview, getUserInterviews } from '@/lib/db/interview';
import { z } from 'zod';

const CreateInterviewSchema = z.object({
  candidateName: z.string().min(1, 'Candidate name is required').max(100),
  candidateEmail: z.string().email('Invalid email address'),
  position: z.string().min(1, 'Position is required').max(100),
  scheduledAt: z.string().optional(),
});

// GET - List user's interviews
export async function GET(_req: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const interviews = await getUserInterviews(session.userId);
    
    return NextResponse.json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    );
  }
}

// POST - Create new interview
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
    const validatedData = CreateInterviewSchema.parse(body);
    
    const interview = await createInterview({
      recruiterId: session.userId,
      candidateName: validatedData.candidateName,
      candidateEmail: validatedData.candidateEmail,
      position: validatedData.position,
      scheduledAt: validatedData.scheduledAt ? new Date(validatedData.scheduledAt) : undefined,
    });
    
    return NextResponse.json({
      success: true,
      interview,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.issues },
        { status: 400 }
      );
    }
    
    console.error('Error creating interview:', error);
    return NextResponse.json(
      { error: 'Failed to create interview' },
      { status: 500 }
    );
  }
}
