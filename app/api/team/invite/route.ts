import { and, eq, isNull } from 'drizzle-orm';
import { auth, currentUserEmail } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import {
  databaseUnavailableResponse,
  requirePermission,
} from '@/lib/server/workspace';
import {
  DEFAULT_EXPIRY_DAYS,
  inviteExpiryDate,
  isValidExpiryDays,
} from '@/lib/team/invite-share';
import {
  isValidRole,
  OWNER_ROLE,
  permissionsForRole,
  roleLabel,
  sanitizePermissions,
} from '@/lib/team/roles';
import { generateInviteToken, hashInviteToken } from '@/lib/team/tokens';

// Création d'un lien magique d'invitation. L'autorisation `team.manage` est
// obligatoire. Le jeton n'est stocké que sous forme d'empreinte SHA-256 : le
// lien complet est renvoyé une seule fois dans la réponse.

export const dynamic = 'force-dynamic';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const gate = await requirePermission('team.manage');
  if (!gate.ok) return gate.response;
  const { userId, workspace } = gate;

  if (!db) {
    return Response.json(
      { error: "La gestion d'équipe nécessite une base de données configurée.", code: 'database_required' },
      { status: 409 },
    );
  }

  const body = await request.json().catch(() => null) as {
    email?: unknown;
    role?: unknown;
    expiresInDays?: unknown;
    permissions?: unknown;
  } | null;

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_PATTERN.test(email)) {
    return Response.json(
      { error: 'Saisissez une adresse email valide.', code: 'invalid_field_value' },
      { status: 400 },
    );
  }

  const role = body?.role;
  if (!isValidRole(role)) {
    return Response.json(
      { error: 'Choisissez un rôle valide pour ce collaborateur.', code: 'invalid_field_value' },
      { status: 400 },
    );
  }

  const expiresInDays = isValidExpiryDays(body?.expiresInDays)
    ? body.expiresInDays
    : DEFAULT_EXPIRY_DAYS;

  // Autorisations : celles du rôle par défaut, ou un ajustement fin validé.
  const rawPermissions = body?.permissions;
  const permissions =
    rawPermissions === undefined ? permissionsForRole(role) : sanitizePermissions(rawPermissions);

  try {
    // Email du propriétaire de l'espace (interdiction de s'inviter soi-même).
    const [ownerConfig] = await db
      .select({ userId: schema.zernioConfig.userId })
      .from(schema.zernioConfig)
      .where(eq(schema.zernioConfig.userId, workspace.ownerUserId))
      .limit(1);
    if (!ownerConfig && !workspace.isOwner) {
      return Response.json(
        { error: "Le propriétaire de cet espace n'est pas identifié : invitation impossible.", code: 'owner_missing' },
        { status: 409 },
      );
    }

    let ownerEmail: string | null = null;
    if (workspace.isOwner) {
      ownerEmail = await currentUserEmail();
    } else {
      try {
        const { data } = await auth.getSession();
        ownerEmail = data?.user?.email ?? null;
      } catch {
        ownerEmail = null;
      }
    }
    if (ownerEmail && ownerEmail.trim().toLowerCase() === email) {
      return Response.json(
        { error: 'Ce compte est déjà le propriétaire de cet espace.', code: 'already_member' },
        { status: 409 },
      );
    }

    // Déjà membre actif avec cet email ?
    const [existingMember] = await db
      .select({ id: schema.teamMembers.id })
      .from(schema.teamMembers)
      .where(and(eq(schema.teamMembers.ownerUserId, workspace.ownerUserId), eq(schema.teamMembers.email, email)))
      .limit(1);
    if (existingMember) {
      return Response.json(
        { error: 'Cette personne fait déjà partie de votre équipe.', code: 'already_member' },
        { status: 409 },
      );
    }

    // Une invitation en attente pour le même email ? On la révoque : renvoyer
    // une invitation remplace l'ancienne (moins de friction, un seul lien actif).
    await db
      .update(schema.teamInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.teamInvitations.ownerUserId, workspace.ownerUserId),
          eq(schema.teamInvitations.email, email),
          isNull(schema.teamInvitations.acceptedAt),
          isNull(schema.teamInvitations.revokedAt),
        ),
      );

    // Email de l'inviteur (affiché dans la page d'acceptation).
    let inviterEmail = await currentUserEmail();
    if (!inviterEmail) {
      try {
        const { data } = await auth.getSession();
        inviterEmail = data?.user?.email ?? null;
      } catch {
        inviterEmail = null;
      }
    }

    const token = generateInviteToken();
    const [invitation] = await db
      .insert(schema.teamInvitations)
      .values({
        ownerUserId: workspace.ownerUserId,
        email,
        role,
        permissions: JSON.stringify(permissions),
        tokenHash: hashInviteToken(token),
        invitedByEmail: inviterEmail,
        invitedByUserId: userId,
        expiresAt: inviteExpiryDate(expiresInDays),
      })
      .returning({ id: schema.teamInvitations.id, expiresAt: schema.teamInvitations.expiresAt });

    // Lien absolu : APP_URL si fournie, sinon l'origine de la requête.
    const appUrl = (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, '');
    const inviteUrl = `${appUrl}/auth/invite/${token}`;

    return Response.json({
      invitation: {
        id: invitation.id,
        email,
        role,
        roleLabel: roleLabel(role),
        permissions,
        expiresAt: invitation.expiresAt,
      },
      inviterRole: workspace.isOwner ? OWNER_ROLE : workspace.role,
      inviteUrl,
    });
  } catch (err) {
    return databaseUnavailableResponse(err);
  }
}
