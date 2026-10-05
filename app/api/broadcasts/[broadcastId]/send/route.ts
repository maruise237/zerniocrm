import { passthrough, proxy, resolveUserKey, zernioFetch } from '@/lib/server/zernio';
import { fetchOptOutIndex } from '@/lib/server/opt-out';
import { requirePermission } from '@/lib/server/workspace';
import { phoneDigits } from '@/lib/whatsapp/opt-out';

type Ctx = { params: Promise<{ broadcastId: string }> };

interface RecipientsPage {
  recipients?: { contactId?: string; platformIdentifier?: string }[];
  pagination?: { hasMore?: boolean };
}

/**
 * Envoi immédiat — refusé si un destinataire s'est désabonné (STOP) depuis
 * son ajout : Zernio ne permet pas de retirer un destinataire d'un
 * brouillon, l'utilisateur duplique alors la campagne (la copie exclut les
 * désabonnés).
 */
export async function POST(req: Request, ctx: Ctx) {
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const { broadcastId } = await ctx.params;
  const path = `/v1/broadcasts/${encodeURIComponent(broadcastId)}`;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const index = await fetchOptOutIndex(resolved.apiKey);
  if (!index) {
    return Response.json(
      {
        error: 'Impossible de vérifier la liste des contacts désabonnés. La campagne n’a pas été envoyée ; réessayez dans un instant.',
        code: 'opt_out_check_failed',
      },
      { status: 503 },
    );
  }

  if (index.ids.size > 0 || index.phones.size > 0) {
    let optedOut = 0;
    for (let page = 0; page < 100; page += 1) {
      const res = await zernioFetch(`${path}/recipients?limit=200&skip=${page * 200}`, undefined, resolved.apiKey);
      if (!res.ok) return passthrough(res);
      const body = (await res.json().catch(() => null)) as RecipientsPage | null;
      for (const r of body?.recipients ?? []) {
        if ((r.contactId && index.ids.has(r.contactId)) || index.phones.has(phoneDigits(r.platformIdentifier))) {
          optedOut += 1;
        }
      }
      if (!body?.pagination?.hasMore) break;
    }
    if (optedOut > 0) {
      return Response.json(
        {
          error: `${optedOut} destinataire(s) se sont désabonnés (STOP) depuis leur ajout. Dupliquez la campagne : la copie les exclut automatiquement.`,
          code: 'recipients_opted_out',
        },
        { status: 409 },
      );
    }
  }

  return proxy({ req, path: `${path}/send`, method: 'POST' });
}
