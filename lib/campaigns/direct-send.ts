/**
 * Envoi direct d'un template personnalisé, destinataire par destinataire.
 *
 * Zernio n'enregistre PAS template.components / template.variableMapping sur
 * un broadcast (vérifié via GET /v1/broadcasts/{id} : components: []). Le seul
 * chemin fiable pour personnaliser {{1}}, {{2}}… est d'envoyer chaque message
 * comme une ouverture de conversation (POST /v1/inbox/conversations) avec les
 * VRAIES valeurs en templateParams — le même chemin que l'envoi d'un template
 * depuis la boîte de réception.
 */
import { apiFetch, ApiError } from '@/lib/api-client';
import {
  campaignVarsToList,
  fetchBroadcastRecipients,
  markDirectSent,
  renderCampaignBody,
  type CampaignVars,
} from '@/lib/campaigns/personalization';
import type { ZernioBroadcastRecipient } from '@/lib/types';

export interface DirectSendResult {
  sent: number;
  failures: string[];
  total: number;
  /** Nombre d'envois enregistrés pour le suivi (campaign_sends). */
  tracked: number;
}

/** Identifiants éventuellement renvoyés par Zernio à la création de conversation. */
function extractSendIds(body: unknown): { conversationId?: string; messageId?: string } {
  if (!body || typeof body !== 'object') return {};
  const obj = body as Record<string, unknown>;
  const data = (obj.data && typeof obj.data === 'object' ? obj.data : {}) as Record<string, unknown>;
  const conversation = (obj.conversation && typeof obj.conversation === 'object'
    ? obj.conversation
    : {}) as Record<string, unknown>;
  const pick = (...values: unknown[]): string | undefined =>
    values.find((v): v is string => typeof v === 'string' && v.length > 0);
  const conversationId = pick(obj.conversationId, data.conversationId, conversation.id, conversation._id);
  const messageId = pick(obj.messageId, data.messageId, data.id, obj.id, conversation._id);
  return { conversationId, messageId };
}

/**
 * Enregistre les envois côté serveur (campaign_sends) pour que la campagne
 * affiche les VRAIS statuts (envoyé/livr/lu/échec) — Zernio ne suit pas les
 * envois directs via son moteur broadcast, mais connaît chaque message dans
 * l'inbox. Best-effort : un échec d'enregistrement ne remonte jamais à
 * l'envoi lui-même.
 */
async function trackSends(broadcastId: string, accountId: string, sends: SendRecord[]): Promise<number> {
  if (sends.length === 0) return 0;
  try {
    const res = await apiFetch<{ recorded?: number }>(
      `/api/broadcasts/${encodeURIComponent(broadcastId)}/sends`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sends: sends.map((s) => ({
            phone: s.phone,
            accountId,
            ...(s.conversationId ? { conversationId: s.conversationId } : {}),
            ...(s.messageId ? { messageId: s.messageId } : {}),
            ...(s.preview ? { preview: s.preview } : {}),
            sentAt: s.sentAt,
          })),
        }),
      },
    );
    return res.recorded ?? sends.length;
  } catch {
    return 0;
  }
}

interface SendRecord {
  phone: string;
  preview?: string;
  sentAt: string;
  conversationId?: string;
  messageId?: string;
}

async function resolveParams(
  recipient: ZernioBroadcastRecipient,
  cfg: CampaignVars,
  contactCache: Map<string, { email?: string; company?: string }>,
): Promise<string[]> {
  const phone = (recipient.platformIdentifier ?? '').replace(/\D/g, '');
  const values: string[] = [];
  for (const v of campaignVarsToList(cfg)) {
    let value = '';
    if (v.field === 'custom') value = v.custom ?? '';
    else if (v.field === 'phone') value = phone ? `+${phone}` : '';
    else if (v.field === 'name') value = recipient.contactName ?? '';
    else if (v.field === 'email' || v.field === 'company') {
      if (recipient.contactId) {
        if (!contactCache.has(recipient.contactId)) {
          try {
            const detail = await apiFetch<{ contact?: { email?: string; company?: string } }>(
              `/api/contacts/${encodeURIComponent(recipient.contactId)}`,
            );
            contactCache.set(recipient.contactId, {
              email: detail.contact?.email,
              company: detail.contact?.company,
            });
          } catch {
            contactCache.set(recipient.contactId, {});
          }
        }
        const info = contactCache.get(recipient.contactId);
        value = (v.field === 'email' ? info?.email : info?.company) ?? '';
      }
    }
    // Meta refuse un paramètre vide : une espace évite l'erreur 132000.
    values.push(value.trim() ? value : ' ');
  }
  return values;
}

export async function sendPersonalizedCampaign(opts: {
  broadcastId: string;
  accountId: string;
  cfg: CampaignVars;
}): Promise<DirectSendResult> {
  const { broadcastId, accountId, cfg } = opts;
  const allRecipients = await fetchBroadcastRecipients(broadcastId);
  const recipients = allRecipients.filter((r) => r.platformIdentifier);
  const total = recipients.length;

  const contactCache = new Map<string, { email?: string; company?: string }>();
  let sent = 0;
  const failures: string[] = [];
  const tracked: SendRecord[] = [];
  const batchSize = 5;
  for (let i = 0; i < recipients.length; i += batchSize) {
    const batch = recipients.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (recipient) => {
        try {
          const templateParams = await resolveParams(recipient, cfg, contactCache);
          const list = campaignVarsToList(cfg);
          const valuesByPos: Record<number, string> = {};
          list.forEach((v, index) => {
            valuesByPos[v.pos] = templateParams[index] ?? ' ';
          });
          const preview =
            renderCampaignBody(cfg, valuesByPos) || (cfg.bodyText ?? '') || `[template] ${cfg.templateName}`;
          const response = await apiFetch<unknown>('/api/conversations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              accountId,
              participantId: (recipient.platformIdentifier ?? '').replace(/\D/g, ''),
              message: preview,
              templateName: cfg.templateName,
              templateLanguage: cfg.language,
              templateParams,
            }),
          });
          sent += 1;
          const ids = extractSendIds(response);
          tracked.push({
            phone: (recipient.platformIdentifier ?? '').replace(/\D/g, ''),
            preview,
            sentAt: new Date().toISOString(),
            ...(ids.conversationId ? { conversationId: ids.conversationId } : {}),
            ...(ids.messageId ? { messageId: ids.messageId } : {}),
          });
        } catch (err) {
          const detail = err instanceof ApiError && err.message ? ` — ${err.message}` : '';
          failures.push(
            `${recipient.contactName || recipient.platformIdentifier}: ${detail || 'erreur inconnue'}`.slice(0, 500),
          );
        }
      }),
    );
  }

  const trackedCount = await trackSends(broadcastId, accountId, tracked);
  markDirectSent(broadcastId);
  return { sent, failures, total, tracked: trackedCount };
}
