import { db, schema } from '@/lib/db';
import { fetchMessageAccounts, readSettings } from '@/lib/server/settings';
import { requirePermission } from '@/lib/server/workspace';
import {
  forwardQuery,
  jsonWithUpstreamHeaders,
  passthrough,
  resolveUserKey,
  zernioFetch,
} from '@/lib/server/zernio';

export async function GET(req: Request) {
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const qs = forwardQuery(req, ['platform', 'accountId', 'status', 'sortOrder', 'limit', 'cursor']);
  const upstream = await zernioFetch(`/v1/inbox/conversations${qs}`, undefined, resolved.apiKey);
  if (!upstream.ok) return passthrough(upstream);

  // With an explicit accountId the caller already scoped the result; otherwise
  // apply the cookie-selected account set server-side.
  if (new URL(req.url).searchParams.has('accountId')) return passthrough(upstream);

  const result = await fetchMessageAccounts({ userId: resolved.userId, apiKey: resolved.apiKey });
  if (result instanceof Response) return result;
  const { selectedAccountIds } = readSettings({
    accounts: result.accounts,
    cookieHeader: req.headers.get('cookie'),
  });
  const selected = new Set(selectedAccountIds);

  const body = (await upstream.json()) as { data?: { accountId?: string }[] };
  const data = (body.data ?? []).filter(
    (c) => typeof c.accountId === 'string' && selected.has(c.accountId),
  );
  // Spread preserves pagination and meta (incl. meta.failedAccounts) as-is.
  return jsonWithUpstreamHeaders({ ...body, data }, upstream);
}

export async function POST(req: Request) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'invalid_field_value' },
      { status: 400 },
    );
  }
  const upstream = await zernioFetch('/v1/inbox/conversations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, resolved.apiKey);
  if (!upstream.ok || !db) return passthrough(upstream);

  // Journalisation locale : la création de conversation
  // porte son premier message (texte ou template campagnes).
  const participant = typeof body.participantId === 'string' ? body.participantId : '';
  const message = typeof body.message === 'string' ? body.message : '';
  if (participant && message) {
    try {
      await db.insert(schema.whatsappMessages).values({
        // Journal attaché au workspace : visible par le propriétaire et les
        // collaborateurs, indépendamment de qui a envoyé le message.
        userId: resolved.workspaceOwnerId,
        conversationId: participant,
        direction: 'OUTBOUND',
        fromNumber: resolved.whatsappId || '',
        toNumber: participant,
        body: message,
        status: 'SENT',
        externalEventId: null,
      });
    } catch {
      // Le journal ne doit jamais bloquer un envoi réussi.
    }
  }
  return passthrough(upstream);
}
