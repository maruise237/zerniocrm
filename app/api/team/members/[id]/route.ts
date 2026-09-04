import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { invalidateUserKeyCache } from '@/lib/server/zernio';
import {
  databaseUnavailableResponse,
  invalidateWorkspaceCache,
  requirePermission,
} from '@/lib/server/workspace';
import { isValidRole, permissionsForRole, sanitizePermissions } from '@/lib/team/roles';

// Gestion d'un membre existant : changement de rôle / autorisations / statut
// (PATCH) ou retrait du workspace (DELETE). L'autorisation `team.manage` est
// obligatoire et un responsable ne peut pas se modifier lui-même (évite les
// blocages accidentels).

export const dynamic = 'force-dynamic';

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('team.manage');
  if (!gate.ok) return gate.response;
  const { userId, workspace } = gate;

  if (!db) {
    return Response.json(
      { error: "La gestion d'équipe nécessite une base de données configurée.", code: 'database_required' },
      { status: 409 },
    );
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null) as {
    role?: unknown;
    permissions?: unknown;
    status?: unknown;
  } | null;

  try {
    const [member] = await db
      .select()
      .from(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.id, id),
          eq(schema.teamMembers.ownerUserId, workspace.ownerUserId),
        ),
      )
      .limit(1);
    if (!member) {
      return Response.json({ error: 'Membre introuvable.', code: 'not_found' }, { status: 404 });
    }
    if (member.memberUserId === userId) {
      return Response.json(
        { error: 'Vous ne pouvez pas modifier votre propre rôle. Demandez au propriétaire.', code: 'self_update_forbidden' },
        { status: 409 },
      );
    }

    const updates: Partial<typeof schema.teamMembers.$inferInsert> = { updatedAt: new Date() };

    if (body?.role !== undefined) {
      if (!isValidRole(body.role)) {
        return Response.json(
          { error: 'Rôle invalide.', code: 'invalid_field_value' },
          { status: 400 },
        );
      }
      updates.role = body.role;
      // Le rôle redéfinit les autorisations par défaut, sauf ajustement explicite.
      updates.permissions =
        body?.permissions === undefined
          ? JSON.stringify(permissionsForRole(body.role))
          : JSON.stringify(sanitizePermissions(body.permissions));
    } else if (body?.permissions !== undefined) {
      updates.permissions = JSON.stringify(sanitizePermissions(body.permissions));
    }

    if (body?.status !== undefined) {
      if (body.status !== 'active' && body.status !== 'suspended') {
        return Response.json(
          { error: 'Statut invalide : « active » ou « suspended ».', code: 'invalid_field_value' },
          { status: 400 },
        );
      }
      updates.status = body.status;
    }

    const [updated] = await db
      .update(schema.teamMembers)
      .set(updates)
      .where(eq(schema.teamMembers.id, member.id))
      .returning({ id: schema.teamMembers.id, role: schema.teamMembers.role, status: schema.teamMembers.status });

    // Le membre voit ses droits appliqués immédiatement (caches effacés).
    invalidateWorkspaceCache(member.memberUserId);
    invalidateUserKeyCache(member.memberUserId);

    return Response.json({ ok: true, member: updated });
  } catch {
    return databaseUnavailableResponse();
  }
}

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requirePermission('team.manage');
  if (!gate.ok) return gate.response;
  const { workspace } = gate;

  if (!db) {
    return Response.json(
      { error: "La gestion d'équipe nécessite une base de données configurée.", code: 'database_required' },
      { status: 409 },
    );
  }

  const { id } = await ctx.params;

  try {
    const [member] = await db
      .delete(schema.teamMembers)
      .where(
        and(
          eq(schema.teamMembers.id, id),
          eq(schema.teamMembers.ownerUserId, workspace.ownerUserId),
        ),
      )
      .returning({ id: schema.teamMembers.id, memberUserId: schema.teamMembers.memberUserId });

    if (!member) {
      return Response.json({ error: 'Membre introuvable.', code: 'not_found' }, { status: 404 });
    }

    invalidateWorkspaceCache(member.memberUserId);
    invalidateUserKeyCache(member.memberUserId);

    return Response.json({ ok: true });
  } catch {
    return databaseUnavailableResponse();
  }
}
