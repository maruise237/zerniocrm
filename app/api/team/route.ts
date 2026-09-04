import { and, eq, isNull } from 'drizzle-orm';
import { auth, currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import {
  databaseUnavailableResponse,
  hasWorkspacePermission,
  resolveWorkspace,
} from '@/lib/server/workspace';

// Lecture de l'équipe du workspace courant. Tous les membres connectés peuvent
// consulter la liste (transparence) ; les actions restent gardées par
// l'autorisation `team.manage` dans les routes d'écriture.

export const dynamic = 'force-dynamic';

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Authentification requise.', code: 'unauthorized' }, { status: 401 });

  if (!db) {
    return Response.json({
      mode: 'local',
      canManage: true,
      isOwner: true,
      self: { role: 'owner', permissions: [], isOwner: true },
      members: [],
      invitations: [],
    });
  }

  try {
    const workspace = await resolveWorkspace(userId);
    const canManage = hasWorkspacePermission(workspace, 'team.manage');

    // Email du propriétaire depuis la session courante (si c'est lui).
    let ownerEmail: string | null = null;
    if (workspace.isOwner) {
      try {
        const { data } = await auth.getSession();
        ownerEmail = data?.user?.email ?? null;
      } catch {
        ownerEmail = null;
      }
    }

    const memberRows = await db
      .select()
      .from(schema.teamMembers)
      .where(eq(schema.teamMembers.ownerUserId, workspace.ownerUserId));

    const pendingInvitations = await db
      .select({
        id: schema.teamInvitations.id,
        email: schema.teamInvitations.email,
        role: schema.teamInvitations.role,
        expiresAt: schema.teamInvitations.expiresAt,
        createdAt: schema.teamInvitations.createdAt,
      })
      .from(schema.teamInvitations)
      .where(
        and(
          eq(schema.teamInvitations.ownerUserId, workspace.ownerUserId),
          isNull(schema.teamInvitations.acceptedAt),
          isNull(schema.teamInvitations.revokedAt),
        ),
      );

    const now = Date.now();

    const members = [
      {
        id: workspace.ownerUserId,
        email: ownerEmail,
        name: null,
        role: 'owner' as const,
        status: 'active' as const,
        isSelf: workspace.isOwner,
        createdAt: null as string | null,
      },
      ...memberRows.map((member) => ({
        id: member.id,
        email: member.email,
        name: member.name,
        role: member.role,
        status: member.status,
        isSelf: member.memberUserId === userId,
        createdAt: member.createdAt.toISOString(),
      })),
    ];

    return Response.json({
      mode: 'ok',
      canManage,
      isOwner: workspace.isOwner,
      self: { role: workspace.role, permissions: workspace.permissions, isOwner: workspace.isOwner },
      members,
      invitations: pendingInvitations
        .map((invitation) => ({
          ...invitation,
          expired: new Date(invitation.expiresAt).getTime() <= now,
        }))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    });
  } catch (err) {
    return databaseUnavailableResponse(err);
  }
}
