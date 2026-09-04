/**
 * Statistiques de suivi des campagnes, calculées côté client à partir des
 * données réelles Zernio.
 *
 * Pourquoi ce module existe : les compteurs agrégés de l'objet broadcast
 * Zernio (sentCount, deliveredCount…) sont incomplets — un destinataire « lu »
 * y est compté uniquement dans readCount, pas dans sentCount/deliveredCount
 * (constaté en production : sent=0, delivered=0, read=1 pour un message lu).
 * On recalcule donc des totaux CUMULATIFS depuis les lignes de destinataires,
 * qui portent les horodatages officiels (sentAt, deliveredAt, readAt) et le
 * statut final. Même logique pour les envois directs personnalisés suivis
 * dans campaign_sends (SENT/DELIVERED/READ/FAILED).
 */

/** Ligne de destinataire native Zernio (champs de suivi utilisés). */
export interface NativeTrackingRow {
  status?: string | null; // pending | sent | delivered | read | failed
  sentAt?: string | null;
  deliveredAt?: string | null;
  readAt?: string | null;
}

/** Ligne d'envoi direct enregistrée (campaign_sends). */
export interface DirectTrackingRow {
  status?: string | null; // SENT | DELIVERED | READ | FAILED
}

export interface CampaignTrackingStats {
  total: number;
  /** Messages remis au canal d'envoi (envoyés). */
  sent: number;
  /** Envoyés ET arrivés sur le téléphone du destinataire. */
  delivered: number;
  /** Livrés ET lus. */
  read: number;
  failed: number;
  pending: number;
}

const isSet = (value?: string | null): boolean => !!value;

export function cumulativeStats(rows: NativeTrackingRow[]): CampaignTrackingStats {
  const total = rows.length;
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  let pending = 0;
  for (const row of rows) {
    const status = (row.status ?? '').toLowerCase();
    if (status === 'failed') {
      failed += 1;
      continue;
    }
    const wasSent = isSet(row.sentAt) || status === 'sent' || status === 'delivered' || status === 'read';
    const wasDelivered = isSet(row.deliveredAt) || status === 'delivered' || status === 'read';
    const wasRead = isSet(row.readAt) || status === 'read';
    if (wasRead) read += 1;
    if (wasDelivered) delivered += 1;
    if (wasSent) sent += 1;
    if (!wasSent) pending += 1;
  }
  return { total, sent, delivered, read, failed, pending };
}

export function directSendStats(rows: DirectTrackingRow[]): CampaignTrackingStats {
  const total = rows.length;
  let sent = 0;
  let delivered = 0;
  let read = 0;
  let failed = 0;
  for (const row of rows) {
    const status = (row.status ?? '').toUpperCase();
    if (status === 'FAILED') failed += 1;
    else sent += 1;
    if (status === 'DELIVERED' || status === 'READ') delivered += 1;
    if (status === 'READ') read += 1;
  }
  return { total, sent, delivered, read, failed, pending: total - sent - failed };
}

/**
 * Raison d'échec dominante d'une campagne (champs officiels Zernio :
 * error / errorCode sur les destinataires). Sert au bandeau du détail :
 * « pourquoi cette campagne a échoué » au lieu d'un « échec » muet.
 */
export function dominantFailure(
  rows: { status?: string | null; error?: string | null; errorCode?: number | null }[],
): string | null {
  const reasons = new Map<string, number>();
  for (const row of rows) {
    if ((row.status ?? '').toLowerCase() !== 'failed') continue;
    const text = (row.error ?? '').trim();
    if (!text) continue;
    const key = row.errorCode ? `${text} (erreur ${row.errorCode})` : text;
    reasons.set(key, (reasons.get(key) ?? 0) + 1);
  }
  let best: { key: string; count: number } | null = null;
  for (const [key, count] of reasons) {
    if (!best || count > best.count) best = { key, count };
  }
  return best ? `${best.key} — ${best.count} destinataire${best.count > 1 ? 's' : ''}` : null;
}
