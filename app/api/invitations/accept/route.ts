import { and, eq, isNull } from 'drizzle-orm';
import { currentUserId, currentUserEmail } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import { invalidateUserKeyCache } from '@/lib/server/zernio';
import {
  databaseUnavailableResponse,
  invalidateWorkspaceCache,
} from '@/lib/server/workspace';
import { hashInviteToken } from '@/lib/team/tokens';

// Acceptation d'une invitation par lien magique. La route est publique côté
// proxy (pour que l'utilisateur puisse y accéder juste après connexion) mais
// EXIGE une session valide : on vérifie ensuite que l'email de session
// correspond exactement à l'email visé par l'invitation.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) {
    return Response.json(
      { error: "Connectez-vous d'abord pour accepter cette invitation.", code: 'unauthorized' },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return Response.json({ error: "Lien d'invitation invalide.", code: 'invalid_token' }, { status: 400 });
  }

  if (!db) {
    return Response.json(
      { error: "Les invitations nécessitent une base de données configurée.", code: 'database_required' },
      { status: 409 },
    );
  }

  const sessionEmail = await currentUserEmail();
  if (!sessionEmail) {
    return Response.json(
      { error: "Session invalide : reconnectez-vous puis réessayez.", code: 'unauthorized' },
      { status: 401 },
    );
  }

  let invitation;
  try {
    [invitation] = await db
      .select()
      .from(schema.teamInvitations)
      .where(eq(schema.teamInvitations.tokenHash, hashInviteToken(token)))
      .limit(1);
  } catch {
    // Base injoignable : impossible de distinguer un lien invalide d'une panne.
    return databaseUnavailableResponse();
  }

  const invalid = (error: string, status: 'invalid' | 'revoked' | 'expired' | 'accepted') =>
    Response.json({ error, status }, { status: 410 });

  if (!invitation) return invalid("Ce lien d'invitation est invalide ou a déjà été utilisé.", 'invalid');
  if (invitation.revokedAt) return invalid("Cette invitation a été annulée. Demandez un nouveau lien à l'expéditeur.", 'revoked');
  if (invitation.acceptedAt) return invalid("Cette invitation a déjà été acceptée.", 'accepted');
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return invalid("Ce lien d'invitation a expiré. Demandez un nouveau lien à l'expéditeur.", 'expired');
  }

  // Le lien est nominatif : seule l'adresse visée peut l'accepter.
  if (sessionEmail.trim().toLowerCase() !== invitation.email.trim().toLowerCase()) {
    return Response.json(
      {
        error: `Cette invitation a été envoyée à ${invitation.email}. Connectez-vous avec cette adresse pour l'accepter.`,
        code: 'email_mismatch',
      },
      { status: 403 },
    );
  }

  // Le membre existe déjà (ré-invitation) ? On met à jour son rôle.
  try {
    const [existingMember] = await db
      .select({ id: schema.teamMembers.id })
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.ownerUserId, invitation.ownerUserId),
          eq(schema.teamMembers.memberUserId, userId),
        ),
      )
      .limit(1);

    if (existingMember) {
      await db
        .update(schema.teamMembers)
        .set({
          role: invitation.role,
          permissions: invitation.permissions,
          status: 'active',
          email: invitation.email,
          updatedAt: new Date(),
        })
        .where(eq(schema.teamMembers.id, existingMember.id));
    } else {
      await db.insert(schema.teamMembers).values({
        ownerUserId: invitation.ownerUserId,
        memberUserId: userId,
        email: invitation.email,
        role: invitation.role,
        permissions: invitation.permissions,
        status: 'active',
        invitedByUserId: invitation.invitedByUserId,
      });
    }

    await db
      .update(schema.teamInvitations)
      .set({ acceptedAt: new Date(), acceptedByUserId: userId })
      .where(
        and(
          eq(schema.teamInvitations.id, invitation.id),
          isNull(schema.teamInvitations.acceptedAt),
        ),
      );
  } catch {
    return databaseUnavailableResponse();
  }

  // Droits appliqués immédiatement : caches de workspace et de clé effacés.
  invalidateWorkspaceCache(userId);
  invalidateUserKeyCache(userId);

  return Response.json({ ok: true, ownerUserId: invitation.ownerUserId, role: invitation.role });
}
