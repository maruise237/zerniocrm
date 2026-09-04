import { and, eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import {
  databaseUnavailableResponse,
  requirePermission,
} from '@/lib/server/workspace';

// Révocation d'une invitation en attente : le lien magique correspondant
// cesse immédiatement de fonctionner (revokedAt posé, vérifié à l'usage).

export const dynamic = 'force-dynamic';

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
    const [invitation] = await db
      .update(schema.teamInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(schema.teamInvitations.id, id),
          eq(schema.teamInvitations.ownerUserId, workspace.ownerUserId),
        ),
      )
      .returning({ id: schema.teamInvitations.id });

    if (!invitation) {
      return Response.json(
        { error: 'Invitation introuvable ou déjà traitée.', code: 'not_found' },
        { status: 404 },
      );
    }
    return Response.json({ ok: true });
  } catch {
    return databaseUnavailableResponse();
  }
}
