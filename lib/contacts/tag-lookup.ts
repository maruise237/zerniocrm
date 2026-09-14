/**
 * Correspondance conversations ↔ contacts pour afficher les étiquettes.
 *
 * POURQUOI : l'agent IA (workflow « Agent client ») ajoute bien les étiquettes
 * côté Zernio (ex. « support-auto » sur le contact), MAIS l'API conversations
 * n'expose jamais de champ tags. La boîte de réception doit donc enrichir
 * chaque conversation avec les tags du contact correspondant, retrouvé par
 * numéro de téléphone.
 *
 * Piège de format : le contact expose `platformIdentifier: "+237658992588"`
 * (E.164 avec « + ») alors que la conversation expose
 * `participantId: "237658992588"` (chiffres seuls). On normalise donc en
 * chiffres seuls, avec repli sur les 9 derniers chiffres (indicatif absent).
 */

export interface TaggedContact {
  id?: string;
  name?: string | null;
  /** E.164 ou presque : "+237658992588". */
  platformIdentifier?: string | null;
  /** Repli : "237658992588". */
  participantId?: string | null;
  tags?: string[] | null;
}

/** Chiffres seuls, sans « + », espaces ni tirets. */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D+/g, '');
}

/** Longueur du suffixe de secours (couvre numéro national sans indicatif). */
const SUFFIX_LENGTH = 9;

/**
 * Index normalisé → étiquettes. Chaque contact est enregistré sous son numéro
 * complet ET sous son suffixe court (sans écraser une entrée complète).
 */
export function buildTagIndex(contacts: TaggedContact[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const add = (key: string, tags: string[]) => {
    if (!key || tags.length === 0) return;
    const existing = index.get(key);
    if (!existing) {
      index.set(key, tags);
      return;
    }
    for (const tag of tags) if (!existing.includes(tag)) existing.push(tag);
  };

  for (const contact of contacts) {
    const tags = [...new Set((contact.tags ?? []).map((t) => t.trim()).filter(Boolean))];
    if (tags.length === 0) continue;
    for (const raw of [contact.platformIdentifier, contact.participantId]) {
      const full = normalizePhone(raw);
      if (!full) continue;
      add(full, tags);
      add(full.slice(-SUFFIX_LENGTH), tags);
    }
  }
  return index;
}

/**
 * Étiquettes du contact rejoint par une conversation. Correspondance exacte
 * sur le numéro complet, puis repli sur les 9 derniers chiffres.
 */
export function lookupTags(
  index: Map<string, string[]>,
  participantId: string | null | undefined,
): string[] {
  const key = normalizePhone(participantId);
  if (!key) return [];
  const exact = index.get(key);
  if (exact) return exact;
  return index.get(key.slice(-SUFFIX_LENGTH)) ?? [];
}
