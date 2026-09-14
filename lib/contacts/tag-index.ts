import type { ZernioContact } from '@/lib/types';

/**
 * Relier les conversations (participant) aux contacts Zernio (étiquettes).
 * Zernio renvoie les conversations SANS champ tags : la seule façon
 * d'afficher « support-auto » dans la messagerie est de joindre la liste
 * des contacts (platformIdentifier/displayIdentifier) au participant.
 * Module pur : testable, aucune dépendance réseau ni UI.
 */

/**
 * Clé normalisée d'un participant : chiffres seuls pour WhatsApp
 * (« +237 6 58 99 25 88 », « 237658992588 » → « 237658992588 »),
 * handle sans « @ » en minuscules ailleurs.
 */
export function participantKey(
  platform: string | undefined,
  idOrUsername: string | undefined | null,
): string {
  const raw = String(idOrUsername ?? '').trim();
  if (!raw) return '';
  if ((platform ?? '').toLowerCase() === 'whatsapp') return raw.replace(/\D/g, '');
  return raw.replace(/^@/, '').toLowerCase();
}

/**
 * Index clé participant → étiquettes, construit depuis la liste des contacts.
 * Un contact sans étiquette n'entre pas dans l'index. Le premier contact
 * rencontré pour une clé gagne (les doublons Zernio existent).
 */
export function buildTagIndex(contacts: ZernioContact[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const contact of contacts ?? []) {
    const tags = (contact.tags ?? []).filter((t) => typeof t === 'string' && t.trim().length > 0);
    if (tags.length === 0) continue;
    const keys = new Set<string>();
    for (const candidate of [contact.platformIdentifier, contact.displayIdentifier]) {
      const key = participantKey(contact.platform, candidate);
      if (key) keys.add(key);
    }
    for (const key of keys) {
      if (!index.has(key)) index.set(key, tags);
    }
  }
  return index;
}

/** Étiquettes du participant, ou [] si inconnu ou sans étiquette. */
export function tagsForParticipant(
  index: Map<string, string[]>,
  platform: string | undefined,
  participantId: string | undefined | null,
): string[] {
  const key = participantKey(platform, participantId);
  if (!key) return [];
  return index.get(key) ?? [];
}
