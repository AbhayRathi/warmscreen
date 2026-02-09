import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { getQuestionAnalytics } from '@/lib/db/question';
import { calculateQuestionCorrelation } from '@/lib/analytics/question-correlation';

interface Params {
  params: Promise<{ id: string }>;
}

// GET - Get analytics for a specific question
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
    const analytics = await getQuestionAnalytics(id);
    
    if (!analytics) {
      return NextResponse.json(
        { error: 'Question not found' },
        { status: 404 }
      );
    }
    
    // Calculate live correlation if possible
    const liveCorrelation = await calculateQuestionCorrelation(id);
    
    return NextResponse.json({
      success: true,
      analytics: {
        ...analytics,
        liveCorrelation,
      },
    });
  } catch (error) {
    console.error('Error fetching question analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch question analytics' },
      { status: 500 }
    );
  }
}
