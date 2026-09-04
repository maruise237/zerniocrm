import { db, schema } from '@/lib/db';
import { requirePermission } from '@/lib/server/workspace';
import { resolveUserKey, zernioFetch } from '@/lib/server/zernio';

export async function POST(request: Request) {
  const gate = await requirePermission('messages.send');
  if (!gate.ok) return gate.response;
  const body = await request.json().catch(() => null) as { to?: unknown; body?: unknown; conversationId?: unknown } | null;
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : to;
  if (!to || !text) return Response.json({ error: 'Destinataire et message obligatoires.' }, { status: 400 });
  // Mode local sans base ni clé serveur : réponse simulée pour le développement.
  if (!db && !process.env.ZERNIO_API_KEY) {
    return Response.json({ id: `local-${Date.now()}`, status: 'SENT', mode: 'local' });
  }
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  const upstream = await zernioFetch('/v1/inbox/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, type: 'text', text: { body: text } }),
  }, resolved.apiKey);
  if (!upstream.ok) return Response.json({ error: 'Zernio a refusé l’envoi.', upstreamStatus: upstream.status }, { status: 502 });
  if (!db) return Response.json({ id: `local-${Date.now()}`, status: 'SENT', mode: 'local' });
  const result = await upstream.json().catch(() => ({})) as { id?: string };
  const [saved] = await db.insert(schema.whatsappMessages).values({ userId: resolved.workspaceOwnerId, conversationId, direction: 'OUTBOUND', fromNumber: resolved.whatsappId || '', toNumber: to, body: text, status: 'SENT', externalEventId: result.id || null }).returning();
  return Response.json(saved, { status: 201 });
}
