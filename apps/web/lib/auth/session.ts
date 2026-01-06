import { getIronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData } from './types';

const sessionOptions = {
  password: process.env.SESSION_SECRET || 'complex_password_at_least_32_characters_long_CHANGE_ME',
  cookieName: 'warmscreen_session',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24, // 24 hours
    path: '/',
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, sessionOptions);
}

export async function createSession(data: Omit<SessionData, 'isLoggedIn' | 'createdAt' | 'expiresAt'>) {
  const session = await getSession();
  const now = Date.now();
  
  session.userId = data.userId;
  session.email = data.email;
  session.name = data.name;
  session.isLoggedIn = true;
  session.createdAt = now;
  session.expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours
  
  await session.save();
  return session;
}

export async function destroySession() {
  const session = await getSession();
  session.destroy();
}

export async function validateSession() {
  const session = await getSession();
  
  if (!session.isLoggedIn) {
    return { valid: false, reason: 'not_logged_in' as const };
  }
  
  if (session.expiresAt && session.expiresAt < Date.now()) {
    await destroySession();
    return { valid: false, reason: 'expired' as const };
  }
  
  return { valid: true, session };
}
