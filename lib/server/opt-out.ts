import { zernioFetch } from '@/lib/server/zernio';
import { buildOptOutIndex, type OptedOutContact, type OptOutIndex } from '@/lib/whatsapp/opt-out';

// Liste des contacts désabonnés (isSubscribed=false) chez Zernio.
// Lue à chaque ajout de destinataires : la liste est courte et doit être
// fraîche (un contact peut répondre STOP une minute avant une campagne).

const PAGE_SIZE = 100;
const MAX_PAGES = 50;

interface ContactsPage {
  contacts?: OptedOutContact[];
  pagination?: { hasMore?: boolean };
}

/** null = lecture impossible : l'appelant refuse alors l'envoi (fail-closed). */
export async function fetchOptOutIndex(apiKey?: string): Promise<OptOutIndex | null> {
  const contacts: OptedOutContact[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({
      isSubscribed: 'false',
      platform: 'whatsapp',
      limit: String(PAGE_SIZE),
      skip: String(page * PAGE_SIZE),
    });
    const res = await zernioFetch(`/v1/contacts?${qs}`, undefined, apiKey);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as ContactsPage | null;
    if (!body) return null;
    contacts.push(...(body.contacts ?? []));
    if (!body.pagination?.hasMore) break;
  }
  return buildOptOutIndex(contacts);
}

/** Contacts d'un segment (tags) encore abonnés : remplace useSegment quand un désabonné en fait partie. */
export async function fetchSubscribedContactIdsForTags(
  tags: string[],
  apiKey?: string,
): Promise<string[] | null> {
  const ids: string[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const qs = new URLSearchParams({
      tags: tags.join(','),
      isSubscribed: 'true',
      platform: 'whatsapp',
      limit: String(PAGE_SIZE),
      skip: String(page * PAGE_SIZE),
    });
    const res = await zernioFetch(`/v1/contacts?${qs}`, undefined, apiKey);
    if (!res.ok) return null;
    const body = (await res.json().catch(() => null)) as ContactsPage | null;
    if (!body) return null;
    for (const c of body.contacts ?? []) if (c.id) ids.push(c.id);
    if (!body.pagination?.hasMore) break;
  }
  return ids;
}

/** Bascule l'abonnement marketing d'un contact (réponse STOP / START). */
export async function setContactSubscribed(
  contactId: string,
  isSubscribed: boolean,
  apiKey: string,
): Promise<boolean> {
  const res = await zernioFetch(
    `/v1/contacts/${encodeURIComponent(contactId)}`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ isSubscribed }),
    },
    apiKey,
  );
  return res.ok;
}
