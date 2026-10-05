import { jsonWithUpstreamHeaders, passthrough, proxy, resolveUserKey, zernioFetch } from '@/lib/server/zernio';
import { fetchOptOutIndex, fetchSubscribedContactIdsForTags } from '@/lib/server/opt-out';
import { requirePermission } from '@/lib/server/workspace';
import { excludeOptedOut, segmentTouchesOptedOut } from '@/lib/whatsapp/opt-out';

type Ctx = { params: Promise<{ broadcastId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { broadcastId } = await ctx.params;
  return proxy({
    req,
    path: `/v1/broadcasts/${encodeURIComponent(broadcastId)}/recipients`,
    query: ['status', 'limit', 'skip'],
  });
}

const optOutUnavailable = () =>
  Response.json(
    {
      error:
        'Impossible de vérifier la liste des contacts désabonnés. Aucun destinataire n’a été ajouté ; réessayez dans un instant.',
      code: 'opt_out_check_failed',
    },
    { status: 503 },
  );

/**
 * Ajout de destinataires — les contacts désabonnés (réponse STOP,
 * isSubscribed=false) sont retirés côté serveur, quel que soit le chemin
 * d'ajout (numéros, fichier, contacts, segment). Fail-closed : si la liste
 * des désabonnés est illisible, rien n'est ajouté.
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const { broadcastId } = await ctx.params;
  const path = `/v1/broadcasts/${encodeURIComponent(broadcastId)}/recipients`;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: 'Invalid JSON body', code: 'invalid_field_value' }, { status: 400 });
  }

  const index = await fetchOptOutIndex(resolved.apiKey);
  if (!index) return optOutUnavailable();

  let excluded = 0;
  let forward: Record<string, unknown>;
  if (body.useSegment === true) {
    // Segment par tags résolu par Zernio : on ne le remplace que s'il
    // contient au moins un désabonné, par la liste des contacts abonnés.
    const detail = await zernioFetch(`/v1/broadcasts/${encodeURIComponent(broadcastId)}`, undefined, resolved.apiKey);
    if (!detail.ok) return passthrough(detail);
    const parsed = (await detail.json().catch(() => null)) as
      | { broadcast?: { segmentFilters?: { tags?: string[] } } }
      | null;
    const tags = (parsed?.broadcast?.segmentFilters?.tags ?? []).filter(Boolean);
    if (tags.length > 0 && segmentTouchesOptedOut(tags, index)) {
      const ids = await fetchSubscribedContactIdsForTags(tags, resolved.apiKey);
      if (!ids) return optOutUnavailable();
      const safe = excludeOptedOut({ contactIds: ids }, index);
      if (!safe.contactIds?.length) return Response.json({ added: 0, skipped: 0, excludedOptOut: safe.excluded });
      forward = { contactIds: safe.contactIds };
      excluded = safe.excluded;
    } else {
      forward = body;
    }
  } else {
    const safe = excludeOptedOut(body, index);
    excluded = safe.excluded;
    forward = { ...body };
    if (safe.phones) forward.phones = safe.phones;
    if (safe.contactIds) forward.contactIds = safe.contactIds;
    const remaining = (safe.phones?.length ?? 0) + (safe.contactIds?.length ?? 0);
    if (remaining === 0 && excluded > 0) {
      return Response.json({ added: 0, skipped: 0, excludedOptOut: excluded });
    }
  }

  const upstream = await zernioFetch(
    path,
    { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(forward) },
    resolved.apiKey,
  );
  if (!upstream.ok) return passthrough(upstream);
  const result = (await upstream.json().catch(() => ({}))) as Record<string, unknown>;
  return jsonWithUpstreamHeaders({ ...result, excludedOptOut: excluded }, upstream);
}
