import { createNeonAuth } from '@neondatabase/auth/next/server';

const authBaseUrl = process.env.NEON_AUTH_BASE_URL || 'https://auth.neon.tech';
const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET || 'local-development-cookie-secret-32-chars';

export const auth = createNeonAuth({
  baseUrl: authBaseUrl,
  cookies: { secret: cookieSecret },
  logLevel: process.env.NODE_ENV === 'production' ? 'warn' : 'silent',
});

/**
 * Contournement d'authentification pour le développement local uniquement
 * (AUTH_DISABLED=true + NODE_ENV != production) — même condition que proxy.ts,
 * jamais actif en production.
 */
function devAuthDisabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true';
}

export async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await auth.getSession();
    const id = data?.user?.id ?? null;
    if (id) return id;
  } catch {
    // Session Neon Auth indisponible (pas de backend, pas de cookie, réseau).
  }
  // Mode dev sans auth : identité de démonstration stable pour toutes les
  // routes API (pages ET API, contrairement au fallback initial limité au catch).
  if (devAuthDisabled()) return process.env.DEMO_USER_ID || 'demo-user';
  return null;
}

/**
 * Email de l'utilisateur connecté (nécessaire pour vérifier qu'une invitation
 * magic link est bien destinée à l'adresse qui l'accepte). Retourne null quand
 * la session est indisponible, sauf en mode dev sans auth où une adresse de
 * démonstration cohérente est fournie.
 */
export async function currentUserEmail(): Promise<string | null> {
  try {
    const { data } = await auth.getSession();
    const email = data?.user?.email;
    if (typeof email === 'string' && email) return email;
  } catch {
    // Session Neon Auth indisponible.
  }
  if (devAuthDisabled()) return `${process.env.DEMO_USER_ID || 'demo-user'}@demo.local`;
  return null;
}
