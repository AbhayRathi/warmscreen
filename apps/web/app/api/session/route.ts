import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createSession, destroySession, getSession } from '@/lib/auth/session';
import { findOrCreateUser } from '@/lib/db/user';

const SignInSchema = z.object({
  email: z.string()
    .email('Please enter a valid email address')
    .min(1, 'Email is required')
    .max(255, 'Email is too long')
    .toLowerCase()
    .trim(),
  name: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name is too long')
    .trim()
    .regex(
      /^[a-zA-Z\s'-]+$/,
      'Name can only contain letters, spaces, hyphens, and apostrophes'
    ),
});

// POST - Create session (Sign In)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validatedData = SignInSchema.parse(body);
    
    // Find or create user in database
    const user = await findOrCreateUser({
      email: validatedData.email,
      name: validatedData.name,
    });
    
    // Create encrypted session
    await createSession({
      userId: user.id,
      email: user.email,
      name: user.name || validatedData.name,
    });
    
    return NextResponse.json({ 
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid input', 
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        },
        { status: 400 }
      );
    }
    
    console.error('Session creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Authentication failed. Please try again.' },
      { status: 500 }
    );
  }
}

// GET - Retrieve session
export async function GET() {
  try {
    const session = await getSession();
    
    if (!session.isLoggedIn) {
      return NextResponse.json(
        { isLoggedIn: false },
        { status: 200 }
      );
    }
    
    return NextResponse.json({
      isLoggedIn: true,
      user: {
        id: session.userId,
        email: session.email,
        name: session.name,
      }
    });
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json(
      { isLoggedIn: false },
      { status: 200 }
    );
  }
}

// DELETE - Destroy session (Sign Out)
export async function DELETE() {
  try {
    await destroySession();
    
    return NextResponse.json({ 
      success: true,
      message: 'Signed out successfully'
    });
  } catch (error) {
    console.error('Session destruction error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sign out' },
      { status: 500 }
    );
  }
}
