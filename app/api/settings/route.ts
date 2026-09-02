import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Authentification requise' }, { status: 401 });
  if (!db) return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=demo_webhook_token`, maskedApiKey: '', configured: false, mode: 'local' });
  const [config] = await db.select().from(schema.zernioConfig).where(eq(schema.zernioConfig.userId, userId)).limit(1);
  if (!config) return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=configuration-requise`, maskedApiKey: '', configured: false });
  return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=${config.webhookToken}`, maskedApiKey: mask(config.zernioApiKey), configured: true });
}

export async function PUT(request: Request) {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Authentification requise' }, { status: 401 });
  const body = await request.json().catch(() => null) as { zernioApiKey?: unknown } | null;
  const key = typeof body?.zernioApiKey === 'string' ? body.zernioApiKey.trim() : '';
  if (!key) return Response.json({ error: 'La clé API Zernio est obligatoire.' }, { status: 400 });
  const webhookToken = randomBytes(24).toString('hex');
  if (!db) return Response.json({ configured: true, mode: 'local', webhookToken });
  const existing = await db.select({ id: schema.zernioConfig.id }).from(schema.zernioConfig).where(eq(schema.zernioConfig.userId, userId)).limit(1);
  if (existing[0]) await db.update(schema.zernioConfig).set({ zernioApiKey: key }).where(eq(schema.zernioConfig.userId, userId));
  else await db.insert(schema.zernioConfig).values({ userId, zernioApiKey: key, webhookToken });
  return Response.json({ configured: true });
}
