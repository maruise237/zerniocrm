import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { currentUserId } from '@/lib/auth/server';
import { db, schema } from '@/lib/db';
import { invalidateUserKeyCache } from '@/lib/server/zernio';
import { invalidateWorkspaceCache, requirePermission } from '@/lib/server/workspace';

function mask(value: string) {
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}

// Lecture : accessible à tous les membres connectés du workspace (la clé est
// masquée, l'URL de webhook n'est pas sensible). Écriture : réservée à
// `settings.manage` (propriétaire / administrateur).

export async function GET() {
  const userId = await currentUserId();
  if (!userId) return Response.json({ error: 'Authentification requise' }, { status: 401 });
  if (!db) return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=demo_webhook_token`, maskedApiKey: '', configured: false, mode: 'local' });
  const { resolveWorkspace } = await import('@/lib/server/workspace');
  const workspace = await resolveWorkspace(userId);
  const [config] = await db.select().from(schema.zernioConfig).where(eq(schema.zernioConfig.userId, workspace.ownerUserId)).limit(1);
  if (!config) return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=configuration-requise`, maskedApiKey: '', configured: false, canManage: workspace.isOwner });
  return Response.json({ webhookUrl: `${process.env.APP_URL || 'http://localhost:4100'}/api/webhooks/zernio?token=${config.webhookToken}`, maskedApiKey: mask(config.zernioApiKey), configured: true, canManage: workspace.permissions.includes('settings.manage') });
}

export async function PUT(request: Request) {
  const gate = await requirePermission('settings.manage');
  if (!gate.ok) return gate.response;
  const userId = gate.userId;
  const body = await request.json().catch(() => null) as { zernioApiKey?: unknown } | null;
  const key = typeof body?.zernioApiKey === 'string' ? body.zernioApiKey.trim() : '';
  if (!key) return Response.json({ error: 'La clé API Zernio est obligatoire.' }, { status: 400 });
  const webhookToken = randomBytes(24).toString('hex');
  if (!db) return Response.json({ configured: true, mode: 'local', webhookToken });
  const existing = await db.select({ id: schema.zernioConfig.id }).from(schema.zernioConfig).where(eq(schema.zernioConfig.userId, userId)).limit(1);
  if (existing[0]) await db.update(schema.zernioConfig).set({ zernioApiKey: key }).where(eq(schema.zernioConfig.userId, userId));
  else await db.insert(schema.zernioConfig).values({ userId, zernioApiKey: key, webhookToken });
  // La clé vient de changer : purge totale des caches (clé + workspace) pour
  // que le propriétaire ET tous les collaborateurs l'utilisent immédiatement.
  invalidateUserKeyCache();
  invalidateWorkspaceCache();
  return Response.json({ configured: true });
}
