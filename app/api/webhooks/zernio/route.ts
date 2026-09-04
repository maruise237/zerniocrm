import { eq } from 'drizzle-orm';
import { db, schema } from '@/lib/db';

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function extractPayload(payload: Record<string, unknown>) {
  const message = (payload.message && typeof payload.message === 'object' ? payload.message : payload.data) as Record<string, unknown> | undefined;
  const conversation = payload.conversation as Record<string, unknown> | undefined;
  const body = stringValue(message?.text) || stringValue(message?.body) || stringValue((message?.content as Record<string, unknown> | undefined)?.text);
  const from = stringValue(message?.from) || stringValue(message?.senderId) || stringValue(conversation?.participantId);
  const to = stringValue(message?.to) || stringValue(message?.recipientId) || stringValue(conversation?.accountId);
  const conversationId = stringValue(conversation?.id) || stringValue(message?.conversationId) || from;
  return { body, from, to, conversationId };
}

export async function POST(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get('token');
    if (!token) return new Response('Token manquant', { status: 400 });
    if (!db) return Response.json({ ok: true, mode: 'local', message: 'Webhook reçu en mode local.' });
    const [config] = await db.select().from(schema.zernioConfig).where(eq(schema.zernioConfig.webhookToken, token)).limit(1);
    if (!config) return new Response('Non autorisé', { status: 401 });
    const payload = await request.json() as Record<string, unknown>;
    if (payload.event !== 'message.received') return Response.json({ ok: true, ignored: true });
    // Déduplication unifiée : l'identifiant du MESSAGE Zernio prime s'il
    // existe, ainsi webhook et synchro à la lecture comptent le même message
    // une seule fois (même espace « zmsg:<id> »).
    const message = (payload.message && typeof payload.message === 'object' ? payload.message : payload.data) as Record<string, unknown> | undefined;
    const messageId = stringValue(message?.id);
    // Espace de déduplication unifié : « zmsg:<id message> » partagé avec la
    // synchro à la lecture ; à défaut, l'id d'événement brut du webhook.
    const eventId = messageId ? `zmsg:${messageId}`.slice(0, 180) : stringValue(payload.id) || null;
    if (eventId) {
      const [duplicate] = await db.select({ id: schema.whatsappMessages.id }).from(schema.whatsappMessages).where(eq(schema.whatsappMessages.externalEventId, eventId)).limit(1);
      if (duplicate) return Response.json({ ok: true, duplicate: true });
    }
    const extracted = extractPayload(payload);
    if (!extracted.body || !extracted.from) return new Response('Payload message invalide', { status: 422 });
    await db.insert(schema.whatsappMessages).values({ userId: config.userId, conversationId: extracted.conversationId, direction: 'INBOUND', fromNumber: extracted.from, toNumber: extracted.to || config.whatsappId || '', body: extracted.body, status: 'DELIVERED', externalEventId: eventId });
    return Response.json({ ok: true });
  } catch (error) {
    console.error('[zernio-webhook]', error);
    return new Response('Erreur interne', { status: 500 });
  }
}
