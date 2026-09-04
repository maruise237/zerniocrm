import { requirePermission } from '@/lib/server/workspace';
import { journalOutboundMessage, syncInboxMessages, type ZernioInboxMessage } from '@/lib/server/journal';
import {
  forwardMultipart,
  forwardQuery,
  jsonWithUpstreamHeaders,
  passthrough,
  resolveUserKey,
  zernioFetch,
} from '@/lib/server/zernio';

type Ctx = { params: Promise<{ conversationId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { conversationId } = await ctx.params;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const qs = forwardQuery(req, ['accountId', 'limit', 'cursor', 'sortOrder']);
  const upstream = await zernioFetch(
    `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages${qs}`,
    undefined,
    resolved.apiKey,
  );
  if (!upstream.ok) return passthrough(upstream);

  const body = (await upstream.json()) as { data?: ZernioInboxMessage[] };
  // Synchro du journal (alimente /dashboard) : les messages réellement
  // renvoyés par Zernio sont enregistrés, dédupliqués, sans jamais bloquer
  // l'affichage de la conversation.
  await syncInboxMessages({
    userId: resolved.workspaceOwnerId,
    conversationId,
    whatsappId: resolved.whatsappId,
    messages: Array.isArray(body.data) ? body.data : [],
  });
  return jsonWithUpstreamHeaders(body, upstream);
}

export async function POST(req: Request, ctx: Ctx) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  const { conversationId } = await ctx.params;
  const path = `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages`;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const upstream = await forwardMultipart({ req, path });
    // Journal best-effort : le texte envoyé n'est pas toujours connu ici
    // (pièce jointe seule) ; la synchro à la lecture complétera le journal.
    return passthrough(upstream);
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json(
      { error: 'Invalid JSON body', code: 'invalid_field_value' },
      { status: 400 },
    );
  }
  const upstream = await zernioFetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, resolved.apiKey);
  if (!upstream.ok) return passthrough(upstream);

  // Journal de l'envoi : le texte part chez Zernio, on le consigne tel quel.
  const text = typeof body.text === 'string' ? body.text : typeof body.message === 'string' ? body.message : '';
  let sentBody: unknown = { ok: true };
  if (text) {
    let sentId: string | null = null;
    try {
      sentBody = await upstream.json();
      const sent = sentBody as { id?: string; data?: { id?: string } };
      sentId = sent.id ?? sent.data?.id ?? null;
    } catch {
      // Pas de JSON lisible : le journal sera complété à la prochaine lecture.
    }
    await journalOutboundMessage({
      userId: resolved.workspaceOwnerId,
      conversationId,
      whatsappId: resolved.whatsappId,
      body: text,
      externalMessageId: sentId,
    });
  }
  // upstream.json() a éventuellement consommé le corps → reconstruire.
  return jsonWithUpstreamHeaders(sentBody, upstream);
}
