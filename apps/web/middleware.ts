import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { validateSession } from './lib/auth/session';

// Paths that don't require authentication
const publicPaths = [
  '/auth/signin',
  '/',
];

// API paths that should return 401 instead of redirecting
const apiPaths = ['/api/'];

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:* https:;");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public paths without authentication
  if (publicPaths.some(path => pathname === path)) {
    return NextResponse.next();
  }
  
  // Special case: allow POST to /api/session (for login)
  if (pathname === '/api/session' && request.method === 'POST') {
    return NextResponse.next();
  }
  
  // Allow voice API routes for candidates (interview pages are public)
  if (
    pathname.startsWith('/api/uploads/sign') ||
    pathname.startsWith('/api/transcriptions/')
  ) {
    return addSecurityHeaders(NextResponse.next());
  }
  
  // Validate session for protected routes
  const { valid, reason } = await validateSession();
  
  if (!valid) {
    // For API routes, return 401 JSON response
    if (apiPaths.some(path => pathname.startsWith(path))) {
      return NextResponse.json(
        { 
          error: 'Unauthorized', 
          reason,
          message: reason === 'expired' 
            ? 'Your session has expired. Please sign in again.'
            : 'Please sign in to access this resource.'
        },
        { status: 401 }
      );
    }
    
    // For page routes, redirect to signin with return URL
    const signInUrl = new URL('/auth/signin', request.url);
    signInUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(signInUrl);
  }
  
  // Add security headers to response
  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
};
