import { createNeonAuth } from '@neondatabase/auth/next/server';

const authBaseUrl = process.env.NEON_AUTH_BASE_URL || 'https://auth.neon.tech';
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || 'local-development-cookie-secret-32-chars';

export const auth = createNeonAuth({
  baseUrl: authBaseUrl,
  cookies: { secret: cookieSecret },
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'silent',
});

export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await auth.getSession();
    return data?.user?.id ?? null;
  } catch {
    return process.env.DEMO_USER_ID || null;
  }
}
