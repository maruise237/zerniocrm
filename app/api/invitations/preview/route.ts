import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { hashInviteToken } from '@/lib/team/tokens';
import { roleLabel } from '@/lib/team/roles';
import { classifyDbError } from '@/lib/server/workspace';

// Route PUBLIQUE (exclue du proxy/middleware) : vérifie un jeton de lien
// magique et renvoie les informations affichables sur la page d'acceptation.
// Aucune donnée sensible : email visé, rôle, expiration et statut seulement.

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as { token?: unknown } | null;
  const token = typeof body?.token === 'string' ? body.token.trim() : '';
  if (!token) {
    return Response.json({ error: "Lien d'invitation invalide.", status: 'invalid', code: 'invalid_token' }, { status: 400 });
  }

  if (!db) {
    return Response.json(
      { error: "Les invitations nécessitent une base de données configurée.", status: 'invalid', code: 'database_required' },
      { status: 409 },
    );
  }

  let invitation;
  try {
    [invitation] = await db
      .select({
        email: schema.teamInvitations.email,
        role: schema.teamInvitations.role,
        invitedByEmail: schema.teamInvitations.invitedByEmail,
        expiresAt: schema.teamInvitations.expiresAt,
        acceptedAt: schema.teamInvitations.acceptedAt,
        revokedAt: schema.teamInvitations.revokedAt,
      })
      .from(schema.teamInvitations)
      .where(eq(schema.teamInvitations.tokenHash, hashInviteToken(token)))
      .limit(1);
  } catch (err) {
    // Distinguer « tables non créées » (migrations à appliquer) d'une base
    // réellement injoignable — sinon le diagnostic est impossible côté prod.
    const reason = err ? classifyDbError(err).reason : 'unreachable';
    return Response.json(
      {
        status: 'invalid',
        code: `db_${reason}`,
        error:
          reason === 'schema_missing'
            ? "La base de données est connectée, mais ses tables n'existent pas encore : les migrations doivent être appliquées une fois sur le projet (commande « npm run db:push » — voir README, section Déploiement)."
            : 'La base de données est momentanément indisponible. Réessayez dans un instant — si le problème persiste, vérifiez la configuration DATABASE_URL.',
      },
      { status: 503 },
    );
  }

  if (!invitation) {
    return Response.json({
      status: 'invalid',
      error: "Ce lien d'invitation est invalide ou a déjà été utilisé.",
    });
  }

  if (invitation.revokedAt) {
    return Response.json({
      status: 'revoked',
      error: "Cette invitation a été annulée. Demandez un nouveau lien à l'expéditeur.",
    });
  }
  if (invitation.acceptedAt) {
    return Response.json({
      status: 'accepted',
      error: "Cette invitation a déjà été acceptée. Vous pouvez vous connecter normalement.",
    });
  }
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) {
    return Response.json({
      status: 'expired',
      error: "Ce lien d'invitation a expiré. Demandez un nouveau lien à l'expéditeur.",
    });
  }

  return Response.json({
    status: 'pending',
    email: invitation.email,
    role: invitation.role,
    roleLabel: roleLabel(invitation.role),
    invitedByEmail: invitation.invitedByEmail,
    expiresAt: invitation.expiresAt,
  });
}
