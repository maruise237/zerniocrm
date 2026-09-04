import { and, eq, inArray } from 'drizzle-orm';
import { db, schema } from '@/lib/db';
import { requirePermission } from '@/lib/server/workspace';
import { resolveUserKey, zernioFetch } from '@/lib/server/zernio';
import { directSendStats } from '@/lib/campaigns/stats';

type Ctx = { params: Promise<{ broadcastId: string }> };

const FINAL_STATUSES = new Set(['READ', 'FAILED']);
/** Les statuts non finaux sont rafraîchis au plus toutes les 30 s par campagne. */
const REFRESH_TTL_MS = 30_000;
/** Plafond de conversations interrogées par cycle de rafraîchissement. */
const MAX_CONVERSATIONS_PER_REFRESH = 25;

const refreshState = new Map<string, number>();

interface SendRecord {
  phone: string;
  accountId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
  preview?: string | null;
  sentAt?: string | null;
}

function digits(value: string): string {
  return value.replace(/\D/g, '');
}

/** Mappe le deliveryStatus inbox Zernio vers le statut campaign_sends. */
function mapDeliveryStatus(value: string | undefined): string | null {
  switch ((value ?? '').toLowerCase()) {
    case 'sent':
      return 'SENT';
    case 'delivered':
      return 'DELIVERED';
    case 'read':
      return 'READ';
    case 'failed':
      return 'FAILED';
    default:
      return null;
  }
}

interface InboxMessage {
  id?: string;
  message?: string;
  direction?: string;
  createdAt?: string;
  deliveryStatus?: string;
}

/**
 * Rafraîchit les statuts réels des envois directs depuis l'inbox Zernio.
 * Les statuts des messages sortants n'arrivent pas par webhook : Zernio les
 * expose sur les messages de chaque conversation (deliveryStatus). Best-effort
 * et throttlé — ne jamais bloquer la réponse.
 */
async function refreshStatuses(
  broadcastId: string,
  workspaceOwnerId: string,
  apiKey: string,
  rows: (typeof schema.campaignSends.$inferSelect)[],
): Promise<void> {
  const pending = rows.filter((r) => !FINAL_STATUSES.has(r.status));
  if (pending.length === 0) return;

  const last = refreshState.get(`${workspaceOwnerId}:${broadcastId}`);
  if (last && Date.now() - last < REFRESH_TTL_MS) return;
  refreshState.set(`${workspaceOwnerId}:${broadcastId}`, Date.now());

  try {
    // phone → conversationId via la liste des conversations (1 appel par compte).
    const accountIds = [...new Set(pending.map((r) => r.accountId).filter((a): a is string => !!a))];
    const conversationByPhone = new Map<string, string>();
    for (const accountId of accountIds.slice(0, 3)) {
      const res = await zernioFetch(
        `/v1/inbox/conversations?accountId=${encodeURIComponent(accountId)}&limit=100`,
        undefined,
        apiKey,
      );
      if (!res.ok) continue;
      const body = (await res.json().catch(() => null)) as {
        conversations?: { id?: string; participantId?: string }[];
        data?: { id?: string; participantId?: string }[];
      } | null;
      for (const conv of [...(body?.conversations ?? []), ...(body?.data ?? [])]) {
        const participant = conv.participantId ? digits(conv.participantId) : '';
        if (conv.id && participant) conversationByPhone.set(participant, conv.id);
      }
    }

    // Résout les conversations manquantes puis interroge les messages.
    const targets = pending
      .map((row) => ({
        row,
        conversationId: row.conversationId ?? conversationByPhone.get(digits(row.phone)) ?? null,
      }))
      .filter((t): t is { row: typeof t.row; conversationId: string } => !!t.conversationId)
      .slice(0, MAX_CONVERSATIONS_PER_REFRESH);

    for (const { row, conversationId } of targets) {
      const accountId = row.accountId;
      if (!accountId) continue;
      const res = await zernioFetch(
        `/v1/inbox/conversations/${encodeURIComponent(conversationId)}/messages?accountId=${encodeURIComponent(accountId)}&limit=50`,
        undefined,
        apiKey,
      );
      if (!res.ok) continue;
      const body = (await res.json().catch(() => null)) as {
        messages?: InboxMessage[];
        data?: InboxMessage[];
      } | null;
      const messages = [...(body?.messages ?? []), ...(body?.data ?? [])]
        .filter((m) => m.direction === 'outgoing')
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''));

      // Le message de la campagne : par messageId connu, sinon le premier
      // message sortant postérieur à l'envoi dont le texte correspond.
      const sentTime = new Date(row.sentAt).getTime();
      const match =
        (row.messageId && messages.find((m) => m.id === row.messageId)) ||
        messages.find((m) => {
          const at = m.createdAt ? new Date(m.createdAt).getTime() : NaN;
          const after = Number.isNaN(at) || at >= sentTime - 60_000;
          return after && (!row.preview || (m.message ?? '') === row.preview);
        }) ||
        messages.find((m) => {
          const at = m.createdAt ? new Date(m.createdAt).getTime() : NaN;
          return !Number.isNaN(at) && at >= sentTime - 60_000;
        });
      if (!match) continue;

      const status = mapDeliveryStatus(match.deliveryStatus);
      if (!status) continue;
      if (!db) return;
      await db
        .update(schema.campaignSends)
        .set({
          status,
          statusAt: new Date(),
          conversationId: conversationId.slice(0, 160),
          ...(match.id ? { messageId: match.id.slice(0, 200) } : {}),
        })
        .where(eq(schema.campaignSends.id, row.id));
    }
  } catch {
    // Rafraîchissement best-effort : un échec ne masque jamais les données.
  }
}

export async function GET(req: Request, ctx: Ctx) {
  const { broadcastId } = await ctx.params;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  if (!db) return Response.json({ sends: [], stats: directSendStats([]) });

  const rows = await db
    .select()
    .from(schema.campaignSends)
    .where(
      and(eq(schema.campaignSends.userId, resolved.workspaceOwnerId), eq(schema.campaignSends.broadcastId, broadcastId)),
    );

  // Force-refresh possible via ?refresh=1 (l'utilisateur vient d'ouvrir le détail).
  const wantsRefresh = new URL(req.url).searchParams.has('refresh');
  if (wantsRefresh) refreshState.delete(`${resolved.workspaceOwnerId}:${broadcastId}`);
  await refreshStatuses(broadcastId, resolved.workspaceOwnerId, resolved.apiKey, rows);

  const fresh = db
    ? await db
        .select()
        .from(schema.campaignSends)
        .where(
          and(eq(schema.campaignSends.userId, resolved.workspaceOwnerId), eq(schema.campaignSends.broadcastId, broadcastId)),
        )
    : [];
  return Response.json({ sends: fresh, stats: directSendStats(fresh) });
}

export async function POST(req: Request, ctx: Ctx) {
  const { broadcastId } = await ctx.params;
  const gate = await requirePermission('campaigns.manage');
  if (!gate.ok) return gate.response;
  const resolved = await resolveUserKey();
  if (!resolved.ok) return resolved.response;
  if (!db) return Response.json({ error: 'Base de données indisponible.', code: 'db_missing' }, { status: 503 });

  let body: { sends?: SendRecord[] };
  try {
    body = (await req.json()) as { sends?: SendRecord[] };
  } catch {
    return Response.json({ error: 'Corps JSON invalide.', code: 'invalid_field_value' }, { status: 400 });
  }

  const records = (body.sends ?? [])
    .filter((s) => typeof s.phone === 'string' && digits(s.phone).length >= 6)
    .slice(0, 1000)
    .map((s) => {
      const sentAt = s.sentAt ? new Date(s.sentAt) : null;
      return {
        userId: resolved.workspaceOwnerId,
        broadcastId: broadcastId.slice(0, 64),
        phone: digits(s.phone).slice(0, 50),
        ...(s.accountId ? { accountId: s.accountId.slice(0, 64) } : {}),
        ...(s.conversationId ? { conversationId: s.conversationId.slice(0, 160) } : {}),
        ...(s.messageId ? { messageId: s.messageId.slice(0, 200) } : {}),
        ...(s.preview ? { preview: s.preview.slice(0, 4000) } : {}),
        ...(sentAt && !Number.isNaN(sentAt.getTime()) ? { sentAt, statusAt: sentAt } : {}),
      };
    });

  if (records.length > 0) {
    await db
      .insert(schema.campaignSends)
      .values(records)
      .onConflictDoNothing({ target: [schema.campaignSends.broadcastId, schema.campaignSends.phone] });
  }
  refreshState.delete(`${resolved.workspaceOwnerId}:${broadcastId}`);

  const phones = records.map((r) => r.phone);
  const rows =
    phones.length > 0
      ? await db
          .select()
          .from(schema.campaignSends)
          .where(
            and(
              eq(schema.campaignSends.userId, resolved.workspaceOwnerId),
              eq(schema.campaignSends.broadcastId, broadcastId),
              inArray(schema.campaignSends.phone, phones),
            ),
          )
      : [];
  return Response.json({ sends: rows, stats: directSendStats(rows), recorded: records.length });
}
