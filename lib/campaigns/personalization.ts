/**
 * Campaign personalization persistence + duplication/relaunch helpers.
 *
 * Zernio does not return a broadcast's variableMapping, so the variables
 * configured at creation are persisted locally (per campaign id) and reused
 * by the direct per-recipient send engine and by duplication/relaunch.
 */
import { apiFetch } from '@/lib/api-client';
import type { ZernioBroadcast, ZernioBroadcastRecipient } from '@/lib/types';

export interface CampaignVars {
  templateName: string;
  language: string;
  vars: { pos: number; field: string; custom?: string }[];
}

const VARS_KEY = (id: string) => `crm-campaign-vars:${id}`;
const DIRECT_SENT_KEY = (id: string) => `crm-campaign-direct-sent:${id}`;

export function saveCampaignVars(broadcastId: string, cfg: CampaignVars): void {
  try {
    window.localStorage.setItem(VARS_KEY(broadcastId), JSON.stringify(cfg));
  } catch {
    // stockage indisponible
  }
}

export function loadCampaignVars(broadcastId: string): CampaignVars | null {
  try {
    const raw = window.localStorage.getItem(VARS_KEY(broadcastId));
    return raw ? (JSON.parse(raw) as CampaignVars) : null;
  } catch {
    return null;
  }
}

export function campaignHasVars(broadcastId: string): boolean {
  return (loadCampaignVars(broadcastId)?.vars.length ?? 0) > 0;
}

export function markDirectSent(broadcastId: string): void {
  try {
    window.localStorage.setItem(DIRECT_SENT_KEY(broadcastId), '1');
  } catch {
    // ignore
  }
}

export function wasDirectSent(broadcastId: string): boolean {
  try {
    return window.localStorage.getItem(DIRECT_SENT_KEY(broadcastId)) === '1';
  } catch {
    return false;
  }
}

// ─── Campagnes masquées localement ─────────────────────────────────────────
// Zernio ne supprime que les brouillons. Une campagne envoyée/échouée peut
// être « supprimée » de la liste en la masquant localement (elle reste dans
// l'historique Zernio).
const HIDDEN_KEY = 'crm-campaign-hidden';

export function loadHiddenCampaignIds(): string[] {
  try {
    const raw = window.localStorage.getItem(HIDDEN_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function hideCampaign(broadcastId: string): void {
  try {
    const next = [...new Set([...loadHiddenCampaignIds(), broadcastId])];
    window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function isCampaignHidden(broadcastId: string): boolean {
  return loadHiddenCampaignIds().includes(broadcastId);
}

/**
 * Récupère TOUS les destinataires d'une campagne, en paginant par lots de
 * 200 (Zernio refuse un limit supérieur : « Too big: expected number to
 * be <=200 »).
 */
export async function fetchBroadcastRecipients(
  broadcastId: string,
  cap = 1000,
): Promise<ZernioBroadcastRecipient[]> {
  const out: ZernioBroadcastRecipient[] = [];
  let skip = 0;
  let total = Infinity;
  while (out.length < cap && out.length < total) {
    const page = await apiFetch<{
      recipients?: ZernioBroadcastRecipient[];
      pagination?: { total?: number };
    }>(`/api/broadcasts/${encodeURIComponent(broadcastId)}/recipients?limit=200&skip=${skip}`);
    const rows = page.recipients ?? [];
    if (rows.length === 0) break;
    out.push(...rows);
    total = page.pagination?.total ?? out.length;
    skip += rows.length;
    if (rows.length < 200) break;
  }
  return out.slice(0, cap);
}

export interface DuplicateOptions {
  original: ZernioBroadcast;
  profileId: string;
  /** Suffix added to the copied name, e.g. " (copie)" or " (relance)". */
  suffix: string;
  /** Copy recipients from the original (by contact id when possible). */
  copyRecipients: boolean;
}

/** Duplicate a broadcast into a new DRAFT (template, tags, recipients, vars). */
export async function duplicateBroadcast(opts: DuplicateOptions): Promise<ZernioBroadcast> {
  const { original, profileId, suffix } = opts;
  const name = `${original.name}${suffix}`;

  const template = original.template?.name
    ? {
        name: original.template.name,
        ...(original.template.language ? { language: original.template.language } : {}),
      }
    : undefined;

  const created = await apiFetch<{ broadcast?: ZernioBroadcast }>('/api/broadcasts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      profileId,
      accountId: original.accountId,
      platform: 'whatsapp',
      name,
      ...(original.description ? { description: original.description } : {}),
      ...(template ? { template } : {}),
      ...(original.segmentFilters?.tags?.length
        ? { segmentFilters: { tags: original.segmentFilters.tags } }
        : {}),
    }),
  });
  const copy = created.broadcast;
  if (!copy?.id) throw new Error('copy-failed');

  // Reprend la personnalisation locale de l'original, si elle existe.
  const varsCfg = loadCampaignVars(original.id);
  if (varsCfg) saveCampaignVars(copy.id, varsCfg);

  if (opts.copyRecipients) {
    const recipients = await fetchBroadcastRecipients(original.id);
    const contactIds = [...new Set(recipients.map((r) => r.contactId).filter((c): c is string => !!c))];
    const phones = [
      ...new Set(
        recipients
          .map((r) => r.platformIdentifier)
          .filter((p): p is string => !!p)
          .map((p) => (p.startsWith('+') ? p : `+${p}`)),
      ),
    ];
    if (contactIds.length > 0) {
      await apiFetch(`/api/broadcasts/${encodeURIComponent(copy.id)}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds }),
      });
    } else if (phones.length > 0) {
      await apiFetch(`/api/broadcasts/${encodeURIComponent(copy.id)}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phones }),
      });
    }
  }

  return copy;
}
