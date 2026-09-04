import { db, schema } from '@/lib/db';

// ── Journal des messages (alimente /dashboard) ─────────────────────────────
// Le CRM ne crée rien : ce module enregistre fidèlement ce qui passe déjà par
// Zernio (messages consultés dans la boîte de réception, réponses envoyées,
// messages reçus via webhook). Chaque ligne est dédupliquée par l'identifiant
// du message Zernio (external_event_id, index unique) : webhook et synchro à
// la lecture pointent le même message sans jamais le compter deux fois.
// Règle absolue : le journal n'est JAMAIS bloquant — un échec d'écriture ne
// doit pas empêcher un envoi ni masquer une conversation.

/** Forme d'un message tel que renvoyé par l'API inbox Zernio. */
export interface ZernioInboxMessage {
  id?: string;
  conversationId?: string;
  message?: string;
  direction?: string; // 'incoming' | 'outgoing'
  createdAt?: string;
  senderId?: string;
  deliveryStatus?: string; // 'sent' | 'delivered' | 'read' | 'failed' | 'deleted'
}

const STATUS_MAP: Record<string, string> = {
  sent: 'SENT',
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
  deleted: 'DELETED',
};

function toDirection(value: string | undefined): 'INBOUND' | 'OUTBOUND' | null {
  if (value === 'incoming') return 'INBOUND';
  if (value === 'outgoing') return 'OUTBOUND';
  return null;
}

/**
 * Enregistre les messages d'une conversation consultée (GET inbox Zernio).
 * Idempotent : réexécuter sur les mêmes messages n'ajoute aucune ligne.
 */
export async function syncInboxMessages(opts: {
  userId: string;
  conversationId: string;
  whatsappId: string | null;
  messages: ZernioInboxMessage[];
}): Promise<void> {
  if (!db) return;
  const rows = opts.messages
    .map((m) => {
      const direction = toDirection(m.direction);
      if (!direction || !m.id) return null;
      const participant = m.conversationId || opts.conversationId;
      const createdAt = m.createdAt ? new Date(m.createdAt) : null;
      return {
        userId: opts.userId,
        conversationId: participant.slice(0, 160),
        direction,
        fromNumber:
          direction === 'INBOUND'
            ? (m.senderId || participant).slice(0, 50)
            : (opts.whatsappId || '').slice(0, 50),
        toNumber:
          direction === 'INBOUND'
            ? (opts.whatsappId || '').slice(0, 50)
            : participant.slice(0, 50),
        body: (m.message ?? '').slice(0, 10_000),
        status: STATUS_MAP[m.deliveryStatus ?? ''] ?? (direction === 'INBOUND' ? 'DELIVERED' : 'SENT'),
        externalEventId: `zmsg:${m.id}`.slice(0, 180),
        ...(createdAt && !Number.isNaN(createdAt.getTime()) ? { createdAt } : {}),
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (!rows.length) return;
  try {
    await db
      .insert(schema.whatsappMessages)
      .values(rows)
      .onConflictDoNothing({ target: schema.whatsappMessages.externalEventId });
  } catch {
    // Journal jamais bloquant.
  }
}

/**
 * Enregistre un message sortant envoyé depuis le CRM (réponse inbox).
 * Le corps de réponse Zernio peut contenir l'identifiant du message créé —
 * on le réutilise pour la déduplication avec la synchro à la lecture.
 */
export async function journalOutboundMessage(opts: {
  userId: string;
  conversationId: string;
  whatsappId: string | null;
  body: string;
  externalMessageId?: string | null;
}): Promise<void> {
  if (!db) return;
  try {
    await db.insert(schema.whatsappMessages).values({
      userId: opts.userId,
      conversationId: opts.conversationId.slice(0, 160),
      direction: 'OUTBOUND',
      fromNumber: (opts.whatsappId || '').slice(0, 50),
      toNumber: opts.conversationId.slice(0, 50),
      body: opts.body.slice(0, 10_000),
      status: 'SENT',
      externalEventId: opts.externalMessageId ? `zmsg:${opts.externalMessageId}`.slice(0, 180) : null,
    });
  } catch {
    // Journal jamais bloquant (doublon inclus).
  }
}
