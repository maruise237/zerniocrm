import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { resolveUserKey } from '@/lib/server/zernio';
import { directSendStats } from '@/lib/campaigns/stats';

/**
 * Agrégats de suivi des envois directs, pour plusieurs campagnes d'un coup
 * (utilisé par la liste des campagnes : « N envoyés · N lus » réels sur les
 * campagnes personnalisées que le moteur broadcast Zernio ne suit pas).
 * GET /api/campaign-sends?ids=id1,id2,id3
 */
export async function GET(req: Request) {
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  if (!db) return Response.json({ aggregates: {} });

  const ids = (new URL(req.url).searchParams.get('ids') ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]{1,64}$/.test(id))
    .slice(0, 100);
  if (ids.length === 0) return Response.json({ aggregates: {} });

  const rows = await db
    .select({ broadcastId: schema.campaignSends.broadcastId, status: schema.campaignSends.status })
    .from(schema.campaignSends)
    .where(
      and(eq(schema.campaignSends.userId, resolved.workspaceOwnerId), inArray(schema.campaignSends.broadcastId, ids)),
    );

  const byBroadcast = new Map<string, { status: string }[]>();
  for (const row of rows) {
    const list = byBroadcast.get(row.broadcastId) ?? [];
    list.push({ status: row.status });
    byBroadcast.set(row.broadcastId, list);
  }

  const aggregates: Record<string, ReturnType<typeof directSendStats>> = {};
  for (const [broadcastId, list] of byBroadcast) {
    aggregates[broadcastId] = directSendStats(list);
  }
  return Response.json({ aggregates });
}
