import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

export default async function proxy(req: NextRequest) {
  // Contournement d'authentification pour le développement local uniquement :
  // AUTH_DISABLED=true + NODE_ENV != production. Jamais actif en production.
  if (process.env.NODE_ENV !== 'production' && process.env.AUTH_DISABLED === 'true') {
    return NextResponse.next();
  }
  return auth.middleware({ loginUrl: '/auth/sign-in' })(req);
}

export const config = {
  // `api/invitations` reste public : la page d'acceptation du lien magique
  // doit pouvoir vérifier puis accepter l'invitation juste après connexion.
  matcher: ['/((?!auth(?:/|$)|api/auth|api/invitations|api/webhooks|_next/static|_next/image|favicon.ico|icon\\.svg|apple-icon.*|logo\\.svg).*)'],
};
