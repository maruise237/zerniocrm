import { eq } from 'drizzle-orm';
import { currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';

export async function POST(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Authentification requise' }, { status: 401 });
  const body = await request.json().catch(() => null) as { to?: unknown; body?: unknown; conversationId?: unknown } | null;
  const to = typeof body?.to === 'string' ? body.to.trim() : '';
  const text = typeof body?.body === 'string' ? body.body.trim() : '';
  const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : to;
  if (!to || !text) return Response.json({ error: 'Destinataire et message obligatoires.' }, { status: 400 });
  if (!db) return Response.json({ id: `local-${Date.now()}`, status: 'SENT', mode: 'local' });
  const [config] = await db.select().from(schema.zernioConfig).where(eq(schema.zernioConfig.userId, userId)).limit(1);
  if (!config) return Response.json({ error: 'Configurez d’abord votre clé API Zernio.' }, { status: 409 });
  const upstream = await fetch(`${process.env.ZERNIO_API_URL || 'https://zernio.com/api'}/v1/inbox/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.zernioApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, type: 'text', text: { body: text } }),
    cache: 'no-store',
  });
  if (!upstream.ok) return Response.json({ error: 'Zernio a refusé l’envoi.', upstreamStatus: upstream.status }, { status: 502 });
  const result = await upstream.json().catch(() => ({})) as { id?: string };
  const [saved] = await db.insert(schema.whatsappMessages).values({ userId, conversationId, direction: 'OUTBOUND', fromNumber: config.whatsappId || '', toNumber: to, body: text, status: 'SENT', externalEventId: result.id || null }).returning();
  return Response.json(saved, { status: 201 });
}
