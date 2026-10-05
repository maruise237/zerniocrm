// Désabonnement marketing (STOP)
// Meta exige que tout contact puisse refuser les messages promotionnels ; un
// contact qui répond « STOP » et reçoit encore des campagnes finit par
// signaler le numéro, ce qui fait chuter sa note de qualité. Le CRM s'appuie
// sur le champ natif `isSubscribed` des contacts Zernio : ce module ne
// contient que la logique pure (reconnaissance des mots-clés, filtrage des
// destinataires), testable sans réseau.

/** Normalise un message : majuscules, sans accents, sans ponctuation ni espaces superflus. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Le message ENTIER doit correspondre : « stop, j'ai déjà payé » n'est pas
// une demande de désabonnement. Inclut le texte des boutons de réponse
// rapide « Stop » / « Stop promotions » des modèles marketing.
const OPT_OUT_KEYWORDS = new Set([
  'STOP',
  'STOP PROMO',
  'STOP PROMOS',
  'STOP PROMOTION',
  'STOP PROMOTIONS',
  'STOP PUB',
  'ARRET',
  'ARRETER',
  'ARRETEZ',
  'DESABONNER',
  'DESABONNEMENT',
  'DESINSCRIRE',
  'DESINSCRIPTION',
  'UNSUBSCRIBE',
]);

const OPT_IN_KEYWORDS = new Set(['START', 'REPRENDRE', 'ABONNER', 'REABONNER', 'SUBSCRIBE']);

export function isOptOutMessage(text: string | null | undefined): boolean {
  return !!text && OPT_OUT_KEYWORDS.has(normalize(text));
}

export function isOptInMessage(text: string | null | undefined): boolean {
  return !!text && OPT_IN_KEYWORDS.has(normalize(text));
}

export const OPT_OUT_CONFIRMATION =
  'C’est noté : vous ne recevrez plus nos messages promotionnels. Répondez START pour vous réabonner.';
export const OPT_IN_CONFIRMATION =
  'C’est noté : vous recevrez à nouveau nos offres. Répondez STOP à tout moment pour vous désabonner.';

/** Chiffres seuls : « +237 6 99… » et « 237699… » désignent le même numéro. */
export function phoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export interface OptedOutContact {
  id: string;
  platformIdentifier?: string;
  tags?: string[];
}

export interface OptOutIndex {
  ids: Set<string>;
  phones: Set<string>;
  tags: Set<string>;
}

export function buildOptOutIndex(contacts: OptedOutContact[]): OptOutIndex {
  const index: OptOutIndex = { ids: new Set(), phones: new Set(), tags: new Set() };
  for (const c of contacts) {
    if (c.id) index.ids.add(c.id);
    const digits = phoneDigits(c.platformIdentifier);
    if (digits) index.phones.add(digits);
    for (const tag of c.tags ?? []) index.tags.add(tag);
  }
  return index;
}

/** Retire les désabonnés d'une liste de numéros ou d'identifiants de contacts. */
export function excludeOptedOut(
  body: { phones?: unknown; contactIds?: unknown },
  index: OptOutIndex,
): { phones?: string[]; contactIds?: string[]; excluded: number } {
  let excluded = 0;
  const out: { phones?: string[]; contactIds?: string[]; excluded: number } = { excluded: 0 };
  if (Array.isArray(body.phones)) {
    out.phones = body.phones.filter((p): p is string => {
      if (typeof p !== 'string') return false;
      const blocked = index.phones.has(phoneDigits(p));
      if (blocked) excluded += 1;
      return !blocked;
    });
  }
  if (Array.isArray(body.contactIds)) {
    out.contactIds = body.contactIds.filter((id): id is string => {
      if (typeof id !== 'string') return false;
      const blocked = index.ids.has(id);
      if (blocked) excluded += 1;
      return !blocked;
    });
  }
  out.excluded = excluded;
  return out;
}

/** Un segment par tags touche-t-il au moins un désabonné ? */
export function segmentTouchesOptedOut(tags: string[], index: OptOutIndex): boolean {
  return tags.some((t) => index.tags.has(t));
}

/** Complément de message affiché après un ajout de destinataires. */
export function optOutNote(excluded: number | undefined): string {
  if (!excluded) return '';
  return excluded > 1 ? `, ${excluded} désabonnés exclus` : ', 1 désabonné exclu';
}
